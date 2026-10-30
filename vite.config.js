import { defineConfig } from "vite";
export default defineConfig({
  // We supply the matching WASM factory and binary explicitly in ai.worker.js.
  // Avoid bundling ONNX's additional, unused asyncify runtime (27 MB).
  resolve: {
    conditions: [
      "onnxruntime-web-use-extern-wasm",
      "module",
      "browser",
      "development|production",
    ],
  },
  worker: { format: "es" },
  build: { target: "es2022" },
  server: { port: 5175, strictPort: true },
  preview: { port: 4175, strictPort: true },
});
