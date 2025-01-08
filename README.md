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

API
---

<details>
  <summary>.broadcast(message)</summary>
  <p>Sends a message to all nodes in the network</p>

```typescript
.broadcast(message:string)
```

</details>
