/**
 * Minimal WAV parsing + programmatic generation (CREATOR-006).
 *
 * Used to validate audio duration for the over-long guard and to generate
 * license-safe test fixtures (no binary audio fixtures in the repo).
 */

/** Parse the duration (seconds) of a PCM WAV from its header, if recognizable. */
export function parseWavDuration(buffer: Buffer): number | undefined {
  if (buffer.length < 44) return undefined;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return undefined;
  if (buffer.toString("ascii", 8, 12) !== "WAVE") return undefined;
  const byteRate = buffer.readUInt32LE(28);
  if (byteRate <= 0) return undefined;
  const dataSize = buffer.readUInt32LE(40);
  if (dataSize <= 0) return undefined;
  return dataSize / byteRate;
}

/**
 * Generate a short PCM mono 8-bit WAV tone of the given length.
 * License-safe synthetic fixture (no copyrighted audio).
 */
export function generateToneWav(seconds: number, sampleRate = 8000): Buffer {
  const dataSize = Math.floor(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate, 28); // byte rate (1 byte/sample)
  buffer.writeUInt16LE(1, 32); // block align
  buffer.writeUInt16LE(8, 34); // bits per sample
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  // 8-bit PCM tone (silence-ish amplitude oscillation)
  for (let i = 0; i < dataSize; i++) {
    buffer[44 + i] = 128 + Math.round(24 * Math.sin((i / sampleRate) * 2 * Math.PI * 220));
  }
  return buffer;
}
