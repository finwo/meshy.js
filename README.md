meshy
=====

Message router for sparsely connected mesh networks

Concepts
--------

This library **DOES NOT** set up any connections itself.

The stream/connection you pass to the library is assumed to be:

- an continuous in-order byte stream
- not gueranteed to be reliable

This means the connection you pass to the library can range from a serial
connection up to a tcp connection (or whatever's popular in the future).

Routing:

- connection-prefix code, 0 = this machine is the target
- ethertype-ish codes for declaring protocol of packet
- ARP-ish protocol for finding neighbours

API
---

<details>
  <summary>.unicast(message, recipient)</summary>
  <p>Sends a message to a single node</p>

```typescript
.unicast(message:Buffer, recipient:Buffer)
```

</details>
