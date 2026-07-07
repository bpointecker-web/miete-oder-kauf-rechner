import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAnnuityPayment,
  buildAmortizationSchedule,
  simulateBuyerOwnerCosts,
  simulateMonthlyPortfolios,
  applyCapitalGainsTax,
  applySaleCosts,
  findBreakevenYear,
  deriveStartCapital,
  runComparison,
} from '../js/calculator.js';

const GOLDEN_MASTER_INPUTS = {
  pricePerSqm: 5500,
  livingAreaSqm: 70,
  transferTaxPct: 3.5,
  landRegisterPct: 1.1,
  brokerBuyPct: 3.0,
  notaryPct: 1.5,
  equityRatioPct: 20,
  mortgageLienPct: 1.2,
  bankProcessingPct: 1.5,
  rateModel: 'fixed',
  interestRatePct: 3.5,
  loanTermYears: 30,
  annualExtraRepayment: 0,
  maintenancePctOfValue: 1.2,
  operatingCostsPerSqm: 2.2,
  appreciationPct: 2.5,
  rentPerSqm: 13.5,
  depositMonths: 3,
  inflationPct: 2.0,
  investmentReturnPct: 6.0,
  kestPct: 27.5,
  horizonYears: 30,
  simulateSale: true,
  saleBrokerFeePct: 3.0,
  immoEstPct: 30,
  primaryResidenceExempt: true,
};

test('calculateAnnuityPayment: 200.000 EUR / 3,5% / 360 Monate ergibt ca. 898 EUR/Monat', () => {
  // Arrange
  const principal = 200000;
  const annualRatePct = 3.5;
  const remainingMonths = 360;

  // Act
  const payment = calculateAnnuityPayment(principal, annualRatePct, remainingMonths);

  // Assert
  assert.ok(
    Math.abs(payment - 898) < 1,
    `Erwartet ca. 898 EUR, erhalten ${payment}`
  );
});

test('calculateAnnuityPayment: Zinssatz 0% verteilt die Restschuld gleichmaessig', () => {
  // Arrange
  const principal = 120000;
  const annualRatePct = 0;
  const remainingMonths = 120;

  // Act
  const payment = calculateAnnuityPayment(principal, annualRatePct, remainingMonths);

  // Assert
  assert.equal(payment, 1000);
});

test('buildAmortizationSchedule: Restschuld ist am Laufzeitende getilgt', () => {
  // Arrange
  const params = { loanAmount: 200000, loanTermYears: 30, interestRatePct: 3.5, horizonYears: 30 };

  // Act
  const schedule = buildAmortizationSchedule(params);

  // Assert
  const totalPrincipal = schedule.reduce((sum, row) => sum + row.principalPaid, 0);
  assert.ok(
    Math.abs(totalPrincipal - params.loanAmount) < 0.01,
    `Summe Tilgung sollte ca. ${params.loanAmount} sein, ist ${totalPrincipal}`
  );
  assert.ok(
    schedule[schedule.length - 1].endBalance < 0.01,
    `Restschuld am Laufzeitende sollte ca. 0 sein, ist ${schedule[schedule.length - 1].endBalance}`
  );
});

test('buildAmortizationSchedule: Zinsanteil Jahr 1 liegt knapp unter Kreditsumme x Jahreszins', () => {
  // Arrange
  const params = { loanAmount: 200000, loanTermYears: 30, interestRatePct: 3.5, horizonYears: 30 };
  const naiveAnnualInterest = params.loanAmount * (params.interestRatePct / 100); // 7000

  // Act
  const schedule = buildAmortizationSchedule(params);

  // Assert
  const year1 = schedule[0];
  assert.ok(year1.interestPaid < naiveAnnualInterest, `Jahr-1-Zins (${year1.interestPaid}) sollte unter ${naiveAnnualInterest} liegen`);
  assert.ok(year1.interestPaid > naiveAnnualInterest * 0.95, `Jahr-1-Zins (${year1.interestPaid}) sollte nahe an ${naiveAnnualInterest} liegen`);
});

