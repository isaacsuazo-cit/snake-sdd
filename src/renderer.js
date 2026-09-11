// Canvas + HUD renderer. Draws a state snapshot only; owns no game rules.
// See design §3 for the full contract.

import { GRID_SIZE, STATUS } from './core.js';

const COLORS = {
  background: '#111',
  body: '#4caf50',
  head: '#8bc34a',
  food: '#e53935',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

function hudText(state) {
  if (state.status === STATUS.GAME_OVER) {
    return `Game over. Score: ${state.score}. Press Enter or Space to restart.`;
  }
  if (state.status === STATUS.WON) {
    return `You won! Score: ${state.score}. Press Enter or Space to restart.`;
  }
  return `Score: ${state.score}`;
}

export function createRenderer(canvas, { cellSize = 20, hud } = {}) {
  canvas.width = GRID_SIZE * cellSize;
  canvas.height = GRID_SIZE * cellSize;
  const ctx = canvas.getContext('2d');

  function fillCell(cell, color) {
    ctx.fillStyle = color;
    ctx.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);
  }

  function render(state) {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state.food !== null) {
      fillCell(state.food, COLORS.food);
    }

    for (let i = state.snake.length - 1; i >= 1; i -= 1) {
      fillCell(state.snake[i], COLORS.body);
    }
    fillCell(state.snake[0], COLORS.head);

    if (state.status !== STATUS.PLAYING) {
      ctx.fillStyle = COLORS.overlay;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (hud) {
      hud.textContent = hudText(state);
    }
  }

  return render;
}
