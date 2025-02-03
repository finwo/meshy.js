meshy
=====

Message router for sparsely connected mesh networks

Concepts
--------

This library **DOES NOT** set up any connections itself.

The connections passed to the library can be both packet-based or stream-based,
as long as the order is maintained.

This means it can be a websocket, bare tcp connection or even a serial port. If
a stream-connection is detected, slip-based packetization is added to it using
[stream-packetize](https://npmjs.com/package/stream-packetize) to make it
compatible with the internal use of the connection.

The connection given is not assumed to be reliable, which protocols built on top
of this should take in to account.

While the packet routing of this library *may* scale far, as no routing tables
are involved, the service discovery as defined **DOES NOT** hyperscale.

Error handling
--------------

Because this is a network library (and because I like the pattern), non-fatal
errors will be returned instead of thrown to prevent the program from crashing.

This does mean that the user of this library needs to decide how to handle such
errors.

Packet structure
----------------

- 1..N bytes: routing target
- 1..N bytes: routing return path
- 2 bytes: protocol indicator
- 0..N bytes: payload

Routing
-------

Routing is a prefix-code, allowing low-memory devices to participate in the
network without having to maintain a routing table.

The routing target is a list of bytes, indicating which "port" the packet should
be routed to on the node that is currently processing the packet. A value of 0
indicates the end of the list and that the packet is destined for the node it's
currently on, so the node should start processing the packet.

Whenever a packet is received, a node should prepend the port number it was
received on to the return path of the packet, either before or during the target
processing.

Packets that have a target or return path longer than the node supports should
be discarded, the actual limit is up to the node's configuration (255
recommended).

Protocols
---------

Because we're basing this protocol somewhat on ethernet/ethertype, we'll borrow
the ethertype protocol numbers as well. Because we do not support these 2 bytes
as a packet-length indicator, we can re-use values &lt;1500 as custom protocols
that are specific to meshy.

Here's a non-exhaustive list of protocols we define or recognize:

| Hex  | Description                 |
| ---- | --------------------------- |
| 0000 | Reserved, do not use        |
| 0100 | Meshy Discovery Protocol    |
| 0800 | Internet Protocol version 4 |
| FFFF | Reserved, do not use        |

Meshy Discovery Protocol
------------------------

The Meshy Discovery Protocol (MDP) is a push-based protocol, designed to
distribute address and service information. Because the discovered names/labels
etc can be addresses or even database keys, we chose to term "locator" to
describe records within the MDP system.

Periodically, a node will send out all locators it knows and hosts towards all
connected neighbours in a single MDP packet. Because records within this packet
contain the routing path towards the node that hosts the locator, any records
forwarded from neighbours should have updated routing paths forwarded.

Whenever receiving an MDP packet, the node should record all locators listed in
the packet with the proper routing path towards the node hosting the locator.
Expired locator entries should be discarded, locators with the same routing path
length but an expiry further in the future should override the old record, and
locators with a routing path shorter than the known routing path should override
the old record.

If a node does not have enough memory or storage to keep track of all locators
on the network, it may choose to discard records for protocols it does not wish
to participate in. This will result in that protocol not being routed over that
node, as discovery stops at that node.

A low-resource node may also choose to forward a path-updated version of the
packet without delay and not track them, though connecting 2 nodes with this
behavior together will cause the packet to bounce between them with increasing
size.

The interval between the periodic packets should be determined by the network
operator. In slow-moving environments a 1-hour interval with expiries measured
in days might suffice, while in fast-paced environments where failover between
routes should be caught by the TCP protocol an interval of 100 milliseconds with
an expiry of 1 second might be more appropriate.

#### Packet structure

Within the packet, after the protocol field, the structure is intentionally kept
simple and imposes as little restrictions as possible.

For version 1 of the protocol, records longer than 2^16-1 bytes are not
supported. Due to the structure, future versions should account for
record-skipping if they will support records larger than this.

| Field    | Type         | Description                                                                          |
| -------- | ------------ | ------------------------------------------------------------------------------------ |
| Size     | uint16be     | Length of the record in bytes, excluding this size field                             |
| Version  | uint16be     | 0x0001, Format version of the record                                                 |
| Protocol | uint16be     | The protocol this locator record applies to                                          |
| Expiry   | uint64be     | When this record expires in milliseconds since the UNIX epoch (1970-01-01 00:00 UTC) |
| Path     | &lt;path&gt; | Path towards the node that is hosting the locator                                    |
| Length   | uint16be     | Length of the value in bytes                                                         |
| Value    | string       | Value of the described locator in this record                                        |

Note that a size indicator of 0x0000 signals the end of the record list,
regardless of whether there is more data within the packet.

#### IPv4 Example

Let's say you want to overlay the network with IPv4 addressing. Although DHCP
is not supported on Meshy, machines can signal their address to the network by
notifying their neighbours, which in turn would propagate the address further.

Such a record may look like this:

```
00 13                   -- Entry contains 19 more bytes
00 01                   -- MDP version 1
08 00                   -- Protocol IPv4
00 00 01 94 1f 29 7c 00 -- 1735689600000, expires on 2025-01-01 00:00:00 GMT
00                      -- Path = this node, no hops
00 04                   -- Address length = 4 bytes
c0 a8 01 20             -- Address = 192.168.1.42
```

Let's say it's neighbour receives this packet on connection 20 and wants to
forward it. In turn, that neighbour would send out that record as follows:

```
00 14                   -- Entry contains 20 more bytes
00 01                   -- MDP version 1
08 00                   -- Protocol IPv4
00 00 01 94 1f 29 7c 00 -- 1735689600000, expires on 2025-01-01 00:00:00 GMT
14 00                   -- 1 hop, connection 20
00 04                   -- Address length = 4 bytes
c0 a8 01 20             -- Address = 192.168.1.42
```
