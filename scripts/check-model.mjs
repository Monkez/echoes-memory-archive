import assert from 'node:assert/strict';
import { pipeline, env } from '@huggingface/transformers';
import { chunksFor, rankChunks, safeResults, lexicalSearch } from '../src/core.js';
import { demoArchive } from '../src/demo.js';
import { MODEL, POOLING, QUERY_PREFIX, MIN_SIMILARITY } from '../src/model-config.js';
env.cacheDir = '.cache/models';
const started = performance.now();
const embed = await pipeline('feature-extraction', MODEL, { dtype: 'q8', device: 'cpu' });
const chunks = chunksFor(demoArchive.memories);
const vectors = (await embed(chunks.map(c => c.text), { pooling: POOLING, normalize: true })).tolist();
const cases = [
  ['baking lessons', 'demo-bread'],
  ['repairing broken electronics', 'demo-radio'],
  ['leaving the family for a new place', 'demo-station'],
  ['growing plants and sharing them', 'demo-garden'],
  ['overcoming a lifelong fear', 'demo-letter']
];
const measurements = [];
for (const [query, expected] of cases) {
  const t = performance.now();
  const vector = (await embed(QUERY_PREFIX + query, { pooling: POOLING, normalize: true })).tolist()[0];
  const results = safeResults(demoArchive.memories, rankChunks(chunks, vectors, vector, MIN_SIMILARITY));
  assert.equal(results[0]?.memoryId, expected, `Wrong best match for: ${query}`);
  measurements.push({ query, best: results[0].memoryId, similarity: +results[0].score.toFixed(3), ms: Math.round(performance.now() - t), keywordMatches: lexicalSearch(demoArchive.memories, query).length });
}
for (const query of ['quantum computing hardware', 'tax return software', 'what was her secret bank password?']) {
  const vector = (await embed(QUERY_PREFIX + query, { pooling: POOLING, normalize: true })).tolist()[0];
  assert.equal(rankChunks(chunks, vectors, vector, MIN_SIMILARITY).length, 0, `False positive: ${query}`);
}
console.log(JSON.stringify({ model: MODEL, dtype: 'q8', totalMs: Math.round(performance.now() - started), cases: measurements, unrelatedQueriesRejected: 3, note: 'Small demo fixture, not a general accuracy benchmark.' }, null, 2));
