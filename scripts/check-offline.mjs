// Local fault-injection harness. Never included in dist/ or a deployment.
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve, join, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.argv[2] || 4181);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Provide a port between 1024 and 65535.");
const root = await mkdtemp(join(tmpdir(), "echoes-offline-check-"));
await cp(fileURLToPath(new URL("../dist/", import.meta.url)), root, { recursive: true });
const serviceWorker = await readFile(join(root, "sw.js"), "utf8");
await writeFile(join(root, "sw.js"), `
// QA ONLY: simulate failed network requests while preserving real Cache API.
let qaOffline = false;
const onlineFetch = self.fetch.bind(self);
self.fetch = (...args) => qaOffline
  ? Promise.reject(new TypeError('QA network unavailable')) : onlineFetch(...args);
self.addEventListener('message', event => {
  if (event.data === 'qa-offline') qaOffline = true;
  if (event.data === 'qa-online') qaOffline = false;
  event.source?.postMessage({ qaOffline });
});
self.addEventListener('fetch', event => {
  if (qaOffline && new URL(event.request.url).origin !== self.location.origin)
    event.respondWith(Promise.reject(new TypeError('QA external network unavailable')));
});
${serviceWorker}`);
await writeFile(join(root, "qa.html"), `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Echoes offline check</title>
<h1>Local network fault test</h1>
<p>This affects only this test origin. App code is copied from dist unchanged.</p>
<p id="state">Preparing service worker</p>
<button id="offline" disabled>Block network</button>
<button id="online" disabled>Restore network</button>
<button id="probe" disabled>Probe external network</button>
<p id="probe-result"></p><a href="/" target="_blank">Open Echoes test build</a>
<p>Run a successful AI search online first. Block, probe, reload the app, then search again.
Restore network before closing. A new port provides a fresh browser storage origin.</p>
<script>
navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(() => {
  document.querySelector('#state').textContent = 'Ready';
  document.querySelectorAll('button').forEach(b => b.disabled = false);
});
navigator.serviceWorker.addEventListener('message', e => {
  document.querySelector('#state').textContent = e.data.qaOffline
    ? 'Network blocked by QA service worker' : 'Network restored';
});
async function mode(value) {
  const registration = await navigator.serviceWorker.ready;
  registration.active.postMessage(value);
}
document.querySelector('#offline').onclick = () => mode('qa-offline');
document.querySelector('#online').onclick = () => mode('qa-online');
document.querySelector('#probe').onclick = async () => {
  try {
    await fetch('https://huggingface.co/api/models/BAAI/bge-small-en-v1.5', { cache: 'no-store' });
    document.querySelector('#probe-result').textContent = 'External fetch succeeded';
  } catch {
    document.querySelector('#probe-result').textContent = 'External fetch blocked';
  }
};
</script></html>`);
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] || "text/plain", "Cache-Control": "no-store" });
    response.end(body);
  } catch { response.writeHead(404).end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`QA only: http://127.0.0.1:${port}/qa.html`));
