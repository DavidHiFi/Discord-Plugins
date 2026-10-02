const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../panel-layout/modules/builtin/systemMonitor.tsx'), 'utf8');
const gatewayText = source.slice(source.indexOf('function getGatewayPing()'), source.indexOf('export const sysMonitorSettings'));
const componentText = source.slice(source.indexOf('function SystemMonitorComponent()'), source.indexOf('    const handleClick = () => {', source.indexOf('function SystemMonitorComponent()'))) + 'return {ping, pingSource, pingQualityClass, pingQualityText, pingTooltip, memoryMb, uptimeSec}; }';
const gateway = {isConnected:()=>true, getSocket:()=>({lastHeartbeatTime:999700,lastHeartbeatAckTime:1000000})};
const rtc = {isConnected:()=>true,getLastPing:()=>61,getPings:()=>[{time:999900,ping:61}]};
let stats = {ping:0,memoryMb:0,uptimeSec:0};
const context = vm.createContext({GatewayConnectionStore:gateway, RTCConnectionStore:rtc, Date:{now:()=>1000100}, Number, Math, Array, parseInt, performance:{memory:{usedJSHeapSize:64*1024*1024}}, sysMonitorSettings:{use:()=>({refreshInterval:'2000'})},useState:()=>[stats,value=>Object.assign(stats,value)],useStateFromStores:(_stores,read)=>read(),useEffect:fn=>fn(),setInterval:()=>1,clearInterval:()=>{}});
const js = esbuild.transformSync(gatewayText+componentText,{loader:'tsx',target:'esnext'}).code;
vm.runInContext(js,context);
const tests=[];
function check(name, run){run();tests.push({name,passed:true});}
function render(){return vm.runInContext('SystemMonitorComponent()',context);}
check('Old missing gateway method reproduces zero',()=>assert.equal(Math.round(gateway.getPing?.()??0),0));
check('Gateway heartbeat fallback gives measured 300 ms',()=>assert.equal(vm.runInContext('getGatewayPing()',context),300));
check('Voice footer follows native 61 ms rather than gateway 300 ms',()=>{const s=render();assert.equal(s.ping,61);assert.equal(s.pingSource,'Voice');assert.equal(s.memoryMb,64);});
check('Updated native voice sample follows 117 ms',()=>{rtc.getLastPing=()=>117;assert.equal(render().ping,117);});
check('Stale voice value loses healthy colour and reports age',()=>{rtc.getPings=()=>[{time:950000,ping:117}];const s=render();assert.equal(s.pingQualityClass,'stale');assert.match(s.pingTooltip,/measured.*ago/);});
check('Connected voice with missing sample does not substitute gateway ping',()=>{rtc.getLastPing=()=>undefined;const s=render();assert.equal(s.ping,0);assert.equal(s.pingQualityText,'Unavailable');});
check('Outside voice footer switches to gateway measurement',()=>{rtc.isConnected=()=>false;assert.equal(render().ping,300);assert.equal(render().pingSource,'Gateway');});
check('Disconnected gateway reports unavailable',()=>{gateway.isConnected=()=>false;assert.equal(render().ping,0);});
check('Pending heartbeat acknowledgement reports unavailable',()=>{gateway.isConnected=()=>true;gateway.getSocket=()=>({lastHeartbeatTime:1000000,lastHeartbeatAckTime:999000});assert.equal(render().ping,0);});
check('Old gateway acknowledgement reports unavailable',()=>{gateway.getSocket=()=>({lastHeartbeatTime:800000,lastHeartbeatAckTime:800300});assert.equal(render().ping,0);});
check('Existing valid gateway getter remains supported',()=>{gateway.getPing=()=>45.6;assert.equal(render().ping,46);});
console.log(JSON.stringify({passed:tests.length}));
