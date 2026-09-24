import "server-only";

function crc32(input: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}

function u32(value: number) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

function bytes(text: string) {
  return new TextEncoder().encode(text);
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

type ZipEntry = { name: string; data: Buffer };

/**
 * Minimal ZIP writer using the ZIP "stored" method. Keeping this dependency-free
 * avoids shipping a browser archive library to the client. Photos are already
 * JPEG/WebP assets, so compression would add CPU cost with little size benefit.
 */
export function createStoredZip(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = bytes(entry.name);
    const data = new Uint8Array(entry.data);
    const crc = crc32(data);
    const local = concat([
      bytes("PK\x03\x04"),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.byteLength),
      u32(data.byteLength),
      u16(name.byteLength),
      u16(0),
      name,
      data,
    ]);
    localParts.push(local);

    centralParts.push(concat([
      bytes("PK\x01\x02"),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.byteLength),
      u32(data.byteLength),
      u16(name.byteLength),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]));

    offset += local.byteLength;
  }

  const centralDirectory = concat(centralParts);
  const localData = concat(localParts);
  const end = concat([
    bytes("PK\x05\x06"),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDirectory.byteLength),
    u32(localData.byteLength),
    u16(0),
  ]);

  return Buffer.from(concat([localData, centralDirectory, end]));
}