test('buildAmortizationSchedule: variabler Zinswechsel - Rate vor/nach Wechsel konstant, Kredit am Ende getilgt', () => {
  // Arrange
  const params = {
    loanAmount: 200000,
    loanTermYears: 30,
    rateModel: 'hybrid',
    interestRatePct: 3.5,
    variableSwitchYear: 10,
    variableRatePct: 5.0,
    horizonYears: 30,
  };

  // Act
  const schedule = buildAmortizationSchedule(params);

  // Assert
  // Rate vor dem Wechsel (Jahre 1-10) ist konstant
  const paymentBeforeSwitch = schedule[0].monthlyPayment;
  for (let i = 0; i < 10; i++) {
    assert.ok(
      Math.abs(schedule[i].monthlyPayment - paymentBeforeSwitch) < 0.01,
      `Jahr ${i + 1}: Rate sollte konstant ${paymentBeforeSwitch} sein, ist ${schedule[i].monthlyPayment}`
    );
  }

  // Rate nach dem Wechsel (Jahre 11-30) ist konstant und hoeher als davor
  const paymentAfterSwitch = schedule[10].monthlyPayment;
  for (let i = 10; i < 30; i++) {
    assert.ok(
      Math.abs(schedule[i].monthlyPayment - paymentAfterSwitch) < 0.01,
      `Jahr ${i + 1}: Rate sollte konstant ${paymentAfterSwitch} sein, ist ${schedule[i].monthlyPayment}`
    );
  }
  assert.ok(
    paymentAfterSwitch > paymentBeforeSwitch,
    `Rate nach Zinswechsel (${paymentAfterSwitch}) sollte hoeher sein als davor (${paymentBeforeSwitch})`
  );

  // Kredit ist am Laufzeitende getilgt
  assert.ok(
    schedule[29].endBalance < 0.01,
    `Restschuld am Laufzeitende sollte ca. 0 sein, ist ${schedule[29].endBalance}`
  );
});

test('buildAmortizationSchedule: Sondertilgung verkuerzt die Tilgungsdauer und endBalance wird nie negativ', () => {
  // Arrange
  const baseParams = { loanAmount: 200000, loanTermYears: 30, interestRatePct: 3.5, horizonYears: 30 };
  const withExtraParams = { ...baseParams, annualExtraRepayment: 5000 };

  // Act
  const baseSchedule = buildAmortizationSchedule(baseParams);
  const extraSchedule = buildAmortizationSchedule(withExtraParams);

  const yearOfPayoffWithoutExtra = baseSchedule.findIndex((row) => row.endBalance === 0) + 1;
  const yearOfPayoffWithExtra = extraSchedule.findIndex((row) => row.endBalance === 0) + 1;

  // Assert
  assert.ok(
    yearOfPayoffWithExtra < yearOfPayoffWithoutExtra,
    `Mit Sondertilgung sollte frueher getilgt sein (${yearOfPayoffWithExtra}) als ohne (${yearOfPayoffWithoutExtra})`
  );
  for (const row of extraSchedule) {
    assert.ok(row.endBalance >= 0, `endBalance darf nie negativ sein, ist ${row.endBalance} in Jahr ${row.year}`);
  }
});

test('buildAmortizationSchedule: hohe Sondertilgung fuehrt zu Volltilgung und 0-Raten in Folgejahren', () => {
  // Arrange
  const params = { loanAmount: 50000, loanTermYears: 30, interestRatePct: 3.5, annualExtraRepayment: 20000, horizonYears: 10 };

  // Act
  const schedule = buildAmortizationSchedule(params);

  // Assert
  // Bei 20.000 Sondertilgung/Jahr + regulaerer Tilgung ist die Schuld nach spaetestens 3 Jahren weg
  const payoffIndex = schedule.findIndex((row) => row.endBalance === 0);
  assert.ok(payoffIndex >= 0 && payoffIndex < 3, `Volltilgung sollte innerhalb von 3 Jahren erfolgen, Index ${payoffIndex}`);

  const yearAfterPayoff = schedule[payoffIndex + 1];
  assert.deepEqual(yearAfterPayoff, { year: yearAfterPayoff.year, monthlyPayment: 0, interestPaid: 0, principalPaid: 0, endBalance: 0 });
});

test('buildAmortizationSchedule: Horizont laenger als Laufzeit liefert 0-Zeilen danach', () => {
  // Arrange
  const params = { loanAmount: 50000, loanTermYears: 5, interestRatePct: 3.5, horizonYears: 7 };

  // Act
  const schedule = buildAmortizationSchedule(params);

  // Assert
  assert.equal(schedule.length, 7);
  assert.ok(schedule[4].endBalance < 0.01, 'Restschuld nach 5 Jahren sollte 0 sein');
  assert.deepEqual(schedule[5], { year: 6, monthlyPayment: 0, interestPaid: 0, principalPaid: 0, endBalance: 0 });
  assert.deepEqual(schedule[6], { year: 7, monthlyPayment: 0, interestPaid: 0, principalPaid: 0, endBalance: 0 });
});

