/**
 * Alpine-Komponente: UI-Zustand und Verdrahtung mit dem Rechenkern.
 * Einzige Datei, die DOM/Alpine kennt — calculator.js bleibt rein.
 */
import { createDefaultInputs, REGIONS, defaultFixedRate } from './presets.js';
import { runComparison } from './calculator.js';
import { renderCharts } from './charts.js';

/**
 * Erzeugt den Alpine-Komponentenzustand.
 * Wird von index.html via x-data="appState()" eingebunden.
 */
export function appState() {
  return {
    // ── Eingaben (einzige Schreibquelle via x-model) ──
    inputs: createDefaultInputs('wien'),

    // ── Abgeleitete Ergebnisse (read-only, via x-effect berechnet) ──
    results: null,

    // ── Chart-Instanzen (intern, werden bei jedem Update ersetzt) ──
    _charts: null,

    // ── UI-Zustand ──
    activeTab: 'immobilie',
    regions: Object.entries(REGIONS).map(([key, r]) => ({ key, label: r.label })),

    // Wird beim Initialisieren von Alpine automatisch aufgerufen
    init() {
      this.$watch('inputs.purchasePrice', () => this.syncPricePerSqm());
      this.$watch('inputs.livingAreaSqm', () => this.syncPricePerSqm());
      this.$watch('inputs.equityAmount', () => this.syncEquityRatio());
      this.$watch('inputs.purchasePrice', () => this.syncEquityRatio());
      this.$watch('inputs.loanTermYears', () => this.syncFixedRate());
      this.$watch('inputs.rateModel', () => this.syncFixedRate());
      this.$watch('inputs', () => this.recalculate(), { deep: true });
      this.recalculate();
    },

    // Hält pricePerSqm als abgeleiteten Wert in sync — calculator.js nutzt weiterhin pricePerSqm
    syncPricePerSqm() {
      const { purchasePrice, livingAreaSqm } = this.inputs;
      if (livingAreaSqm > 0 && purchasePrice > 0) {
        this.inputs.pricePerSqm = Math.round(purchasePrice / livingAreaSqm);
      }
    },

    // Passt interestRatePct an wenn sich Laufzeit oder Zinsmodell ändert
    syncFixedRate() {
      if (this.inputs.rateModel !== 'fixed') return;
      this.inputs.interestRatePct = defaultFixedRate(this.inputs.loanTermYears);
    },

    // Hält equityRatioPct als abgeleiteten Wert in sync — calculator.js nutzt weiterhin
    // equityRatioPct. Bewusst volle Präzision speichern (nicht runden!), damit der
    // Rechenkern exakt das eingegebene equityAmount rekonstruiert; gerundet wird nur
    // in der Anzeige (readonly-Feld via toFixed(1)).
    syncEquityRatio() {
      const { equityAmount, purchasePrice } = this.inputs;
      if (purchasePrice > 0) {
        this.inputs.equityRatioPct = (equityAmount / purchasePrice) * 100;
      }
    },

    recalculate() {
      try {
        this.results = runComparison(this.inputs);
      } catch {
        this.results = null;
      }
      // Charts nach Alpine-Tick rendern, damit die Canvas-Elemente im DOM sind
      this.$nextTick(() => {
        if (this.results) {
          this._charts = renderCharts(this.results, this._charts);
        }
      });
    },

    setRegion(regionKey) {
      const equityAmount = this.inputs.equityAmount;
      this.inputs = createDefaultInputs(regionKey);
      this.inputs.equityAmount = equityAmount;
      this.syncEquityRatio();
    },

    // Hilfsmethode: Zins-Modell umschalten (fix/variabel)
    setRateModel(model) {
      this.inputs.rateModel = model;
    },

    // Formatierung für die Anzeige
    formatEur(value) {
      if (value == null || !Number.isFinite(value)) return '–';
      return new Intl.NumberFormat('de-AT', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
      }).format(value);
    },

    formatPct(value) {
      if (value == null || !Number.isFinite(value)) return '–';
      return new Intl.NumberFormat('de-AT', {
        style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
      }).format(value / 100);
    },

    winnerText() {
      if (!this.results) return '';
      const diff = this.results.differenceNominal;
      const years = this.inputs.horizonYears;
      if (Math.abs(diff) < 1) return `Nach ${years} Jahren sind Kaufen und Mieten nominell gleichwertig.`;
      const winner = diff > 0 ? 'Kaufen' : 'Mieten';
      const abs = this.formatEur(Math.abs(diff));
      return `${winner} ist nach ${years} Jahren nominell um ${abs} vorteilhafter.`;
    },
  };
}

// alpine:init wird von Alpine gefeuert bevor es den DOM verarbeitet —
// exakt das richtige Fenster um Komponenten zu registrieren.
document.addEventListener('alpine:init', () => {
  window.Alpine.data('appState', appState);
});
