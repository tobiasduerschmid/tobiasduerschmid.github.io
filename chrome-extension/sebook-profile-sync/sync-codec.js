/**
 * Gzip plus base64 framing for chrome.storage.sync.
 * Sync values must be JSON, and each stored item is capped at 8 kilobytes.
 */

import {
  META_KEY,
  chunkKey,
  chunkString,
  nextMeta,
  packedBytes,
  payloadCompatibility,
  stableStringifyRecords,
} from './sync-model.js';

export async function encodeSyncPayload(records, metaFields) {
  const json = stableStringifyRecords(records);
  const compressed = await gzipBytes(new TextEncoder().encode(json));
  const chunked = chunkString(bytesToBase64(compressed));
  const meta = nextMeta(metaFields.previousMeta, {
    revision: metaFields.revision,
    chunks: chunked.chunks.length,
    omittedCount: metaFields.omittedCount,
    updatedAt: metaFields.updatedAt,
  });
  return {
    meta,
    chunks: chunked.chunks,
    totalBytes: packedBytes(meta, chunked.chunks),
    ok: !chunked.truncated,
    truncated: chunked.truncated,
  };
}

export async function decodeSyncPayload(stored) {
  const meta = stored[META_KEY];
  const compatibility = payloadCompatibility(meta);
  if (compatibility === 'unreadable') return null;
  const payload = joinChunkValues(stored, meta.chunks);
  if (!payload) return { records: {}, meta, newer: compatibility === 'newer' };
  const json = new TextDecoder().decode(await gunzipBytes(base64ToBytes(payload)));
  return { records: JSON.parse(json), meta, newer: compatibility === 'newer' };
}

export function bytesToBase64(bytes) {
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

export function base64ToBytes(payload) {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function joinChunkValues(stored, count) {
  let payload = '';
  for (let index = 0; index < count; index += 1) payload += stored[chunkKey(index)] || '';
  return payload;
}

async function gzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
