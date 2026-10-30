import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(path = "") {
  const entries = await readdir(new URL("../dist/" + path, import.meta.url), {
    withFileTypes: true,
  });
  const result = [];
  for (const entry of entries) {
    const child = path + entry.name;
    if (entry.isDirectory()) result.push(...(await files(child + "/")));
    else if (entry.name !== "sw.js") result.push("/" + child);
  }
  return result;
}
const assets = await files();
const hash = createHash("sha256");
for (const path of assets)
  hash.update(await readFile(new URL("../dist" + path, import.meta.url)));
const name = "echoes-shell-" + hash.digest("hex").slice(0, 16);
await writeFile(
  new URL("../dist/sw.js", import.meta.url),
  `const CACHE=${JSON.stringify(name)};const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('echoes-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const path=u.pathname==='/'?'/index.html':u.pathname;if(!ASSETS.includes(path))return;e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match(path))));});
`,
);
console.log(
  "Offline app shell:",
  name,
  assets.length,
  "assets. Model cache is managed separately by Transformers.js.",
);
