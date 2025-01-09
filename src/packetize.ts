// Turns a meshy-compatible stream into packets
// Only intended for point-to-point packets, no routing info here
// Packets are limited to an encoded 1MiB - 2 bytes to prevent buffer overflows

// Structure:
//   Packets are encoded like SLIP: https://en.wikipedia.org/wiki/Serial_Line_Internet_Protocol
//   A CRC16 is added to add minor validation


import { EventEmitter } from 'node:events';
import { crc16 } from './crc16-xmodem';

import { MeshyStreamConnection } from './types';

const packetLimit = 2**20; // 1MiB
const encodeTable = {
  [0xDB]: Buffer.from([0xDB,0xDD]), // Frame escape
  [0xC0]: Buffer.from([0xDB,0xDC]), // Frame end
};
const decodeTable = {
  [0xDC]: Buffer.from([0xC0]),      // Transposed frame end
  [0xDD]: Buffer.from([0xDB]),      // Transposed frame escape
};

export interface MeshyPacketConnectionEventMap {
  message: [string|Buffer];
  close: [];
}

export class MeshyPacketConnection extends EventEmitter<MeshyPacketConnectionEventMap> {

  constructor(private streamConnection: MeshyStreamConnection) {
    super();
    let ingressBuffer = Buffer.alloc(0);

    streamConnection.on('close', () => {
      this.emit('close');
      // Should be removed from references by user
      // We can not destroy ourselves
    });

    streamConnection.on('data', (chunk: string | Buffer) => {
      ingressBuffer = Buffer.concat([ ingressBuffer, Buffer.from(chunk) ]).subarray(-packetLimit);

      // Search for a complete frame
      let frameEndIndex: number;
      while ((frameEndIndex = ingressBuffer.indexOf(0xC0)) >= 0) {
        // We supposedly got a frame, shift it from the ingress buffer
        let frame = ingressBuffer.subarray(0, frameEndIndex);
        ingressBuffer = ingressBuffer.subarray(frameEndIndex + 1);
        // Decode escape sequences
        let frameEscapeIndex: number;
        let frameEscapePointer = 0;
        while((frameEscapeIndex = frame.indexOf(0xDB, frameEscapePointer)) >= 0) {
          // Discard frame if invalid escape sequence detected
          if (!(frame[frameEscapeIndex+1] in decodeTable)) {
            frame = Buffer.alloc(0);
            break;
          }
          // Replace the escape sequence
          frame = Buffer.concat([
            frame.subarray(0, frameEscapeIndex),
            decodeTable[frame[frameEscapeIndex + 1]],
            frame.subarray(frameEscapeIndex + 2),
          ]);
          frameEscapePointer = frameEscapeIndex + 1; // Next check skip decoded byte
        }
        // Discard frame if it's too short to contain crc
        if (frame.length < 2) continue;
        // Discard upon crc failure
        if (crc16(frame)) continue;
        // Remove crc from frame
        frame = frame.subarray(0, frame.length - 2);
        // Emit the received frame
        this.emit('message', frame);
      }
    });

  }

  sendMessage(chunk: string|Buffer): void {

    // Build message + crc
    // CAUTION: message mutates
    let message = Buffer.concat([
      Buffer.from(chunk),
      Buffer.from([0x00, 0x00]),
    ]);
    let crc = crc16(message);
    message.writeUInt16BE(crc, message.length - 2);

    // Escape any special markers in the frame
    for(const marker in encodeTable) {
      let frameMarkerIndex: number;
      let frameMarkerPointer = 0;
      while((frameMarkerIndex = message.indexOf(marker, frameMarkerPointer)) >= 0) {
        message = Buffer.concat([
          message.subarray(0, frameMarkerIndex),
          encodeTable[marker],
          message.subarray(frameMarkerIndex + 1),
        ]);
        frameMarkerPointer = frameMarkerIndex + 2;
      }
    }

    // Wrap the frame in frame-end markers
    message = Buffer.concat([
      Buffer.from([0xC0]), // Invalidate noise on the line using crc or too-small packet
      message,             // The actual message
      Buffer.from([0xC0]), // And close the message
    ]);

    // And actually send the message
    this.streamConnection.write(message);
  }

  close() {
    if ('end' in this.streamConnection) {
      this.streamConnection.end();
    } else if ('close' in this.streamConnection) {
      this.streamConnection.close();
    }
  }
}
