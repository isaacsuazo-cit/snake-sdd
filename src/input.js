// Keyboard-to-intent mapping. Forwards intents unchanged; owns no game rules.
// See design §4 for the full contract.

import { DIRECTIONS } from './core.js';

// WASD aliases Up/Left/Down/Right; case-insensitive via directionForKey (AD6).
export const KEY_MAP = Object.freeze({
  ArrowUp: DIRECTIONS.UP,
  ArrowDown: DIRECTIONS.DOWN,
  ArrowLeft: DIRECTIONS.LEFT,
  ArrowRight: DIRECTIONS.RIGHT,
  w: DIRECTIONS.UP,
  s: DIRECTIONS.DOWN,
  a: DIRECTIONS.LEFT,
  d: DIRECTIONS.RIGHT,
});

// 1-char keys (WASD) are lowercased before lookup; arrow keys pass through untouched.
export function directionForKey(key) {
  return KEY_MAP[key.length === 1 ? key.toLowerCase() : key];
}

const RESTART_KEYS = new Set(['Enter', ' ']);

export function attachInput(target, { onDirection, onRestart }) {
  function handleKeydown(event) {
    const direction = directionForKey(event.key);
    if (direction !== undefined) {
      event.preventDefault();
      onDirection(direction);
      return;
    }
    if (RESTART_KEYS.has(event.key)) {
      event.preventDefault();
      onRestart();
    }
  }

  target.addEventListener('keydown', handleKeydown);

  return function detach() {
    target.removeEventListener('keydown', handleKeydown);
  };
}
