import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, createDefaultInputs } from '../js/presets.js';
import { runComparison } from '../js/calculator.js';

const REQUIRED_FIELDS = [
  'purchasePrice', 'pricePerSqm', 'livingAreaSqm',
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

test('createDefaultInputs: liefert vollstaendiges inputs-Objekt mit allen Pflichtfeldern', () => {
  const inputs = createDefaultInputs();
  for (const field of REQUIRED_FIELDS) {
    assert.ok(field in inputs, `Pflichtfeld "${field}" fehlt`);
  }
});

test('createDefaultInputs: AT-Defaults sind plausibel', () => {
  const inputs = createDefaultInputs();

  assert.equal(inputs.pricePerSqm, 4000);
  assert.equal(inputs.rentPerSqm, 10.0);
  assert.equal(inputs.livingAreaSqm, 70);
  assert.ok(inputs.appreciationPct >= 1 && inputs.appreciationPct <= 5,
    `appreciationPct sollte zwischen 1 und 5 % liegen, war: ${inputs.appreciationPct}`);
  assert.ok(inputs.purchasePrice > 0 && Number.isFinite(inputs.purchasePrice));
});

test('createDefaultInputs: runComparison laeuft ohne Fehler durch', () => {
  const inputs = createDefaultInputs();
  const results = runComparison(inputs);
  assert.ok(Number.isFinite(results.buyerNetWealthNominal), 'buyerNetWealthNominal nicht endlich');
  assert.ok(Number.isFinite(results.renterNetWealthNominal), 'renterNetWealthNominal nicht endlich');
  assert.ok(Number.isFinite(results.differenceNominal), 'differenceNominal nicht endlich');
});

test('REGIONS: enthaelt alle 6 oesterreichischen Regionen mit plausiblen Richtwerten', () => {
  const expected = ['wien', 'graz', 'linz', 'salzburg', 'innsbruck', 'oesterreich'];
  for (const key of expected) {
    assert.ok(key in REGIONS, `Region "${key}" fehlt in REGIONS`);
    const r = REGIONS[key];
    assert.ok(typeof r.label === 'string' && r.label.length > 0, `${key}: label fehlt`);
    assert.ok(r.appreciationPct >= 1 && r.appreciationPct <= 5,
      `${key}: appreciationPct ${r.appreciationPct} ausserhalb plausiblem Bereich`);
  }
});