test('simulateBuyerOwnerCosts: Jahr 0 = Instandhaltung (% vom Wert) + Betriebskosten (€/m²)', () => {
  // Arrange
  const inputs = {
    pricePerSqm: 5500,
    livingAreaSqm: 70,
    maintenancePctOfValue: 1.2,
    operatingCostsPerSqm: 2.2,
    appreciationPct: 2.5,
    inflationPct: 2.0,
    horizonYears: 5,
  };
  const purchasePrice = 5500 * 70; // 385.000

  // Act
  const series = simulateBuyerOwnerCosts(inputs);

  // Assert
  const year0 = series[0];
  assert.equal(year0.year, 0);
  assert.equal(year0.propertyValue, purchasePrice);
  // Instandhaltung = 1,2 % des Werts p.a. / 12; Betriebskosten = 2,2 €/m² × 70
  const expectedMaintenance = purchasePrice * (1.2 / 100) / 12; // 385
  const expectedOperating = 2.2 * 70;                            // 154
  assert.ok(
    Math.abs(year0.monthlyOwnerCosts - (expectedMaintenance + expectedOperating)) < 0.001,
    `Jahr 0: Kosten sollten ${expectedMaintenance + expectedOperating} sein, sind ${year0.monthlyOwnerCosts}`
  );
});

test('simulateBuyerOwnerCosts: Instandhaltung waechst mit dem Wert, Betriebskosten mit der Inflation', () => {
  // Arrange
  const inputs = {
    pricePerSqm: 5500,
    livingAreaSqm: 70,
    maintenancePctOfValue: 1.2,
    operatingCostsPerSqm: 2.2,
    appreciationPct: 2.5,
    inflationPct: 2.0,
    horizonYears: 5,
  };
  const purchasePrice = 5500 * 70;

  // Act
  const series = simulateBuyerOwnerCosts(inputs);

  // Assert — Instandhaltung folgt der Wertsteigerung (2,5 %), Betriebskosten der Inflation (2 %)
  const maintenanceYear5 = purchasePrice * Math.pow(1.025, 5) * (1.2 / 100) / 12;
  const operatingYear5 = 2.2 * 70 * Math.pow(1.02, 5);
  const expectedYear5 = maintenanceYear5 + operatingYear5;
  assert.ok(
    Math.abs(series[5].monthlyOwnerCosts - expectedYear5) < 0.001,
    `Jahr 5: erwartet ${expectedYear5}, erhalten ${series[5].monthlyOwnerCosts}`
  );
});

test('simulateBuyerOwnerCosts: negative Wertsteigerung senkt den Immobilienwert ueber die Zeit', () => {
  // Arrange
  const inputs = {
    pricePerSqm: 5500,
    livingAreaSqm: 70,
    maintenancePctOfValue: 1.2,
    operatingCostsPerSqm: 2.2,
    appreciationPct: -1.0,
    inflationPct: 2.0,
    horizonYears: 5,
  };
  const purchasePrice = 5500 * 70;

  // Act
  const series = simulateBuyerOwnerCosts(inputs);

  // Assert
  const expectedYear5 = purchasePrice * Math.pow(0.99, 5);
  assert.ok(series[5].propertyValue < purchasePrice, 'Immobilienwert sollte unter den Kaufpreis sinken');
  assert.ok(
    Math.abs(series[5].propertyValue - expectedYear5) < 0.001,
    `Jahr 5: erwartet ${expectedYear5}, erhalten ${series[5].propertyValue}`
  );
});

