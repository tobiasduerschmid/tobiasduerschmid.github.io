const fs = require('node:fs');
const { promises: fsPromises } = fs;
const http = require('node:http');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');

const LOOPBACK_HOST = '127.0.0.1';

const CONTENT_TYPES = Object.freeze({
  '.avif': 'image/avif',
  '.bin': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.eot': 'application/vnd.ms-fontobject',
  '.gif': 'image/gif',
  '.gz': 'application/gzip',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
  '.zip': 'application/zip',
});

class RequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function isWithinDirectory(directory, candidate) {
  const relativePath = path.relative(directory, candidate);
  return relativePath === '' || (
    relativePath !== '..'
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath)
  );
}

function resolveRequestedPath(siteRoot, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch (error) {
    throw new RequestError(400, 'Malformed request URL.');
  }

  if (pathname.includes('\0')) {
    throw new RequestError(400, 'Malformed request URL.');
  }

  const relativePath = pathname.replace(/^[/\\]+/, '');
  const requestedPath = path.resolve(siteRoot, relativePath);
  if (!isWithinDirectory(siteRoot, requestedPath)) {
    throw new RequestError(403, 'Path is outside the built site.');
  }

  return { pathname, requestedPath };
}

function candidatePaths({ pathname, requestedPath }) {
  if (pathname.endsWith('/')) {
    return [path.join(requestedPath, 'index.html')];
  }

  const candidates = [requestedPath];
  if (path.extname(requestedPath) === '') {
    candidates.push(`${requestedPath}.html`, path.join(requestedPath, 'index.html'));
  }
  return candidates;
}

async function findSiteFile(siteRoot, requestUrl) {
  const resolvedRequest = resolveRequestedPath(siteRoot, requestUrl);

  for (const candidate of candidatePaths(resolvedRequest)) {
    let realPath;
    try {
      realPath = await fsPromises.realpath(candidate);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
      throw error;
    }

    if (!isWithinDirectory(siteRoot, realPath)) {
      throw new RequestError(403, 'Path is outside the built site.');
    }

    const fileStat = await fsPromises.stat(realPath);
    if (fileStat.isFile()) return { path: realPath, stat: fileStat };
  }

  return null;
}

function sendTextResponse(request, response, statusCode, message, extraHeaders = {}) {
  const body = Buffer.from(`${message}\n`, 'utf8');
  response.writeHead(statusCode, {
    'Content-Length': body.length,
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

async function serveSiteRequest(siteRoot, request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendTextResponse(request, response, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  const siteFile = await findSiteFile(siteRoot, request.url || '/');
  if (!siteFile) {
    sendTextResponse(request, response, 404, 'Not Found');
    return;
  }

  response.writeHead(200, {
    'Content-Length': siteFile.stat.size,
    'Content-Type': CONTENT_TYPES[path.extname(siteFile.path).toLowerCase()] || 'application/octet-stream',
    'Last-Modified': siteFile.stat.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  await pipeline(fs.createReadStream(siteFile.path), response);
}

async function resolveSiteRoot(rootDirectory) {
  const configuredRoot = path.resolve(rootDirectory);
  let siteRoot;
  let siteStat;
  try {
    siteRoot = await fsPromises.realpath(configuredRoot);
    siteStat = await fsPromises.stat(siteRoot);
  } catch (error) {
    throw new Error(
      `Built site directory is unavailable at ${configuredRoot}. Run make build before generating PDFs.`,
      { cause: error },
    );
  }

  if (!siteStat.isDirectory()) {
    throw new Error(
      `Built site path is not a directory: ${configuredRoot}. Run make build before generating PDFs.`,
    );
  }
  return siteRoot;
}

/**
 * Starts a loopback-only HTTP server for a completed static-site build.
 * The returned close operation is idempotent and terminates keep-alive sockets.
 */
async function startLocalSiteServer({ rootDirectory } = {}) {
  if (!rootDirectory) {
    throw new Error('A built site directory is required.');
  }

  const siteRoot = await resolveSiteRoot(rootDirectory);
  const sockets = new Set();
  const server = http.createServer((request, response) => {
    serveSiteRequest(siteRoot, request, response).catch(error => {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      const statusCode = error instanceof RequestError ? error.statusCode : 500;
      const message = error instanceof RequestError ? error.message : 'Internal Server Error';
      sendTextResponse(request, response, statusCode, message);
    });
  });

  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  await new Promise((resolve, reject) => {
    const rejectStartup = error => reject(error);
    server.once('error', rejectStartup);
    server.listen(0, LOOPBACK_HOST, () => {
      server.off('error', rejectStartup);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not determine the local site server address.');
  }

  let closePromise;
  return {
    baseUrl: `http://${LOOPBACK_HOST}:${address.port}`,
    close() {
      if (closePromise) return closePromise;

      closePromise = new Promise((resolve, reject) => {
        server.close(error => {
          if (error) reject(error);
          else resolve();
        });
        for (const socket of sockets) socket.destroy();
      });
      return closePromise;
    },
  };
}

module.exports = { startLocalSiteServer };
