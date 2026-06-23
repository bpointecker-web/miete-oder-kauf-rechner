import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, createDefaultInputs } from '../js/presets.js';
import { runComparison } from '../js/calculator.js';

const REQUIRED_FIELDS = [
  'region', 'purchasePrice', 'pricePerSqm', 'livingAreaSqm',
  'transferTaxPct', 'landRegisterPct', 'brokerBuyPct', 'notaryPct',
  'equityAmount', 'equityRatioPct', 'mortgageLienPct', 'bankProcessingPct',
  'rateModel', 'interestRatePct', 'variableSwitchYear', 'variableRatePct',
  'loanTermYears', 'annualExtraRepayment',
  'maintenancePctOfValue', 'operatingCostsPerSqm', 'renovationCost', 'renovationYear',
  'appreciationPct',
  'rentPerSqm', 'totalMonthlyRent', 'depositMonths',
  'inflationPct', 'investmentReturnPct', 'renterSavingsRatePct',
  'kestPct', 'horizonYears',
  'simulateSale', 'saleBrokerFeePct', 'immoEstPct', 'primaryResidenceExempt',
];

test('createDefaultInputs: alle Regionen liefern vollstaendige inputs-Objekte', () => {
  for (const region of Object.keys(REGIONS)) {
    const inputs = createDefaultInputs(region);
    for (const field of REQUIRED_FIELDS) {
      assert.ok(field in inputs, `Region "${region}": Pflichtfeld "${field}" fehlt`);
    }
  }
});

test('createDefaultInputs: Variante B — nur appreciationPct ist regional, Preis/Miete sind feste AT-Ø-Defaults', () => {
  // Arrange — Designentscheidung: Regionswechsel aendert ausschliesslich appreciationPct.
  // Kaufpreis und Miete sind Pflichtfelder, die der Nutzer ohnehin selbst eingibt,
  // und starten daher fuer ALLE Regionen mit denselben AT-Ø-Defaults.
  const wien = createDefaultInputs('wien');
  const linz = createDefaultInputs('linz');

  // Assert: Preis & Miete regionsunabhaengig (feste AT-Defaults: 4.000 €/m², 10 €/m²)
  assert.equal(wien.pricePerSqm, 4000);
  assert.equal(wien.rentPerSqm, 10.0);
  assert.equal(wien.pricePerSqm, linz.pricePerSqm, 'pricePerSqm darf nicht regional variieren');
  assert.equal(wien.rentPerSqm, linz.rentPerSqm, 'rentPerSqm darf nicht regional variieren');

  // Assert: appreciationPct ist der EINZIGE regionale Wert, gespeist aus REGIONS
  assert.equal(wien.appreciationPct, REGIONS['wien'].appreciationPct);
  assert.equal(linz.appreciationPct, REGIONS['linz'].appreciationPct);
  assert.ok(wien.appreciationPct > 0 && wien.appreciationPct < 20,
    `appreciationPct sollte plausibler Prozentwert sein, war: ${wien.appreciationPct}`
  );
});

test('createDefaultInputs: runComparison laeuft fuer alle 6 Regionen ohne Fehler', () => {
  for (const region of Object.keys(REGIONS)) {
    const inputs = createDefaultInputs(region);
    const results = runComparison(inputs);
    // Kein NaN, kein Infinity in den Kernwerten
    assert.ok(Number.isFinite(results.buyerNetWealthNominal), `${region}: buyerNetWealthNominal nicht endlich`);
    assert.ok(Number.isFinite(results.renterNetWealthNominal), `${region}: renterNetWealthNominal nicht endlich`);
    assert.ok(Number.isFinite(results.differenceNominal), `${region}: differenceNominal nicht endlich`);
  }
});

test('createDefaultInputs: unbekannte Region wirft Fehler', () => {
  assert.throws(
    () => createDefaultInputs('tokio'),
    /Unbekannte Region/
  );
});