test('simulateMonthlyPortfolios: monatliche Akkumulation liefert mehr als jaehrliche Einmalbuchung', () => {
  // Arrange
  // Kaeuferkosten 1000/Monat, Miete 800/Monat -> Mieter spart 200/Monat, 12% p.a. Rendite
  const inputs = { rentPerSqm: 800, livingAreaSqm: 1, inflationPct: 0, investmentReturnPct: 12, horizonYears: 1 };
  const amort = [{ monthlyPayment: 1000 }];
  const owner = [{ monthlyOwnerCosts: 0 }, { monthlyOwnerCosts: 0 }];
  const startCapital = { buyer: 0, renter: 0 };

  // Act
  const { renterPortfolioByYear } = simulateMonthlyPortfolios(inputs, amort, owner, startCapital);

  // Assert
  // Monatlich: FV einer nachschuessigen Rente, r=1%/Monat, 12 Monate, Sparrate 200
  const monthlyRate = 0.01;
  const expectedMonthly = 200 * ((Math.pow(1 + monthlyRate, 12) - 1) / monthlyRate);
  const yearlyLumpSum = 200 * 12; // einmalige Buchung am Jahresende, kein Zinseffekt im 1. Jahr

  assert.ok(
    Math.abs(renterPortfolioByYear[1].value - expectedMonthly) < 0.01,
    `Erwartet ca. ${expectedMonthly.toFixed(2)}, erhalten ${renterPortfolioByYear[1].value}`
  );
  assert.ok(
    renterPortfolioByYear[1].value > yearlyLumpSum,
    `Monatliche Akkumulation (${renterPortfolioByYear[1].value}) sollte ueber jaehrlicher Einmalbuchung (${yearlyLumpSum}) liegen`
  );
});

test('simulateMonthlyPortfolios: je nach Kosten-Differenz spart Kaeufer oder Mieter', () => {
  // Arrange
  const baseInputs = { livingAreaSqm: 1, inflationPct: 0, investmentReturnPct: 12, horizonYears: 1 };
  const owner = [{ monthlyOwnerCosts: 0 }, { monthlyOwnerCosts: 0 }];
  const startCapital = { buyer: 0, renter: 0 };

  // Act: Kaeuferkosten (1000) > Miete (800) -> Mieter wohnt guenstiger und spart die Differenz
  const amortBuyerExpensive = [{ monthlyPayment: 1000 }];
  const renterSavesResult = simulateMonthlyPortfolios(
    { ...baseInputs, rentPerSqm: 800 },
    amortBuyerExpensive,
    owner,
    startCapital
  );

  // Act: Kaeuferkosten (800) < Miete (1000) -> Kaeufer wohnt guenstiger und spart die Differenz
  const amortBuyerCheap = [{ monthlyPayment: 800 }];
  const buyerSavesResult = simulateMonthlyPortfolios(
    { ...baseInputs, rentPerSqm: 1000 },
    amortBuyerCheap,
    owner,
    startCapital
  );

  // Assert
  assert.ok(renterSavesResult.renterPortfolioByYear[1].value > 0, 'Mieter-Portfolio sollte wachsen, wenn Kaeuferkosten hoeher sind als die Miete');
  assert.equal(renterSavesResult.buyerPortfolioByYear[1].value, 0, 'Kaeufer-Portfolio sollte unveraendert bleiben, wenn Kaeufer nicht spart');

  assert.ok(buyerSavesResult.buyerPortfolioByYear[1].value > 0, 'Kaeufer-Portfolio sollte wachsen, wenn die Miete hoeher ist als die Kaeuferkosten');
  assert.equal(buyerSavesResult.renterPortfolioByYear[1].value, 0, 'Mieter-Portfolio sollte unveraendert bleiben, wenn Mieter nicht spart');
});

test('simulateMonthlyPortfolios: costBasis entspricht Startkapital plus Summe der Einzahlungen', () => {
  // Arrange
  const inputs = { rentPerSqm: 800, livingAreaSqm: 1, inflationPct: 0, investmentReturnPct: 12, horizonYears: 1 };
  const amort = [{ monthlyPayment: 1000 }];
  const owner = [{ monthlyOwnerCosts: 0 }, { monthlyOwnerCosts: 0 }];
  const startCapital = { buyer: 5000, renter: 3000 };

  // Act
  const { renterPortfolioByYear, buyerPortfolioByYear } = simulateMonthlyPortfolios(inputs, amort, owner, startCapital);

  // Assert
  // Mieter spart 200/Monat * 12 = 2400, Kaeufer spart 0
  assert.ok(
    Math.abs(renterPortfolioByYear[1].costBasis - (3000 + 2400)) < 0.001,
    `Mieter-Kostenbasis sollte 5400 sein, ist ${renterPortfolioByYear[1].costBasis}`
  );
  assert.equal(buyerPortfolioByYear[1].costBasis, 5000, 'Kaeufer-Kostenbasis sollte unveraendert bleiben');
});

