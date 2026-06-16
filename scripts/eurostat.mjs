/**
 * Reine Hilfsfunktionen zum Auswerten der Eurostat-HPI-Antwort (JSON-stat 2.0).
 *
 * Bewusst seiteneffektfrei (kein fetch, kein fs) — damit aus den Tests heraus
 * mit fixierten Beispiel-Payloads deterministisch geprueft werden kann. Das IO
 * (Netzwerk, Dateien) liegt ausschliesslich in update-data.mjs.
 *
 * Eurostat-Datensatz: prc_hpi_q (Harmonisierter Wohnimmobilienpreisindex,
 * quartalsweise). Relevante Units:
 *   - I10_Q  : Indexwert (Basis 2010 = 100)
 *   - RCH_A  : jaehrliche Aenderungsrate in % (year-over-year)
 *
 * @module scripts/eurostat
 */

/**
 * Extrahiert aus einer JSON-stat-Antwort die nach Zeit sortierte Werteliste.
 *
 * Annahme: alle Dimensionen ausser `time` haben in der Abfrage Groesse 1
 * (z.B. geo=AT, purchase=TOTAL, unit=<eine>). Dann entspricht der flache
 * Value-Index direkt der Zeitposition.
 *
 * @param {object} jsonStat - geparste Eurostat-Antwort (format=JSON)
 * @returns {Array<{quarter: string, value: number}>} chronologisch aufsteigend,
 *   ohne Luecken (null-Werte werden uebersprungen)
 */
export function extractTimeSeries(jsonStat) {
  const timeCategory = jsonStat?.dimension?.time?.category?.index;
  if (!timeCategory) {
    throw new Error('Eurostat-Antwort hat keine time-Dimension (unerwartetes Format)');
  }
  const values = jsonStat.value ?? {};
  return Object.entries(timeCategory)
    .sort((a, b) => a[1] - b[1])
    .map(([quarter, pos]) => ({ quarter, value: values[pos] }))
    .filter((row) => typeof row.value === 'number' && Number.isFinite(row.value));
}

/**
 * Letzter (aktuellster) Wert einer Zeitreihe.
 *
 * @param {Array<{quarter: string, value: number}>} series
 * @returns {{quarter: string, value: number}}
 * @throws {Error} bei leerer Reihe
 */
export function latest(series) {
  if (!series.length) throw new Error('Leere Zeitreihe — kein aktueller Wert verfuegbar');
  return series[series.length - 1];
}

/**
 * Gleitender Durchschnitt der letzten `quarters` Werte (z.B. 20 = 5 Jahre).
 *
 * @param {Array<{quarter: string, value: number}>} series
 * @param {number} quarters - Anzahl der letzten Quartale
 * @returns {number} Durchschnitt
 * @throws {Error} bei zu kurzer Reihe
 */
export function trailingAverage(series, quarters) {
  if (series.length < quarters) {
    throw new Error(`Zeitreihe zu kurz: ${series.length} Quartale, benoetigt ${quarters}`);
  }
  const slice = series.slice(-quarters).map((r) => r.value);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}

/**
 * Berechnet den Skalierungsfaktor, um Anker-Preise auf den aktuellen Indexstand
 * fortzuschreiben: aktuellerPreis = ankerPreis × (aktuellerIndex / ankerIndex).
 *
 * @param {number} currentIndex - aktueller I10_Q-Indexwert
 * @param {number} anchorIndex - I10_Q-Wert zum Anker-Zeitpunkt
 * @returns {number} Skalierungsfaktor
 * @throws {Error} bei ungueltigem Anker-Index
 */
export function indexScaleFactor(currentIndex, anchorIndex) {
  if (!(anchorIndex > 0)) {
    throw new Error(`Ungueltiger Anker-Index: ${anchorIndex}`);
  }
  return currentIndex / anchorIndex;
}

/**
 * Eurostat-API-URL fuer den HPI-Datensatz mit gegebener Unit.
 *
 * @param {string} unit - z.B. 'I10_Q' oder 'RCH_A'
 * @returns {string} vollstaendige URL
 */
export function hpiApiUrl(unit) {
  const base = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hpi_q';
  const params = new URLSearchParams({
    format: 'JSON',
    geo: 'AT',
    purchase: 'TOTAL',
    unit,
    lang: 'EN',
  });
  return `${base}?${params.toString()}`;
}
