// Canvas + HUD renderer. Draws a state snapshot only; owns no game rules.
// See design §3 for the full contract.

import { GRID_SIZE, STATUS, DIRECTIONS } from './core.js';

// Fallbacks mirror the original palette so the board still renders without the stylesheet.
const COLOR_TOKENS = {
  background: ['--color-board-bg', '#111'],
  grid: ['--color-grid', 'rgba(255, 255, 255, 0.05)'],
  head: ['--color-snake-head', '#8bc34a'],
  tail: ['--color-snake-tail', '#4caf50'],
  food: ['--color-food', '#e53935'],
  wall: ['--color-wall', '#6b7489'],
  foodNegative: ['--color-food-negative', '#b388ff'],
};

const CELL_INSET = 2;
const FOOD_PULSE_AMOUNT = 0.1;
const FOOD_PULSE_PERIOD_MS = 200;

// Eye offsets are fractions of a cell measured from the head cell's centre.
const EYE_OFFSETS = {
  [DIRECTIONS.UP]: [{ x: -0.2, y: -0.22 }, { x: 0.2, y: -0.22 }],
  [DIRECTIONS.DOWN]: [{ x: -0.2, y: 0.22 }, { x: 0.2, y: 0.22 }],
  [DIRECTIONS.LEFT]: [{ x: -0.22, y: -0.2 }, { x: -0.22, y: 0.2 }],
  [DIRECTIONS.RIGHT]: [{ x: 0.22, y: -0.2 }, { x: 0.22, y: 0.2 }],
};

function readColors(canvas) {
  const styles = typeof getComputedStyle === 'function' ? getComputedStyle(canvas) : null;
  const colors = {};
  for (const [name, [token, fallback]] of Object.entries(COLOR_TOKENS)) {
    const value = styles ? styles.getPropertyValue(token).trim() : '';
    colors[name] = value || fallback;
  }
  return colors;
}

// Parses #rgb, #rrggbb and rgb()/rgba() into [r, g, b, a]; returns null for anything else.
function parseColor(color) {
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map((d) => d + d) : hex[1].match(/../g);
    return [...digits.map((d) => parseInt(d, 16)), 1];
  }
  const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
  }
  return null;
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function lerpCell(from, to, t) {
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
}

function createColorRamp(fromColor, toColor) {
  const from = parseColor(fromColor);
  const to = parseColor(toColor);
  if (!from || !to) {
    return () => fromColor;
  }
  return (t) => {
    const [r, g, b, a] = from.map((channel, i) => lerp(channel, to[i], t));
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
  };
}

function traceRoundRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function createRenderer(canvas, { cellSize = 20, hud } = {}) {
  const boardSize = GRID_SIZE * cellSize;
  const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
  // CSS owns the displayed size (width: 100%; aspect-ratio: 1); only the backing store is set here.
  canvas.width = boardSize * dpr;
  canvas.height = boardSize * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const colors = readColors(canvas);
  const bodyColorAt = createColorRamp(colors.head, colors.tail);
  const cellRadius = cellSize * 0.25;
  const eyeRadius = Math.max(1, cellSize * 0.09);

  function drawBackground() {
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, boardSize, boardSize);

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID_SIZE; i += 1) {
      const offset = i * cellSize + 0.5;
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset, boardSize);
      ctx.moveTo(0, offset);
      ctx.lineTo(boardSize, offset);
    }
    ctx.stroke();
  }

  function fillCell(cell, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    traceRoundRect(
      ctx,
      cell.x * cellSize + CELL_INSET,
      cell.y * cellSize + CELL_INSET,
      cellSize - CELL_INSET * 2,
      cellSize - CELL_INSET * 2,
      cellRadius,
    );
    ctx.fill();
  }

  function drawEyes(head, direction) {
    const offsets = EYE_OFFSETS[direction] ?? EYE_OFFSETS[DIRECTIONS.RIGHT];
    const centerX = (head.x + 0.5) * cellSize;
    const centerY = (head.y + 0.5) * cellSize;
    ctx.fillStyle = colors.background;
    ctx.beginPath();
    for (const offset of offsets) {
      const x = centerX + offset.x * cellSize;
      const y = centerY + offset.y * cellSize;
      ctx.moveTo(x + eyeRadius, y);
      ctx.arc(x, y, eyeRadius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawWalls(walls) {
    ctx.fillStyle = colors.wall;
    for (const wall of walls) {
      ctx.fillRect(
        wall.x * cellSize + CELL_INSET,
        wall.y * cellSize + CELL_INSET,
        cellSize - CELL_INSET * 2,
        cellSize - CELL_INSET * 2,
      );
    }
  }

  // Hollow ring + minus bar: negative food must never rely on color alone (AD7).
  function drawNegativeFood(centerX, centerY, radius) {
    const lineWidth = cellSize * 0.15;
    ctx.strokeStyle = colors.foodNegative;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.5, centerY);
    ctx.lineTo(centerX + radius * 0.5, centerY);
    ctx.stroke();
  }

  function drawFood(food, time) {
    const baseRadius = cellSize / 2 - CELL_INSET;
    const radius = baseRadius * (1 + FOOD_PULSE_AMOUNT * Math.sin(time / FOOD_PULSE_PERIOD_MS));
    const centerX = (food.x + 0.5) * cellSize;
    const centerY = (food.y + 0.5) * cellSize;
    if ((food.kind ?? 'normal') === 'negative') {
      drawNegativeFood(centerX, centerY, radius);
      return;
    }
    ctx.fillStyle = colors.food;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function resolveSegments(state, previous, progress) {
    const interpolate = previous !== null && state.status === STATUS.PLAYING && progress < 1;
    if (!interpolate) {
      return state.snake;
    }
    const t = Math.max(0, progress);
    return state.snake.map((cell, i) => lerpCell(previous.snake[i] ?? cell, cell, t));
  }

  function drawSnake(state, segments) {
    const lastIndex = segments.length - 1;
    for (let i = lastIndex; i >= 0; i -= 1) {
      fillCell(segments[i], bodyColorAt(lastIndex === 0 ? 0 : i / lastIndex));
    }
    drawEyes(segments[0], state.direction);
  }

  function render(state, { previous = null, progress = 1, time = 0 } = {}) {
    drawBackground();

    drawWalls(state.walls ?? []);

    if (state.food !== null) {
      drawFood(state.food, time);
    }

    drawSnake(state, resolveSegments(state, previous, progress));

    if (hud) {
      hud.textContent = `Score: ${state.score}`;
    }
  }

  return render;
}
