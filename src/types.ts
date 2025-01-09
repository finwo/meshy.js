import { EventEmitter } from 'node:events';

// export type JSONPrimitive = string | number | boolean | null | undefined;
// export type JSONValue = JSONPrimitive | JSONValue[] | {
//   [key: string]: JSONValue;
// };
// export function safeJsonStringify(data: unknown): data is JSONValue {
//   return !!JSON.stringify(data);
// }

interface MeshyTcpConnectionEventMap {
  data: [string|Buffer];
  close: [];
}
type MeshyTcpConnection = EventEmitter<MeshyTcpConnectionEventMap> & {
  write: (chunk: string|Buffer) => void,
  end: () => void,
};

interface MeshySerialConnectionEventMap {
  data: [string|Buffer];
  close: [];
}
type MeshySerialConnection = EventEmitter<MeshySerialConnectionEventMap> & {
  write: (chunk: string|Buffer) => void,
  close: () => void,
};

export type MeshyStreamConnection = MeshyTcpConnection | MeshySerialConnection;
