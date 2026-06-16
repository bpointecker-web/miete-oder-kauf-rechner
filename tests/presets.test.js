import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, createDefaultInputs } from '../js/presets.js';
import { runComparison } from '../js/calculator.js';

const REQUIRED_FIELDS = [
  'region', 'pricePerSqm', 'livingAreaSqm',
  'transferTaxPct', 'landRegisterPct', 'brokerBuyPct', 'notaryPct',
  'equityAmount', 'equityRatioPct', 'mortgageLienPct', 'bankProcessingPct',
  'rateModel', 'interestRatePct', 'variableSwitchYear', 'variableRatePct',
  'loanTermYears', 'annualExtraRepayment',
  'ownerCostsPerSqm', 'operatingCostsPerSqm', 'appreciationPct',
  'rentPerSqm', 'depositMonths',
  'inflationPct', 'investmentReturnPct', 'applyVorabpauschale',
  'vorabpauschaleHaircutPct', 'kestPct', 'horizonYears',
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

test('createDefaultInputs: rentPerSqm aus pricePerSqm x rentalYieldPct, appreciationPct aus Eurostat', () => {
  // Arrange — Wien-Werte kommen aus REGIONS (live aus regional-generated.js)
  const wien = REGIONS['wien'];
  const inputs = createDefaultInputs('wien');

  // Assert rentPerSqm: pricePerSqm * rentalYieldPct% / 12, auf Cent gerundet
  const expectedRent = Math.round((wien.pricePerSqm * wien.rentalYieldPct) / 100 / 12 * 100) / 100;
  assert.ok(
    Math.abs(inputs.rentPerSqm - expectedRent) < 0.0001,
    `Wien rentPerSqm: ${inputs.rentPerSqm}, erwartet: ${expectedRent}`
  );
  assert.equal(inputs.pricePerSqm, wien.pricePerSqm);

  // appreciationPct kommt aus Eurostat-Daten (nicht mehr hartkodiert).
  // Pruefe nur: ist ein sinnvoller positiver Prozentwert.
  assert.ok(inputs.appreciationPct > 0 && inputs.appreciationPct < 20,
    `appreciationPct sollte positiver Prozentwert sein, war: ${inputs.appreciationPct}`
  );
  assert.equal(inputs.appreciationPct, wien.appreciationPct);
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
