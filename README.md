meshy
=====

Message router for sparsely connected mesh networks

## API

#### Setup

Setting up the message router can be done as follows. Note that while just plain TCP and AES-256-CTR are shown,
WebSockets, SSL connections and [serial ports](https://www.npmjs.com/package/serialport) are also supported.

```typescript
import Meshy from 'meshy';

const meshy = new Meshy({
  mdp: {
    interval: 1000,
  },
});


// Start a tcp server and give it's connections to meshy
const plainServer = net.createServer();
plainServer.listen(plainPort, host, () => console.log(`Listening plainly on ${host}:${plainPort}`));
plainServer.on('connection', sock => {
  meshy.addConnection(sock);
});

// Or, aes-256-ctr encryption is supported as well
import { PacketConnection } from 'stream-packetize';
const aesServer = net.createServer();
aesServer.listen(aesPort, host, () => console.log(`Listening AES-256 on ${host}:${aesPort}`));
aesServer.on('connection', sock => {
  meshy.addConnection(new PacketConnection({
    passphrase: "supers3cret",           // Either a string
    passphrase: crypto.randomBytes(123), // Or a buffer
  });
});
```

#### Transferring data

While in theory you could send data into the network, and even find routing info using the
`.routeInfo(protocol,locator)` method, meshy is not designed to be used as-is.

Instead, meshy is designed to behave like a layer 2 protocol (regardless of whether it runs on serial or over tcp).

Take a look into [meshy-ipv4](https://npmjs.com/package/meshy-ipv4) if you want to send data across a meshy network in
IPv4 format.
