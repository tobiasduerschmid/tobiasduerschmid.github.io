const fs = require('node:fs');
const path = require('node:path');

// Only authored inputs that can contribute to emitted browser pages. Test,
// instruction, documentation, and third-party text must never count as a
// candidate implementation of an accessibility criterion.
const SOURCE_DIRECTORIES = {
  SEBook: ['.html', '.md'],
  _blog: ['.html', '.md'],
  _data: ['.json', '.yaml', '.yml'],
  _includes: ['.html'],
  _layouts: ['.html'],
  _posts: ['.html', '.md'],
  _sass: ['.scss'],
  blog: ['.html', '.md'],
  css: ['.css', '.scss'],
  js: ['.js'],
  writingguide: ['.html', '.md'],
};
const EXCLUDED_SOURCE_DIRECTORIES = new Set(['vendor', 'node_modules', '.git']);
const ROOT_SOURCE_EXTENSIONS = new Set(['.html', '.js']);

function collectAuthoredSourceFiles(root) {
  const files = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && ROOT_SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.join(root, entry.name));
    }
  }

  function visit(dir, extensions) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDED_SOURCE_DIRECTORIES.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full, extensions);
      else if (entry.isFile() && extensions.has(path.extname(entry.name))) files.push(full);
    }
  }

  for (const [name, extensions] of Object.entries(SOURCE_DIRECTORIES)) {
    visit(path.join(root, name), new Set(extensions));
  }
  return files.sort();
}

function findSourceCandidates(patterns, files, root, limit = 40) {
  const needles = patterns.map((pattern) => pattern.toLowerCase());
  const matches = [];
  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      const matchIndex = needles.findIndex((needle) => line.toLowerCase().includes(needle));
      if (matchIndex < 0) continue;
      matches.push({
        file: relativePath,
        line: index + 1,
        pattern: patterns[matchIndex],
        excerpt: line.trim().slice(0, 220),
      });
      if (matches.length >= limit) return matches;
    }
  }
  return matches;
}

module.exports = { collectAuthoredSourceFiles, findSourceCandidates, SOURCE_DIRECTORIES };
