import test from "node:test";
import assert from "node:assert/strict";
import { readArchive, writeArchive, STORAGE_KEY } from "../src/storage.js";
import { demoArchive } from "../src/demo.js";
const storage = (initial) => {
  const values = new Map(initial);
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  };
};
test("storage round trip keeps every original field", () => {
  const s = storage();
  writeArchive(s, demoArchive);
  assert.deepEqual(readArchive(s, {}), demoArchive);
});
test("invalid import never overwrites the existing archive", () => {
  const s = storage();
  writeArchive(s, demoArchive);
  const before = s.getItem(STORAGE_KEY);
  assert.throws(() => writeArchive(s, { schema: "wrong" }));
  assert.equal(s.getItem(STORAGE_KEY), before);
});
test("corrupted saved data is surfaced, never silently replaced with the demo", () => {
  assert.throws(() =>
    readArchive(storage([[STORAGE_KEY, "broken"]]), demoArchive),
  );
});
test("storage quota failure is propagated instead of reporting saved", () => {
  assert.throws(
    () =>
      writeArchive(
        {
          setItem() {
            throw new Error("Quota exceeded");
          },
        },
        demoArchive,
      ),
    /Quota/,
  );
});
