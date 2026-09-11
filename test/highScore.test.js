import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createHighScore } from '../src/highScore.js';

// Minimal Web Storage shape backed by a plain object shared across instances.
function createFakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (Object.hasOwn(data, key) ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    data,
  };
}

function createThrowingStorage() {
  return {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
}

describe('HS-01 — Missing storage degrades to in-memory', () => {
  test('null storage starts at 0 and still tracks the best in memory', () => {
    const highScore = createHighScore(null);
    assert.equal(highScore.get(), 0);
    assert.deepEqual(highScore.submit(7), { best: 7, isNew: true });
    assert.equal(highScore.get(), 7);
  });

  test('undefined storage does not throw', () => {
    assert.doesNotThrow(() => createHighScore(undefined).submit(3));
  });
});

describe('HS-02 — Throwing storage degrades to in-memory', () => {
  test('getItem and setItem that throw never surface and the best is kept in memory', () => {
    const highScore = createHighScore(createThrowingStorage());
    assert.doesNotThrow(() => highScore.get());
    assert.equal(highScore.get(), 0);
    assert.doesNotThrow(() => highScore.submit(5));
    assert.equal(highScore.get(), 5);
  });
});

describe('HS-03 — Stored value parsing', () => {
  test('reads a previously stored numeric value', () => {
    const storage = createFakeStorage({ 'snake.highScore': '12' });
    assert.equal(createHighScore(storage).get(), 12);
  });

  test('non-numeric stored value reads as 0', () => {
    const storage = createFakeStorage({ 'snake.highScore': 'banana' });
    assert.equal(createHighScore(storage).get(), 0);
  });

  test('negative stored value reads as 0', () => {
    const storage = createFakeStorage({ 'snake.highScore': '-4' });
    assert.equal(createHighScore(storage).get(), 0);
  });

  test('missing key reads as 0', () => {
    assert.equal(createHighScore(createFakeStorage()).get(), 0);
  });

  test('honors a custom key', () => {
    const storage = createFakeStorage({ custom: '9' });
    assert.equal(createHighScore(storage, { key: 'custom' }).get(), 9);
  });
});

describe('HS-04 — submit semantics', () => {
  test('a higher score becomes the new best and is flagged as new', () => {
    const storage = createFakeStorage({ 'snake.highScore': '10' });
    const highScore = createHighScore(storage);
    assert.deepEqual(highScore.submit(11), { best: 11, isNew: true });
    assert.equal(storage.data['snake.highScore'], '11');
  });

  test('a tie keeps the best and is not new', () => {
    const storage = createFakeStorage({ 'snake.highScore': '10' });
    const highScore = createHighScore(storage);
    assert.deepEqual(highScore.submit(10), { best: 10, isNew: false });
  });

  test('a lower score keeps the best, is not new, and does not persist', () => {
    const storage = createFakeStorage({ 'snake.highScore': '10' });
    const highScore = createHighScore(storage);
    assert.deepEqual(highScore.submit(3), { best: 10, isNew: false });
    assert.equal(storage.data['snake.highScore'], '10');
  });

  test('non-finite and negative scores are ignored', () => {
    const highScore = createHighScore(createFakeStorage({ 'snake.highScore': '4' }));
    assert.deepEqual(highScore.submit(NaN), { best: 4, isNew: false });
    assert.deepEqual(highScore.submit(Infinity), { best: 4, isNew: false });
    assert.deepEqual(highScore.submit(-1), { best: 4, isNew: false });
    assert.deepEqual(highScore.submit('12'), { best: 4, isNew: false });
  });
});

describe('HS-05 — Persistence across instances', () => {
  test('a second instance over the same storage sees the best submitted by the first', () => {
    const storage = createFakeStorage();
    createHighScore(storage).submit(20);
    const later = createHighScore(storage);
    assert.equal(later.get(), 20);
    assert.deepEqual(later.submit(20), { best: 20, isNew: false });
  });
});
