export const MODEL = "Xenova/bge-small-en-v1.5";
export const MODEL_REVISION = "ea104dacec62c0de699686887e3f920caeb4f3e3";
export const POOLING = "cls";
export const QUERY_PREFIX =
  "Represent this sentence for searching relevant passages: ";
// Calibrated only against our small English demo fixture; not a probability of truth.
export const MIN_SIMILARITY = 0.56;
