import { PacketConnection, StreamConnection } from 'stream-packetize';

// const privateData = new WeakMap<object, {
//   connections: {
//     connection: PacketConnection,
//     identifier?: HexString<64>,
//   }[],
// }>();

export enum RoutingMode {
  ADDRESS, // Static packets, nodes hold a routing table
};

export type MeshyOptions = {
  routingMode: RoutingMode,
};

export class Meshy {
  // identifier: Buffer;

  constructor(options?: Partial<MeshyOptions>) {

    const opts: MeshyOptions = Object.assign({
      routingMode: RoutingMode.ADDRESS,
    }, options || {});

    switch(opts.routingMode) {
      case RoutingMode.ADDRESS:
        // Supported
        break;
      default:
        throw new Error(`Routing mode '${opts.routingMode}' not supported`);
    }

    // // Ensure we have a node id
    // if (!nodeId) {
    //   nodeId = Buffer.from(Buffer.alloc(6).map(() => Math.floor(Math.random()*256)));
    // }

    // // And convert it's type if needed
    // if ('string' === typeof nodeId) {
    //   nodeId = Buffer.from(nodeId, 'hex');
    // }

    // this.identifier = nodeId;


    // Ensure nodeId = 32-byte/64-char hex string
    // Uses given or self-generated

    // nodeId = nodeId || randomHexString(8);
    // if (!isHexString(nodeId, 8)) {
    //   throw new TypeError(`nodeId must be a 4-byte hex string, ${typeof nodeId} given`);
    // }
    // this.identifier = nodeId;

    // privateData.set(this, {
    //   connections: [],
    // });

  }

  addConnection(connection: StreamConnection) {
    // const ctx = privateData.get(this);
    // ctx.connections.push({
    //   connection: new PacketConnection(connection),
    // });
  }

  broadcast(message: Buffer) {

  }

  unicast(message: Buffer, recipient: Buffer) {

  }



}

export default Meshy;

console.log(new Meshy());

// let msg = Buffer.from('\xDE\xAD\xBE\xEF\0\0', 'ascii');
// let crc = crc16(msg);
// console.log({msg,crc});
// msg.writeUint16BE(crc,msg.length - 2);
// console.log({msg,crc:crc16(msg)});