test('applyCapitalGainsTax: Gewinn wird mit KESt besteuert', () => {
  // Arrange
  const portfolioSeries = [{ year: 1, value: 12000, costBasis: 10000 }];
  const kestPct = 27.5;

  // Act
  const result = applyCapitalGainsTax(portfolioSeries, kestPct);

  // Assert
  // Gewinn = 2000, Steuer = 2000 * 0.275 = 550
  assert.equal(result[0].tax, 550);
  assert.equal(result[0].valueAfterTax, 12000 - 550);
});

test('applyCapitalGainsTax: Verlust erzeugt keine negative Steuer', () => {
  // Arrange
  const portfolioSeries = [{ year: 1, value: 8000, costBasis: 10000 }];
  const kestPct = 27.5;

  // Act
  const result = applyCapitalGainsTax(portfolioSeries, kestPct);

  // Assert
  assert.equal(result[0].tax, 0);
  assert.equal(result[0].valueAfterTax, 8000);
});

test('applySaleCosts: ohne Hauptwohnsitzbefreiung wird ImmoESt auf den Wertgewinn faellig', () => {
  // Arrange
  const propertyValue = 400000;
  const originalPrice = 350000;
  const remainingDebt = 150000;
  const brokerFeePct = 3;
  const taxRate = 30;

  // Act
  const netProceeds = applySaleCosts(propertyValue, originalPrice, remainingDebt, brokerFeePct, taxRate, false);

  // Assert
  // Maklerprovision = 400.000 * 3% = 12.000
  // Wertgewinn = 400.000 - 350.000 = 50.000, ImmoESt = 50.000 * 30% = 15.000
  // netProceeds = 400.000 - 150.000 - 12.000 - 15.000 = 223.000
  assert.equal(netProceeds, 223000);
});

test('applySaleCosts: Hauptwohnsitzbefreiung setzt ImmoESt trotz Gewinn auf 0', () => {
  // Arrange
  const propertyValue = 400000;
  const originalPrice = 350000;
  const remainingDebt = 150000;
  const brokerFeePct = 3;
  const taxRate = 30;

  // Act
  const netProceeds = applySaleCosts(propertyValue, originalPrice, remainingDebt, brokerFeePct, taxRate, true);

  // Assert
  // Maklerprovision = 12.000, ImmoESt = 0 (Befreiung)
  // netProceeds = 400.000 - 150.000 - 12.000 - 0 = 238.000
  assert.equal(netProceeds, 238000);
});

test('applySaleCosts: kein Gewinn -> keine ImmoESt auch ohne Befreiung', () => {
  // Arrange
  const propertyValue = 300000;
  const originalPrice = 350000; // Wertverlust
  const remainingDebt = 150000;
  const brokerFeePct = 3;
  const taxRate = 30;

  // Act
  const netProceeds = applySaleCosts(propertyValue, originalPrice, remainingDebt, brokerFeePct, taxRate, false);

  // Assert
  // Maklerprovision = 300.000 * 3% = 9.000, kein Gewinn -> ImmoESt = 0
  // netProceeds = 300.000 - 150.000 - 9.000 - 0 = 141.000
  assert.equal(netProceeds, 141000);
});

