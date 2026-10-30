# Echoes

Browser-local memory archive for the DEV Hacktoberfest Week 4 challenge (2026).

- Stack: vanilla JavaScript, Vite, Transformers.js, ONNX BGE embeddings in a Web Worker.
- `src/core.js`: archive validation, ordering, chunking and retrieval contracts.
- `src/ai.worker.js`: real local model inference; no remote text inference.
- `src/main.js`, `src/style.css`: accessible browser UI; light MacOS-inspired surfaces.
- `tests/`: Node behavior tests. `scripts/check-model.mjs`: real inference smoke test.
- Run: `npm ci`, `npm run dev`; release: `npm test`, `npm run build`.
- Preserve verbatim memories. Never synthesize quotes or infer missing dates as facts.
- Do not upload archive contents, add analytics, or embed credentials. Public demo data is explicitly fictional.
- Export/import must be lossless and reject invalid archives before replacing data.
- Keep AI status honest; lexical fallback must be labeled. No fabricated metrics or testimonials.
- Read local `agents/STATUS.md` when present; private execution notes are not part of the public source. Competition submission is incomplete until published and verified.
