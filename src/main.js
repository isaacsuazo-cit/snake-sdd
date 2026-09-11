// Bootstrap: wires core, renderer and input together and owns the tick timer.
// See design §5 for the full contract.

import { createInitialState, queueDirection, step, STATUS } from './core.js';
import { createRenderer } from './renderer.js';
import { attachInput } from './input.js';

const TICK_MS = 150;

const canvas = document.getElementById('board');
const hud = document.getElementById('hud');
const render = createRenderer(canvas, { hud });

let state;
let timer;

function tick() {
  state = step(state, { random: Math.random });
  render(state);
  if (state.status !== STATUS.PLAYING) {
    clearInterval(timer);
  }
}

function start() {
  clearInterval(timer);
  state = createInitialState({ random: Math.random });
  render(state);
  timer = setInterval(tick, TICK_MS);
}

attachInput(window, {
  onDirection: (direction) => {
    state = queueDirection(state, direction);
  },
  onRestart: () => {
    if (state.status !== STATUS.PLAYING) {
      start();
    }
  },
});

start();
