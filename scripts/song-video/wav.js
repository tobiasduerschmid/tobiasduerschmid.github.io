/**
 * Minimal WAV reading and writing for the song-video render: PCM 16-bit or
 * 32-bit float in, PCM 16-bit out, channels as Float32Arrays in [-1, 1].
 */
'use strict';

const fs = require('node:fs');

const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;
const FORMAT_EXTENSIBLE = 0xfffe;

/** Reads a WAV file into { sampleRate, channels }. */
function readWav(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${filePath} is not a WAV file.`);
  }
  let format = null;
  let offset = 12;
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      let tag = data.readUInt16LE(body);
      if (tag === FORMAT_EXTENSIBLE) tag = data.readUInt16LE(body + 24);
      format = {
        tag,
        channelCount: data.readUInt16LE(body + 2),
        sampleRate: data.readUInt32LE(body + 4),
        bits: data.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (!format) throw new Error(`${filePath}: data chunk before fmt chunk.`);
      return { sampleRate: format.sampleRate, channels: decodeSamples(data, body, size, format, filePath) };
    }
    offset = body + size + (size % 2);
  }
  throw new Error(`${filePath} has no data chunk.`);
}

function decodeSamples(data, start, size, { tag, channelCount, bits }, filePath) {
  const bytes = bits / 8;
  const frames = Math.floor(size / (bytes * channelCount));
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channelCount; c++) {
      const at = start + (i * channelCount + c) * bytes;
      if (tag === FORMAT_PCM && bits === 16) channels[c][i] = data.readInt16LE(at) / 32768;
      else if (tag === FORMAT_FLOAT && bits === 32) channels[c][i] = data.readFloatLE(at);
      else throw new Error(`${filePath}: unsupported WAV format ${tag}/${bits}-bit.`);
    }
  }
  return channels;
}

/** Writes { sampleRate, channels } as 16-bit PCM. */
function writeWav(filePath, { sampleRate, channels }) {
  const frames = channels[0].length;
  const blockAlign = channels.length * 2;
  const out = Buffer.alloc(44 + frames * blockAlign);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + frames * blockAlign, 4);
  out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(FORMAT_PCM, 20);
  out.writeUInt16LE(channels.length, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * blockAlign, 28);
  out.writeUInt16LE(blockAlign, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(frames * blockAlign, 40);
  for (let i = 0; i < frames; i++) {
    channels.forEach((channel, c) => {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      out.writeInt16LE(Math.round(sample * 32767), 44 + i * blockAlign + c * 2);
    });
  }
  fs.writeFileSync(filePath, out);
}

module.exports = { readWav, writeWav };
