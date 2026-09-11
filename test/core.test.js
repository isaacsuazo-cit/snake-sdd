import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { GRID_SIZE, createInitialState, step, queueDirection } from '../src/core.js';

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

describe('CORE-14 — RNG-to-free-cell mapping and boundaries', () => {
  test('random() returning 0 maps to the first free cell in row-major order', () => {
    const state = createInitialState({ random: () => 0 });
    assert.deepEqual(state.food, { x: 0, y: 0 });
  });

  test('random() returning 0.999999999 maps to the last free cell with no index error', () => {
    const state = createInitialState({ random: () => 0.999999999 });
    assert.deepEqual(state.food, { x: 19, y: 19 });
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
    const path = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let i = 0; i < GRID_SIZE; i += 1) {
        path.push({ x: y % 2 === 0 ? i : GRID_SIZE - 1 - i, y });
      }
    }
    const snake = path.slice(0, 398).reverse();
    const food = path[398];
    const lastFreeCell = path[399];
    const head = snake[0];
    const dx = food.x - head.x;
    const direction = dx === 1 ? 'right' : dx === -1 ? 'left' : food.y > head.y ? 'down' : 'up';
    const state = {
      snake,
      direction,
      pendingDirection: direction,
      food,
      score: 0,
      status: 'playing',
    };
    const lowRandom = step(state, { random: () => 0 });
    const highRandom = step(state, { random: () => 0.999999999 });
    assert.deepEqual(lowRandom.food, lastFreeCell);
    assert.deepEqual(highRandom.food, lastFreeCell);
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
