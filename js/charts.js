/**
 * Chart-Rendering für den Mieten-vs.-Kaufen-Rechner.
 *
 * Zwei Diagramme (Chart.js):
 *   - Vermögens-Verlauf: Nettovermögen Käufer / Mieter über die Jahre (nominal)
 *   - Cashflow:          Monatliche Gesamtkosten Käufer vs. Mieter über die Jahre
 *
 * Jeder Aufruf von renderCharts() zerstört die alten Chart-Instanzen und baut
 * neue auf. Das vermeidet Probleme beim Resize des Canvas.
 */

const CHART_COLORS = {
  buyer:      '#85B7EB',
  buyerFill:  'rgba(133,183,235,0.15)',
  renter:     '#5DCAA5',
  renterFill: 'rgba(93,202,165,0.15)',
  grid:       'rgba(133,183,235,0.12)',
  tick:       'rgba(181,212,244,0.55)',
  breakeven:  'rgba(250,199,117,0.75)',
};

const CHART_FONT = {
  family: 'system-ui, -apple-system, sans-serif',
  size: 11,
  color: 'rgba(181,212,244,0.7)',
};

function baseOptions(horizonYears, breakevenYear) {
  const plugins = {
    legend: {
      labels: { color: CHART_FONT.color, font: { family: CHART_FONT.family, size: CHART_FONT.size }, boxWidth: 12, padding: 12 },
    },
    tooltip: {
      backgroundColor: '#042C53',
      titleColor: 'rgba(181,212,244,0.9)',
      bodyColor: '#fff',
      borderColor: 'rgba(133,183,235,0.3)',
      borderWidth: 1,
    },
  };

  // Vertikale Linie beim Breakeven-Jahr
  if (breakevenYear !== null) {
    plugins.annotation = {
      annotations: {
        breakeven: {
          type: 'line',
          xMin: breakevenYear,
          xMax: breakevenYear,
          borderColor: CHART_COLORS.breakeven,
          borderWidth: 1.5,
          borderDash: [4, 4],
          label: {
            display: true,
            content: `Breakeven J. ${breakevenYear}`,
            color: CHART_COLORS.breakeven,
            backgroundColor: 'rgba(4,44,83,0.85)',
            font: { family: CHART_FONT.family, size: 10 },
            position: 'start',
            padding: 4,
          },
        },
      },
    };
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: horizonYears,
        ticks: {
          color: CHART_FONT.color,
          font: { family: CHART_FONT.family, size: CHART_FONT.size },
          maxTicksLimit: 8,
          callback: (v) => `J. ${v}`,
        },
        grid: { color: CHART_COLORS.grid },
      },
      y: {
        ticks: {
          color: CHART_FONT.color,
          font: { family: CHART_FONT.family, size: CHART_FONT.size },
          maxTicksLimit: 6,
          callback: (v) => `${(v / 1000).toFixed(0)}k`,
        },
        grid: { color: CHART_COLORS.grid },
      },
    },
    plugins,
  };
}

/**
 * Rendert beide Charts neu. Gibt ein Objekt mit den Chart-Instanzen zurück,
 * damit app.js sie beim nächsten Update zerstören kann.
 *
 * @param {object} results  - das `results`-Objekt aus runComparison()
 * @param {object|null} prev - { wealth, cashflow } vorige Chart-Instanzen (werden zerstört)
 * @returns {{ wealth: Chart, cashflow: Chart }}
 */
export function renderCharts(results, prev = null) {
  if (prev?.wealth)   { prev.wealth.destroy();   }
  if (prev?.cashflow) { prev.cashflow.destroy(); }

  const { years, buyerNetWealthNominal, renterNetWealthNominal, buyerMonthlyCost, renterMonthlyCost } = results.series;
  const { horizonYears, breakevenYear } = { horizonYears: years[years.length - 1], breakevenYear: results.breakevenYear };

  // ── D1: Vermögens-Verlauf ────────────────────────────────────────────
  const wealthCtx = document.getElementById('chart-wealth')?.getContext('2d');
  let wealth = null;
  if (wealthCtx) {
    const data = years.map((y, i) => ({ x: y, y: buyerNetWealthNominal[i] }));
    const dataR = years.map((y, i) => ({ x: y, y: renterNetWealthNominal[i] }));
    wealth = new window.Chart(wealthCtx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Käufer – Nettovermögen',
            data,
            borderColor: CHART_COLORS.buyer,
            backgroundColor: CHART_COLORS.buyerFill,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Mieter – Nettovermögen',
            data: dataR,
            borderColor: CHART_COLORS.renter,
            backgroundColor: CHART_COLORS.renterFill,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        ...baseOptions(horizonYears, breakevenYear),
        plugins: {
          ...baseOptions(horizonYears, breakevenYear).plugins,
          title: {
            display: true,
            text: 'Nettovermögen nominal (nach Steuern)',
            color: 'rgba(181,212,244,0.8)',
            font: { family: CHART_FONT.family, size: 12, weight: '600' },
            padding: { bottom: 8 },
          },
        },
      },
    });
  }

  // ── D2: Cashflow (monatliche Kosten) ────────────────────────────────
  const cashflowCtx = document.getElementById('chart-cashflow')?.getContext('2d');
  let cashflow = null;
  if (cashflowCtx) {
    const dataB = years.map((y, i) => ({ x: y, y: buyerMonthlyCost[i] }));
    const dataR = years.map((y, i) => ({ x: y, y: renterMonthlyCost[i] }));
    const opts = baseOptions(horizonYears, null);
    opts.scales.y.ticks.callback = (v) => `${v.toFixed(0)} €`;
    cashflow = new window.Chart(cashflowCtx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Käufer – mtl. Kosten (Rate + Betrieb)',
            data: dataB,
            borderColor: CHART_COLORS.buyer,
            backgroundColor: 'transparent',
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Mieter – mtl. Miete',
            data: dataR,
            borderColor: CHART_COLORS.renter,
            backgroundColor: 'transparent',
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [5, 3],
          },
        ],
      },
      options: {
        ...opts,
        plugins: {
          ...opts.plugins,
          title: {
            display: true,
            text: 'Monatliche Kosten im Verlauf',
            color: 'rgba(181,212,244,0.8)',
            font: { family: CHART_FONT.family, size: 12, weight: '600' },
            padding: { bottom: 8 },
          },
        },
      },
    });
  }

  return { wealth, cashflow };
}
