import mockConnection from './mockConnection';
import Meshy, {MeshyProtocolHandler, MeshyProtocolHandlerFn} from '../src';

class MockIPv4 implements MeshyProtocolHandler {
  protocol: number = 0x0800;
  locators: { expiry: bigint, value: Buffer }[] = [];
  async onmessage() {}
  async onclose() {}
  constructor(ip: [number,number,number,number]) {
    this.locators.push({ expiry: 10000n, value: Buffer.from(ip) });
  }
}

const assert = (expected, actual, message) => {
  if (expected !== actual) throw new Error(`Expected ${expected}, actual ${actual} -- ${message}`);
  process.stdout.write(`[pass] ${message}\n`);
};

// // References
const IPv4 = 0x0800;
const b = (...a) => Buffer.from(a);


// Network structure
//
// Alice ---- Charlie ---- David
//    \         /
//     -- Bob --

// Build network
const Alice   = new Meshy({ mdp: { interval: 1e2 } });
const Bob     = new Meshy({ mdp: { interval: 1e2 } });
const Charlie = new Meshy({ mdp: { interval: 1e2 } });
const David   = new Meshy({ mdp: { interval: 1e2 } });

// Setup IPv4 on the network
Alice  .registerHandler(new MockIPv4([192,168,1,10]))
Bob    .registerHandler(new MockIPv4([192,168,1,20]))
Charlie.registerHandler(new MockIPv4([192,168,1,30]))
David  .registerHandler(new MockIPv4([192,168,1,40]))

const con_ab = mockConnection();
Alice.addConnection(con_ab[0]);
Bob.addConnection(con_ab[1]);

const con_bc = mockConnection();
Bob.addConnection(con_bc[0]);
Charlie.addConnection(con_bc[1]);

const con_ac = mockConnection();
Alice.addConnection(con_ac[0]);
Charlie.addConnection(con_ac[1]);

const con_cd = mockConnection();
Charlie.addConnection(con_cd[0]);
David.addConnection(con_cd[1]);

setTimeout(async () => {

  const route_ac = Alice.routeInfo(IPv4, b(192,168,1,30));
  assert(true, Buffer.isBuffer(route_ac), "Alice   -> Charlie route resolves");
  // @ts-ignore
  assert(0, Buffer.compare(route_ac, b(2,0)), 'Alice   -> Charlie routes without hops');

  const route_cd = Charlie.routeInfo(IPv4, b(192,168,1,40));
  assert(true, Buffer.isBuffer(route_cd), "Charlie -> David   route resolves");
  // @ts-ignore
  assert(0, Buffer.compare(route_cd, b(3,0)), 'Charlie -> David   routes without hops');

  const route_ad = Alice.routeInfo(IPv4, b(192,168,1,40));
  assert(true, Buffer.isBuffer(route_ad), "Alice   -> David   route resolves");
  // @ts-ignore
  assert(0, Buffer.compare(route_ad, b(2,3,0)), 'Alice   -> David   routes with hops');

  const route_dc = David.routeInfo(IPv4, b(192,168,1,30));
  assert(true, Buffer.isBuffer(route_dc), "David   -> Charlie route resolves");
  // @ts-ignore
  assert(0, Buffer.compare(route_dc, b(1,0)), 'David   -> Charlie routes without hops');

  const route_ca = Charlie.routeInfo(IPv4, b(192,168,1,10));
  assert(true, Buffer.isBuffer(route_ca), "Charlie -> Alice   route resolves");
  // @ts-ignore
  assert(0, Buffer.compare(route_ca, b(2,0)), 'Charlie -> Alice   routes without hops');

  const route_da = David.routeInfo(IPv4, b(192,168,1,10));
  assert(true, Buffer.isBuffer(route_da), "David   -> Alice   route resolves");
  // @ts-ignore
  assert(0, Buffer.compare(route_da, b(1,2,0)), 'David   -> Alice   routes with hops');

  await new Promise(r => setTimeout(r, 100));
  Alice.shutdown();
  Bob.shutdown();
  Charlie.shutdown();
  David.shutdown();
}, 500);
