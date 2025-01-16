import { isPacketConnection, isStreamConnection, PacketConnection, StreamConnection } from 'stream-packetize';

type MeshyOptions = {

};

const privateData = new WeakMap<object, {
  connections: {
    port      : number,
    connection: PacketConnection | WebSocket,
  }[],
}>();

export class Meshy {
  private opts: MeshyOptions;

  constructor(options?: Partial<MeshyOptions>) {

    // Mix in default options
    this.opts = Object.assign({
    }, options);

    // Ensure a context for truly private data exists
    privateData.set(this, {
      connections: [],
    });

  }

  /**
   * @param   {StreamConnection|PacketConnection} connection - The connection to manage using meshy
   * @returns {Error|false} False on success, an error upon failure
   */
  addConnection(connection: StreamConnection | PacketConnection): Error|false {
    if (isStreamConnection(connection)) connection = new PacketConnection(connection);

    // @ts-ignore THIS IS THE LINE THAT CHECKS IT, SHUT UP
    if (!(isPacketConnection(connection) || (connection instanceof WebSocket))) {
      return new Error(`Given incompatible connection`);
    }

    // Check if we can manage another connection
    const ctx  = privateData.get(this);
    if (ctx.connections.length >= 255) {
      return new Error(`Connection pool full`);
    }

    // Reserve a unique port number
    // TODO: optimize?
    let port = 1;
    while(ctx.connections.find(entry => entry.port == port)) {
      port++;
    }

    // And actually store the thing
    ctx.connections.push({
      port,
      connection,
    });

    return false;
  }

}

export default Meshy;

console.log(new Meshy());
