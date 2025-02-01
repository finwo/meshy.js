import { isPacketConnection, isStreamConnection, PacketConnection, StreamConnection } from 'stream-packetize';

type MeshyOptions = {
  mdpInterval: number,
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
  services: {
    port    : number,
    path    : Buffer,
    expires : bigint,
    protocol: number,
    value   : Buffer,
  }[],
}>();

function num_to_ui16be(value: bigint | number) {
  const output = Buffer.alloc(2);
  output.writeUint16BE(Number(value));
  return output;
}
function num_to_ui64be(value: bigint | number) {
  const output = Buffer.alloc(8);
  output.writeBigInt64BE(BigInt(value))
  return output;
}

export class Meshy {
  private opts: MeshyOptions;
  private mdpInterval: NodeJS.Timeout;

  constructor(options?: Partial<MeshyOptions>) {

    // Mix in default options
    this.opts = Object.assign({
      mdpInterval: 1e3,
    }, options);

    // Ensure a context for truly private data exists
    privateData.set(this, {
      connections: [],
      handlers: [],
      services: [],
    });
    const ctx = privateData.get(this);

    // MDP sender + housekeeping
    this.mdpInterval = setInterval(() => {

      // Handle service expiry
      const now    = BigInt(Date.now());
      ctx.services = ctx.services.filter(service => {
        if (service.port === 0) return true; // Self-declared
        return service.expires >= now;
      });

      let   payload = Buffer.alloc(0);
      const path       = Buffer.from([0]);
      const returnPath = Buffer.from([0]);
      const protocol   = 0x0100;
      for(const service of ctx.services) {
        const expires = service.port ? service.expires : now + service.expires;
        if (expires < now) continue;
        const record = Buffer.concat([
          num_to_ui16be(1),                          // MDP version 1
          num_to_ui16be(service.protocol),           // Service protocol
          num_to_ui64be(expires),                    // Expiry timestamp
          Buffer.from([service.port]), service.path, // Service path
          num_to_ui16be(service.value.length),       // Value length
          service.value,                             // Value itself
        ]);
        payload = Buffer.concat([
          payload,
          num_to_ui16be(record.length),
          record,
        ]);
      }
      for(const neighbour of ctx.connections) {
        this.sendMessage(
          neighbour.port,
          path,
          returnPath,
          protocol,
          payload,
        );
      }
      console.log(payload.toString('hex'));
    }, this.opts.mdpInterval);

    // MDP receiver
    ctx.handlers.push({
      protocol: 0x0100,
      fn: async (_: Buffer, port: number, payload: Buffer) => {
        while(payload.length) {

          // Shift the whole entry from the payload, so we can skip
          const entryLength = payload.readUint16BE(0);
          if (!entryLength) break; // 0 = end of list
          let entry = payload.subarray(2, entryLength + 2);
          payload = payload.subarray(entryLength + 2);

          // Check entry compatibility
          const version = entry.readUint16BE(0);
          if (version !== 1) continue; // unsupported
          entry = entry.subarray(2);

          // Extract data
          const protocol = entry.readUint16BE(0);
          const expires  = entry.readBigInt64BE(2);
          const path     = Buffer.concat([
            entry.subarray(10, entry.indexOf(0, 10) + 1)
          ]);
          entry = entry.subarray(path.length + 10);
          const valueLength = entry.readUint16BE(0);
          const value       = entry.subarray(2, 2 + valueLength);

          // Received expired entry = skip
          if (expires < BigInt(Date.now())) continue;

          // Check if we already know the service
          const found = ctx.services.find(service => {
            if (service.protocol !== protocol) return false;
            if (Buffer.compare(service.value, value)) return false;
            return true;
          });

          // Skip if we ourselves host the service
          // Reason: expires = duration, not timestamp
          if (found && (found.port === 0)) continue;

          if (found && (
            ((found.expires > expires) && (found.path.length  > path.length)) ||
            ((found.expires < expires) && (found.path.length >= path.length))
          )) {
            // Update if shorter path or newer record from same distance
            found.expires = expires;
            found.path    = path;
            found.port    = port;
          } else if (!found) {
            // Or insert if new
            ctx.services.push({
              port,
              path,
              expires,
              protocol,
              value,
            });
          }
        }
        return true;
      },
    });

  }

  // Note: targetpath is original, returnpath is already been prepended
  private async _handleMessage(message: { returnPath: Buffer, port: number, protocol: number, payload: Buffer }) {
    const ctx = privateData.get(this);
    // TODO: message is for us, do stuff
    const handlers = ctx.handlers.filter(entry => entry.protocol == message.protocol);
    for(const handler of handlers) {
      // return falsy = done, return truthy = pass to next handler
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

  // TODO: something to remove this declaration
  declareService(protocol: number, value: Buffer, expiry: bigint | number = 60e3) {
    const ctx  = privateData.get(this);
    ctx.services.push({
      port    : 0,
      path    : Buffer.alloc(0),
      expires : BigInt(expiry),
      protocol: protocol,
      value   : value,
    });
  }

  /**
   * @param   {StreamConnection|PacketConnection|WebSocket} connection - The connection to manage using meshy
   * @returns {Error|false} False on success, an error upon failure
   */
  addConnection(connection: StreamConnection | PacketConnection | WebSocket): Error|false {
    if (isStreamConnection(connection)) connection = new PacketConnection(connection);
    if (!(isPacketConnection(connection)) || (connection instanceof WebSocket)) {
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

    function onMessage(handler) {
      if (isPacketConnection(connection)) return connection.on('message', handler);
      if (connection instanceof WebSocket) return connection.onmessage(handler);
    }
    function onClose(handler) {
      if (isPacketConnection(connection)) return connection.on('close', handler);
      if (connection instanceof WebSocket) return connection.onclose(handler);
    }

    // Handle incoming packets
    onMessage((message: string|Buffer) => {
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
    onClose(() => {
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
