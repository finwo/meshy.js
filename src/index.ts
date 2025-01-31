import { isPacketConnection, isStreamConnection, PacketConnection, StreamConnection } from 'stream-packetize';

type MeshyOptions = {

};

export type MeshyHandlerFn = (path:Buffer, port:number, payload:Buffer) => Promise<any>;

const privateData = new WeakMap<object, {
  connections: {
    port      : number,
    connection: PacketConnection | WebSocket,
  }[],
  handlers: {
    protocol: number,
    fn      : MeshyHandlerFn,
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
      handlers: [],
    });

  }

  // Note: targetpath is original, returnpath is already been prepended
  private async _handleMessage(message: { returnPath: Buffer, port: number, protocol: number, payload: Buffer }) {
    const ctx = privateData.get(this);
    // TODO: message is for us, do stuff
    const handlers = ctx.handlers.filter(entry => entry.protocol == message.protocol);
    for(const handler of handlers) {
      const done = !(await handler.fn(message.returnPath, message.port, message.payload));
      if (done) break;
    }
    // If a message has no handler, we don't support it
    // We don't care about unsupported messages, so we drop them silently
  }

  async sendMessage(port: number, path: Buffer, returnPath: Buffer, protocol: number, payload: Buffer): Promise<boolean> {
    if (path[path.length - 1] !== 0) return false;
    const ctx       = privateData.get(this);
    const neighbour = ctx.connections.find(entry => entry.port == port);
    if (!neighbour) return false;
    neighbour.connection.send(Buffer.concat([
      path,
      returnPath,
      Buffer.from([ (protocol >> 8) % 256, protocol % 256 ]),
      payload,
    ]));
    return true;
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

      // Split paths and payload
      const targetPath = message.subarray(0, message.indexOf(0) + 1);
      const returnPath = message.subarray(targetPath.length, message.indexOf(0, targetPath.length) + 1);
      const payload    = message.subarray(targetPath.length + returnPath.length);

      // Handle messages for us, process the thing
      if (targetPath[0] == 0) {
        return this._handleMessage({
          returnPath,
          port,
          protocol: payload.readUint16BE(0),
          payload : payload.subarray(2)
        });
      }

      // Forward packet if not for us
      const neighbour = ctx.connections.find(entry => entry.port == targetPath[0]);
      if (!neighbour) return; // Discard packet if target missing
      neighbour.connection.send(Buffer.concat([
        targetPath.subarray(1),
        Buffer.from([port]),
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
