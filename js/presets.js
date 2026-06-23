/**
 * Regionale Default-Daten und Default-Input-Fabrik.
 *
 * DESIGNENTSCHEIDUNG: Regionswechsel ändert nur appreciationPct.
 * Kaufpreis und Miete sind Pflichtfelder die der Nutzer selbst eingibt —
 * regionale Presets dafür wären Scheinkomfort den er sofort überschreibt.
 * Der einzige sinnvolle regionale Parameter ist die Wertsteigerungsrate,
 * da Nutzer dafür keine eigene Zahl haben.
 *
 * @module presets
 */

import { REGIONAL_DATA } from '../data/regional-generated.js';

/**
 * Regionale Eckwerte — nur label und appreciationPct werden vom App genutzt.
 * Die übrigen Felder in regional-generated.js dienen als Dokumentation/Referenz.
 *
 * appreciationPct-Quellen: anchor-Werte aus regional-generated.js (manuell gepflegt,
 * konservative Langfrist-Schätzwerte; Eurostat 10J-Ø steht in computed.appreciationPct
 * und enthält den Corona-Boom 2020–2022, daher zu optimistisch für 30J-Vergleich).
 *
 * @type {Record<string, { label: string, appreciationPct: number }>}
 */
export const REGIONS = Object.fromEntries(
  Object.entries(REGIONAL_DATA.regions).map(([key, r]) => [
    key,
    {
      label: r.label,
      appreciationPct: r.anchor.appreciationPct,
    },
  ])
);

/**
 * Marktüblicher Fixzins-Default je Laufzeit (Stand Juni 2026).
 * Quellen: optifin.at, capitalo.at, infina.at
 */
export function defaultFixedRate(termYears) {
  if (termYears <= 10) return 3.4;
  return 3.3; // 15–30 Jahre: Mitte der Marktbandbreite 3,2–3,5 %
}

/**
 * Feste Österreich-Ø Startdaten — gelten für alle Regionen beim ersten Laden.
 * Nutzer tippt seine konkreten Zahlen darüber; nur appreciationPct ist regional.
 */
const AT_DEFAULTS = {
  pricePerSqm: 4000,
  rentPerSqm: 10.0,
  livingAreaSqm: 70,
};

/**
 * Liefert ein vollständiges `inputs`-Objekt für eine Region.
 * Kaufpreis und Miete starten mit AT-Ø-Defaults; appreciationPct ist regional.
 *
 * @param {keyof typeof REGIONS} region - z.B. `'wien'`
 * @returns {object} vollständiges inputs-Objekt
 * @throws {Error} bei unbekannter Region
 */
export function createDefaultInputs(region) {
  const preset = REGIONS[region];
  if (!preset) {
    throw new Error(`Unbekannte Region: "${region}". Gültig: ${Object.keys(REGIONS).join(', ')}`);
  }

  const { pricePerSqm, rentPerSqm, livingAreaSqm } = AT_DEFAULTS;
  const purchasePrice = pricePerSqm * livingAreaSqm;
  const loanTermYears = 30;

  return {
    // Immobilie & Kauf
    region,
    purchasePrice,
    pricePerSqm,
    livingAreaSqm,

    // Kaufnebenkosten (Prozent vom Kaufpreis)
    transferTaxPct: 3.5,
    landRegisterPct: 1.1,
    brokerBuyPct: 3.6,
    notaryPct: 1.5,

    // Finanzierung
    equityAmount: Math.round(purchasePrice * 0.20),
    equityRatioPct: 20,
    mortgageLienPct: 1.2,
    bankProcessingPct: 1.5,
    rateModel: 'fixed',
    interestRatePct: defaultFixedRate(loanTermYears),
    variableSwitchYear: 10,
    variableRatePct: 3.5,
    loanTermYears,
    annualExtraRepayment: 0,

    // Laufende Kosten Eigentum
    maintenancePctOfValue: 1.2,
    operatingCostsPerSqm: 2.50,
    renovationCost: 0,
    renovationYear: 15,
    appreciationPct: preset.appreciationPct,  // einziger regionaler Wert

    // Miete
    rentPerSqm,
    totalMonthlyRent: Math.round(rentPerSqm * livingAreaSqm),
    depositMonths: 3,

    // Annahmen
    inflationPct: 2.0,
    investmentReturnPct: 7.0,
    renterSavingsRatePct: 100,
    kestPct: 27.5,
    horizonYears: 30,
    simulateSale: true,
    saleBrokerFeePct: 3.6,
    immoEstPct: 30,
    primaryResidenceExempt: true,

    householdNetIncome: null,
  };
}
