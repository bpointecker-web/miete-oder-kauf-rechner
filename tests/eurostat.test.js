import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTimeSeries,
  latest,
  trailingAverage,
  indexScaleFactor,
  hpiApiUrl,
} from '../scripts/eurostat.mjs';

// Minimaler JSON-stat-2.0-Payload nach Vorbild der echten Eurostat-Antwort
// (geo=AT, purchase=TOTAL, eine unit -> nur time variiert).
function makePayload(values) {
  const index = {};
  const valueMap = {};
  values.forEach((v, i) => {
    index[`2020-Q${(i % 4) + 1}-${i}`] = i;
    if (v !== null) valueMap[i] = v;
  });
  return {
    dimension: { time: { category: { index } } },
    value: valueMap,
  };
}

test('extractTimeSeries: sortiert chronologisch und ueberspringt null-Werte', () => {
  // Arrange
  const payload = makePayload([100, null, 102, 103]);

  // Act
  const series = extractTimeSeries(payload);

  // Assert
  assert.equal(series.length, 3); // null entfernt
  assert.deepEqual(series.map((r) => r.value), [100, 102, 103]);
});

test('extractTimeSeries: wirft bei fehlender time-Dimension', () => {
  assert.throws(() => extractTimeSeries({ value: {} }), /time-Dimension/);
});

test('latest: liefert den letzten Wert der Reihe', () => {
  // Arrange
  const series = extractTimeSeries(makePayload([100, 110, 219]));

  // Act
  const result = latest(series);

  // Assert
  assert.equal(result.value, 219);
});

test('latest: wirft bei leerer Reihe', () => {
  assert.throws(() => latest([]), /Leere Zeitreihe/);
});

test('trailingAverage: berechnet Schnitt der letzten N Quartale', () => {
  // Arrange — 6 Werte, Schnitt der letzten 4 = (3+4+5+6)/4 = 4.5
  const series = extractTimeSeries(makePayload([1, 2, 3, 4, 5, 6]));

  // Act
  const avg = trailingAverage(series, 4);

  // Assert
  assert.equal(avg, 4.5);
});

test('trailingAverage: wirft, wenn die Reihe kuerzer als N ist', () => {
  const series = extractTimeSeries(makePayload([1, 2]));
  assert.throws(() => trailingAverage(series, 4), /zu kurz/);
});

test('indexScaleFactor: aktueller/Anker ergibt den korrekten Faktor', () => {
  // Arrange / Act — Index von 219 auf 240 gestiegen
  const factor = indexScaleFactor(240, 219);

  // Assert
  assert.ok(Math.abs(factor - 1.09589) < 0.0001, `factor: ${factor}`);
});

test('indexScaleFactor: wirft bei ungueltigem Anker-Index', () => {
  assert.throws(() => indexScaleFactor(240, 0), /Ungueltiger Anker-Index/);
});

test('hpiApiUrl: baut korrekte Eurostat-URL mit Unit', () => {
  // Act
  const url = hpiApiUrl('RCH_A');

  // Assert
  assert.ok(url.includes('prc_hpi_q'), 'enthaelt Datensatz-Code');
  assert.ok(url.includes('geo=AT'), 'enthaelt geo=AT');
  assert.ok(url.includes('unit=RCH_A'), 'enthaelt unit');
  assert.ok(url.includes('purchase=TOTAL'), 'enthaelt purchase');
});
