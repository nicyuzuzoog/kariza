const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';
const PRODUCT = `${BASE}/products/6ae84fb2b156c613f3733b9a`;
const PORT = 9333;

import { spawn } from 'node:child_process';
import fs from 'node:fs';

const loginRes = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'superadmin@mrskariza.school', password: 'Admin@1234' }),
});
const login = await loginRes.json();
if (!login.token) throw new Error(`Login failed: ${JSON.stringify(login)}`);

fs.mkdirSync('C:/Users/user/AppData/Local/Temp/opencode/mrskariza-cdp', { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--remote-allow-origins=*',
  '--user-data-dir=C:/Users/user/AppData/Local/Temp/opencode/mrskariza-cdp/profile',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--disable-extensions',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let targets;
for (let i = 0; i < 40; i += 1) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    if (targets.some((target) => target.type === 'page')) break;
  } catch {
    // not ready
  }
  await sleep(250);
}
const pageTarget = targets?.find((target) => target.type === 'page');
if (!pageTarget) throw new Error('Chrome did not start');

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const events = [];
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  } else if (message.method) {
    events.push(message.method);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');

async function navigate(url) {
  await send('Page.navigate', { url });
  await sleep(2500);
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

await navigate(`${BASE}/login`);
await evaluate(`localStorage.setItem('mrskariza_token', ${JSON.stringify(login.token)}); localStorage.setItem('mrskariza_user', ${JSON.stringify(JSON.stringify(login.user))}); 'ok'`);

for (const width of [1440, 1024, 768, 390]) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await navigate(PRODUCT);
  const diagnostics = await evaluate(`(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    document.querySelectorAll('body *').forEach((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (rect.width === 0 && rect.height === 0) return;
      if (rect.right > vw + 1 || rect.left < -1) {
        bad.push({
          tag: el.tagName,
          cls: String(el.className || '').slice(0, 90),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 45),
        });
      }
    });
    return {
      viewport: vw,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflow: bad.slice(0, 25),
    };
  })()`);

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`C:/Users/user/AppData/Local/Temp/opencode/mrskariza-${width}.png`, Buffer.from(screenshot.data, 'base64'));

  console.log(`\n=== ${width}px ===`);
  console.log(JSON.stringify(diagnostics, null, 2));
}

ws.close();
chrome.kill();
