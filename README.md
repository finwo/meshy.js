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

+------+------------------------------------------------+
| Hex  | Description                                    |
+------+------------------------------------------------+
| 0800 | IPv4                                           |
| 8100 | 802.1Q tag, reserved for future implementation |
| 88cc | Link Layer Discovery Protocol                  |
+------+------------------------------------------------+

TBD: LLDP looks like a **push** protocol, not a request-response. So how will we
question neighbours further away?

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

+-------+-----------+---------------------+
| Type  | Usage     | Description         |
+-------+-----------+---------------------+
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
+-------+-----------+---------------------+
