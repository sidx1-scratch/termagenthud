import * as net from 'net';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export class NativeWebSocket extends EventEmitter {
  private socket: net.Socket;
  public readyState: number = 1; // 1 = OPEN

  constructor(socket: net.Socket) {
    super();
    this.socket = socket;

    socket.on('data', (buffer: Buffer) => {
      this.parseFrame(buffer);
    });

    socket.on('close', () => {
      this.readyState = 3; // CLOSED
      this.emit('close');
    });

    socket.on('error', (err) => {
      this.emit('error', err);
    });
  }

  private parseFrame(buffer: Buffer) {
    if (buffer.length < 2) return;

    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const opcode = firstByte & 0x0f;

    // 0x8 = close, 0x9 = ping, 0xa = pong, 0x1 = text
    if (opcode === 0x8) {
      this.close();
      return;
    }
    if (opcode === 0x9) {
      // Respond to ping with pong
      this.sendPong();
      return;
    }

    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      // High 32 bits + Low 32 bits
      payloadLength = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let maskingKey: Buffer | null = null;
    if (isMasked) {
      maskingKey = buffer.subarray(offset, offset + 4);
      offset += 4;
    }

    const payload = buffer.subarray(offset, offset + payloadLength);
    if (isMasked && maskingKey) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskingKey[i % 4];
      }
    }

    if (opcode === 0x1) {
      // Text payload
      const text = payload.toString('utf8');
      this.emit('message', text);
    }
  }

  public send(data: string) {
    if (this.readyState !== 1) return;
    const payload = Buffer.from(data, 'utf8');
    const length = payload.length;

    let header: Buffer;
    if (length < 126) {
      header = Buffer.from([0x81, length]);
    } else if (length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    this.socket.write(Buffer.concat([header, payload]));
  }

  private sendPong() {
    this.socket.write(Buffer.from([0x8a, 0x00]));
  }

  public close() {
    if (this.readyState !== 3) {
      this.readyState = 3;
      try {
        this.socket.write(Buffer.from([0x88, 0x00]));
        this.socket.end();
      } catch {}
    }
  }
}

export class NativeWebSocketServer extends EventEmitter {
  private server: net.Server;
  public clients: Set<NativeWebSocket> = new Set();

  constructor(port: number) {
    super();
    this.server = net.createServer((socket) => {
      socket.once('data', (buffer) => {
        const reqStr = buffer.toString('utf8');
        const headers = this.parseHeaders(reqStr);

        if (
          headers['upgrade']?.toLowerCase() === 'websocket' &&
          headers['sec-websocket-key']
        ) {
          const key = headers['sec-websocket-key'];
          const acceptKey = crypto
            .createHash('sha1')
            .update(key + WS_GUID)
            .digest('base64');

          const response = [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${acceptKey}`,
            '\r\n',
          ].join('\r\n');

          socket.write(response);

          const client = new NativeWebSocket(socket);
          this.clients.add(client);
          this.emit('connection', client);

          client.on('close', () => {
            this.clients.delete(client);
          });
        } else {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
      });
    });

    this.server.listen(port, '127.0.0.1', () => {
      this.emit('listening', port);
    });
  }

  private parseHeaders(str: string): Record<string, string> {
    const lines = str.split('\r\n');
    const headers: Record<string, string> = {};
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) break;
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const k = line.slice(0, idx).trim().toLowerCase();
        const v = line.slice(idx + 1).trim();
        headers[k] = v;
      }
    }
    return headers;
  }

  public broadcast(message: string, exclude?: NativeWebSocket) {
    for (const client of this.clients) {
      if (client !== exclude && client.readyState === 1) {
        client.send(message);
      }
    }
  }

  public close() {
    for (const client of this.clients) {
      client.close();
    }
    this.server.close();
  }
}
