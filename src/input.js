// Keyboard-to-intent mapping. Forwards intents unchanged; owns no game rules.
// See design §4 for the full contract.

import { DIRECTIONS } from './core.js';

const DIRECTION_KEYS = {
  ArrowUp: DIRECTIONS.UP,
  ArrowDown: DIRECTIONS.DOWN,
  ArrowLeft: DIRECTIONS.LEFT,
  ArrowRight: DIRECTIONS.RIGHT,
};

const RESTART_KEYS = new Set(['Enter', ' ']);

export function attachInput(target, { onDirection, onRestart }) {
  function handleKeydown(event) {
    const direction = DIRECTION_KEYS[event.key];
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
