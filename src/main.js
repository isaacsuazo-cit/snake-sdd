// Bootstrap: wires core, renderer, input, overlay and high score together.
// Owns timing, phase (idle → playing → terminal) and restart gating; no game rules live here.

import { createInitialState, queueDirection, step, STATUS } from './core.js';
import { createRenderer } from './renderer.js';
import { attachInput } from './input.js';
import { createOverlay } from './overlay.js';
import { createHighScore } from './highScore.js';

const PHASE = { IDLE: 'idle', PLAYING: 'playing' };

const canvas = document.getElementById('board');
const hud = document.getElementById('hud');
const bestLabel = document.getElementById('best');
const boardWrap = document.getElementById('board-wrap');
const levelLabel = document.getElementById('level');
const speedLabel = document.getElementById('speed');
const render = createRenderer(canvas, { hud, cellSize: 32 });
const overlay = createOverlay(document.getElementById('overlay'));
const highScore = createHighScore(readLocalStorage());

let state;
let previous = null;
let phase = PHASE.IDLE;
let timer;
let lastTickAt = 0;

// Touching `window.localStorage` itself can throw (blocked cookies, sandboxed frames).
function readLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSimulating() {
  return phase === PHASE.PLAYING && state.status === STATUS.PLAYING;
}

function showBest(best, isNew) {
  bestLabel.textContent = `Best: ${best}`;
  bestLabel.classList.toggle('is-new-record', isNew);
}

// Re-adding a class mid-animation does not restart it; the reflow read forces a fresh run.
function popHud() {
  hud.classList.remove('is-popping');
  void hud.offsetWidth;
  hud.classList.add('is-popping');
}

// Reads state only; the panel never computes level/speed itself.
function showPanel() {
  levelLabel.textContent = `Level ${state.level}`;
  speedLabel.textContent = `${state.tickMs} ms / tick`;
}

function finish() {
  clearInterval(timer);
  const isGameOver = state.status === STATUS.GAME_OVER;
  if (isGameOver) {
    boardWrap.classList.add('is-shaking');
  }
  const { best, isNew } = highScore.submit(state.score);
  showBest(best, isNew);
  overlay.show({
    kind: isGameOver ? 'game-over' : 'won',
    title: isGameOver ? (isNew ? 'New record!' : 'Game over') : 'You won!',
    score: `Score: ${state.score} · Level ${state.level} · Best: ${best}`,
    hint: 'Press Enter or Space to restart',
  });
}

// Re-arms on every call so a `tickMs` change (level-up) never drifts the running interval.
function armTimer() {
  clearInterval(timer);
  timer = setInterval(tick, state.tickMs);
}

function tick() {
  previous = state;
  state = step(state, { random: Math.random });
  lastTickAt = performance.now();
  if (state.score > previous.score) {
    popHud();
  }
  if (state.tickMs !== previous.tickMs) {
    armTimer();
  }
  if (state.level !== previous.level) {
    showPanel();
  }
  if (state.status !== STATUS.PLAYING) {
    finish();
  }
}

function startSimulation() {
  phase = PHASE.PLAYING;
  overlay.hide();
  lastTickAt = performance.now();
  armTimer();
}

function beginRun(direction) {
  state = queueDirection(state, direction);
  startSimulation();
}

function restart() {
  state = createInitialState({ random: Math.random });
  previous = null;
  bestLabel.classList.remove('is-new-record');
  showPanel();
  startSimulation();
}

function frame(now) {
  const simulating = isSimulating();
  render(state, {
    previous: simulating ? previous : null,
    progress: simulating ? Math.min(1, (now - lastTickAt) / state.tickMs) : 1,
    time: now,
  });
  requestAnimationFrame(frame);
}

function boot() {
  state = createInitialState({ random: Math.random });
  render(state);
  showBest(highScore.get(), false);
  showPanel();
  overlay.show({
    kind: 'start',
    title: 'Snake',
    score: `Best: ${highScore.get()}`,
    hint: 'Press an arrow key to start',
  });
  requestAnimationFrame(frame);
}

hud.addEventListener('animationend', (event) => {
  if (event.target === hud) {
    hud.classList.remove('is-popping');
  }
});

boardWrap.addEventListener('animationend', (event) => {
  if (event.target === boardWrap) {
    boardWrap.classList.remove('is-shaking');
  }
});

attachInput(window, {
  onDirection: (direction) => {
    if (phase === PHASE.IDLE) {
      beginRun(direction);
      return;
    }
    state = queueDirection(state, direction);
  },
  onRestart: () => {
    if (phase === PHASE.PLAYING && state.status !== STATUS.PLAYING) {
      restart();
    }
  },
});

boot();
