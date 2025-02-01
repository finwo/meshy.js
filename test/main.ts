import mockConnection from './mockConnection';
import Meshy from '../src';

// Build network
const Alice   = new Meshy();
const Bob     = new Meshy();
const Charlie = new Meshy();

const con_ab = mockConnection();
Alice.addConnection(con_ab[0]);
Bob.addConnection(con_ab[1]);

const con_bc = mockConnection();
Bob.addConnection(con_bc[0]);
Charlie.addConnection(con_bc[1]);

const con_ac = mockConnection();
Alice.addConnection(con_ac[0]);
Charlie.addConnection(con_ac[1]);

Alice.declareService(0x0800, Buffer.from([192,168,1,10]))
Bob.declareService(0x0800, Buffer.from([192,168,1,20]))
Charlie.declareService(0x0800, Buffer.from([192,168,1,30]))

setTimeout(() => {
  setInterval(() => {
    process.stdout.write('\n');
  }, 1000);
}, 1);

console.log({
  Alice,
  Bob,
  // Charlie,
});
