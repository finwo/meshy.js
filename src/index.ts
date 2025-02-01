import { isPacketConnection, isStreamConnection, PacketConnection, StreamConnection } from 'stream-packetize';
import {num_to_ui16be, num_to_ui64be} from './numbers';

export type MeshyProtocolHandlerFn = (meshy: Meshy, path:Buffer, payload:Buffer) => Promise<any>;

export interface MeshyProtocolHandler {
  protocol: number;
  locators: { expiry: bigint, value: Buffer }[];
  onmessage: MeshyProtocolHandlerFn;
  onclose: (meshy:Meshy) => Promise<any>;
};

export type MeshyOptions = {
  mdp: false | MDPOptions;
};

export type MDPOptions = {
  interval: number;
};

const privateData = new WeakMap<object, {
  connections: {
    port      : number,
    path      : Buffer,
    connection: PacketConnection | WebSocket,
  }[],
  handlers: MeshyProtocolHandler[],
  locators: {
    path    : Buffer,
    expires : bigint,
    protocol: number,
    value   : Buffer,
  }[],
}>();

export class MeshyDiscoveryProtocolHandler implements MeshyProtocolHandler {
  interval: NodeJS.Timeout;
  protocol: number = 0x0800;
  locators: { expiry: bigint, value: Buffer }[] = [];
  constructor(meshy: Meshy, private options: MDPOptions) {
    // Share privateData
    const ctx = privateData.get(meshy);
    // MDP sender + housekeeping
    this.interval = setInterval(() => {
      // Handle locator expiry
      const now = BigInt(Date.now());
      ctx.locators = ctx.locators.filter(locator => locator.expires >= now);

      // Pre-build payload
      const local = Buffer.from([0]);
      let payload = Buffer.alloc(0);

      // Append local locators
      for(const handler of ctx.handlers) {
        for(const locator of handler.locators) {
          const record = Buffer.concat([
            num_to_ui16be(1),                    // MDP version 1
            num_to_ui16be(handler.protocol),     // Locator protocol
            num_to_ui64be(now + locator.expiry), // Expiry timestamp
            local,                               // Routing path
            num_to_ui16be(locator.value.length), // Value length
            locator.value,                       // Locator value
          ]);
          payload = Buffer.concat([
            payload,
            num_to_ui16be(record.length),
            record,
          ]);
        }
      }

      // Forward remove locators
      for(const locator of ctx.locators) {
        const record = Buffer.concat([
          num_to_ui16be(1),                    // MDP version 1
          num_to_ui16be(locator.protocol),     // Locator protocol
          num_to_ui64be(locator.expires),      // Expiry timestamp
          locator.path,                        // Routing path
          num_to_ui16be(locator.value.length), // Value length
          locator.value,                       // Locator value
        ]);
        payload = Buffer.concat([
          payload,
          num_to_ui16be(record.length),
          record,
        ]);
      }

      // Send to all neighbours
      for(const neighbour of ctx.connections) {
        meshy.sendMessage(neighbour.path, this.protocol, payload);
      }
    }, options.interval);
  }
  async onmessage(meshy: Meshy, returnPath: Buffer, payload: Buffer) {
    const ctx = privateData.get(meshy);

    while(payload.length) {

      // Shift the whole record from the payload
      const recordLength = payload.readUint16BE(0);
      if (!recordLength) break; // 0 = end of list
      let record = payload.subarray(2, recordLength + 2);
      payload = payload.subarray(recordLength + 2);

      // Check record compatibility
      const version = record.readUint16BE(0);
      if (version !== 1) continue;
      record = record.subarray(2);

      // Extract data
      const protocol = record.readUint16BE(0);
      const expires  = record.readBigInt64BE(2);
      const path     = Buffer.concat([
        returnPath.subarray(0, returnPath.length - 1),
        record.subarray(10, record.indexOf(0, 10) + 1),
      ]);
      record = record.subarray(path.length - returnPath.length + 11);
      const valueLength = record.readUint16BE(0);
      const value       = record.subarray(2, 2 + valueLength);

      // Expired record = skip
      if (expires < BigInt(Date.now())) continue;

      // Self-hosted service = skip
      if (ctx.handlers.find(handler => handler.locators.find(locator => Buffer.compare(locator.value, value) === 0))) {
        continue;
      }

      // Fetch already-known locator
      const found = ctx.locators.find(locator => {
        if (locator.protocol !== protocol) return false;
        return Buffer.compare(value, locator.value) === 0;
      });

      if (found && (
        ((found.expires > expires) && (found.path.length  > path.length)) ||
        ((found.expires < expires) && (found.path.length >= path.length))
      )) {
        // Update pre-existing record if it's better
        found.expires = expires;
        found.path    = path;
      } else if (!found) {
        // Or insert if new
        ctx.locators.push({
          path,
          expires,
          protocol,
          value,
        });
      }
    }

  }
  async onclose(meshy: Meshy) {
    const ctx = privateData.get(meshy);
    ctx.locators = [];
    clearInterval(this.interval);
  }
}


