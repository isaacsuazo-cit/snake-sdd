import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { GRID_SIZE, createInitialState, step, queueDirection, levelFor, tickMsFor } from '../src/core.js';

// Boustrophedon (row-major, alternating direction) path covering every grid
// cell, per design §6. Backing fixture for `serpentine()` below.
function boustrophedonPath() {
  const path = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let i = 0; i < GRID_SIZE; i += 1) {
      path.push({ x: y % 2 === 0 ? i : GRID_SIZE - 1 - i, y });
    }
  }
  return path;
}

function directionBetween(from, to) {
  if (to.x === from.x + 1) return 'right';
  if (to.x === from.x - 1) return 'left';
  return to.y > from.y ? 'down' : 'up';
}

// Snake covers every cell except `freeCellCount`; food sits on the next
// free cell ahead, so `remainingFreeCells` is what stays free after eating.
function serpentine(freeCellCount) {
  const path = boustrophedonPath();
  const snakeLength = path.length - freeCellCount;
  const snake = path.slice(0, snakeLength).reverse();
  const food = path[snakeLength];
  const remainingFreeCells = path.slice(snakeLength + 1);
  const direction = directionBetween(snake[0], food);
  return { snake, food, direction, remainingFreeCells };
}

// Baseline playing fixture shared across LEVEL/APPLE/UI tests; food sits one
// cell ahead of the head so a bare `step()` call always eats it.
function playing(overrides = {}) {
  const base = {
    snake: [
      { x: 11, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ],
    direction: 'right',
    pendingDirection: 'right',
    food: { x: 12, y: 10, kind: 'normal' },
    walls: [],
    score: 0,
    status: 'playing',
    level: 1,
    tickMs: 150,
  };
  return { ...base, ...overrides };
}

// Call-counting stub: returns `values[n]` on the n-th call, then repeats the
// last value; `.calls` exposes the count for D3 order assertions.
function sequence(values) {
  const stub = () => {
    const value = values[stub.calls] ?? values[values.length - 1];
    stub.calls += 1;
    return value;
  };
  stub.calls = 0;
  return stub;
}

describe('CORE-01 — GRID_SIZE constant', () => {
  test('exports GRID_SIZE equal to 20', () => {
    assert.equal(GRID_SIZE, 20);
  });
});

describe('CORE-02 — Initial state', () => {
  test('creates a fresh state with a centered 3-segment snake, status playing, score 0', () => {
    const state = createInitialState();
    assert.deepEqual(state.snake, [
      { x: 11, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ]);
    assert.equal(state.status, 'playing');
    assert.equal(state.score, 0);
  });

  test('places food on a cell not occupied by the snake', () => {
    const state = createInitialState();
    const foodOnSnake = state.snake.some(
      (segment) => segment.x === state.food.x && segment.y === state.food.y
    );
    assert.equal(foodOnSnake, false);
  });
});

describe('CORE-13 — Injectable RNG contract', () => {
  test('invokes the injected random function instead of Math.random', () => {
    let callCount = 0;
    const stub = () => {
      callCount += 1;
      return 0.5;
    };
    createInitialState({ random: stub });
    assert.equal(callCount, 1);
  });

  test('defaults to Math.random and returns a valid state when random is omitted', () => {
    assert.doesNotThrow(() => createInitialState());
  });
});

describe('LEVEL-01 — levelFor pure boundary', () => {
  test('levelFor(5) rolls over into level 2', () => {
    assert.equal(levelFor(5), 2);
  });

  test('levelFor(4) stays in level 1', () => {
    assert.equal(levelFor(4), 1);
  });

  test('levelFor(10) reaches level 3, proving the formula scales', () => {
    assert.equal(levelFor(10), 3);
  });
});

describe('LEVEL-02 — tickMsFor pure floor', () => {
  test('tickMsFor(16) floors at 60', () => {
    assert.equal(tickMsFor(16), 60);
  });

  test('tickMsFor(20) stays clamped at 60, never negative', () => {
    assert.equal(tickMsFor(20), 60);
  });

  test('tickMsFor(1) is the base 150ms tick', () => {
    assert.equal(tickMsFor(1), 150);
  });
});

describe('LEVEL-03 — cached level/tickMs written by step', () => {
  test('a level-up mid-tick updates state.level and state.tickMs in the same returned state', () => {
    const state = playing({ score: 4 });
    const next = step(state);
    assert.equal(next.level, 2);
    assert.equal(next.tickMs, 144);
  });

  test('a step with no level change leaves level and tickMs at their prior values', () => {
    const state = playing({ score: 1, food: { x: 0, y: 0, kind: 'normal' } });
    const next = step(state);
    assert.equal(next.level, 1);
    assert.equal(next.tickMs, 150);
  });
});

describe('CORE-14 — RNG-to-free-cell mapping and boundaries', () => {
  test('random() returning 0 maps to the first free cell in row-major order', () => {
    const state = createInitialState({ random: () => 0 });
    assert.deepEqual(state.food, { x: 0, y: 0, kind: 'normal' });
  });

  test('random() returning 0.999999999 maps to the last free cell with no index error', () => {
    const state = createInitialState({ random: () => 0.999999999 });
    assert.deepEqual(state.food, { x: 19, y: 19, kind: 'normal' });
  });
});

describe('CORE-03 — Movement per step', () => {
  test('advances the head one cell and removes the tail, keeping length unchanged', () => {
    const state = {
      snake: [
        { x: 11, y: 10 },
        { x: 10, y: 10 },
        { x: 9, y: 10 },
      ],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 0, y: 0 },
      score: 0,
      status: 'playing',
    };
    const next = step(state);
    assert.deepEqual(next.snake, [
      { x: 12, y: 10 },
      { x: 11, y: 10 },
      { x: 10, y: 10 },
    ]);
    assert.equal(next.snake.length, 3);
  });
});

describe('CORE-04 — Direction intent', () => {
  test('queueDirection sets the pending direction applied on the next step', () => {
    const state = {
      snake: [
        { x: 11, y: 10 },
        { x: 10, y: 10 },
        { x: 9, y: 10 },
      ],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 0, y: 0 },
      score: 0,
      status: 'playing',
    };
    const turned = queueDirection(state, 'up');
    const next = step(turned);
    assert.deepEqual(next.snake[0], { x: 11, y: 9 });
    assert.equal(next.direction, 'up');
  });
});