test('runComparison: ImmoESt-Bemessung beruecksichtigt Kaufnebenkosten als Anschaffungskosten', () => {
  // Arrange — bewusst reduziertes Szenario: Miete=0 und Eigentuemerkosten=0 halten das
  // Kaeufer-Portfolio bei 0, sodass buyerNetWealthNominal exakt dem Netto-Verkaufserloes
  // der Immobilie entspricht (isoliert den ImmoESt-Fix von Portfolio-Effekten).
  const inputs = {
    pricePerSqm: 1000,
    livingAreaSqm: 100,
    transferTaxPct: 10,
    landRegisterPct: 0,
    brokerBuyPct: 0,
    notaryPct: 0,
    equityRatioPct: 100,
    mortgageLienPct: 0,
    bankProcessingPct: 0,
    rateModel: 'fixed',
    interestRatePct: 0,
    loanTermYears: 1,
    annualExtraRepayment: 0,
    maintenancePctOfValue: 0,
    operatingCostsPerSqm: 0,
    appreciationPct: 15,
    rentPerSqm: 0,
    depositMonths: 0,
    inflationPct: 0,
    investmentReturnPct: 0,
    kestPct: 0,
    horizonYears: 1,
    simulateSale: true,
    saleBrokerFeePct: 0,
    immoEstPct: 30,
    primaryResidenceExempt: false,
    renovationCost: 0,
    renovationYear: 15,
  };

  // Act
  const results = runComparison(inputs);

  // Assert
  // Kaufpreis 100.000, Kaufnebenkosten (nur GrESt 10%) = 10.000 -> Anschaffungskosten 110.000.
  // Immobilienwert Jahr 1 = 100.000 * 1,15 = 115.000. Wertgewinn = 115.000 - 110.000 = 5.000.
  // ImmoESt (30%) = 1.500 -> Nettoerloes = 115.000 - 1.500 = 113.500 (kein Kredit, keine Maklerprovision).
  // Ohne den Fix (Anschaffungskosten = nur Kaufpreis) waere der Gewinn faelschlich 15.000
  // und der Nettoerloes 110.500 (4.500 statt 1.500 ImmoESt -> 3.000 zu viel Steuer).
  assert.ok(
    Math.abs(results.buyerNetWealthNominal - 113500) < 0.01,
    `buyerNetWealthNominal: ${results.buyerNetWealthNominal} (erwartet 113.500, Bug-Wert waere 110.500)`
  );
});

test('findBreakevenYear: klarer Breakeven in der Mitte der Serie', () => {
  // Arrange
  const buyerSeries = [0, 10000, 25000, 45000, 70000];
  const renterSeries = [5000, 15000, 28000, 40000, 50000];

  // Act
  const breakevenYear = findBreakevenYear(buyerSeries, renterSeries);

  // Assert
  // Jahr 0-2: Mieter > Kaeufer, Jahr 3: Kaeufer (45000) >= Mieter (40000) -> Breakeven
  assert.equal(breakevenYear, 3);
});

test('findBreakevenYear: kein Breakeven -> null', () => {
  // Arrange
  const buyerSeries = [0, 10000, 20000, 30000];
  const renterSeries = [5000, 15000, 28000, 45000];

  // Act
  const breakevenYear = findBreakevenYear(buyerSeries, renterSeries);

  // Assert
  assert.equal(breakevenYear, null);
});

test('findBreakevenYear: Kaeufer ist bereits in Jahr 0 vorne -> Breakeven = 0', () => {
  // Arrange
  const buyerSeries = [5000, 20000, 40000];
  const renterSeries = [0, 15000, 35000];

  // Act
  const breakevenYear = findBreakevenYear(buyerSeries, renterSeries);

  // Assert
  assert.equal(breakevenYear, 0);
});

test('findBreakevenYear: reales Breakeven (diskontiert) ist identisch zum nominalen (Spec §1.6)', () => {
  // Arrange
  const buyerSeriesNominal = [0, 10000, 25000, 45000, 70000];
  const renterSeriesNominal = [5000, 15000, 28000, 40000, 50000];
  const inflationPct = 2.5;
  const toReal = (series) => series.map((value, year) => value / Math.pow(1 + inflationPct / 100, year));

  // Act
  const nominalBreakeven = findBreakevenYear(buyerSeriesNominal, renterSeriesNominal);
  const realBreakeven = findBreakevenYear(toReal(buyerSeriesNominal), toReal(renterSeriesNominal));

  // Assert
  assert.equal(realBreakeven, nominalBreakeven);
});

