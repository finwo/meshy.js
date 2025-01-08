// TODO: properly type this thing
type HexString = string;

function isHexString(subject: unknown, length?: number): subject is HexString {
  if ('string' !== typeof subject) return false;
  if ('number' === typeof length && subject.length !== length) return false;
  return !subject.match(/[^0-9a-zA-Z]/);
}

function randomHexString(length = 64) {
  let output = '';
  while(output.length < length) output += Math.random().toString(16).slice(2);
  return output.slice(0, length);
}

export class Meshy {
  identifier: HexString;

  constructor(nodeId?: string) {

    // Ensure nodeId = 32-byte/64-char hex string
    // Uses given or self-generated
    nodeId = nodeId || randomHexString(64);
    if (!isHexString(nodeId, 64)) {
      throw new TypeError(`nodeId must be a 32-byte hex string, ${typeof nodeId} given`);
    }

    this.identifier = nodeId;
  }

}

export default Meshy;

console.log(new Meshy());
