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

Here's a list of custom protocols we define outside of the ethertype set.

| Hex  | Description                 |
| ---- | --------------------------- |
| 0000 | Reserved, do not use        |
| 0100 | Meshy Discovery Protocol    |
| 0800 | Internet Protocol version 4 |
| FFFF | Reserved, do not use        |

Meshy Discovery Protocol
------------------------

The Meshy Discovery Protocol (MDP) is a push-based protocol, designed to
distribute address and service information. For simplicity's sake, we'll refer
to all records as services, although records may also signify just an address in
a different protocol.

Periodically, a node will send out all services it supports, and optionally all
services it knows about, towards it's direct neighbours in a single MDP packet.
Because each record within a packet contains the return path towards the node
that hosts it, records that originated from neighbours must have their paths
updated.

Whenever receiving a packet, the node should record all services listed in the
packet with the proper path towards the node hosting the service. Expired
service entries should be discarded, services with the same path length but an
expiry further in the future should override the old registration, and services
with a path shorter than the known path should override the old registration.

If a node does not have enough memory or storage to keep track of all services
on the network, it may choose to forward a path-updated version of the packet
without delay. It should be noted that connecting 2 nodes together with this
behavior will cause the packet to be sent back-and-forth and grow the paths
listed within the records of that packet.

The interval between the periodic packets should be determined by the network
operator. In slow-moving environments a 1-hour interval with expiries measured
in days might suffice, while in fast-paced environments where failover between
routes should be caught by the TCP protocol an interval of 100 milliseconds with
an expiry of 1 second might be more appropriate.

#### Packet structure

Within the packet, after the protocol field, there is simply a list of 5-value
records. These values are:

| Field    | Type         | Description                                                                          |
| -------- | ------------ | ------------------------------------------------------------------------------------ |
| Version  | uint16be     | 0x0001, Format version of the record                                                 |
| Protocol | uint16be     | The protocol this service record applies to                                          |
| Expiry   | uint64be     | When this record expires in milliseconds since the UNIX epoch (1970-01-01 00:00 UTC) |
| Path     | &lt;path&gt; | Path towards the node that is hosting the service                                    |
| Length   | uint16be     | Length of the name in bytes                                                          |
| Name     | string       | Name of the service described in this record                                         |

Note that a version indicator of 0x0000 signals the end of the record list,
regardless of whether there is more data within the packet.

#### IPv4 Example

Let's say you want to overlay the network with IPv4 addressing. Although DHCP
is not supported on Meshy, machines can signal their address to the network by
notifying their neighbours, which in turn would propagate the address further.

Such a record may look like this:

```
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
00 01                   -- MDP version 1
08 00                   -- Protocol IPv4
00 00 01 94 1f 29 7c 00 -- 1735689600000, expires on 2025-01-01 00:00:00 GMT
14 00                   -- 1 hop, connection 20
00 04                   -- Address length = 4 bytes
c0 a8 01 20             -- Address = 192.168.1.42
```





<!--

LLDP
----

Because LLDP specifications are hidden behind paywalls (hit me up if you have a
shareable definition), we define a variant here that *hopefully* is compatible.

This definition is mostly based on [the wikipedia
page](https://en.wikipedia.org/wiki/Link_Layer_Discovery_Protocol) and guessing
missing information.

### Packet format

After the protocol indicator, the packet contains a list of TLV entries up to
the packet end OR an "end of lldpdu" record, whichever comes first.

A TLV record consists of a 7-bit type indicator followed by a 9-bit length
indicator. The registered types are as follows:

| Type  | Usage     | Description         |
| ----- | --------- | ------------------- |
| 0     | Optional  | End of LLDPU        |
| 1     | Mandatory | Chassis ID          |
| 2     | Mandatory | Port ID             |
| 3     | Mandatory | Time to live        |
| 4     | Optional  | Port description    |
| 5     | Optional  | System name         |
| 6     | Optional  | System description  |
| 7     | Optional  | System capabilities |
| 8     | Optional  | Management address  |
| 9-126 | Reserved  |                     |
| 127   | Custom    |                     |

-->
