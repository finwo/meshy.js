export function num_to_ui16be(value: bigint | number) {
  const output = Buffer.alloc(2);
  output.writeUint16BE(Number(value));
  return output;
}

export function num_to_ui64be(value: bigint | number) {
  const output = Buffer.alloc(8);
  output.writeBigInt64BE(BigInt(value))
  return output;
}

