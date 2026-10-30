# Third-party components

The npm lockfile pins the installed dependency graph. The original packages include their license files. The app does not claim ownership of the model or dependencies.

| Component | Purpose | License / source |
| --- | --- | --- |
| Transformers.js 4.3.2 | Tokenization, model loading and embeddings | Apache-2.0, https://github.com/huggingface/transformers.js |
| ONNX Runtime Web | Local WASM inference | MIT, https://github.com/microsoft/onnxruntime |
| BGE small English v1.5 | Open embedding weights | MIT, https://huggingface.co/BAAI/bge-small-en-v1.5 |
| Xenova ONNX conversion | q8 browser-compatible model | https://huggingface.co/Xenova/bge-small-en-v1.5 |
| Vite 8.3.5 | Development and static build | MIT, https://github.com/vitejs/vite |

Model conversion revision: `ea104dacec62c0de699686887e3f920caeb4f3e3`. Model files are fetched at runtime; they are not committed to this repository. BGE uses CLS pooling and a retrieval query instruction documented by its authors. The 0.56 application cutoff is our demo-fixture choice, not a threshold guaranteed by the model authors.

The production build copies the full installed dependency license texts into `dist/licenses/` so they remain available alongside redistributed runtime code. Transitive dependency licenses are included where the package publishes a license file.