test('deriveStartCapital: Default-Beispiel (Wien) rechnerisch korrekt, kein Warning', () => {
  // Arrange
  const inputs = {
    pricePerSqm: 5500,
    livingAreaSqm: 70,
    transferTaxPct: 3.5,
    landRegisterPct: 1.1,
    brokerBuyPct: 3.0,
    notaryPct: 1.5,
    equityRatioPct: 20,
    mortgageLienPct: 1.2,
    bankProcessingPct: 1.5,
    rentPerSqm: 13.5,
    depositMonths: 3,
  };

  // Act
  const derived = deriveStartCapital(inputs);

  // Assert
  // purchasePrice = 5500 * 70 = 385.000
  assert.equal(derived.purchasePrice, 385000);
  // closingCosts = 385.000 * 9,1% = 35.035
  assert.ok(Math.abs(derived.closingCosts - 35035) < 0.001, `closingCosts: ${derived.closingCosts}`);
  // equity = gesamtes Bargeld = 385.000 * 20% = 77.000 (deckt Nebenkosten -> kein Warning)
  assert.equal(derived.equity, 77000);
  assert.equal(derived.warnings.length, 0);
  // loanAmount = (385.000 - 77.000 + 35.035) / (1 - 2,7%) = 343.035 / 0,973
  const expectedLoan = (385000 - 77000 + 35035) / (1 - 0.027);
  assert.ok(Math.abs(derived.loanAmount - expectedLoan) < 0.001, `loanAmount: ${derived.loanAmount}`);
  // financingCosts = loanAmount * 2,7%
  assert.ok(Math.abs(derived.financingCosts - expectedLoan * 0.027) < 0.001, `financingCosts: ${derived.financingCosts}`);
  // downPayment = 77.000 - closingCosts - financingCosts (Rest fließt in den Kaufpreis)
  assert.ok(Math.abs(derived.downPayment - (77000 - 35035 - expectedLoan * 0.027)) < 0.001, `downPayment: ${derived.downPayment}`);
  // startCapital = equity (beide Seiten setzen dasselbe Bargeld ein)
  assert.equal(derived.startCapital, 77000);
  // Quell-/Verwendungs-Invariante: equity + loan = purchasePrice + closingCosts + financingCosts
  assert.ok(
    Math.abs((derived.equity + derived.loanAmount) - (derived.purchasePrice + derived.closingCosts + derived.financingCosts)) < 0.001
  );
  // monthlyRent = 13.5 * 70 = 945, deposit = 945 * 3 = 2.835
  assert.equal(derived.monthlyRent, 945);
  assert.equal(derived.deposit, 2835);
});

test('deriveStartCapital: Eigenkapital unter den Nebenkosten -> Warning, kein stilles Anheben', () => {
  // Arrange
  const inputs = {
    pricePerSqm: 5500,
    livingAreaSqm: 70,
    transferTaxPct: 3.5,
    landRegisterPct: 1.1,
    brokerBuyPct: 3.0,
    notaryPct: 1.5,
    equityRatioPct: 5, // 19.250 EUR < Nebenkosten -> Ueber-100%-Finanzierung
    mortgageLienPct: 1.2,
    bankProcessingPct: 1.5,
    rentPerSqm: 13.5,
    depositMonths: 3,
  };

  // Act
  const derived = deriveStartCapital(inputs);

  // Assert
  // equity bleibt unveraendert (kein stilles Anheben mehr) = 385.000 * 5% = 19.250
  assert.equal(derived.equity, 19250);
  assert.equal(derived.warnings.length, 1);
  assert.equal(derived.warnings[0].code, 'EQUITY_BELOW_COSTS');
  // downPayment ist negativ -> Kredit liegt ueber dem Kaufpreis (>100%-Finanzierung)
  assert.ok(derived.downPayment < 0, `downPayment: ${derived.downPayment}`);
  assert.ok(derived.loanAmount > derived.purchasePrice, `loanAmount: ${derived.loanAmount}`);
});

test('deriveStartCapital: Nebenkosten "mitfinanzieren" = weniger Eigenkapital eintragen (identische Kreditsumme)', () => {
  // Geld ist fungibel: ob Nebenkosten gedanklich aus dem Eigenkapital oder ueber den
  // Kredit bezahlt werden, fuehrt bei gleichem Bargeldeinsatz zur gleichen Kreditsumme.
  // Kaufpreis 1.000.000 EUR, Eigenkapital 500.000 EUR (z.B. Erloes aus Wohnungsverkauf).
  const inputs = {
    pricePerSqm: 10000,
    livingAreaSqm: 100,
    transferTaxPct: 3.5,
    landRegisterPct: 1.1,
    brokerBuyPct: 3.0,
    notaryPct: 1.5,
    equityRatioPct: 50,
    mortgageLienPct: 1.2,
    bankProcessingPct: 1.5,
    rentPerSqm: 13.5,
    depositMonths: 3,
  };

  // Act
  const derived = deriveStartCapital(inputs);

  // Assert
  assert.equal(derived.purchasePrice, 1000000);
  assert.equal(derived.equity, 500000);
  assert.equal(derived.closingCosts, 91000);
  // loanAmount = (1.000.000 - 500.000 + 91.000) / (1 - 2,7%) = 591.000 / 0,973
  const expectedLoan = 591000 / (1 - 0.027);
  assert.ok(Math.abs(derived.loanAmount - expectedLoan) < 0.001, `loanAmount: ${derived.loanAmount}`);
  assert.ok(
    Math.abs(derived.financingCosts - expectedLoan * 0.027) < 0.001,
    `financingCosts: ${derived.financingCosts}`
  );
  // Bargeldeinsatz = Eigenkapital (beide Vergleichsseiten setzen dasselbe ein)
  assert.equal(derived.startCapital, 500000);
  // Quell-/Verwendungs-Invariante: equity + loan = purchasePrice + closingCosts + financingCosts
  assert.ok(
    Math.abs((derived.equity + derived.loanAmount) - (derived.purchasePrice + derived.closingCosts + derived.financingCosts)) < 0.001
  );
  assert.equal(derived.warnings.length, 0);
});

