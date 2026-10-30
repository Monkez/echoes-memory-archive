# Echoes — The stories we keep

A small, browser-local archive for memories and their original words. Search for “baking lessons” and find a story about kneading dough, even when the words *baking lessons* never appear in it.

Echoes retrieves passages. It does not impersonate a person, generate recollections, or fill gaps in history. Unknown dates stay unknown; approximate years remain visibly approximate. The six starter stories are explicitly fictional.

Built during October 26–31, 2026 for the DEV Hacktoberfest Week 4 theme, **Ghost in the Machine**. Implementation and writing were produced with an AI coding agent under the project owner's direction. There are no claims of customer traction, personal family history, or prizes won.

## Use it

1. Explore the six fictional memories, or choose **Start a new archive**.
2. Add the original words, a person and a source. Leave the date unknown when needed.
3. Try **By meaning** for English semantic search. The first search downloads the model (about 34 MB) and processes the query on your device.
4. Choose **Exact words** for a deterministic word-matching fallback without a model.
5. **Export → JSON** creates a restorable backup. **Markdown** creates a readable document. Import previews an archive before replacing your current one.

Browser data is not a backup. Keep exported files somewhere you trust. Changes can be undone one step, until the next change or a reload. If another tab changes the archive, reload before saving to avoid overwriting it.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended) and npm. On Windows:

```bat
setup.bat
run.bat
```

On other systems:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5175`). To check the production build, run `npm run build` then `npm run preview` (port 4175). Stop with Ctrl+C. No API key, backend, or paid inference service is required.

## Checks

```sh
npm test
npm run build
npm run test:model
```

The model check downloads/caches the pinned q8 model and performs real CPU inference. It covers five related queries and three unrelated queries over the fictional archive. These fixtures are deliberately small: they are not a general accuracy benchmark. See [verification](docs/VERIFICATION.md) for actual browser checks and remaining limits.

## How search works

- Original text is divided into contiguous passages, with source offsets preserved.
- A Web Worker runs BGE small English through Transformers.js and ONNX Runtime WASM, using CLS pooling, normalized embeddings, and BGE's query instruction.
- Cosine similarity ranks passages. A 0.56 cutoff was selected against the small demo fixture; it is not a probability or a universal relevance threshold.
- Before showing a result, the app checks that its text exactly equals the saved source slice. The highest-scoring passage per memory is shown.

The worker caches passage embeddings in memory and discards unused entries after a search. Cancel terminates the worker; later searches can load the cached model again. The archive is capped at 200 memories and 12,000 characters per memory to keep this local prototype bounded.

## Privacy, offline use and limits

- Memory text and queries are processed locally. There is no archive upload, telemetry or hosted inference endpoint.
- First loading contacts the hosting provider; first AI use contacts Hugging Face for model files. Those services can observe ordinary download metadata such as IP address.
- `localStorage` is **not encrypted**. Someone with access to the browser profile may read it. Clearing browser data, changing browser/origin, or storage eviction can remove the archive or caches.
- The production build includes an app-shell service worker. Transformers.js manages the model cache separately. Complete a successful search while online before attempting offline use. Missing or evicted caches require another download. Development mode does not install the app-shell worker.
- English semantic retrieval can miss relevant memories or suggest irrelevant ones. Other-language text can be stored, but multilingual semantic quality is not claimed. Exact words supports literal Unicode text.
- Mobile layout is tested at a narrow viewport; mobile-device inference performance has not been benchmarked. Modern browsers with WebAssembly and Web Workers are required for AI.
- Sources and dates are entered by the archivist; the app does not verify historical truth.

## Project map

`src/core.js` handles validation, dates, chunking and retrieval contracts; `storage.js` handles browser persistence; `ai.worker.js` performs inference; `main.js` and `style.css` implement the UI. `scripts/offline.mjs` generates the production cache. `.openai/hosting.json` identifies the demo deployment and contains no credential. Local `agents/` notes are ignored and are not needed to run the app.

## License and credits

Echoes code and its fictional sample text are MIT licensed; see [LICENSE](LICENSE). Dependencies and models retain their own terms; see [THIRD_PARTY.md](THIRD_PARTY.md). The UI uses system fonts and small inline SVG symbols; no external image or icon service is used.
