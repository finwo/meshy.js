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

  // Note: targetpath is original, returnpath is already been prepended
  private _handleMessage(message: { returnPath: Buffer, payload: Buffer }) {
    const ctx = privateData.get(this);
    // TODO: message is for us, do stuff
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
    while(ctx.connections.find(entry => entry.port === port)) {
      port++;
    }

    // Handle incoming packets
    connection.on('message', (message: string|Buffer) => {
      if ('string' === typeof message) message = Buffer.from(message);

      // Extract paths, pre-emptively prefix returnPath
      const targetPath = message.subarray(0, message.indexOf(0) + 1);
      const returnPath = Buffer.concat([Buffer.from([port]),message.subarray(targetPath.length, message.indexOf(0, targetPath.length) + 1)]);
      const payload    = message.subarray(targetPath.length + returnPath.length - 1);

      // Handle messages for us, process the thing
      if (targetPath[0] == 0) {
        return this._handleMessage({ returnPath, payload });
      }

      // Forward packet if not for us
      const neighbour = ctx.connections.find(entry => entry.port == targetPath[0]);
      if (!neighbour) return; // Discard packet if target missing
      neighbour.connection.send(Buffer.concat([
        targetPath.subarray(1),
        returnPath,
        payload,
      ]));
    });

    // Handle closures
    // TODO: do anything special?
    connection.on('close', () => {
      ctx.connections = ctx.connections.filter(entry => entry.port !== port);
    });

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
