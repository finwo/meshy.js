import { HexString, isHexString, randomHexString } from "./hexstring";
import { crc16 } from './crc16-xmodem';
import { MeshyStreamConnection } from './types';
import {MeshyPacketConnection} from "./packetize";

const privateData = new WeakMap<object, {
  connections: {
    connection: MeshyPacketConnection,
    identifier?: HexString<64>,
  }[],
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

  addConnection(connection: MeshyStreamConnection) {
    const ctx = privateData.get(this);
    ctx.connections.push({
      connection: new MeshyPacketConnection(connection),
    });
  }



}

export default Meshy;

console.log(new Meshy());

let msg = Buffer.from('\xDE\xAD\xBE\xEF\0\0', 'ascii');
let crc = crc16(msg);
console.log({msg,crc});
msg.writeUint16BE(crc,msg.length - 2);
console.log({msg,crc:crc16(msg)});