export class Meshy {
  private opts: MeshyOptions;
  private mdp: false | MeshyDiscoveryProtocolHandler;
  constructor(options?: Partial<MeshyOptions>) {

    // Mix in default options
    this.opts = Object.assign({
      mdp: {
        interval: 1000,
      },
    }, options);

    // Ensure a context for truly private data exists
    privateData.set(this, {
      connections: [],
      handlers: [],
      locators: [],
    });
    const ctx = privateData.get(this);

    // Start MDP handler if requested to
    if (this.opts.mdp) {
      this.mdp = new MeshyDiscoveryProtocolHandler(this, this.opts.mdp);
      ctx.handlers.push(this.mdp);
    }
  }

  routeInfo(protocol: number, locator: Buffer) {
    const ctx = privateData.get(this);
    const found = ctx.locators.find(l => {
      if (l.protocol !== protocol) return false;
      return Buffer.compare(l.value, locator) === 0;
    });
    if (!found) return false;
    return found.path;
  }

  async sendMessage(path: Buffer, protocol: number, payload: Buffer, returnPath?: Buffer): Promise<boolean> {
    if (!path.length) return false;

    // Handle message to self
    if (path[0] === 0) {
      const prefix = Buffer.alloc(4).fill(0);
      prefix.writeUInt16BE(protocol, 2);
      setImmediate(() => this._handleMessage(-1, Buffer.concat([prefix,payload])));
      return true;
    }

    // Sanity checking
    if (!returnPath) returnPath = Buffer.from([0]);
    if (returnPath.length < 1) returnPath = Buffer.from([0]);
    if (path.length < 2) return false;
    if (path[path.length - 1] !== 0) return false;
    if (returnPath[returnPath.length - 1] !== 0) return false;

    // And actually send to the neighbour
    const ctx = privateData.get(this);
    const neighbour = ctx.connections.find(entry => entry.port == path[0]);
    if (!neighbour) return false;
    const message = Buffer.concat([
      path.subarray(1),
      returnPath,
      num_to_ui16be(protocol),
      payload,
    ]);
    neighbour.connection.send(message);
    return true;
  }

  private async _handleMessage(port: number, message: string|Buffer) {
    const ctx  = privateData.get(this);
    if ('string' === typeof message) message = Buffer.from(message);

    // Split paths and payload
    // !!! MODIFIES RETURN PATH !!!
    const targetPath = message.subarray(0, message.indexOf(0) + 1);
    const returnPath = Buffer.concat([
      Buffer.from(port === -1 ? [] : [port]),
      message.subarray(targetPath.length, message.indexOf(0, targetPath.length) + 1),
    ]);
    const payload = message.subarray(targetPath.length + returnPath.length - 1);

    // Handle messages for us, process the thing
    if (targetPath[0] == 0) {
      let handled = false;
      const protocol = payload.readUint16BE(0);
      const content  = payload.subarray(2);
      for(const protocolHandler of ctx.handlers) {
        if (protocolHandler.protocol !== protocol) continue;
        handled = !(await protocolHandler.onmessage(this, returnPath, content));
        if (handled) break;
      }
      return;
    }

    // Forward packet if not for us
    const neighbour = ctx.connections.find(entry => entry.port == targetPath[0]);
    if (!neighbour) return; // Discard packet if target missing
    neighbour.connection.send(Buffer.concat([
      targetPath.subarray(1),
      returnPath,
      payload,
    ]));
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
    onMessage(async (message: string|Buffer) => this._handleMessage(port, message));

    // Handle closures
    // TODO: do anything special?
    onClose(() => {
      ctx.connections = ctx.connections.filter(entry => entry.port !== port);
    });

    // And actually store the thing
    ctx.connections.push({
      port,
      path: Buffer.from([ port, 0 ]),
      connection,
    });

    return false;
  }

  registerHandler(handler: MeshyProtocolHandler) {
    const ctx  = privateData.get(this);
    ctx.handlers.push(handler);
  }

  removeHandler(subject: MeshyProtocolHandler) {
    const ctx  = privateData.get(this);
    ctx.handlers = ctx.handlers.filter(handler => handler !== subject);
  }

  async shutdown() {
    const ctx        = privateData.get(this);
    const handlers   = ctx.handlers;
    const neighbours = ctx.connections;
    for(const handler   of handlers  ) await handler.onclose(this);
    for(const neighbour of neighbours) await neighbour.connection.close();
  }

}

export default Meshy;
