// node shoot.mjs <cdp-port> <url> <outdir> <label> <cssWidth> <dpr> <mobile:0|1>
import fs from 'node:fs';
const [,, port, url, outdir, label, cssW, dprS, mobileS] = process.argv;
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const {res, rej} = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails).slice(0,300));
  else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text.slice(0,300));
};
const send = (method, params={}) => new Promise((res, rej) => { const i = ++id; pending.set(i, {res, rej}); ws.send(JSON.stringify({id: i, method, params})); });
const evaluate = async (expr) => { const r = await send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true}); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
const dpr = +dprS, W = +cssW, mobile = mobileS === '1';
await send('Emulation.setDeviceMetricsOverride', {width: W, height: 900, deviceScaleFactor: dpr, mobile});
await send('Page.navigate', {url});
await new Promise(r => setTimeout(r, 1500));
const nimg = await evaluate(`(async () => { for (const im of document.images) im.loading = 'eager'; const fails = []; await Promise.all([...document.images].map(im => im.decode().catch(e => fails.push(im.src)))); return JSON.stringify({n: document.images.length, fails}); })()`);
await new Promise(r => setTimeout(r, 500));
const info = await evaluate(`JSON.stringify({ docH: document.documentElement.scrollHeight, docW: document.documentElement.scrollWidth, innerW: innerWidth, imgs: [...document.images].map(im => { const r = im.getBoundingClientRect(); return {src: im.currentSrc.split('/').pop(), top: r.top + scrollY, h: r.height, w: r.width, left: r.left, nw: im.naturalWidth, nh: im.naturalHeight, complete: im.complete}; }) })`);
fs.writeFileSync(`${outdir}/${label}-layout.json`, info);
const {docH} = JSON.parse(info);
const CH = 4000; const parts = [];
for (let y = 0; y < docH; y += CH) {
  const h = Math.min(CH, docH - y);
  const r = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true, clip: {x: 0, y, width: W, height: h, scale: 1}});
  const f = `${outdir}/${label}-part-${String(y).padStart(6,'0')}.png`;
  fs.writeFileSync(f, Buffer.from(r.data, 'base64')); parts.push(f);
}
console.log(JSON.stringify({label, W, dpr, docH, parts: parts.length, images: JSON.parse(nimg), errors}));
ws.close();
