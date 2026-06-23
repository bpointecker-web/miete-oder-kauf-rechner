// Reiner, DOM-freier Rechenkern für den Mieten-vs-Kaufen-Vergleich.
// Siehe ARCHITEKTUR.md (Abschnitt 4-5) für Datenverträge und Pipeline.
// Wird Schritt für Schritt gemäß ENTWICKLUNGSPLAN.md (Phase A) implementiert.

/**
 * Monatliche Annuitätsrate für ein Darlehen.
 *
 * @param {number} principal - Restschuld zu Beginn der Berechnung
 * @param {number} annualRatePct - Nominaler Jahreszins in Prozent (z.B. 3.5)
 * @param {number} remainingMonths - Verbleibende Laufzeit in Monaten
 * @returns {number} monatliche Annuitätsrate
 */
export function calculateAnnuityPayment(principal, annualRatePct, remainingMonths) {
  const monthlyRate = annualRatePct / 100 / 12;

  if (monthlyRate === 0) {
    return principal / remainingMonths;
  }

  const factor = Math.pow(1 + monthlyRate, remainingMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

/**
 * Tilgungsplan für ein Annuitätendarlehen, aggregiert auf Jahresebene.
 *
 * Ist die Restschuld vor Beginn eines Jahres bereits 0 (z.B. weil `horizonYears`
 * länger als `loanTermYears` ist), liefert das Jahr 0-Werte (siehe Spec §2.2
 * Edge-Case-Tabelle, "Horizont > Kreditlaufzeit").
 *
 * @param {object} params
 * @param {number} params.loanAmount - Kreditsumme
 * @param {number} params.loanTermYears - Vertragslaufzeit in Jahren
 * @param {"fixed"|"variable"} [params.rateModel="fixed"] - Zinsmodell (nur für Label, Berechnung identisch)
 * @param {number} params.interestRatePct - Zins p.a. in Prozent
 * @param {number} [params.annualExtraRepayment=0] - Sondertilgung am Jahresende, gecappt bei Restschuld
 * @param {number} params.horizonYears - Betrachtungshorizont in Jahren
 * @returns {Array<{year: number, monthlyPayment: number, interestPaid: number, principalPaid: number, endBalance: number}>}
 */
export function buildAmortizationSchedule({
  loanAmount,
  loanTermYears,
  rateModel = 'fixed',
  interestRatePct,
  variableSwitchYear,
  variableRatePct,
  annualExtraRepayment = 0,
  horizonYears,
}) {
  let monthlyRate = interestRatePct / 100 / 12;
  let payment = calculateAnnuityPayment(loanAmount, interestRatePct, loanTermYears * 12);

  let balance = loanAmount;
  const schedule = [];

  for (let year = 1; year <= horizonYears; year++) {
    // Hybrid: nach der Fixphase Annuität auf Basis Restschuld + Restlaufzeit neu berechnen
    if (rateModel === 'hybrid' && year === variableSwitchYear + 1) {
      const remainingMonths = (loanTermYears - variableSwitchYear) * 12;
      monthlyRate = variableRatePct / 100 / 12;
      payment = calculateAnnuityPayment(balance, variableRatePct, remainingMonths);
    }

    if (balance <= 0) {
      schedule.push({ year, monthlyPayment: 0, interestPaid: 0, principalPaid: 0, endBalance: 0 });
      continue;
    }

    let interestPaid = 0;
    let principalPaid = 0;

    for (let month = 0; month < 12 && balance > 0; month++) {
      const interest = balance * monthlyRate;
      let principal = payment - interest;
      if (principal > balance) {
        principal = balance;
      }
      balance -= principal;
      if (balance < 1e-8) {
        // Gleitkomma-Rest (z.B. 1e-10) auf exakt 0 snappen, damit
        // nachfolgende Jahre korrekt als "vollstaendig getilgt" erkannt werden
        balance = 0;
      }
      interestPaid += interest;
      principalPaid += principal;
    }

    if (annualExtraRepayment > 0 && balance > 0) {
      const extra = Math.min(annualExtraRepayment, balance);
      balance -= extra;
      if (balance < 1e-8) {
        balance = 0;
      }
      principalPaid += extra;
    }

    schedule.push({ year, monthlyPayment: payment, interestPaid, principalPaid, endBalance: balance });
  }

  return schedule;
}

/**
 * Immobilienwert und laufende Eigentümerkosten (inkl. Betriebskosten) pro Jahr.
 *
 * Liefert einen Eintrag für Jahr 0 (Startwerte, unindexiert) bis `horizonYears`
 * (Jahr 0..N, also N+1 Einträge) — Jahr 0 wird für die "Liquidation-heute"-Serie
 * (Architektur §5) als Startpunkt benötigt.
 *
 * - `propertyValue` wächst jährlich mit `appreciationPct` (darf negativ sein, Spec §2.3).
 * - `monthlyMaintenance` = maintenancePctOfValue % des aktuellen Immobilienwerts / 12:
 *   wächst mit der Wertsteigerung (nicht nur Inflation), weil Instandhaltung an den
 *   Immobilienwert gekoppelt ist (teurere Wohnung → teurer zu erhalten).
 * - `monthlyOperating` (Betriebskosten) wächst weiterhin mit Inflation.
 *
 * @param {object} inputs
 * @param {number} inputs.pricePerSqm - Kaufpreis €/m²
 * @param {number} inputs.livingAreaSqm - Wohnfläche m²
 * @param {number} inputs.maintenancePctOfValue - Instandhaltung % des Immobilienwerts p.a.
 * @param {number} inputs.operatingCostsPerSqm - Betriebskosten €/m²/Monat
 * @param {number} inputs.appreciationPct - Wertsteigerung Immobilie p.a. in Prozent (kann < 0 sein)
 * @param {number} inputs.inflationPct - Inflation p.a. in Prozent
 * @param {number} inputs.horizonYears - Betrachtungshorizont in Jahren
 * @returns {Array<{year: number, propertyValue: number, monthlyOwnerCosts: number}>}
 */
export function simulateBuyerOwnerCosts({
  pricePerSqm,
  livingAreaSqm,
  maintenancePctOfValue,
  operatingCostsPerSqm,
  appreciationPct,
  inflationPct,
  horizonYears,
}) {
  const purchasePrice = pricePerSqm * livingAreaSqm;
  const appreciationFactor = 1 + appreciationPct / 100;
  const inflationFactor = 1 + inflationPct / 100;
  const baseMonthlyOperating = operatingCostsPerSqm * livingAreaSqm;

  const series = [];
  for (let year = 0; year <= horizonYears; year++) {
    const propertyValue = purchasePrice * Math.pow(appreciationFactor, year);
    const monthlyMaintenance = propertyValue * (maintenancePctOfValue / 100) / 12;
    const monthlyOperating = baseMonthlyOperating * Math.pow(inflationFactor, year);
    series.push({
      year,
      propertyValue,
      monthlyOwnerCosts: monthlyMaintenance + monthlyOperating,
    });
  }

  return series;
}

/**
 * Monatliche Simulation der beiden Vermögens-Portfolios (Käufer/Mieter).
 *
 * Zentrale Modellannahme (Spec §1.3): Beide Seiten haben dasselbe "Wohnbudget" =
 * jeweils die teurere der beiden Optionen (Käuferkosten vs. Miete) in diesem Monat.
 * Wer günstiger wohnt, spart die Differenz und investiert sie in sein Portfolio
 * (monatliche Verzinsung mit `q = 1 + investmentReturnPct/100/12`).
 *
 * Käuferkosten in Jahr y = `amort[y-1].monthlyPayment + owner[y-1].monthlyOwnerCosts`
 * (Jahr-1-Werte gelten für die ersten 12 Monate, etc. — Index y-1 da `amort`
 * 1-basiert auf Jahre und `owner` 0-basiert beginnt). Miete in Jahr y wird analog
 * mit `(1+inflationPct/100)^(y-1)` indexiert.
 *
 * Laufende Fondsbesteuerung (ausschüttungsgleiche Erträge): Am Jahresende wird
 * KESt auf `dividendYieldPct` des Portfoliowerts zu Jahresbeginn fällig —
 * modelliert die jährliche Pflichtbesteuerung bei österreichischen Meldefonds.
 * Direkt vom Portfolio abgezogen, Kostenbasis erhöht (bereits versteuerter
 * Anteil zählt nicht erneut als Gewinn beim Endverkauf).
 *
 * @param {object} inputs
 * @param {number} inputs.rentPerSqm - Miete €/m²/Monat (Jahr 0, brutto inkl. BK)
 * @param {number} inputs.livingAreaSqm - Wohnfläche m²
 * @param {number} inputs.inflationPct - Inflation p.a. in Prozent (Mietsteigerung)
 * @param {number} inputs.investmentReturnPct - Anlagerendite Mieter-Portfolio p.a. in Prozent
 * @param {number} inputs.horizonYears - Betrachtungshorizont in Jahren
 * @param {number} [inputs.dividendYieldPct=1.5] - Ausschüttungsgleiche Erträge des Meldefonds in % des NAV p.a.
 * @param {number} [inputs.kestPct=0] - KESt-Satz in Prozent
 * @param {Array<{monthlyPayment: number}>} amort - Ergebnis von `buildAmortizationSchedule` (Jahre 1..N)
 * @param {Array<{monthlyOwnerCosts: number}>} owner - Ergebnis von `simulateBuyerOwnerCosts` (Jahre 0..N)
 * @param {{buyer: number, renter: number}} startCapital - Startwert je Portfolio (Mieter-Wert bereits abzgl. Kaution)
 * @returns {{buyerPortfolioByYear: Array<{year: number, value: number, costBasis: number}>, renterPortfolioByYear: Array<{year: number, value: number, costBasis: number}>}}
 */
export function simulateMonthlyPortfolios(inputs, amort, owner, startCapital) {
  const {
    rentPerSqm,
    livingAreaSqm,
    inflationPct,
    investmentReturnPct,
    horizonYears,
    dividendYieldPct = 1.5,
    kestPct = 0,
    renterSavingsRatePct = 100,
    renovationCost = 0,
    renovationYear = 15,
  } = inputs;

  const renterSavingsRate = renterSavingsRatePct / 100;

  const baseMonthlyRent = rentPerSqm * livingAreaSqm;
  const inflationFactor = 1 + inflationPct / 100;
  const monthlyGrowthFactor = 1 + investmentReturnPct / 100 / 12;

  let buyerValue = startCapital.buyer;
  let buyerCostBasis = startCapital.buyer;
  let renterValue = startCapital.renter;
  let renterCostBasis = startCapital.renter;

  const buyerPortfolioByYear = [{ year: 0, value: buyerValue, costBasis: buyerCostBasis }];
  const renterPortfolioByYear = [{ year: 0, value: renterValue, costBasis: renterCostBasis }];

  for (let year = 1; year <= horizonYears; year++) {
    // Sanierungsstau: einmalige Kosten am Jahresanfang vom Käufer-Portfolio abziehen.
    // Wächst nicht mit Inflation (nominaler Fixbetrag, wie vom Nutzer eingegeben).
    if (renovationCost > 0 && year === renovationYear) {
      buyerValue -= renovationCost;
    }

    const buyerMonthlyCost = amort[year - 1].monthlyPayment + owner[year - 1].monthlyOwnerCosts;
    const rentMonthly = baseMonthlyRent * Math.pow(inflationFactor, year - 1);
    const sharedBudget = Math.max(buyerMonthlyCost, rentMonthly);
    const buyerSaving = sharedBudget - buyerMonthlyCost;
    const renterSaving = sharedBudget - rentMonthly;

    for (let month = 0; month < 12; month++) {
      buyerValue = buyerValue * monthlyGrowthFactor + buyerSaving;
      buyerCostBasis += buyerSaving;
      // Nur der investierte Anteil fließt ins Portfolio — bei Sparquote < 100 % wird
      // der Rest konsumiert (nicht angelegt). Bei negativem renterSaving (Miete > Budget)
      // greift die Sparquote nicht: der Fehlbetrag muss vollständig aus dem Portfolio.
      const renterInvested = renterSaving > 0 ? renterSaving * renterSavingsRate : renterSaving;
      renterValue = renterValue * monthlyGrowthFactor + renterInvested;
      renterCostBasis += renterInvested;
    }

    // Jährliche KeSt auf ausschüttungsgleiche Erträge (Pflicht bei Meldefonds AT)
    const renterValueAtYearStart = renterPortfolioByYear[year - 1].value;
    const annualFundTax = renterValueAtYearStart * (dividendYieldPct / 100) * (kestPct / 100);
    renterValue -= annualFundTax;
    renterCostBasis += annualFundTax;

    buyerPortfolioByYear.push({ year, value: buyerValue, costBasis: buyerCostBasis });
    renterPortfolioByYear.push({ year, value: renterValue, costBasis: renterCostBasis });
  }

  return { buyerPortfolioByYear, renterPortfolioByYear };
}

/**
 * Wendet die Kapitalertragsteuer (KESt) auf den Gewinn einer Portfolio-Zeitreihe an.
 *
 * Pro Jahr wird KESt auf `max(0, value - costBasis)` berechnet (D2, Architektur §7) —
 * nie auf den vollen Portfoliowert, und nie negativ bei Verlust.
 *
 * @param {Array<{year: number, value: number, costBasis: number}>} portfolioSeries
 * @param {number} kestPct - KESt-Satz in Prozent (z.B. 27.5)
 * @returns {Array<{year: number, valueAfterTax: number, tax: number}>}
 */
export function applyCapitalGainsTax(portfolioSeries, kestPct) {
  const kestRate = kestPct / 100;

  return portfolioSeries.map(({ year, value, costBasis }) => {
    const gain = Math.max(0, value - costBasis);
    const tax = gain * kestRate;
    return { year, valueAfterTax: value - tax, tax };
  });
}

/**
 * Nettoerlös einer Immobilie nach Restschuld, Maklerprovision und ImmoESt.
 *
 * `Käufer-Nettovermögen = Immobilienwert − Restschuld − Verkaufskosten/-steuer` (Spec §1.5).
 * Die ImmoESt (30 %) wird nur auf einen **positiven** Wertgewinn
 * (`propertyValue − originalPrice`) angewandt und entfällt bei
 * Hauptwohnsitzbefreiung vollständig.
 *
 * @param {number} propertyValue - aktueller Immobilienwert
 * @param {number} originalPrice - ursprünglicher Kaufpreis (für den Wertgewinn)
 * @param {number} remainingDebt - Restschuld zum Verkaufszeitpunkt
 * @param {number} brokerFeePct - Maklerprovision in Prozent vom Immobilienwert
 * @param {number} taxRate - ImmoESt-Satz in Prozent (z.B. 30)
 * @param {boolean} isPrimaryResidence - Hauptwohnsitzbefreiung aktiv?
 * @returns {number} netProceeds
 */
export function applySaleCosts(propertyValue, originalPrice, remainingDebt, brokerFeePct, taxRate, isPrimaryResidence) {
  const brokerFee = propertyValue * (brokerFeePct / 100);
  const gain = Math.max(0, propertyValue - originalPrice);
  const tax = isPrimaryResidence ? 0 : gain * (taxRate / 100);

  return propertyValue - remainingDebt - brokerFee - tax;
}

/**
 * Erstes Jahr, in dem das Käufer-Nettovermögen das Mieter-Nettovermögen erreicht/übersteigt.
 *
 * `null`, falls das in keinem Jahr der Serie passiert. Es gibt **nur diesen einen**
 * (nominalen) Aufruf — ein separates "reales Breakeven" ist mathematisch identisch
 * (Spec §1.6), da die Realwert-Diskontierung beide Serien in jedem Jahr durch
 * denselben Faktor `(1+Inflation)^y` teilt und damit das Vorzeichen der Differenz
 * `Käufer − Mieter` unverändert lässt.
 *
 * @param {number[]} buyerSeries - Käufer-Nettovermögen pro Jahr (Index 0..N)
 * @param {number[]} renterSeries - Mieter-Nettovermögen pro Jahr (Index 0..N)
 * @returns {number | null} Jahr (0-basiert, gleicher Index wie die Serien) oder `null`
 */
/**
 * Ermittelt per Binärsuche die minimale Sparquote (0–100 %), ab der Mieten vorteilhafter ist.
 * null  = Kaufen gewinnt selbst bei 100 % Sparquote (Mieten lohnt sich nie).
 * 0     = Mieten gewinnt sogar ohne jegliches Anlegen.
 */
export function findBreakevenSavingsRate(inputs) {
  const at100 = runComparison({ ...inputs, renterSavingsRatePct: 100 });
  if (at100.differenceNominal >= 0) return null;

  const at0 = runComparison({ ...inputs, renterSavingsRatePct: 0 });
  if (at0.differenceNominal < 0) return 0;

  let lo = 0, hi = 100;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (runComparison({ ...inputs, renterSavingsRatePct: mid }).differenceNominal < 0) {
      hi = mid; // Mieter gewinnt → Schwelle liegt tiefer
    } else {
      lo = mid; // Käufer gewinnt → Schwelle liegt höher
    }
  }
  return Math.round((lo + hi) / 2);
}

export function findBreakevenYear(buyerSeries, renterSeries) {
  for (let year = 0; year < buyerSeries.length; year++) {
    if (buyerSeries[year] >= renterSeries[year]) {
      return year;
    }
  }
  return null;
}

/**
 * Leitet Startkapital, Kreditsumme, Mietkaution und Nebenkosten aus den Rohwerten ab.
 *
 * **Mittelverwendung (ein einziges, intuitives Modell):** `equity` ist das gesamte
 * Bargeld, das der Käufer einsetzt. Daraus werden zuerst Kauf- und
 * Finanzierungsnebenkosten bezahlt; der Rest (`downPayment`) fließt als Anzahlung in
 * den Kaufpreis und reduziert den Kredit. Geld ist fungibel — ob man die Nebenkosten
 * gedanklich „aus dem Eigenkapital zahlt" oder „über den Kredit mitfinanziert", führt
 * zu identischer Kreditsumme; deshalb gibt es keinen separaten „Nebenkosten
 * mitfinanzieren"-Modus mehr.
 *
 * Da die Finanzierungsnebenkosten von der noch unbekannten Kredithöhe abhängen, ist
 * die Gleichung nach `loanAmount` aufgelöst:
 *   `loan = (purchasePrice − equity + closingCosts) / (1 − financingCostsPct/100)`
 * Es gilt die Quell-/Verwendungs-Invariante `equity + loanAmount = purchasePrice +
 * closingCosts + financingCosts`.
 *
 * **Plausibilitätsprüfung:** Reicht das Eigenkapital nicht einmal für die Nebenkosten
 * (`downPayment < 0`), läge der Kredit über dem Kaufpreis (>100%-Finanzierung) — in
 * Österreich praktisch nicht vergeben. In diesem Fall wird eine `warning`
 * zurückgegeben (kein stilles Anheben — der eingegebene Wert bleibt sichtbar).
 *
 * `startCapital` = `equity` (beide Vergleichsseiten setzen dasselbe Bargeld ein).
 *
 * @param {object} inputs
 * @param {number} inputs.pricePerSqm
 * @param {number} inputs.livingAreaSqm
 * @param {number} inputs.transferTaxPct
 * @param {number} inputs.landRegisterPct
 * @param {number} inputs.brokerBuyPct
 * @param {number} inputs.notaryPct
 * @param {number} inputs.equityRatioPct
 * @param {number} inputs.mortgageLienPct
 * @param {number} inputs.bankProcessingPct
 * @param {number} inputs.rentPerSqm
 * @param {number} inputs.depositMonths
 * @returns {{
 *   purchasePrice: number, equity: number, loanAmount: number,
 *   closingCosts: number, financingCosts: number, downPayment: number,
 *   startCapital: number, monthlyRent: number, deposit: number,
 *   warnings: Array<{code: string, message: string}>
 * }}
 */
export function deriveStartCapital({
  pricePerSqm,
  livingAreaSqm,
  transferTaxPct,
  landRegisterPct,
  brokerBuyPct,
  notaryPct,
  equityRatioPct,
  mortgageLienPct,
  bankProcessingPct,
  rentPerSqm,
  depositMonths,
}) {
  const purchasePrice = pricePerSqm * livingAreaSqm;
  const closingCostsPct = transferTaxPct + landRegisterPct + brokerBuyPct + notaryPct;
  const financingCostsPct = mortgageLienPct + bankProcessingPct;

  const closingCosts = purchasePrice * (closingCostsPct / 100);

  // Eigenkapital = gesamtes Bargeld. Nebenkosten zuerst daraus bezahlen, Rest als
  // Anzahlung → Kredit nach loanAmount aufgelöst (Finanzierungsnebenkosten hängen
  // von der Kredithöhe ab).
  const equity = purchasePrice * (equityRatioPct / 100);
  const loanAmount = (purchasePrice - equity + closingCosts) / (1 - financingCostsPct / 100);
  const financingCosts = loanAmount * (financingCostsPct / 100);
  const downPayment = equity - closingCosts - financingCosts;
  const startCapital = equity;

  const warnings = [];
  if (downPayment < 0) {
    warnings.push({
      code: 'EQUITY_BELOW_COSTS',
      message: `Das Eigenkapital (${equity.toFixed(0)} €) deckt nicht einmal die Nebenkosten (${(closingCosts + financingCosts).toFixed(0)} €). Das entspräche einer Über-100%-Finanzierung, die österreichische Banken praktisch nicht vergeben. Bitte mehr Eigenkapital ansetzen.`,
    });
  }

  const monthlyRent = rentPerSqm * livingAreaSqm;
  const deposit = monthlyRent * depositMonths;

  return {
    purchasePrice,
    equity,
    loanAmount,
    closingCosts,
    financingCosts,
    downPayment,
    startCapital,
    monthlyRent,
    deposit,
    warnings,
  };
}

/**
 * Einziger öffentlicher Einstiegspunkt: verdrahtet alle Teilfunktionen (A1–A10)
 * zur vollständigen Vergleichspipeline (Architektur §5) und liefert das
 * `results`-Objekt (Architektur §4.2).
 *
 * "Liquidation-heute"-Prinzip (D1): für jedes Jahr 0..N wird das
 * Käufer-Nettovermögen so berechnet, als würde in diesem Jahr verkauft/aufgelöst
 * (KESt auf das Portfolio + ggf. Verkaufskosten/ImmoESt auf die Immobilie), und
 * analog das Mieter-Nettovermögen (KESt auf das Portfolio + Mietkaution zurück).
 * Daraus ergeben sich die Verlaufsserien, der Breakeven (A9, real ≡ nominal) und
 * die Bottom-Line-Werte für Jahr N.
 *
 * @param {object} inputs - vollständiges `inputs`-Objekt (Architektur §4.1)
 * @returns {object} `results`-Objekt (Architektur §4.2)
 */
export function runComparison(inputs) {
  const derived = deriveStartCapital(inputs);

  const amort = buildAmortizationSchedule({
    loanAmount: derived.loanAmount,
    loanTermYears: inputs.loanTermYears,
    rateModel: inputs.rateModel,
    interestRatePct: inputs.interestRatePct,
    variableSwitchYear: inputs.variableSwitchYear,
    variableRatePct: inputs.variableRatePct,
    annualExtraRepayment: inputs.annualExtraRepayment,
    horizonYears: inputs.horizonYears,
  });

  const owner = simulateBuyerOwnerCosts({
    pricePerSqm: inputs.pricePerSqm,
    livingAreaSqm: inputs.livingAreaSqm,
    maintenancePctOfValue: inputs.maintenancePctOfValue,
    operatingCostsPerSqm: inputs.operatingCostsPerSqm,
    appreciationPct: inputs.appreciationPct,
    inflationPct: inputs.inflationPct,
    horizonYears: inputs.horizonYears,
  });

  // Der Käufer setzt sein gesamtes Startkapital für den Kauf ein (Eigenkapital +
  // Nebenkosten) -> sein Portfolio startet bei 0. Der Mieter investiert das
  // (um die Kaution reduzierte) Startkapital vollständig (Spec §1.1).
  const startCapital = {
    buyer: 0,
    renter: derived.startCapital - derived.deposit,
  };

  const portfolios = simulateMonthlyPortfolios(inputs, amort, owner, startCapital);
  const buyerPortfolioAfterTax = applyCapitalGainsTax(portfolios.buyerPortfolioByYear, inputs.kestPct);
  const renterPortfolioAfterTax = applyCapitalGainsTax(portfolios.renterPortfolioByYear, inputs.kestPct);

  const years = [];
  const buyerNetWealthNominal = [];
  const renterNetWealthNominal = [];
  const buyerMonthlyCost = [];
  const renterMonthlyCost = [];

  const baseMonthlyRent = derived.monthlyRent;
  const inflationFactor = 1 + inputs.inflationPct / 100;

  for (let year = 0; year <= inputs.horizonYears; year++) {
    const propertyValue = owner[year].propertyValue;
    const remainingDebt = year === 0 ? derived.loanAmount : amort[year - 1].endBalance;

    const propertyNet = inputs.simulateSale
      ? applySaleCosts(
          propertyValue,
          derived.purchasePrice,
          remainingDebt,
          inputs.saleBrokerFeePct,
          inputs.immoEstPct,
          inputs.primaryResidenceExempt
        )
      : propertyValue - remainingDebt;

    years.push(year);
    buyerNetWealthNominal.push(propertyNet + buyerPortfolioAfterTax[year].valueAfterTax);
    renterNetWealthNominal.push(renterPortfolioAfterTax[year].valueAfterTax + derived.deposit);

    // Cashflow-Serie: Kosten "während" dieses Jahres (Jahr N nutzt die letzten verfügbaren Werte)
    // Sanierungsstau: auf 12 Monate verteilt → sichtbarer Buckel im Cashflow-Chart
    const costIndex = Math.min(year, amort.length - 1);
    const renovationMonthly = (inputs.renovationCost > 0 && year === inputs.renovationYear)
      ? inputs.renovationCost / 12
      : 0;
    buyerMonthlyCost.push(amort[costIndex].monthlyPayment + owner[costIndex].monthlyOwnerCosts + renovationMonthly);
    renterMonthlyCost.push(baseMonthlyRent * Math.pow(inflationFactor, costIndex));
  }

  const toReal = (series) => series.map((value, year) => value / Math.pow(inflationFactor, year));
  const buyerNetWealthReal = toReal(buyerNetWealthNominal);
  const renterNetWealthReal = toReal(renterNetWealthNominal);

  const breakevenYear = findBreakevenYear(buyerNetWealthNominal, renterNetWealthNominal);

  const lastIndex = inputs.horizonYears;

  return {
    buyerNetWealthNominal: buyerNetWealthNominal[lastIndex],
    renterNetWealthNominal: renterNetWealthNominal[lastIndex],
    differenceNominal: buyerNetWealthNominal[lastIndex] - renterNetWealthNominal[lastIndex],
    buyerNetWealthReal: buyerNetWealthReal[lastIndex],
    renterNetWealthReal: renterNetWealthReal[lastIndex],
    differenceReal: buyerNetWealthReal[lastIndex] - renterNetWealthReal[lastIndex],
    breakevenYear,

    warnings: derived.warnings,

    series: {
      years,
      buyerNetWealthNominal,
      renterNetWealthNominal,
      buyerNetWealthReal,
      renterNetWealthReal,
      buyerMonthlyCost,
      renterMonthlyCost,
    },

    derived: {
      purchasePrice: derived.purchasePrice,
      equity: derived.equity,
      loanAmount: derived.loanAmount,
      closingCosts: derived.closingCosts,
      financingCosts: derived.financingCosts,
      downPayment: derived.downPayment,
      startCapital: derived.startCapital,
      monthlyRent: derived.monthlyRent,
      deposit: derived.deposit,
    },
  };
}
