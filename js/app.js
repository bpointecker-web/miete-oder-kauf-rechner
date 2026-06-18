/**
 * Alpine-Komponente: UI-Zustand und Verdrahtung mit dem Rechenkern.
 * Einzige Datei, die DOM/Alpine kennt — calculator.js bleibt rein.
 */
import { createDefaultInputs, REGIONS, defaultFixedRate } from './presets.js';
import { runComparison, findBreakevenSavingsRate } from './calculator.js';
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
      this.$watch('inputs.variableSwitchYear', () => this.syncFixedRate());
      this.$watch('inputs.rateModel', () => this.syncFixedRate());
      this.$watch('inputs.totalMonthlyRent', () => this.syncRentPerSqm());
      this.$watch('inputs.livingAreaSqm', () => this.syncTotalMonthlyRentFromArea());
      this.$watch('inputs', () => this.recalculate(), { deep: true });
      // Charts neu rendern wenn Ergebnis-Tab sichtbar wird (war vorher display:none)
      this.$watch('activeTab', tab => {
        if (tab === 'ergebnis' && this.results) {
          this.$nextTick(() => { this._charts = renderCharts(this.results, this._charts); });
        }
      });
      this.recalculate();
    },

    // Hält pricePerSqm als abgeleiteten Wert in sync — calculator.js nutzt weiterhin pricePerSqm
    syncPricePerSqm() {
      const { purchasePrice, livingAreaSqm } = this.inputs;
      if (livingAreaSqm > 0 && purchasePrice > 0) {
        this.inputs.pricePerSqm = Math.round(purchasePrice / livingAreaSqm);
      }
    },

    // Passt interestRatePct an wenn sich Laufzeit, Fixphase oder Zinsmodell ändert
    syncFixedRate() {
      if (this.inputs.rateModel === 'fixed') {
        this.inputs.interestRatePct = defaultFixedRate(this.inputs.loanTermYears);
      } else if (this.inputs.rateModel === 'hybrid') {
        // Fixzins richtet sich nach der Fixphasen-Laufzeit, nicht der Gesamtlaufzeit
        this.inputs.interestRatePct = defaultFixedRate(this.inputs.variableSwitchYear);
      }
    },

    // Hält rentPerSqm in sync wenn Gesamtmiete oder Fläche sich ändert
    syncRentPerSqm() {
      const { totalMonthlyRent, livingAreaSqm } = this.inputs;
      if (livingAreaSqm > 0) {
        this.inputs.rentPerSqm = totalMonthlyRent / livingAreaSqm;
      }
    },

    // Wenn Fläche sich ändert: Gesamtmiete aus bisherigem €/m²-Wert ableiten
    syncTotalMonthlyRentFromArea() {
      const { rentPerSqm, livingAreaSqm } = this.inputs;
      if (livingAreaSqm > 0 && rentPerSqm > 0) {
        this.inputs.totalMonthlyRent = Math.round(rentPerSqm * livingAreaSqm);
      }
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
        this.results.breakevenSavingsRate = findBreakevenSavingsRate(this.inputs);
      } catch {
        this.results = null;
      }
      // Charts + Input-Resize nach Alpine-Tick (DOM muss aktuell sein)
      this.$nextTick(() => {
        if (this.results) {
          this._charts = renderCharts(this.results, this._charts);
        }
        resizeAllUnitInputs();
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

// Alpine-Direktive x-eur: Eurobetrag mit 1.000er-Punkt anzeigen (385.000),
// intern als Number speichern. Auf Fokus: rohe Zahl zur Bearbeitung.
function registerAlpineExtensions() {
  window.Alpine.directive('eur', (el, { expression }, { evaluateLater, effect, evaluate }) => {
    const get = evaluateLater(expression);
    const fmt = n => Math.round(+n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const parse = s => {
      const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
      return isNaN(n) ? null : n;
    };

    // Reaktiv: zeige formatierten Wert sobald das Feld nicht fokussiert ist
    effect(() => {
      get(val => {
        if (document.activeElement !== el) {
          el.value = fmt(val);
          resizeInput(el);
        }
      });
    });

    // Fokus: rohe Zahl anzeigen (keine Punkte), alles markieren
    el.addEventListener('focus', () => {
      get(val => { el.value = val ? String(+val) : ''; });
      el.select();
      resizeInput(el);
    });

    // Tipp: Alpine-State laufend aktualisieren (Tausend-Punkte als Trenner tolerieren)
    el.addEventListener('input', () => {
      const n = parse(el.value);
      if (n !== null) evaluate(`${expression} = ${n}`);
      resizeInput(el);
    });

    // Blur: formatiert darstellen und State sicherstellen
    el.addEventListener('blur', () => {
      const n = parse(el.value);
      if (n !== null) {
        evaluate(`${expression} = ${n}`);
        el.value = fmt(n);
      } else {
        get(val => { el.value = fmt(val); });
      }
      resizeInput(el);
    });
  });
}

// Registrierung robust gegen Race Condition zwischen ES-Modul-Import-Chain
// und Alpine's defer-Script: beide Fälle abdecken.
function registerAlpineComponent() {
  registerAlpineExtensions();
  window.Alpine.data('appState', appState);
}

if (window.Alpine) {
  registerAlpineComponent();
} else {
  document.addEventListener('alpine:init', registerAlpineComponent);
}

// Inputs in .input-wrap auf Ziffernbreite schrumpfen,
// damit die Einheit direkt hinter der Zahl sitzt.
// Span-Mirror: exakte Textbreite im echten Browser-Font (kein Canvas-Fallback-Problem).
let _sizer = null;
function resizeInput(input) {
  if (!_sizer) {
    _sizer = document.createElement('span');
    Object.assign(_sizer.style, {
      position: 'fixed', top: '-9999px', left: '-9999px',
      visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'pre',
    });
    document.body.appendChild(_sizer);
  }
  const cs = getComputedStyle(input);
  _sizer.style.font = cs.font;
  // Komma als Dezimaltrenner berücksichtigen (de-AT Locale)
  _sizer.textContent = (input.value || '0').replace('.', ',');
  const textW = _sizer.getBoundingClientRect().width;
  const padH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  input.style.width = `${Math.ceil(textW + padH + 4)}px`;
}

export function resizeAllUnitInputs() {
  document.querySelectorAll('.input-wrap input').forEach(resizeInput);
}

// Klick auf den Wrap-Bereich (rechts neben der Zahl) → Input fokussieren
document.addEventListener('click', e => {
  const wrap = e.target.closest('.input-wrap');
  if (wrap && e.target === wrap) wrap.querySelector('input')?.focus();
});

// Benutzer-Tipp-Events: direkt reagieren
document.addEventListener('input', e => {
  if (e.target.closest('.input-wrap')) resizeInput(e.target);
});