describe('CORE-08 — Wall collision', () => {
  test('head moving off the right edge sets game-over and preserves snake and score', () => {
    const snake = [
      { x: 19, y: 10 },
      { x: 18, y: 10 },
      { x: 17, y: 10 },
    ];
    const state = {
      snake,
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 0, y: 0 },
      score: 3,
      status: 'playing',
    };
    const next = step(state);
    assert.equal(next.status, 'game-over');
    assert.equal(next.score, 3);
    assert.deepEqual(next.snake, snake);
  });
});

describe('CORE-09 — Self collision', () => {
  test('head moving onto a non-vacating body segment sets game-over', () => {
    const state = {
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
        { x: 6, y: 4 },
      ],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 0, y: 0 },
      score: 2,
      status: 'playing',
    };
    const next = step(state);
    assert.equal(next.status, 'game-over');
  });
});

describe('CORE-07 — Tail-vacating cell is not a collision', () => {
  test('moving into the pre-step tail cell without growth stays playing', () => {
    const state = {
      snake: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
      ],
      direction: 'right',
      pendingDirection: 'down',
      food: { x: 0, y: 0 },
      score: 0,
      status: 'playing',
    };
    const next = step(state);
    assert.equal(next.status, 'playing');
  });
});

describe('CORE-06 — Growth on eating', () => {
  test('eating grows the snake by 1, increases score by 1, and keeps the prior tail', () => {
    const state = {
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 6, y: 5 },
      score: 0,
      status: 'playing',
    };
    const next = step(state, { random: () => 0 });
    assert.equal(next.snake.length, 4);
    assert.equal(next.score, 1);
    assert.deepEqual(next.snake[3], { x: 3, y: 5 });
  });

  test('the new food is never placed on the grown snake, including the retained tail', () => {
    const state = {
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 6, y: 5 },
      score: 0,
      status: 'playing',
    };
    const next = step(state, { random: () => 0 });
    const foodOnSnake = next.snake.some(
      (segment) => segment.x === next.food.x && segment.y === next.food.y
    );
    assert.equal(foodOnSnake, false);
  });
});

describe('CORE-15 — Free-cell definition', () => {
  test('places food on the single remaining free cell regardless of the random() value', () => {
    const { snake, food, direction, remainingFreeCells } = serpentine(2);
    const state = { snake, direction, pendingDirection: direction, food, score: 0, status: 'playing' };

    const lowRandom = step(state, { random: () => 0 });
    const highRandom = step(state, { random: () => 0.999999999 });

    assert.deepEqual(lowRandom.food, { ...remainingFreeCells[0], kind: 'normal' });
    assert.deepEqual(highRandom.food, { ...remainingFreeCells[0], kind: 'normal' });
  });
});

