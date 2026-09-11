// Persistent best score over a Web Storage-shaped backend. Owns no game rules.
// Degrades to in-memory when storage is missing or throws (private mode, quota).

const DEFAULT_KEY = 'snake.highScore';

function parseStored(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isValidScore(score) {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0;
}

function readStored(storage, key) {
  try {
    return parseStored(storage.getItem(key));
  } catch {
    return 0;
  }
}

function writeStored(storage, key, value) {
  try {
    storage.setItem(key, String(value));
  } catch {
    // Storage unavailable or full: the in-memory best still holds the value.
  }
}

export function createHighScore(storage, { key = DEFAULT_KEY } = {}) {
  const backend = storage !== null && storage !== undefined ? storage : null;
  let best = backend ? readStored(backend, key) : 0;

  function get() {
    return best;
  }

  function submit(score) {
    if (!isValidScore(score) || score <= best) {
      return { best, isNew: false };
    }
    best = score;
    if (backend) {
      writeStored(backend, key, best);
    }
    return { best, isNew: true };
  }

  return { get, submit };
}
