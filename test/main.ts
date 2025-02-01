import mockConnection from './mockConnection';
import Meshy from '../src';

// Build network
const Alice   = new Meshy({ mdpInterval: 1e2 });
const Bob     = new Meshy({ mdpInterval: 1e2 });
const Charlie = new Meshy({ mdpInterval: 1e2 });
const David   = new Meshy({ mdpInterval: 1e2 });

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

Alice.declareService(0x0800, Buffer.from([192,168,1,10]))
Bob.declareService(0x0800, Buffer.from([192,168,1,20]))
Charlie.declareService(0x0800, Buffer.from([192,168,1,30]))
David.declareService(0x0800, Buffer.from([192,168,1,40]))

setTimeout(() => {
  console.log('Alice   -> Charlie', Alice.routeInfo(0x0800, Buffer.from([192,168,1,30])));
  console.log('Charlie -> David  ', Charlie.routeInfo(0x0800, Buffer.from([192,168,1,40])));
  console.log('Alice   -> David  ', Alice.routeInfo(0x0800, Buffer.from([192,168,1,40])));
  console.log('');
  console.log('David   -> Charlie', David.routeInfo(0x0800, Buffer.from([192,168,1,30])));
  console.log('Charlie -> Alice  ', Charlie.routeInfo(0x0800, Buffer.from([192,168,1,10])));
  console.log('David   -> Alice  ', David.routeInfo(0x0800, Buffer.from([192,168,1,10])));
}, 500);

// console.log({
//   Alice,
//   Bob,
//   // Charlie,
// });
