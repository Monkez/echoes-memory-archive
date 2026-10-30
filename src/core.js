export const MAX_MEMORIES = 200;
export const MAX_TEXT = 12000;

function bounded(value, name, max, required = true) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  ) {
    throw new Error(
      `${name} must be ${required ? "non-empty text" : "text"} of at most ${max} characters.`,
    );
  }
  return value;
}

export function validDate(date) {
  if (date.precision === "unknown") return date.value === "";
  if (date.precision === "year" || date.precision === "approximate")
    return /^(1[0-9]{3}|20[0-9]{2}|2100)$/.test(date.value);
  if (date.precision !== "day" || !/^\d{4}-\d{2}-\d{2}$/.test(date.value))
    return false;
  const d = new Date(`${date.value}T00:00:00Z`);
  return (
    Number.isFinite(d.getTime()) &&
    d.toISOString().slice(0, 10) === date.value &&
    +date.value.slice(0, 4) >= 1000 &&
    +date.value.slice(0, 4) <= 2100
  );
}

export function validateMemory(m) {
  if (!m || typeof m !== "object" || Array.isArray(m))
    throw new Error("Invalid memory.");
  const id = bounded(m.id, "Memory ID", 100);
  const title = bounded(m.title, "Title", 120);
  const text = bounded(m.text, "Memory", MAX_TEXT);
  const person = bounded(m.person, "Person", 80, false);
  const source = bounded(m.source, "Source", 200, false);
  const date = m.date;
  if (!date || !validDate(date))
    throw new Error("Choose a valid date, year, or “Date unknown”.");
  if (typeof m.kept !== "boolean") throw new Error("Invalid keepsake flag.");
  return {
    id,
    title,
    text,
    person,
    source,
    date: { precision: date.precision, value: date.value },
    kept: m.kept,
  };
}

export function validateArchive(value) {
  if (!value || value.schema !== "echoes/v1" || !Array.isArray(value.memories))
    throw new Error("This is not an Echoes v1 archive.");
  if (value.memories.length > MAX_MEMORIES)
    throw new Error(`An archive can hold up to ${MAX_MEMORIES} memories.`);
  const memories = value.memories.map(validateMemory);
  if (new Set(memories.map((m) => m.id)).size !== memories.length)
    throw new Error("Archive contains duplicate memory IDs.");
  return {
    schema: "echoes/v1",
    title: bounded(value.title, "Archive title", 120),
    memories,
  };
}

export function dateLabel(date) {
  if (date.precision === "unknown") return "Date unknown";
  if (date.precision === "approximate") return `Around ${date.value}`;
  if (date.precision === "year") return date.value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date.value}T00:00:00Z`));
}

export function chronological(memories) {
  return [...memories].sort((a, b) => {
    const key = (m) =>
      m.date.precision === "unknown" ? "9999" : m.date.value.padEnd(10, "-");
    return key(a).localeCompare(key(b)) || a.title.localeCompare(b.title);
  });
}

// Every chunk is a contiguous slice of the original. No model-generated quotations.
export function chunksFor(memories, size = 550) {
  if (!Number.isInteger(size) || size < 20)
    throw new Error("Invalid chunk size.");
  const chunks = [];
  for (const m of memories) {
    let start = 0;
    while (start < m.text.length) {
      let end = Math.min(start + size, m.text.length);
      if (end < m.text.length) {
        const space = m.text.lastIndexOf(" ", end);
        if (space > start + size / 2) end = space;
      }
      const text = m.text.slice(start, end);
      if (text.trim()) chunks.push({ memoryId: m.id, start, end, text });
      start = end;
    }
  }
  return chunks;
}

export function cosine(a, b) {
  if (a.length !== b.length || !a.length)
    throw new Error("Embedding dimensions do not match.");
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

export function rankChunks(chunks, embeddings, queryEmbedding, minimum = 0.27) {
  if (chunks.length !== embeddings.length)
    throw new Error("Incomplete archive index.");
  const ranked = chunks
    .map((chunk, i) => ({
      ...chunk,
      score: cosine(embeddings[i], queryEmbedding),
    }))
    .filter((r) => Number.isFinite(r.score) && r.score >= minimum)
    .sort((a, b) => b.score - a.score);
  const seen = new Set();
  return ranked
    .filter((r) => {
      if (seen.has(r.memoryId)) return false;
      seen.add(r.memoryId);
      return true;
    })
    .slice(0, 8);
}

export function lexicalSearch(memories, query) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return [];
  return chunksFor(memories)
    .map((chunk) => {
      const lower = chunk.text.toLocaleLowerCase();
      const score =
        terms.filter((t) => lower.includes(t)).length / terms.length;
      return { ...chunk, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter(
      (r, i, all) => all.findIndex((x) => x.memoryId === r.memoryId) === i,
    )
    .slice(0, 8);
}

export function safeResults(memories, results) {
  return results.filter((r) => {
    const m = memories.find((m) => m.id === r.memoryId);
    return (
      m &&
      Number.isInteger(r.start) &&
      Number.isInteger(r.end) &&
      r.start >= 0 &&
      r.end > r.start &&
      r.end <= m.text.length &&
      m.text.slice(r.start, r.end) === r.text
    );
  });
}

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

export function exportMarkdown(archive) {
  const literal = (s) => s.replace(/[\\`*_{}\[\]<>#|]/g, "\\$&");
  return (
    `# ${literal(archive.title)}\n\nExported from Echoes. Dates and source descriptions are provided by the archivist.\n\n` +
    chronological(archive.memories)
      .map(
        (m) =>
          `## ${literal(m.title)}\n\n${literal(dateLabel(m.date))} · ${literal(m.person || "Person not recorded")}\n\n${m.text
            .split("\n")
            .map((line) => "> " + literal(line))
            .join("\n")}\n\nSource: ${literal(m.source || "Not recorded")}\n`,
      )
      .join("\n")
  );
}