describe('CORE-10 — Won transition', () => {
  test('eating the last free cell sets status won, food null, and never spawns', () => {
    const { snake, food, direction } = serpentine(1);
    const state = { snake, direction, pendingDirection: direction, food, score: 41, status: 'playing' };
    let spawnAttempts = 0;
    const random = () => {
      spawnAttempts += 1;
      return 0;
    };

    const next = step(state, { random });

    assert.equal(next.status, 'won');
    assert.equal(next.food, null);
    assert.equal(next.score, 42);
    assert.equal(spawnAttempts, 0);
  });
});

describe('CORE-11 — Terminal state is a no-op', () => {
  const gameOverState = {
    snake: [
      { x: 11, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ],
    direction: 'right',
    pendingDirection: 'right',
    food: { x: 0, y: 0 },
    score: 4,
    status: 'game-over',
  };
  const wonState = { ...gameOverState, food: null, score: 400, status: 'won' };

  test('step returns the same reference and does not throw when status is game-over', () => {
    assert.doesNotThrow(() => step(gameOverState));
    assert.equal(step(gameOverState), gameOverState);
  });

  test('step returns the same reference and does not throw when status is won', () => {
    assert.doesNotThrow(() => step(wonState));
    assert.equal(step(wonState), wonState);
  });

  test('queueDirection returns the same reference and does not throw when status is game-over', () => {
    assert.doesNotThrow(() => queueDirection(gameOverState, 'up'));
    assert.equal(queueDirection(gameOverState, 'up'), gameOverState);
  });
});

describe('CORE-12 — Restart produces fresh state', () => {
  test('createInitialState after a terminal state yields an independent playing state at score 0', () => {
    const priorState = createInitialState();
    const priorGameOver = { ...priorState, status: 'game-over', score: 12 };

    const fresh = createInitialState();

    assert.equal(fresh.status, 'playing');
    assert.equal(fresh.score, 0);
    assert.notEqual(fresh.snake, priorGameOver.snake);
    assert.equal(priorGameOver.status, 'game-over');
    assert.equal(priorGameOver.score, 12);
  });

  test('restart resets walls, level, tickMs and food kind regardless of the prior run (UI-04)', () => {
    const priorState = Object.freeze({
      walls: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      score: 12,
      level: 3,
      tickMs: 138,
      food: { x: 5, y: 5, kind: 'negative' },
      status: 'game-over',
    });

    const fresh = createInitialState({ random: () => 0.5 });

    assert.deepEqual(fresh.walls, []);
    assert.equal(fresh.level, 1);
    assert.equal(fresh.tickMs, 150);
    assert.equal(fresh.food.kind, 'normal');
    assert.equal(fresh.status, 'playing');
    assert.equal(fresh.score, 0);
    assert.equal(priorState.score, 12);
    assert.equal(priorState.level, 3);
    assert.deepEqual(priorState.walls, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  });
});

describe('COMPAT-01 — legacy state defaults missing walls to []', () => {
  test('step on a hand-built state without a walls key returns walls: [] (behaves like walls:[])', () => {
    const legacyState = {
      snake: [
        { x: 11, y: 10 },
        { x: 10, y: 10 },
        { x: 9, y: 10 },
      ],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 0, y: 0 },
      score: 0,
      status: 'playing',
    };
    const next = step(legacyState);
    assert.deepEqual(next.walls, []);
  });
});

describe('WALL-05 — wall collision ends the game, same priority as off-grid', () => {
  test('head advancing onto a wall cell directly ahead ends the game', () => {
    const state = playing({ walls: [{ x: 12, y: 10 }], food: { x: 0, y: 0, kind: 'normal' } });
    const next = step(state);
    assert.equal(next.status, 'game-over');
  });

  test('a wall collision on a different heading proves the check is general, not hardcoded', () => {
    const state = playing({
      snake: [
        { x: 10, y: 9 },
        { x: 10, y: 10 },
        { x: 10, y: 11 },
      ],
      direction: 'up',
      pendingDirection: 'up',
      walls: [{ x: 10, y: 8 }],
      food: { x: 0, y: 0, kind: 'normal' },
    });
    const next = step(state);
    assert.equal(next.status, 'game-over');
  });
});

describe('WALL-04 — wall persistence across ticks with no level-up', () => {
  test('walls persist unchanged across two sequential non-eating steps', () => {
    const walls = [{ x: 0, y: 0 }];
    let state = playing({ walls, food: { x: 15, y: 10, kind: 'normal' } });

    state = step(state);
    assert.deepEqual(state.walls, walls);

    state = step(state);
    assert.deepEqual(state.walls, walls);
  });

  test('walls persist unchanged across an eating step that does not level up', () => {
    const walls = [{ x: 5, y: 5 }, { x: 6, y: 5 }];
    const state = playing({ walls, score: 1 });
    const next = step(state, { random: () => 0.9 });
    assert.deepEqual(next.walls, walls);
  });

  test('a legacy state with no walls key still yields walls: [] after an eating step (COMPAT-01 x WALL-04)', () => {
    const legacyState = {
      snake: [
        { x: 11, y: 10 },
        { x: 10, y: 10 },
        { x: 9, y: 10 },
      ],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 12, y: 10 },
      score: 0,
      status: 'playing',
    };
    const next = step(legacyState, { random: () => 0.9 });
    assert.deepEqual(next.walls, []);
  });
});