test('runComparison: "Golden Master" Referenzszenario (Default Wien, 30 Jahre)', () => {
  // Arrange
  const inputs = GOLDEN_MASTER_INPUTS;

  // Act
  const results = runComparison(inputs);

  // Assert: Bottom-Line-Kennzahlen (eingefroren, Stand A12 — neu kalibriert nach
  // Umstellung Fondsbesteuerung: laufende Fondssteuer (1,5 % × 27,5 %) entfernt,
  // nur noch End-KESt symmetrisch auf beide Portfolios. Mieter-Wert steigt dadurch,
  // Käufer-Wert unveraendert (Käufer-Portfolio in diesem Szenario ≈ 0).
  assert.ok(Math.abs(results.buyerNetWealthNominal - 783336.61) < 0.01, `buyerNetWealthNominal: ${results.buyerNetWealthNominal}`);
  assert.ok(Math.abs(results.renterNetWealthNominal - 1260300.71) < 0.01, `renterNetWealthNominal: ${results.renterNetWealthNominal}`);
  assert.ok(Math.abs(results.differenceNominal - -476964.10) < 0.01, `differenceNominal: ${results.differenceNominal}`);
  assert.ok(Math.abs(results.buyerNetWealthReal - 432457.34) < 0.01, `buyerNetWealthReal: ${results.buyerNetWealthReal}`);
  assert.ok(Math.abs(results.renterNetWealthReal - 695775.33) < 0.01, `renterNetWealthReal: ${results.renterNetWealthReal}`);
  assert.ok(Math.abs(results.differenceReal - -263317.99) < 0.01, `differenceReal: ${results.differenceReal}`);
  // Bei den Default-Annahmen (Anlagerendite 6% > Wertsteigerung 2,5%) bleibt der
  // Mieter ueber den gesamten Horizont vorne -> kein Breakeven
  assert.equal(results.breakevenYear, null);
  assert.deepEqual(results.warnings, []);

  // Assert: derived
  assert.equal(results.derived.purchasePrice, 385000);
  assert.equal(results.derived.equity, 77000);
  const expectedLoan = (385000 - 77000 + 35035) / (1 - 0.027);
  assert.ok(Math.abs(results.derived.loanAmount - expectedLoan) < 0.001, `loanAmount: ${results.derived.loanAmount}`);
  assert.ok(Math.abs(results.derived.closingCosts - 35035) < 0.001);
  assert.ok(Math.abs(results.derived.financingCosts - expectedLoan * 0.027) < 0.001);
  assert.ok(Math.abs(results.derived.downPayment - (77000 - 35035 - expectedLoan * 0.027)) < 0.001);
  assert.equal(results.derived.startCapital, 77000);
  assert.equal(results.derived.monthlyRent, 945);
  assert.equal(results.derived.deposit, 2835);

  // Assert: Form der Serien vollstaendig (Architektur §4.2), Jahre 0..30
  assert.equal(results.series.years.length, 31);
  assert.deepEqual(results.series.years, Array.from({ length: 31 }, (_, i) => i));
  for (const key of ['buyerNetWealthNominal', 'renterNetWealthNominal', 'buyerNetWealthReal', 'renterNetWealthReal', 'buyerMonthlyCost', 'renterMonthlyCost']) {
    assert.equal(results.series[key].length, 31, `series.${key} sollte 31 Werte haben`);
    assert.ok(results.series[key].every((v) => Number.isFinite(v)), `series.${key} sollte nur endliche Zahlen enthalten`);
  }
});
