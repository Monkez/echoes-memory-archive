import "./style.css";
import {
  chronological,
  dateLabel,
  escapeHtml as esc,
  validateArchive,
  validateMemory,
  safeResults,
  lexicalSearch,
  exportMarkdown,
  MAX_MEMORIES,
} from "./core.js";
import { readArchive, writeArchive, STORAGE_KEY } from "./storage.js";
import { demoArchive } from "./demo.js";

const paths = {
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  book: '<path d="M12 5c-4-3-8-2-10-1v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  down: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  up: '<path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  edit: '<path d="m15 5 4 4M3 21l5-1L21 7a3 3 0 0 0-4-4L4 16l-1 5Z"/>',
  sparkles:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = (name) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
let archive,
  storageProblem = "",
  blockedSave = false,
  changedInOtherTab = false;
try {
  archive = readArchive(localStorage, demoArchive);
} catch {
  archive = structuredClone(demoArchive);
  storageProblem =
    "Your saved archive could not be read. Export the original saved file before replacing it. The sample is shown for now.";
  blockedSave = true;
}
let view = "all",
  person = "",
  query = "",
  searchMode = "meaning",
  results = null,
  searched = "",
  status = "idle",
  statusText = "",
  aiReady = false,
  elapsed = 0;
let worker,
  requestId = 0,
  timeout,
  toastTimer,
  undoArchive = null,
  previousFocus,
  importCandidate;
const modal = document.querySelector("#modal");
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 5000);
}
function setStatus(value, text) {
  status = value;
  statusText = text;
  renderSearchState();
}
function cancelSearch() {
  requestId++;
  worker?.terminate();
  worker = null;
  aiReady = false;
  clearTimeout(timeout);
  setStatus("idle", "Search stopped. Your archive is unchanged.");
}
function commit(next, message) {
  if (changedInOtherTab) {
    toast(
      "Another tab changed this archive. Reload before saving so its changes are not lost.",
    );
    return false;
  }
  if (blockedSave) {
    toast(
      "Export the original saved file first, then start a new archive to recover.",
    );
    return false;
  }
  try {
    const clean = writeArchive(localStorage, next);
    undoArchive = structuredClone(archive);
    archive = clean;
    storageProblem = "";
    results = null;
    searched = "";
    if (status === "working") cancelSearch();
    render();
    toast(message);
    return true;
  } catch {
    storageProblem =
      "This browser could not save the change. Your previous archive is unchanged. Export a backup or free browser storage, then try again.";
    toast(storageProblem);
    return false;
  }
}
function people() {
  return [
    ...new Set(archive.memories.map((m) => m.person).filter(Boolean)),
  ].sort();
}
function included(m) {
  return (
    (!person || m.person === person) &&
    (view !== "keepsakes" || m.kept) &&
    (view !== "undated" || m.date.precision === "unknown")
  );
}
function visibleMemories() {
  return chronological(archive.memories).filter(included);
}
function render() {
  const count = archive.memories.length;
  document.querySelector("#app").innerHTML =
    `<div class="app-shell"><aside class="sidebar"><a href="#" class="brand" data-action="home"><img src="/echo.svg" alt=""/><span>echoes<small>A place for what remains.</small></span></a><div class="archive-name"><span class="archive-initial">${icon("book")}</span><div><strong>Your local archive</strong><small>${count} ${count === 1 ? "memory" : "memories"} preserved</small></div></div><p class="nav-label">YOUR COLLECTION</p><nav aria-label="Collection views">${[
      ["all", "book", "All memories", count],
      [
        "keepsakes",
        "heart",
        "Keepsakes",
        archive.memories.filter((m) => m.kept).length,
      ],
      [
        "undated",
        "clock",
        "Dates to revisit",
        archive.memories.filter((m) => m.date.precision === "unknown").length,
      ],
    ]
      .map(
        ([id, ic, label, n]) =>
          `<button data-view="${id}" ${view === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span><b>${n}</b></button>`,
      )
      .join(
        "",
      )}</nav><div class="people-filter"><label for="person-filter">PEOPLE IN THESE STORIES</label><select id="person-filter" aria-label="People in these stories"><option value="">Everyone</option>${people()
      .map(
        (p) =>
          `<option ${person === p ? "selected" : ""} value="${esc(p)}">${esc(p)}</option>`,
      )
      .join(
        "",
      )}</select></div><div class="sidebar-bottom"><div class="local-note">${icon("shield")}<div><strong>Yours to keep.</strong><p>Memories stay in this browser.<br/>Export a backup to keep them safe.</p></div></div><button class="sidebar-about" data-action="about">${icon("info")} Privacy & open technology</button></div></aside><div class="workspace"><header class="toolbar"><span class="breadcrumb">Your archive <span>/</span> ${view === "keepsakes" ? "Keepsakes" : view === "undated" ? "Dates to revisit" : "All memories"}</span><div class="toolbar-actions"><button class="button subtle" data-action="export" aria-label="Export">${icon("down")}<span>Export</span></button><button class="button subtle" data-action="import" aria-label="Import">${icon("up")}<span>Import</span></button><button class="button primary" data-action="add" aria-label="Add a memory">${icon("plus")}<span>Add a memory</span></button></div></header><main id="main"><div class="heading"><div class="eyebrow">KEEP THEIR WORDS. FIND THEIR STORIES.</div><h1>${esc(archive.title)}</h1><p>A recipe. A train journey. A song without a name.<br class="mobile-break"/> Small things worth remembering.</p></div>${storageProblem ? `<div class="error-banner">${esc(storageProblem)} ${blockedSave ? '<button data-action="recover" class="text-button">Export original saved file</button>' : ""}</div>` : ""}<section class="search-panel" aria-label="Search memories"><div class="search-heading"><div class="search-title">${icon("sparkles")}<strong>What do you remember?</strong></div><div class="segmented" role="group" aria-label="Search method"><button data-mode="meaning" aria-pressed="${searchMode === "meaning"}">By meaning</button><button data-mode="words" aria-pressed="${searchMode === "words"}">Exact words</button></div></div><form id="search-form"><label class="search-input">${icon("search")}<input id="query" maxlength="300" value="${esc(query)}" aria-label="Find a memory" placeholder="Try “baking lessons” or “overcoming a fear”…" autocomplete="off"/></label><button class="button primary" id="search-submit" type="submit">Find memories ${icon("arrow")}</button></form><div class="search-bottom"><div id="search-state" aria-live="polite"></div><button class="text-button" id="cancel-search" data-action="cancel" hidden>Stop search</button></div><div class="try-queries"><span>Try a connection</span>${["baking lessons", "repairing broken electronics", "overcoming a lifelong fear"].map((q) => `<button data-query="${q}">${q}</button>`).join("")}</div></section><section id="memories" aria-label="Memory collection">${renderMemories()}</section><footer class="archive-footer"><span>${icon("shield")} No account. No memory uploads. Export anytime.</span>${undoArchive ? '<button class="text-button" data-action="undo">Undo last change</button>' : ""}<button class="text-button mobile-privacy" data-action="about">Privacy & open technology</button><button class="text-button" data-action="new">Start a new archive</button></footer></main></div></div>`;
  renderSearchState();
}
function renderSearchState() {
  const state = document.querySelector("#search-state");
  if (!state) return;
  const submit = document.querySelector("#search-submit"),
    cancel = document.querySelector("#cancel-search");
  submit.disabled = status === "working" || archive.memories.length === 0;
  cancel.hidden = status !== "working";
  const message =
    statusText ||
    (searchMode === "words"
      ? "Matches the words you type. No AI download needed."
      : aiReady
        ? "Open AI is ready on this device. Searches stay local."
        : "First AI search downloads an open model (~34 MB). English search; nothing you write is uploaded.");
  state.className = status === "error" ? "search-state error" : "search-state";
  state.innerHTML = `${status === "working" ? '<span class="spinner"></span>' : icon(status === "error" ? "info" : "shield")}<span>${esc(message)}</span>`;
}
function renderMemories() {
  const list = visibleMemories();
  if (results !== null) {
    const filtered = results.filter((r) =>
      included(archive.memories.find((m) => m.id === r.memoryId)),
    );
    return `<div class="collection-heading"><div><h2>Connections to “${esc(searched)}”</h2><p>${searchMode === "words" ? "Exact-word matches" : "Possible connections, not an answer or a claim of fact."}${elapsed && searchMode === "meaning" ? ` · ${elapsed} ms on this device` : ""}</p></div><button class="text-button" data-action="clear-search">${icon("close")} Clear search</button></div>${
      filtered.length
        ? `<div class="results-grid">${filtered
            .map((r) =>
              memoryCard(
                archive.memories.find((m) => m.id === r.memoryId),
                r,
              ),
            )
            .join("")}</div>`
        : `<div class="empty">${icon("search")}<h3>No close connection found</h3><p>Try different words, choose another person, or use Exact words.<br/>Echoes will not invent a memory to fill the gap.</p></div>`
    }<p class="evidence-note">${icon("check")} Every passage below is an exact slice of a saved memory. Similarity is not proof that a memory answers your question.</p>`;
  }
  const heading =
    view === "keepsakes"
      ? "Your keepsakes"
      : view === "undated"
        ? "A story without a date is still a story."
        : "An archive of ordinary, extraordinary things";
  return `<div class="collection-heading"><div><h2>${heading}</h2><p>${list.length} ${list.length === 1 ? "memory" : "memories"}${person ? " · " + esc(person) : ""} · Ordered by the dates you recorded</p></div><span class="collection-chip">${icon("clock")} ${view === "undated" ? "Unplaced in time" : "A life, in fragments"}</span></div>${list.length ? `<div class="memory-grid">${list.map((m) => memoryCard(m)).join("")}</div>` : `<div class="empty">${icon("book")}<h3>${countEmptyTitle()}</h3><p>${view === "keepsakes" ? "Use the heart on a memory to keep it close." : view === "undated" ? "All memories in this view have a recorded year or date." : "Add a story in its own words. You can leave the date unknown."}</p><button class="button" data-action="add">${icon("plus")} Add a memory</button></div>`}<p class="sample-note">Sample stories are fictional and labeled in their source. Add your own, or start with an empty archive.</p>`;
}
function countEmptyTitle() {
  return view === "keepsakes"
    ? "Keep something close"
    : view === "undated"
      ? "Nothing to revisit here"
      : "Your first memory starts here";
}
function memoryCard(m, result) {
  const colors = ["blue", "rose", "sage", "amber"];
  const idx = archive.memories.findIndex((x) => x.id === m.id);
  const color = colors[idx % colors.length];
  const short = result
    ? result.text
    : m.text.length > 190
      ? m.text.slice(0, 190).trimEnd() + "…"
      : m.text;
  return `<article class="memory-card ${color}" data-memory="${esc(m.id)}"><div class="memory-top"><span class="person-tag"><span class="person-dot"></span>${esc(m.person || "Person not recorded")}</span><button class="heart-button ${m.kept ? "kept" : ""}" data-keep="${esc(m.id)}" aria-label="${m.kept ? "Remove keepsake" : "Keep memory"}: ${esc(m.title)}" aria-pressed="${m.kept}">${icon("heart")}</button></div><button class="memory-open" data-open="${esc(m.id)}"><span class="memory-date ${m.date.precision === "unknown" ? "uncertain" : ""}">${esc(dateLabel(m.date))}${m.date.precision === "approximate" ? " · approximate" : ""}</span><h3>${esc(m.title)}</h3><blockquote>${esc(short)}</blockquote><span class="read-more">${result ? "Read original passage" : "Open memory"} ${icon("arrow")}</span></button><div class="memory-footer"><span>${icon("book")} ${esc(m.source || "Source not recorded")}</span>${result && searchMode === "meaning" ? `<span class="similarity" title="Cosine similarity; not a confidence score">${result.score.toFixed(2)} similarity</span>` : ""}</div></article>`;
}
function refreshList() {
  document.querySelector("#memories").innerHTML = renderMemories();
}
async function search(text = query) {
  query = text.trim();
  const field = document.querySelector("#query");
  if (field) field.value = query;
  if (!query) {
    toast("Write a few words about the memory you want to find.");
    field?.focus();
    return;
  }
  if (!archive.memories.length) {
    toast("Add a memory before searching.");
    return;
  }
  if (status === "working") cancelSearch();
  searched = query;
  results = null;
  elapsed = 0;
  refreshList();
  if (searchMode === "words") {
    results = safeResults(
      archive.memories,
      lexicalSearch(archive.memories, query),
    );
    setStatus("idle", "Exact-word search. AI was not used.");
    refreshList();
    return;
  }
  const id = ++requestId;
  if (!worker) {
    worker = new Worker(new URL("./ai.worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (data.id !== requestId) return;
      if (data.type === "progress") {
        setStatus("working", data.text);
        return;
      }
      clearTimeout(timeout);
      if (data.type === "results") {
        aiReady = true;
        results = safeResults(archive.memories, data.results);
        elapsed = data.elapsed;
        setStatus(
          "idle",
          `Search complete · ${results.length} possible ${results.length === 1 ? "connection" : "connections"} · processed on your device`,
        );
        refreshList();
      } else {
        setStatus("error", data.text);
        worker?.terminate();
        worker = null;
        aiReady = false;
      }
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker?.terminate();
      worker = null;
      aiReady = false;
      setStatus(
        "error",
        "Your browser could not start local AI. Try Exact words; your memories are unchanged.",
      );
    };
  }
  setStatus("working", "Starting private search…");
  timeout = setTimeout(() => {
    cancelSearch();
    setStatus(
      "error",
      "The search took too long. Try again on a faster connection, or use Exact words.",
    );
  }, 180000);
  worker.postMessage({ id, query, archive });
}
function showModal(html) {
  previousFocus = document.activeElement;
  modal.innerHTML = `<button class="modal-close" data-action="close" aria-label="Close dialog">${icon("close")}</button>${html}`;
  modal.showModal();
}
function closeModal() {
  modal.close();
  previousFocus?.focus();
}
modal.addEventListener("close", () => previousFocus?.focus());
function openMemory(id) {
  const m = archive.memories.find((x) => x.id === id);
  if (!m) return;
  showModal(
    `<p class="eyebrow">${esc(m.person || "A saved memory")}</p><h2 id="modal-title">${esc(m.title)}</h2><span class="reading-date">${icon("clock")} ${esc(dateLabel(m.date))}${m.date.precision === "approximate" ? " · estimated by the archivist" : ""}</span><blockquote class="original-text">${esc(m.text)}</blockquote><div class="source-note">${icon("book")}<div><strong>Original source</strong><p>${esc(m.source || "No source recorded. Add one when you can.")}</p><small>Preserved verbatim. Dates and source descriptions are recorded by the archivist, not verified by AI.</small></div></div><div class="modal-footer"><button class="button" data-edit="${esc(m.id)}">${icon("edit")} Edit memory</button><button class="button danger-text" data-delete="${esc(m.id)}">${icon("trash")} Remove</button><button class="button primary" data-action="close">Done</button></div>`,
  );
}
function editMemory(id) {
  if (modal.open) modal.close();
  const m = archive.memories.find((x) => x.id === id);
  if (!m && archive.memories.length >= MAX_MEMORIES) {
    toast(
      `This archive is limited to ${MAX_MEMORIES} memories. Export it and start another archive.`,
    );
    return;
  }
  showModal(
    `<p class="eyebrow">IN THEIR OWN WORDS</p><h2 id="modal-title">${m ? "Edit this memory" : "Keep a memory"}</h2><p class="modal-intro">A small detail is enough. Leave what you do not know blank.</p><form id="memory-form" data-id="${esc(m?.id || "")}"><label>Give it a title<input name="title" required maxlength="120" value="${esc(m?.title || "")}" placeholder="The radio on the windowsill"/></label><label>The memory<textarea name="text" required maxlength="12000" rows="5" placeholder="Keep the original words, as you remember or recorded them.">${esc(m?.text || "")}</textarea></label><div class="form-row"><label>Who is it about?<input name="person" maxlength="80" value="${esc(m?.person || "")}" placeholder="A name, or leave blank"/></label><label>How well do you know the date?<select name="precision" id="date-precision">${[
      ["unknown", "Date unknown"],
      ["approximate", "Approximate year"],
      ["year", "Known year"],
      ["day", "Exact date"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${m?.date.precision === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label></div><label id="date-field">Date or year<input name="date" id="date-value" value="${esc(m?.date.value || "")}"/><small id="date-help"></small></label><label>Where did these words come from?<input name="source" maxlength="200" value="${esc(m?.source || "")}" placeholder="A letter, a notebook, a conversation…"/></label><p class="form-error" id="form-error" role="alert"></p><div class="modal-footer"><span class="save-note">${icon("shield")} Saved only in this browser</span><button type="button" class="button" data-action="close">Cancel</button><button type="submit" class="button primary">Save memory</button></div></form>`,
  );
  updateDateInput();
}
function updateDateInput() {
  const precision = document.querySelector("#date-precision")?.value;
  if (!precision) return;
  const input = document.querySelector("#date-value");
  document.querySelector("#date-field").hidden = precision === "unknown";
  input.required = precision !== "unknown";
  input.type = precision === "day" ? "date" : "text";
  input.maxLength = precision === "day" ? 10 : 4;
  input.placeholder = "e.g. 1982";
  input.inputMode = precision === "day" ? "none" : "numeric";
  document.querySelector("#date-help").textContent =
    precision === "approximate"
      ? "Shown as “Around …”, never as an exact date."
      : "Use a year between 1000 and 2100.";
}
function download(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportArchive() {
  showModal(
    `<p class="eyebrow">A COPY THAT BELONGS TO YOU</p><h2 id="modal-title">Take your memories with you</h2><p class="modal-intro">Browser storage can be cleared. Keep a backup somewhere you trust.</p><div class="export-options"><button data-action="json" class="export-option">${icon("down")}<span><strong>Archive backup · JSON</strong><small>All words, dates, sources and keepsakes. Import it back into Echoes.</small></span>${icon("arrow")}</button><button data-action="markdown" class="export-option">${icon("book")}<span><strong>Readable collection · Markdown</strong><small>A plain-text document you can read and keep without this app.</small></span>${icon("arrow")}</button></div><p class="privacy-copy">Nothing is uploaded. The file is saved to your device.</p>`,
  );
}
function about() {
  showModal(
    `<p class="eyebrow">OPEN BY DESIGN</p><h2 id="modal-title">The stories stay with you.</h2><p class="modal-intro">Echoes helps you find the words that were saved. It never writes a new memory or imitates a person.</p><div class="about-sections"><section><h3>AI happens here</h3><p>Meaning search uses BGE small English, an open embedding model, through Transformers.js and ONNX Runtime in a browser worker. The model is downloaded from Hugging Face on the first search. Memory text and questions are processed on this device.</p></section><section><h3>Connections, not invented answers</h3><p>Results are verbatim passages from your archive. Similarity is a ranking signal, not a probability or evidence that a memory answers a question. This small English model can miss relevant stories or suggest irrelevant ones.</p></section><section><h3>Local does not mean encrypted</h3><p>The archive is stored in this browser, without encryption. Anyone with access to this browser profile may be able to read it. Clear browser data and it can disappear. Export a backup regularly.</p></section><section><h3>Use it offline after preparation</h3><p>The production app caches its files and the downloaded model. Keep the page open after the first successful AI search before going offline. Browser eviction or a missing cache can require a new download. Exact-word search needs no model.</p></section></div><div class="modal-footer"><a class="button" href="https://huggingface.co/BAAI/bge-small-en-v1.5" target="_blank" rel="noopener noreferrer">Read the model card ${icon("arrow")}</a><button class="button primary" data-action="close">Got it</button></div>`,
  );
}
function startNew() {
  showModal(
    `<p class="eyebrow">A FRESH PAGE</p><h2 id="modal-title">Start a new archive?</h2><p class="modal-intro">This replaces the archive in this browser. Export a backup first if you want to keep it. You can undo your last change until you make another change, close or reload the page.</p><label class="standalone-label">Archive name<input id="new-title" maxlength="120" value="My family stories"/></label><div class="modal-footer"><button class="button" data-action="json">Export current archive</button><button class="button primary" data-action="confirm-new">Start empty archive</button></div>`,
  );
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("button,a");
  if (!button) return;
  if (button.dataset.view) {
    view = button.dataset.view;
    render();
    return;
  }
  if (button.dataset.open) {
    openMemory(button.dataset.open);
    return;
  }
  if (button.dataset.edit) {
    editMemory(button.dataset.edit);
    return;
  }
  if (button.dataset.keep) {
    const next = structuredClone(archive);
    const m = next.memories.find((m) => m.id === button.dataset.keep);
    m.kept = !m.kept;
    commit(next, m.kept ? "Added to keepsakes." : "Removed from keepsakes.");
    return;
  }
  if (button.dataset.mode) {
    if (status === "working") cancelSearch();
    searchMode = button.dataset.mode;
    results = null;
    searched = "";
    statusText = "";
    render();
    return;
  }
  if (button.dataset.query) {
    search(button.dataset.query);
    return;
  }
  if (button.dataset.delete) {
    const m = archive.memories.find((m) => m.id === button.dataset.delete);
    modal.close();
    showModal(
      `<h2 id="modal-title">Remove “${esc(m.title)}”?</h2><p class="modal-intro">You can undo your last change until you make another change, close or reload the page. Keep an exported archive for a lasting backup.</p><div class="modal-footer"><button class="button" data-action="close">Keep memory</button><button class="button danger" data-confirm-delete="${esc(m.id)}">Remove memory</button></div>`,
    );
    return;
  }
  if (button.dataset.confirmDelete) {
    if (
      commit(
        {
          ...archive,
          memories: archive.memories.filter(
            (m) => m.id !== button.dataset.confirmDelete,
          ),
        },
        "Memory removed. Use Undo to bring it back.",
      )
    ) {
      closeModal();
      showUndo();
    }
    return;
  }
  const action = button.dataset.action;
  if (action === "home") {
    event.preventDefault();
    view = "all";
    person = "";
    results = null;
    render();
  }
  if (action === "add") editMemory();
  if (action === "close") closeModal();
  if (action === "about") about();
  if (action === "cancel") cancelSearch();
  if (action === "clear-search") {
    results = null;
    searched = "";
    query = "";
    statusText = "";
    render();
  }
  if (action === "export") exportArchive();
  if (action === "json") {
    download("echoes-archive.json", JSON.stringify(archive, null, 2));
    toast("Archive backup downloaded.");
  }
  if (action === "markdown") {
    download(
      "echoes-memories.md",
      exportMarkdown(archive),
      "text/markdown;charset=utf-8",
    );
    toast("Readable collection downloaded.");
  }
  if (action === "import") document.querySelector("#import-file").click();
  if (action === "confirm-import" && importCandidate) {
    if (
      commit(
        importCandidate,
        "Archive imported. Undo is available until reload.",
      )
    ) {
      person = "";
      view = "all";
      closeModal();
      render();
      showUndo();
      importCandidate = null;
    }
  }
  if (action === "new") startNew();
  if (action === "confirm-new") {
    const title = document.querySelector("#new-title").value.trim();
    if (!title) {
      toast("Give the archive a name.");
      return;
    }
    if (blockedSave) {
      toast("Export the original saved file before replacing this archive.");
      return;
    }
    if (
      commit(
        { schema: "echoes/v1", title, memories: [] },
        "New archive created. Undo is available until reload.",
      )
    ) {
      person = "";
      view = "all";
      closeModal();
      render();
      showUndo();
    }
  }
  if (action === "recover") {
    try {
      download(
        "echoes-original-saved-data.txt",
        localStorage.getItem(STORAGE_KEY) || "",
        "text/plain",
      );
      blockedSave = false;
      toast("Original saved data exported. You may now start a new archive.");
    } catch {
      toast(
        "The browser cannot read its saved data. Try allowing storage for this site.",
      );
    }
  }
  if (action === "undo" && undoArchive) {
    const restore = undoArchive;
    if (commit(restore, "Previous archive restored.")) {
      undoArchive = null;
      person = "";
      view = "all";
      render();
    }
  }
});
function showUndo() {
  toast('Previous version kept. Use “Undo last change” below the memories before another change or reload.');
}
document.addEventListener("input", (e) => {
  if (e.target.id === "query") query = e.target.value;
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "person-filter") {
    person = e.target.value;
    refreshList();
  }
  if (e.target.id === "date-precision") updateDateInput();
  if (e.target.id === "import-file") {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 6 * 1024 * 1024)
        throw new Error("Archive is too large. Maximum file size is 6 MB.");
      importCandidate = validateArchive(JSON.parse(await file.text()));
      showModal(
        `<p class="eyebrow">RESTORE A COLLECTION</p><h2 id="modal-title">Import “${esc(importCandidate.title)}”?</h2><p class="modal-intro">${importCandidate.memories.length} memories. Importing replaces the current archive on this device. Export your current collection first if you want a lasting backup.</p><div class="modal-footer"><button class="button" data-action="json">Export current archive</button><button class="button primary" data-action="confirm-import">Replace with this archive</button></div>`,
      );
    } catch (error) {
      importCandidate = null;
      toast(`Import not applied: ${error.message}`);
    }
  }
});
document.addEventListener("submit", (event) => {
  if (event.target.id === "search-form") {
    event.preventDefault();
    search();
  }
  if (event.target.id === "memory-form") {
    event.preventDefault();
    const form = event.target;
    const f = new FormData(form);
    const id = form.dataset.id || crypto.randomUUID();
    const old = archive.memories.find((m) => m.id === id);
    try {
      const m = validateMemory({
        id,
        title: f.get("title").trim(),
        text: f.get("text"),
        person: f.get("person").trim(),
        source: f.get("source").trim(),
        date: {
          precision: f.get("precision"),
          value: f.get("precision") === "unknown" ? "" : f.get("date").trim(),
        },
        kept: old?.kept || false,
      });
      const memories = old
        ? archive.memories.map((x) => (x.id === id ? m : x))
        : [...archive.memories, m];
      if (commit({ ...archive, memories }, "Memory saved on this device."))
        closeModal();
      else
        document.querySelector("#form-error").textContent =
          storageProblem || "Save was not applied.";
    } catch (error) {
      document.querySelector("#form-error").textContent = error.message;
    }
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY || e.key === null) {
    changedInOtherTab = true;
    toast("This archive changed in another tab. Reload before making changes.");
  }
});
render();
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* Backup/export and online usage still work without an offline shell. */
  });
