import { spawn } from 'node:child_process';

console.log('start');
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9334',
  '--remote-allow-origins=*',
  '--user-data-dir=C:/Users/user/AppData/Local/Temp/opencode/mrskariza-cdp/profile2',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

chrome.stderr.on('data', (data) => console.log('chrome:', data.toString().slice(0, 300)));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
console.log('spawned');

for (let i = 0; i < 40; i += 1) {
  try {
    const response = await fetch('http://127.0.0.1:9334/json/list');
    const targets = await response.json();
    if (targets.length) {
      console.log('targets:', targets.map((t) => `${t.type} ${t.url}`));
      const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', () => { console.log('ws open'); resolve(); }, { once: true });
        ws.addEventListener('error', (event) => { console.log('ws error', event.message); reject(new Error('ws error')); }, { once: true });
      });
      ws.send(JSON.stringify({ id: 1, method: 'Browser.getVersion' }));
      ws.addEventListener('message', (event) => {
        console.log('message:', event.data.slice(0, 200));
        ws.close();
        chrome.kill();
        process.exit(0);
      });
      break;
    }
  } catch (error) {
    if (i % 10 === 0) console.log('waiting', i, error.message);
  }
  await sleep(250);
}

setTimeout(() => {
  console.log('timeout exit');
  chrome.kill();
  process.exit(1);
}, 20000);
