import { pipeline, env } from "@huggingface/transformers";
import wasmURL from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import factoryURL from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import {
  MODEL,
  MODEL_REVISION,
  POOLING,
  QUERY_PREFIX,
  MIN_SIMILARITY,
} from "./model-config.js";
import { chunksFor, rankChunks, validateArchive } from "./core.js";

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = { wasm: wasmURL, mjs: factoryURL };
let extractor,
  busy = false;
const cache = new Map();
self.onmessage = async ({ data }) => {
  if (busy) return;
  busy = true;
  const { id, query, archive } = data;
  const send = (message) => self.postMessage({ id, ...message });
  try {
    validateArchive(archive);
    if (typeof query !== "string" || !query.trim() || query.length > 300)
      throw new Error("Enter a question of up to 300 characters.");
    if (!extractor) {
      send({
        type: "progress",
        text: "Loading the open model. Your memories stay in this browser.",
      });
      extractor = await pipeline("feature-extraction", MODEL, {
        revision: MODEL_REVISION,
        dtype: "q8",
        device: "wasm",
        progress_callback: (p) => {
          if (p.status === "progress" && p.file?.endsWith(".onnx"))
            send({
              type: "progress",
              text: `Downloading search model · ${Math.round(p.progress)}%`,
            });
        },
      });
    }
    const chunks = chunksFor(archive.memories);
    const vectors = [];
    const start = performance.now();
    for (let i = 0; i < chunks.length; i += 8) {
      const batch = chunks.slice(i, i + 8);
      const missing = [
        ...new Set(batch.map((c) => c.text).filter((text) => !cache.has(text))),
      ];
      if (missing.length) {
        const output = (
          await extractor(missing, { pooling: POOLING, normalize: true })
        ).tolist();
        missing.forEach((text, j) => cache.set(text, output[j]));
      }
      vectors.push(...batch.map((c) => cache.get(c.text)));
      send({
        type: "progress",
        text: `Reading memories locally · ${Math.min(i + 8, chunks.length)}/${chunks.length} passages`,
      });
    }
    const queryVector = (
      await extractor(QUERY_PREFIX + query, {
        pooling: POOLING,
        normalize: true,
      })
    ).tolist()[0];
    const results = rankChunks(chunks, vectors, queryVector, MIN_SIMILARITY);
    send({
      type: "results",
      results,
      elapsed: Math.round(performance.now() - start),
      model: MODEL,
    });
    const keep = new Set(chunks.map((c) => c.text));
    for (const key of cache.keys()) if (!keep.has(key)) cache.delete(key);
  } catch (error) {
    send({
      type: "error",
      text: "Local AI could not finish. Check your connection for the first model download, or use Exact words. Your archive is unchanged.",
      detail: String(error.message || error),
    });
  } finally {
    busy = false;
  }
};
