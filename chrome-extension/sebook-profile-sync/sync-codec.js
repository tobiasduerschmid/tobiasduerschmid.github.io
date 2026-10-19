/**
 * Gzip plus base64 framing for chrome.storage.sync.
 * Sync values must be JSON, and each stored item is capped at 8 kilobytes.
 */

import {
  LIMITS,
  META_KEY,
  chunkKey,
  chunkString,
  nextMeta,
  packedBytes,
  payloadCompatibility,
  stableStringifyRecords,
  maxChunkChars,
  syncItemBytes,
} from './sync-model.js';
import { RESOURCE_LIMITS, validateSyncRecords } from './sync-validation.js';

export async function encodeSyncPayload(records, metaFields) {
  try {
    validateSyncRecords(records);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { ok: false, totalBytes: Infinity, chunks: [] };
  }
  const json = stableStringifyRecords(records);
  const expanded = new TextEncoder().encode(json);
  if (expanded.byteLength > RESOURCE_LIMITS.maxExpandedBytes) return { ok: false, totalBytes: Infinity, chunks: [] };
  const compressed = await gzipBytes(expanded);
  const chunked = chunkString(bytesToBase64(compressed));
  const meta = nextMeta(metaFields.previousMeta, {
    revision: metaFields.revision,
    chunks: chunked.chunks.length,
    omittedCount: metaFields.omittedCount,
    updatedAt: metaFields.updatedAt,
    expandedBytes: expanded.byteLength,
  });
  return {
    meta,
    chunks: chunked.chunks,
    totalBytes: packedBytes(meta, chunked.chunks),
    ok: !chunked.truncated && syncItemBytes(META_KEY, meta) <= LIMITS.bytesPerItem,
    truncated: chunked.truncated,
  };
}

export async function decodeSyncPayload(stored) {
  const meta = stored[META_KEY];
  if (!meta) return null;
  if (!Number.isSafeInteger(meta.chunks) || meta.chunks < 0 || meta.chunks >= LIMITS.maxItems) {
    throw new RangeError('Invalid profile chunk count.');
  }
  if (meta.expandedBytes != null && (!Number.isSafeInteger(meta.expandedBytes)
    || meta.expandedBytes < 0 || meta.expandedBytes > RESOURCE_LIMITS.maxExpandedBytes)) {
    throw new RangeError('Invalid expanded profile size.');
  }
  const compatibility = payloadCompatibility(meta);
  if (compatibility === 'unreadable') return null;
  const payload = joinChunkValues(stored, meta);
  if (!payload) {
    if (meta.expandedBytes) throw new RangeError('Expanded profile size mismatch.');
    return { records: {}, meta, newer: compatibility === 'newer' };
  }
  const json = await gunzipText(base64ToBytes(payload), meta.expandedBytes);
  const records = JSON.parse(json);
  validateSyncRecords(records);
  return { records, meta, newer: compatibility === 'newer' };
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

function joinChunkValues(stored, meta) {
  let bytes = syncItemBytes(META_KEY, meta);
  if (bytes > LIMITS.bytesPerItem) throw new RangeError('Profile metadata exceeds the item limit.');
  const chunks = [];
  for (let index = 0; index < meta.chunks; index += 1) {
    const chunk = stored[chunkKey(index)];
    if (typeof chunk !== 'string' || !chunk.length || chunk.length > maxChunkChars(index)) {
      throw new RangeError('Missing or oversized profile chunk.');
    }
    bytes += syncItemBytes(chunkKey(index), chunk);
    if (bytes > LIMITS.quotaBytes) throw new RangeError('Profile payload exceeds the sync limit.');
    chunks.push(chunk);
  }
  return chunks.join('');
}

async function gzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipText(bytes, declaredSize) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let json = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > RESOURCE_LIMITS.maxExpandedBytes || (declaredSize != null && total > declaredSize)) {
        throw new RangeError('Profile exceeds the expanded byte limit or declared size.');
      }
      json += decoder.decode(value, { stream: true });
    }
    if (declaredSize != null && total !== declaredSize) throw new RangeError('Expanded profile size mismatch.');
    return json + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
