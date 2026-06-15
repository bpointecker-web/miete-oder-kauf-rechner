import { test } from 'node:test';
import assert from 'node:assert/strict';

// Smoke-Test: beweist, dass der Node-Test-Runner im Projekt korrekt läuft
// (ESM-Module, "node --test tests/"). Kein Fachtest.
test('Test-Setup laeuft', () => {
  assert.strictEqual(1 + 1, 2);
});
