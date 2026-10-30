# Verification — 2026-10-30

Tested on Windows with Node 24.18 and the Chromium-based in-app browser. This records observed behavior, not universal browser or model guarantees.

## Automated and installation checks

- 11/11 behavior tests pass: lossless archive serialization, dates and invalid dates, input bounds, source-offset checks, semantic ranking, clearly separate lexical fallback, export escaping, persistence, corrupt stored data, and quota failure.
- `setup.bat` successfully performed a clean npm install, test run and production build. It initially encountered a Windows file lock while Vite preview was running; after stopping that process, clean setup succeeded. Failure handling also checks nonzero negative Windows error codes.
- `npm run test:model` passes five related-query assertions and three unrelated-query rejection assertions using the pinned q8 BGE model on native CPU, including after the clean install. The cutoff was selected using this same small fixture, so these are regression checks, not a held-out accuracy estimate.
- Production build includes the explicit 14.3 MB WASM runtime, the approximately 499 kB worker, app assets and dependency license texts. The unused 26.9 MB asyncify binary was removed through ONNX's external-WASM export condition.

## Browser flows observed

- Real WASM inference found the expected best memory for baking lessons, repairing broken electronics, leaving home, growing/sharing plants, and overcoming fear. Three unrelated queries returned zero connections. Warm query times vary by device; no general performance promise is made.
- Add, reload, edit, remove and undo worked. An entered unknown date remained unknown, an approximate year remained labeled, and year 9999 was rejected without saving.
- A test memory containing leading/trailing spaces, newlines, Vietnamese text and literal `<script>` text was saved and exported unchanged. It rendered as text rather than executable markup.
- Downloaded JSON was read back and checked for the exact text and seven entries, then imported through the UI. An invalid JSON archive was rejected while the prior seven entries remained visible.
- Creating an empty archive disabled search and displayed the empty state. Undo restored the previous archive.
- A second tab changed a keepsake; the first tab's attempted write was blocked with a reload message. The test change was undone and the original six-story sample restored.
- Desktop and 390×844 layout were visually inspected. At the narrow viewport, document scroll width and client width were both 375 px (remaining width used by scrollbar). The add/edit dialog fits and can scroll; icon-only controls have explicit accessible names.
- A toast initially covered a footer undo control. The toast now ignores pointer events, and the persistent undo control was retested successfully.
- Search cancellation is available while the worker is busy; worker messages carry request IDs to reject stale results. No archive mutation is performed by search.

## Offline evidence and limits

After a successful search and cache preparation, the preview server was stopped. The browser reloaded the production app and successfully performed another semantic search. A stronger follow-up used a test-only service worker that rejects same-origin network fetches and cross-origin requests, while leaving the production app's cache fallback intact. An independent external fetch probe failed, then the app was reloaded to create a fresh AI worker.

That stronger check initially failed: Transformers.js 4.3.2's `get_tokenizer_files` calls its metadata helper without forwarding the selected revision. It probed `resolve/main/tokenizer_config.json`, while actual tokenizer files were cached under the pinned revision. The single-model worker now pins `env.remotePathTemplate` too, so the metadata probe and downloads resolve to the same immutable URL and cache entry. No node_modules patch or fake response is used.

After the fix, the reloaded app returned the expected bread story and passed all five related-query and three unrelated-query browser checks with requests blocked. The test harness does not change operating-system connectivity, so this is controlled request-failure evidence, not a claim that every device or browser was tested. Browser cache eviction still requires a new download. Storage remains local and unencrypted; exported backups are essential.

To reproduce: run `npm run build`, then `node scripts/check-offline.mjs` and open the printed `/qa.html` URL. Run one AI search in the app while online, select **Block network** and **Probe external network** in the control tab, reload the app, and search again. The probe must report **External fetch blocked**. Select **Restore network** before closing the tabs and stopping the server. Supply a different port as the script's first argument for a fresh browser storage origin. The harness copies `dist/` to a temporary directory and injects faults only into that copy; it is never deployed.

## Release status

This file describes local verification. A successful local build is not proof that the public demo, repository, DEV article, contest entry, or prize payment exists. Those are separate release steps.
