import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { GRID_SIZE } from '../src/core.js';

describe('CORE-01 — GRID_SIZE constant', () => {
  test('exports GRID_SIZE equal to 20', () => {
    assert.equal(GRID_SIZE, 20);
  });
});
