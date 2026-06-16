/**
 * Regionale Default-Daten und Default-Input-Fabrik.
 *
 * ⚠️  TRANSPARENZHINWEIS — QUELLENSTAND UNVOLLSTÄNDIG ⚠️
 * =======================================================
 * Die Werte in REGIONS sind SCHÄTZWERTE, keine verifizierten Marktdaten.
 * Sie dienen als Ausgangspunkt und sind in der UI vollständig überschreibbar.
 *
 * Was verifiziert ist:
 *   - Kaufpreise (pricePerSqm): grob plausibel auf Basis von
 *     immopreise.at und soldd.com/immobilienpreise-oesterreich-2025,
 *     Stand ca. 2025 — NICHT mit Einzelquellen pro Stadt belegt.
 *
 * Was NICHT verifiziert ist:
 *   - rentalYieldPct (Bruttomietrendite): Schätzwerte aus allgemeiner
 *     Marktkenntnis (2,8–3,4 %), KEINE Auswertung realer Inserate.
 *   - rentPerSqm: wird aus pricePerSqm × rentalYieldPct/12 abgeleitet —
 *     ist also doppelt indirekt, kein direkter Marktdurchschnitt.
 *   - appreciationPct: historische Schätzwerte, keine Quellenangabe.
 *
 * TODO (vor Go-Live, Phase E1 / README.md):
 *   □ Kaufpreise pro Stadt mit konkreter Quelle + Datum belegen
 *     (z.B. willhaben.at Median-Kaufpreis, immopreise.at, OeNB-Index)
 *   □ Marktmieten direkt erheben statt aus Rendite ableiten
 *     (z.B. willhaben.at Mietinserate Durchschnitt pro Stadt, Datum)
 *   □ Wertsteigerung: OeNB-Wohnimmobilienpreisindex als Quelle prüfen
 *   □ Stand-Datum im README und in der UI sichtbar machen
 *
 * @module presets
 */

import { REGIONAL_DATA } from '../data/regional-generated.js';

/**
 * Regionale Eckwerte — direkt aus data/regional-generated.js (auto-generiert
 * von scripts/update-data.mjs via Eurostat-API). Nur computed-Werte (Kaufpreis,
 * Wertsteigerung) kommen von Eurostat; rentalYieldPct ist weiterhin Schätzwert.
 *
 * @type {Record<string, {
 *   label: string,
 *   pricePerSqm: number,
 *   rentalYieldPct: number,
 *   appreciationPct: number,
 * }>}
 */
export const REGIONS = Object.fromEntries(
  Object.entries(REGIONAL_DATA.regions).map(([key, r]) => [
    key,
    {
      label: r.label,
      pricePerSqm: r.computed.pricePerSqm,
      rentalYieldPct: r.anchor.rentalYieldPct,
      appreciationPct: r.computed.appreciationPct,
    },
  ])
);

/**
 * Liefert ein vollständiges `inputs`-Objekt (Architektur §4.1) für eine Region.
 *
 * `rentPerSqm` wird aus `pricePerSqm × rentalYieldPct / 12` berechnet und kann
 * danach in der UI frei überschrieben werden — calculator.js behandelt es als
 * normalen Input-Parameter.
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

  const rentPerSqm = (preset.pricePerSqm * preset.rentalYieldPct) / 100 / 12;

  return {
    // Immobilie & Kauf
    region,
    pricePerSqm: preset.pricePerSqm,
    livingAreaSqm: 70,

    // Kaufnebenkosten (Prozent vom Kaufpreis)
    transferTaxPct: 3.5,
    landRegisterPct: 1.1,
    brokerBuyPct: 3.0,
    notaryPct: 1.5,

    // Finanzierung
    equityRatioPct: 20,
    mortgageLienPct: 1.2,
    bankProcessingPct: 1.5,
    financeClosingCosts: false,
    rateModel: 'fixed',
    interestRatePct: 3.5,
    variableSwitchYear: 10,
    variableRatePct: 5.0,
    loanTermYears: 30,
    annualExtraRepayment: 0,

    // Laufende Kosten Eigentum (€/m²/Monat)
    ownerCostsPerSqm: 2.75,
    operatingCostsPerSqm: 2.20,
    appreciationPct: preset.appreciationPct,

    // Miete — aus Rendite-Annahme abgeleitet, in UI überschreibbar
    rentPerSqm,
    depositMonths: 3,

    // Annahmen
    inflationPct: 2.0,
    investmentReturnPct: 6.0,
    applyVorabpauschale: false,
    vorabpauschaleHaircutPct: 0.5,
    kestPct: 27.5,
    horizonYears: 30,
    simulateSale: true,
    saleBrokerFeePct: 3.0,
    immoEstPct: 30,
    primaryResidenceExempt: true,

    // Leistbarkeit (Phase 2)
    householdNetIncome: null,
  };
}
