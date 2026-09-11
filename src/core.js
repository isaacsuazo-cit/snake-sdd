// Pure, timer-free, DOM-free game rules core.
// See design §2 for the full contract (constants, state shape, functions).

export const GRID_SIZE = 20;
export const INITIAL_LENGTH = 3;
export const DIRECTIONS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };
export const STATUS = { PLAYING: 'playing', GAME_OVER: 'game-over', WON: 'won' };

export function levelFor(score) {
  return Math.floor(score / 5) + 1;
}

export function tickMsFor(level) {
  return Math.max(60, 150 - 6 * (level - 1));
}

// Caches levelFor/tickMsFor on every core-emitted state so adapters stay
// rule-free (design AD1/AD2).
function withLevel(next) {
  const level = levelFor(next.score);
  return { ...next, level, tickMs: tickMsFor(level) };
}

function freeCells(blocked) {
  const occupied = new Set(blocked.map(({ x, y }) => `${x},${y}`));
  const cells = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function pickFreeCell(cells, random) {
  const index = Math.floor(random() * cells.length);
  return cells[index];
}

function isOffGrid({ x, y }) {
  return x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE;
}

// The tail (last segment) vacates its cell this tick, so it is excluded (design D1).
function hitsBody(snake, cell) {
  return snake.slice(0, -1).some((segment) => segment.x === cell.x && segment.y === cell.y);
}

function collides(cells, cell) {
  return cells.some((occupied) => occupied.x === cell.x && occupied.y === cell.y);
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
  const free = freeCells([...snake]);
  const food = { ...pickFreeCell(free, random), kind: 'normal' };
  return withLevel({
    snake,
    direction: DIRECTIONS.RIGHT,
    pendingDirection: DIRECTIONS.RIGHT,
    food,
    walls: [],
    score: 0,
    status: STATUS.PLAYING,
  });
}

const OPPOSITE_DIRECTION = {
  [DIRECTIONS.UP]: DIRECTIONS.DOWN,
  [DIRECTIONS.DOWN]: DIRECTIONS.UP,
  [DIRECTIONS.LEFT]: DIRECTIONS.RIGHT,
  [DIRECTIONS.RIGHT]: DIRECTIONS.LEFT,
};

export function queueDirection(state, direction) {
  if (state.status !== STATUS.PLAYING || OPPOSITE_DIRECTION[state.direction] === direction) {
    return state;
  }
  return { ...state, pendingDirection: direction };
}

export function step(state, { random = Math.random } = {}) {
  if (state.status !== STATUS.PLAYING) {
    return state;
  }

  const walls = state.walls ?? [];
  const direction = state.pendingDirection;
  const delta = DELTA[direction];
  const head = state.snake[0];
  const newHead = { x: head.x + delta.x, y: head.y + delta.y };

  if (isOffGrid(newHead) || collides(walls, newHead) || hitsBody(state.snake, newHead)) {
    return withLevel({ ...state, walls, status: STATUS.GAME_OVER });
  }

  const eats = state.food !== null && newHead.x === state.food.x && newHead.y === state.food.y;
  const grownSnake = [newHead, ...state.snake];
  const newSnake = eats ? grownSnake : grownSnake.slice(0, -1);

  if (!eats) {
    return withLevel({ ...state, snake: newSnake, walls, direction, pendingDirection: direction });
  }

  const scored = {
    ...state,
    snake: newSnake,
    walls,
    direction,
    pendingDirection: direction,
    score: state.score + 1,
  };

  const free = freeCells([...newSnake, ...walls]);

  if (free.length === 0) {
    return withLevel({ ...scored, status: STATUS.WON, food: null });
  }

  return withLevel({ ...scored, food: { ...pickFreeCell(free, random), kind: 'normal' } });
}
