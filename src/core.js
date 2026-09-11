// Pure, timer-free, DOM-free game rules core.
// See design §2 for the full contract (constants, state shape, functions).

export const GRID_SIZE = 20;
export const INITIAL_LENGTH = 3;
export const DIRECTIONS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };
export const STATUS = { PLAYING: 'playing', GAME_OVER: 'game-over', WON: 'won' };

function enumerateFreeCells(snake) {
  const occupied = new Set(snake.map(({ x, y }) => `${x},${y}`));
  const freeCells = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        freeCells.push({ x, y });
      }
    }
  }
  return freeCells;
}

function pickFreeCell(freeCells, random) {
  const index = Math.floor(random() * freeCells.length);
  return freeCells[index];
}

const DELTA = {
  [DIRECTIONS.UP]: { x: 0, y: -1 },
  [DIRECTIONS.DOWN]: { x: 0, y: 1 },
  [DIRECTIONS.LEFT]: { x: -1, y: 0 },
  [DIRECTIONS.RIGHT]: { x: 1, y: 0 },
};

export function createInitialState({ random = Math.random } = {}) {
  const snake = [
    { x: 11, y: 10 },
    { x: 10, y: 10 },
    { x: 9, y: 10 },
  ];
  const freeCells = enumerateFreeCells(snake);
  const food = pickFreeCell(freeCells, random);
  return {
    snake,
    direction: DIRECTIONS.RIGHT,
    pendingDirection: DIRECTIONS.RIGHT,
    food,
    score: 0,
    status: STATUS.PLAYING,
  };
}

const OPPOSITE_DIRECTION = {
  [DIRECTIONS.UP]: DIRECTIONS.DOWN,
  [DIRECTIONS.DOWN]: DIRECTIONS.UP,
  [DIRECTIONS.LEFT]: DIRECTIONS.RIGHT,
  [DIRECTIONS.RIGHT]: DIRECTIONS.LEFT,
};

export function queueDirection(state, direction) {
  if (OPPOSITE_DIRECTION[state.direction] === direction) {
    return state;
  }
  return { ...state, pendingDirection: direction };
}

export function step(state) {
  const direction = state.pendingDirection;
  const delta = DELTA[direction];
  const head = state.snake[0];
  const newHead = { x: head.x + delta.x, y: head.y + delta.y };
  const newSnake = [newHead, ...state.snake.slice(0, -1)];
  return {
    ...state,
    snake: newSnake,
    direction,
    pendingDirection: direction,
  };
}
