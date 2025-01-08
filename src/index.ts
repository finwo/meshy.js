import { HexString, isHexString, randomHexString } from "./hexstring";

type MeshyEventHandler = (chunk: string|Buffer) => any;

export type MeshyCompatibleConnection = {
  on: (eventName: 'data' | 'close', handler: MeshyEventHandler) => any,
  write: (chunk: string|Buffer) => any,
  end: () => any,
}

const privateData = new WeakMap<object, {
  connections: MeshyCompatibleConnection[],
}>();

export class Meshy {
  identifier: HexString<64>;

  constructor(nodeId?: string) {

    // Ensure nodeId = 32-byte/64-char hex string
    // Uses given or self-generated
    nodeId = nodeId || randomHexString(64);
    if (!isHexString(nodeId, 64)) {
      throw new TypeError(`nodeId must be a 32-byte hex string, ${typeof nodeId} given`);
    }
    this.identifier = nodeId;

    privateData.set(this, {
      connections: [],
    });

  }



}

export default Meshy;

console.log(new Meshy());
