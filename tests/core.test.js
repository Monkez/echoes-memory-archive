import test from "node:test";
import assert from "node:assert/strict";
import {
  validateArchive,
  validateMemory,
  validDate,
  chronological,
  chunksFor,
  rankChunks,
  safeResults,
  lexicalSearch,
  exportMarkdown,
  escapeHtml,
} from "../src/core.js";
import { demoArchive } from "../src/demo.js";

test("archive round trip preserves verbatim text, uncertainty and keepsakes", () => {
  assert.deepEqual(
    validateArchive(JSON.parse(JSON.stringify(demoArchive))),
    demoArchive,
  );
});
test("reject malformed or oversized imports before changing the archive", () => {
  assert.throws(
    () =>
      validateArchive({
        ...demoArchive,
        memories: [...demoArchive.memories, demoArchive.memories[0]],
      }),
    /duplicate/,
  );
  assert.throws(
    () =>
      validateArchive({
        ...demoArchive,
        memories: Array(201).fill(demoArchive.memories[0]),
      }),
    /200/,
  );
  assert.throws(
    () => validateArchive({ schema: "other", memories: [] }),
    /not an Echoes/,
  );
  assert.throws(
    () =>
      validateMemory({ ...demoArchive.memories[0], text: "a".repeat(12001) }),
    /12000/,
  );
});
test("date precision does not invent dates; impossible days are rejected", () => {
  assert.equal(validDate({ precision: "day", value: "2024-02-29" }), true);
  assert.equal(validDate({ precision: "day", value: "2025-02-29" }), false);
  assert.equal(validDate({ precision: "unknown", value: "1980" }), false);
  assert.equal(validDate({ precision: "approximate", value: "1980" }), true);
  assert.equal(chronological(demoArchive.memories).at(-1).id, "demo-dance");
  assert.equal(demoArchive.memories[0].id, "demo-bread");
});
test("chunking loses no text and every quote has valid source offsets", () => {
  const memories = [
    { id: "long", text: "Đây là một kỷ niệm.\n".repeat(100) + "TAIL" },
  ];
  const chunks = chunksFor(memories, 80);
  assert.equal(chunks.map((c) => c.text).join(""), memories[0].text);
  assert.equal(safeResults(memories, chunks).length, chunks.length);
  assert.equal(
    safeResults(memories, [{ ...chunks[0], text: "invented quote" }]).length,
    0,
  );
  assert.equal(
    safeResults(memories, [{ ...chunks[0], end: 999999 }]).length,
    0,
  );
});
test("ranking returns strongest passage per memory and rejects weak matches", () => {
  const chunks = [
    { memoryId: "a" },
    { memoryId: "a" },
    { memoryId: "b" },
    { memoryId: "c" },
  ];
  const result = rankChunks(
    chunks,
    [
      [0.6, 0.8],
      [1, 0],
      [0, 1],
      [0.8, 0.6],
    ],
    [1, 0],
  );
  assert.deepEqual(
    result.map((r) => r.memoryId),
    ["a", "c"],
  );
  assert.equal(
    rankChunks(
      chunks,
      [
        [0, 0],
        [0, 1],
        [0, 1],
        [0, 1],
      ],
      [1, 0],
    ).length,
    0,
  );
  assert.throws(() => rankChunks(chunks, [], [1, 0]), /Incomplete/);
});
test("lexical fallback does not masquerade as semantic retrieval", () => {
  assert.equal(
    lexicalSearch(demoArchive.memories, "solder")[0].memoryId,
    "demo-radio",
  );
  assert.equal(lexicalSearch(demoArchive.memories, "     ").length, 0);
  assert.equal(lexicalSearch(demoArchive.memories, "baking lessons").length, 0);
});
test("export renders unknown dates and source, user content is escaped for HTML", () => {
  const md = exportMarkdown(demoArchive);
  assert.match(md, /Date unknown/);
  assert.match(md, /Source: Fictional demo/);
  assert.equal(
    escapeHtml('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  );
});
