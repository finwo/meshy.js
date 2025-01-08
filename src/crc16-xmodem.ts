// See https://crccalc.com/

// Main configuration
// Note: we do not support RefIn or RefOut
const polynomial = 0x1021;
const init       = 0x0000;
const xorout     = 0x0000;

// Pre-calculate reference table
// Allows us to process byte-for-byte instead of bit-for-bit
const crcTable = [];
for(let i=0 ; i < 256 ; i++) {
  let virt = (i << 16);
  for(let s = 7 ; s >= 0 ; s--)
    if (virt & (0x10000 << s)) virt ^= (0x10000|polynomial) << s;
  crcTable[i] = virt + (i << 16); // Re-mix in i, to clear higher bits during calculation
}

export function crc16(subject: Buffer): number {
  let result = init;
  for(let i = 0 ; i < subject.length ; i++) {
    result  = ((result << 8) + subject[i]) ^ crcTable[result >> 8];
  }
  return result ^ xorout;
}

export function crc16b(subject: Buffer): Buffer {
  const result = Buffer.alloc(2);
  result.writeUInt16BE(crc16(subject));
  return result;
}
