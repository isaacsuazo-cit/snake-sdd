import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { DIRECTIONS } from '../src/core.js';
import { KEY_MAP, directionForKey, attachInput } from '../src/input.js';

// Minimal EventTarget-like stub: attachInput never touches DOM beyond
// add/removeEventListener, so a plain object is enough for these tests.
function fakeTarget() {
  let handler;
  return {
    addEventListener: (_type, fn) => {
      handler = fn;
    },
    removeEventListener: () => {
      handler = undefined;
    },
    dispatch: (key) => {
      const event = { key, preventDefault: () => { event.defaulted = true; } };
      handler(event);
      return event;
    },
  };
}

describe('INPUT-01 — WASD alias', () => {
  test('lowercase w maps to Up, uppercase D maps to Right', () => {
    assert.equal(directionForKey('w'), DIRECTIONS.UP);
    assert.equal(directionForKey('D'), DIRECTIONS.RIGHT);
  });

  test('arrow keys keep mapping to their direction', () => {
    assert.equal(directionForKey('ArrowUp'), DIRECTIONS.UP);
    assert.equal(directionForKey('ArrowLeft'), DIRECTIONS.LEFT);
  });

  test('an unmapped key returns undefined', () => {
    assert.equal(directionForKey('q'), undefined);
    assert.equal(directionForKey('Escape'), undefined);
  });

  test('KEY_MAP is frozen and covers every WASD letter and arrow', () => {
    assert.equal(Object.isFrozen(KEY_MAP), true);
    assert.deepEqual(Object.keys(KEY_MAP).sort(), [
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'a',
      'd',
      's',
      'w',
    ]);
  });

  test('attachInput routes uppercase S the same as ArrowDown (reversal-guard parity)', () => {
    const target = fakeTarget();
    const directions = [];
    attachInput(target, { onDirection: (d) => directions.push(d), onRestart: () => {} });

    const arrowEvent = target.dispatch('ArrowDown');
    const wasdEvent = target.dispatch('S');

    assert.deepEqual(directions, [DIRECTIONS.DOWN, DIRECTIONS.DOWN]);
    assert.equal(arrowEvent.defaulted, true);
    assert.equal(wasdEvent.defaulted, true);
  });

  test('attachInput calls preventDefault only on handled keys', () => {
    const target = fakeTarget();
    attachInput(target, { onDirection: () => {}, onRestart: () => {} });

    const unhandled = target.dispatch('q');

    assert.equal(unhandled.defaulted, undefined);
  });
});