describe('WALL-06 — free cells for food/won exclude walls, not just the snake', () => {
  test('eating the one true-free cell wins even though the other empty cell is a wall', () => {
    const { snake, food, direction, remainingFreeCells } = serpentine(2);
    const walls = remainingFreeCells;
    const state = playing({ snake, direction, pendingDirection: direction, food, walls, score: 41 });
    let spawnAttempts = 0;
    const random = () => {
      spawnAttempts += 1;
      return 0;
    };

    const next = step(state, { random });

    assert.equal(next.status, 'won');
    assert.equal(next.food, null);
    assert.equal(spawnAttempts, 0);
  });

  test('with the wall cell removed, the same board keeps playing and spawns food on it', () => {
    const { snake, food, direction, remainingFreeCells } = serpentine(2);
    const state = playing({ snake, direction, pendingDirection: direction, food, walls: [], score: 41 });

    const next = step(state, { random: () => 0 });

    assert.equal(next.status, 'playing');
    assert.deepEqual(next.food, { ...remainingFreeCells[0], kind: 'normal' });
  });
});

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('Core purity contract (CORE-03, CORE-04, CORE-06 — no argument mutation)', () => {
  const playingState = deepFreeze({
    snake: [
      { x: 11, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ],
    direction: 'right',
    pendingDirection: 'right',
    food: { x: 0, y: 0 },
    score: 0,
    status: 'playing',
  });
  const wonState = deepFreeze({ ...playingState, food: null, score: 5, status: 'won' });

  test('step never mutates a frozen playing state and returns a new object', () => {
    let next;
    assert.doesNotThrow(() => {
      next = step(playingState);
    });
    assert.notEqual(next, playingState);
  });

  test('step returns the exact frozen reference unchanged for a terminal state', () => {
    let next;
    assert.doesNotThrow(() => {
      next = step(wonState);
    });
    assert.equal(next, wonState);
  });

  test('queueDirection never mutates a frozen state and returns a new object when accepted', () => {
    let next;
    assert.doesNotThrow(() => {
      next = queueDirection(playingState, 'up');
    });
    assert.notEqual(next, playingState);
  });

  test('queueDirection returns the exact frozen reference unchanged when rejected', () => {
    let next;
    assert.doesNotThrow(() => {
      next = queueDirection(playingState, 'left');
    });
    assert.equal(next, playingState);
  });

  test('createInitialState never mutates a frozen options object', () => {
    const options = deepFreeze({ random: () => 0.5 });
    assert.doesNotThrow(() => createInitialState(options));
  });

  test('step never mutates or pushes into a frozen walls array', () => {
    const stateWithWalls = deepFreeze({
      ...playingState,
      walls: [{ x: 5, y: 5 }],
    });
    let next;
    assert.doesNotThrow(() => {
      next = step(stateWithWalls);
    });
    assert.deepEqual(stateWithWalls.walls, [{ x: 5, y: 5 }]);
    assert.deepEqual(next.walls, [{ x: 5, y: 5 }]);
  });
});

describe('CORE-05 — Reversal guard (last applied direction)', () => {
  test('rejects a direct reversal against the last applied direction', () => {
    const state = {
      snake: [
        { x: 11, y: 10 },
        { x: 10, y: 10 },
        { x: 9, y: 10 },
      ],
      direction: 'right',
      pendingDirection: 'right',
      food: { x: 0, y: 0 },
      score: 0,
      status: 'playing',
    };
    const rejected = queueDirection(state, 'left');
    assert.equal(rejected.pendingDirection, 'right');
    const next = step(rejected);
    assert.equal(next.direction, 'right');
  });

  test('accepts two non-opposite inputs queued in the same tick, keeping the last one pending', () => {
    const state = {
      snake: [
        { x: 10, y: 9 },
        { x: 10, y: 10 },
        { x: 10, y: 11 },
      ],
      direction: 'up',
      pendingDirection: 'up',
      food: { x: 0, y: 0 },
      score: 0,
      status: 'playing',
    };
    const afterRight = queueDirection(state, 'right');
    assert.equal(afterRight.pendingDirection, 'right');
    const afterLeft = queueDirection(afterRight, 'left');
    assert.equal(afterLeft.pendingDirection, 'left');
  });
});
