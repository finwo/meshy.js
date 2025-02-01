import { EventEmitter } from 'node:events';
import PacketConnection, { SerialConnectionEventMap } from 'stream-packetize';

export type HandlerFn = (...args:any[]) => any;

class MockConnection extends EventEmitter<SerialConnectionEventMap> {
  constructor(
    private onwrite: HandlerFn,
    private onclose: HandlerFn,
  ) {
    super();
  }
  write(chunk: string|Buffer): void {
    this.onwrite(chunk);
  }
  close(): void {
    this.onclose();
  }
}

export function mockConnection(): [PacketConnection, PacketConnection] {
  const primaryRaw = new MockConnection(
    (chunk: string|Buffer) => {
      secondaryRaw.emit('data', chunk);
    },
    (chunk?: string|Buffer) => {
      if (chunk) secondaryRaw.emit('data', chunk);
      secondaryRaw.emit('close');
    },
  );
  const secondaryRaw = new MockConnection(
    (chunk: string|Buffer) => {
      primaryRaw.emit('data', chunk);
    },
    (chunk?: string|Buffer) => {
      if (chunk) primaryRaw.emit('data', chunk);
      primaryRaw.emit('close');
    },
  );
  return [
    new PacketConnection(primaryRaw),
    new PacketConnection(secondaryRaw),
  ];
};

export default mockConnection;
