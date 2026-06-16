/**
 * Aktualisiert data/regional.json anhand offizieller Eurostat-HPI-Daten.
 *
 * Ablauf:
 *   1. Eurostat HPI holen (Indexwert I10_Q + Jahresaenderungsrate RCH_A).
 *   2. Skalierungsfaktor = aktuellerIndex / ankerIndex berechnen.
 *   3. Pro Region: computed.pricePerSqm = anchor.pricePerSqm × Faktor,
 *      computed.appreciationPct = gleitender Schnitt (national, gerundet).
 *   4. meta.lastAutoUpdate + index.anchorIndexValue-Bezug protokollieren.
 *   5. JSON zurueckschreiben.
 *
 * Ausfuehrung:  node scripts/update-data.mjs
 * In CI (GitHub Action) identisch; committet danach die Aenderung an JSON.
 *
 * EINSCHRAENKUNG (bewusst, transparent): Der Eurostat-Index ist national.
 * Alle Staedte werden mit demselben Faktor fortgeschrieben — staedtische
 * Divergenz wird nicht erfasst. Ueber kurze Zeitraeume vernachlaessigbar,
 * ueber viele Jahre driften reale Stadtpreise auseinander. Daher sollten die
 * Anker-Werte gelegentlich manuell neu gesetzt werden (anchor.* + anchorDate).
 *
 * @module scripts/update-data
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  extractTimeSeries,
  latest,
  trailingAverage,
  indexScaleFactor,
  hpiApiUrl,
} from './eurostat.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'regional.json');
const JS_PATH  = join(__dirname, '..', 'data', 'regional-generated.js');
const TRAILING_QUARTERS = { '1y': 4, '5y': 20, '10y': 40 };

/**
 * Holt eine Eurostat-Unit und gibt die geparste Zeitreihe zurueck.
 * @param {string} unit
 * @returns {Promise<Array<{quarter: string, value: number}>>}
 */
async function fetchSeries(unit) {
  const url = hpiApiUrl(unit);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Eurostat-Abruf fehlgeschlagen (${unit}): HTTP ${res.status}`);
  }
  return extractTimeSeries(await res.json());
}

async function main() {
  const raw = await readFile(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);

  const indexSeries = await fetchSeries('I10_Q');
  const rateSeries = await fetchSeries('RCH_A');

  const currentIndex = latest(indexSeries);
  const anchorIndex = data.meta.index.anchorIndexValue;
  const factor = indexScaleFactor(currentIndex.value, anchorIndex);

  const mode = data.meta.index.appreciationMode ?? '5y_avg';
  const quarters = TRAILING_QUARTERS[mode.replace('_avg', '')] ?? 20;
  const appreciation = Number(trailingAverage(rateSeries, quarters).toFixed(2));

  for (const region of Object.values(data.regions)) {
    region.computed.indexScaleFactor = Number(factor.toFixed(4));
    region.computed.pricePerSqm = Math.round(region.anchor.pricePerSqm * factor);
    region.computed.appreciationPct = appreciation;
  }

  data.meta.lastAutoUpdate = {
    timestamp: new Date().toISOString(),
    currentIndexQuarter: currentIndex.quarter,
    currentIndexValue: currentIndex.value,
    scaleFactor: Number(factor.toFixed(4)),
    appreciationPct: appreciation,
    appreciationBasisQuarters: quarters,
  };

  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  // Generiertes JS-Modul schreiben — kein JSON-Import-Assert noetig,
  // funktioniert nativ in Node ESM und im Browser ohne Build-Step.
  const jsContent = [
    '// ACHTUNG: Automatisch generiert von scripts/update-data.mjs — nicht von Hand editieren.',
    `// Letztes Update: ${data.meta.lastAutoUpdate.timestamp}`,
    `// Eurostat-Quelle: ${data.meta.index.source}`,
    '',
    `export const REGIONAL_DATA = ${JSON.stringify(data, null, 2)};`,
    '',
  ].join('\n');
  await writeFile(JS_PATH, jsContent, 'utf8');

  console.log('data/regional.json + data/regional-generated.js aktualisiert:');
  console.log(`  Eurostat-Index ${currentIndex.quarter}: ${currentIndex.value} (Anker ${anchorIndex})`);
  console.log(`  Skalierungsfaktor: ${factor.toFixed(4)}`);
  console.log(`  Wertsteigerung (${quarters}Q-Schnitt): ${appreciation}%`);
  for (const [key, r] of Object.entries(data.regions)) {
    console.log(`  ${r.label.padEnd(14)} ${r.anchor.pricePerSqm} -> ${r.computed.pricePerSqm} EUR/m2`);
  }
}

main().catch((err) => {
  console.error('Update fehlgeschlagen:', err.message);
  process.exit(1);
});
