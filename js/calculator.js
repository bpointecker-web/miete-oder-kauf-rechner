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
 * Unterstützt `rateModel="fixed"` (Step A2) und `rateModel="variable"` (Step A3):
 * bei "variable" gilt bis einschließlich `variableSwitchYear` der `interestRatePct`-Zins;
 * danach wird die Annuität auf Basis der Restschuld, der Restlaufzeit
 * (`loanTermYears - variableSwitchYear`) und `variableRatePct` neu berechnet
 * (siehe Spec §2.2 Edge-Case-Tabelle, "Zinswechsel (variabel)").
 *
 * Ist die Restschuld vor Beginn eines Jahres bereits 0 (z.B. weil `horizonYears`
 * länger als `loanTermYears` ist), liefert das Jahr 0-Werte (siehe Spec §2.2
 * Edge-Case-Tabelle, "Horizont > Kreditlaufzeit").
 *
 * @param {object} params
 * @param {number} params.loanAmount - Kreditsumme
 * @param {number} params.loanTermYears - Vertragslaufzeit in Jahren
 * @param {"fixed"|"variable"} [params.rateModel="fixed"] - Zinsmodell
 * @param {number} params.interestRatePct - Zins p.a. in Prozent (Fixzins bzw. Startzins variabel)
 * @param {number} [params.variableSwitchYear] - Jahr, nach dem der Zins wechselt (nur "variable")
 * @param {number} [params.variableRatePct] - Zins p.a. nach dem Wechsel (nur "variable")
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
    if (rateModel === 'variable' && year === variableSwitchYear + 1) {
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
 * - `monthlyOwnerCosts` (Eigentümer- + Betriebskosten zusammen, €/m²/Monat × Fläche)
 *   wächst jährlich mit `inflationPct`.
 *
 * @param {object} inputs
 * @param {number} inputs.pricePerSqm - Kaufpreis €/m²
 * @param {number} inputs.livingAreaSqm - Wohnfläche m²
 * @param {number} inputs.ownerCostsPerSqm - Eigentümerkosten €/m²/Monat
 * @param {number} inputs.operatingCostsPerSqm - Betriebskosten €/m²/Monat
 * @param {number} inputs.appreciationPct - Wertsteigerung Immobilie p.a. in Prozent (kann < 0 sein)
 * @param {number} inputs.inflationPct - Inflation p.a. in Prozent
 * @param {number} inputs.horizonYears - Betrachtungshorizont in Jahren
 * @returns {Array<{year: number, propertyValue: number, monthlyOwnerCosts: number}>}
 */
export function simulateBuyerOwnerCosts({
  pricePerSqm,
  livingAreaSqm,
  ownerCostsPerSqm,
  operatingCostsPerSqm,
  appreciationPct,
  inflationPct,
  horizonYears,
}) {
  const purchasePrice = pricePerSqm * livingAreaSqm;
  const baseMonthlyOwnerCosts = (ownerCostsPerSqm + operatingCostsPerSqm) * livingAreaSqm;
  const appreciationFactor = 1 + appreciationPct / 100;
  const inflationFactor = 1 + inflationPct / 100;

  const series = [];
  for (let year = 0; year <= horizonYears; year++) {
    series.push({
      year,
      propertyValue: purchasePrice * Math.pow(appreciationFactor, year),
      monthlyOwnerCosts: baseMonthlyOwnerCosts * Math.pow(inflationFactor, year),
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
 * Optionaler Vorabpauschale-Haircut (Spec §2.5, bewusst konservativ): ist
 * `applyVorabpauschale` aktiv, wird am Jahresende eine KESt auf
 * `vorabpauschaleHaircutPct` des Mieter-Portfoliowerts zu Jahresbeginn fällig,
 * direkt vom Portfolio abgezogen und der Kostenbasis zugeschlagen (bereits
 * versteuerter Anteil zählt nicht erneut als Gewinn).
 *
 * @param {object} inputs
 * @param {number} inputs.rentPerSqm - Miete €/m²/Monat (Jahr 0, brutto inkl. BK)
 * @param {number} inputs.livingAreaSqm - Wohnfläche m²
 * @param {number} inputs.inflationPct - Inflation p.a. in Prozent (Mietsteigerung)
 * @param {number} inputs.investmentReturnPct - Anlagerendite Mieter-Portfolio p.a. in Prozent
 * @param {number} inputs.horizonYears - Betrachtungshorizont in Jahren
 * @param {boolean} [inputs.applyVorabpauschale=false] - Vorabpauschale-Haircut aktiv?
 * @param {number} [inputs.vorabpauschaleHaircutPct=0] - Anteil des Jahresanfangswerts, der als Vorabpauschale versteuert wird
 * @param {number} [inputs.kestPct=0] - KESt-Satz in Prozent (für Vorabpauschale-Haircut)
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
    applyVorabpauschale = false,
    vorabpauschaleHaircutPct = 0,
    kestPct = 0,
  } = inputs;

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
    const buyerMonthlyCost = amort[year - 1].monthlyPayment + owner[year - 1].monthlyOwnerCosts;
    const rentMonthly = baseMonthlyRent * Math.pow(inflationFactor, year - 1);
    const sharedBudget = Math.max(buyerMonthlyCost, rentMonthly);
    const buyerSaving = sharedBudget - buyerMonthlyCost;
    const renterSaving = sharedBudget - rentMonthly;

    for (let month = 0; month < 12; month++) {
      buyerValue = buyerValue * monthlyGrowthFactor + buyerSaving;
      buyerCostBasis += buyerSaving;
      renterValue = renterValue * monthlyGrowthFactor + renterSaving;
      renterCostBasis += renterSaving;
    }

    if (applyVorabpauschale) {
      const renterValueAtYearStart = renterPortfolioByYear[year - 1].value;
      const vorabpauschaleTax = renterValueAtYearStart * (vorabpauschaleHaircutPct / 100) * (kestPct / 100);
      renterValue -= vorabpauschaleTax;
      renterCostBasis += vorabpauschaleTax;
    }

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
 * `Startkapital = Eigenkapital + Kaufnebenkosten + Finanzierungsnebenkosten` (Spec §1.1).
 *
 * **Mindest-Eigenkapital-Validierung (Spec §2.2, D3):** Banken finanzieren die
 * Nebenkosten praktisch nicht mit ("keine 110%-Finanzierung"). Das Mindest-EK
 * entspricht daher `Kaufnebenkosten + Kaufpreis × Finanzierungsnebenkosten-Satz`
 * (Finanzierungsnebenkosten hier bewusst auf den vollen Kaufpreis bezogen, nicht
 * auf die ggf. noch unbekannte finale Kreditsumme — vermeidet Zirkelbezug und
 * entspricht der "≈11,8% bei Default-Sätzen"-Angabe der Spec).
 * Liegt das eingegebene Eigenkapital darunter, wird es intern auf den
 * Mindestwert angehoben und eine `warning` zurückgegeben.
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
 * @param {boolean} [inputs.financeClosingCosts=false] - falls true, deckt der Kredit
 *   zusätzlich Kauf- und Finanzierungsnebenkosten ab (z.B. wenn das Eigenkapital
 *   exakt dem Kaufpreis-Anteil entsprechen soll, etwa Erlös aus einem Wohnungsverkauf).
 *   Die EK-Mindestprüfung entfällt in diesem Modus, da ihr Zweck (Nebenkosten aus
 *   EK decken) hier über den Kredit gelöst wird.
 * @returns {{
 *   purchasePrice: number, equity: number, loanAmount: number,
 *   closingCosts: number, financingCosts: number, startCapital: number,
 *   monthlyRent: number, deposit: number,
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
  financeClosingCosts = false,
}) {
  const purchasePrice = pricePerSqm * livingAreaSqm;
  const closingCostsPct = transferTaxPct + landRegisterPct + brokerBuyPct + notaryPct;
  const financingCostsPct = mortgageLienPct + bankProcessingPct;

  const closingCosts = purchasePrice * (closingCostsPct / 100);

  const warnings = [];
  let equity = purchasePrice * (equityRatioPct / 100);

  let loanAmount, financingCosts, startCapital;
  if (financeClosingCosts) {
    // loanAmount = (Kaufpreisanteil + Kaufnebenkosten + loanAmount*financingCostsPct%)
    // -> aufgelöst nach loanAmount:
    loanAmount = (purchasePrice - equity + closingCosts) / (1 - financingCostsPct / 100);
    financingCosts = loanAmount * (financingCostsPct / 100);
    startCapital = equity;
  } else {
    const minEquity = closingCosts + purchasePrice * (financingCostsPct / 100);
    if (equity < minEquity) {
      warnings.push({
        code: 'EQUITY_BELOW_MINIMUM',
        message: `Mindest-Eigenkapital beträgt ${minEquity.toFixed(2)} € (Nebenkosten werden von Banken praktisch nicht mitfinanziert, keine 110%-Finanzierung). Eigenkapitalquote wurde automatisch angehoben.`,
      });
      equity = minEquity;
    }
    loanAmount = purchasePrice - equity;
    financingCosts = loanAmount * (financingCostsPct / 100);
    startCapital = equity + closingCosts + financingCosts;
  }

  const monthlyRent = rentPerSqm * livingAreaSqm;
  const deposit = monthlyRent * depositMonths;

  return {
    purchasePrice,
    equity,
    loanAmount,
    closingCosts,
    financingCosts,
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
    ownerCostsPerSqm: inputs.ownerCostsPerSqm,
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
    const costIndex = Math.min(year, amort.length - 1);
    buyerMonthlyCost.push(amort[costIndex].monthlyPayment + owner[costIndex].monthlyOwnerCosts);
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
      startCapital: derived.startCapital,
      monthlyRent: derived.monthlyRent,
      deposit: derived.deposit,
    },
  };
}
