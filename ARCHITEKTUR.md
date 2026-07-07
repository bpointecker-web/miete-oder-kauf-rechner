# Architekturkonzept

Technisches Konzept für den "Mieten vs. Kaufen"-Rechner. Ergänzt `SPEZIFIKATION.md` (das *Was*) um das *Wie der Struktur*. Der Entwicklungsablauf selbst steht in `ENTWICKLUNGSPROZESS.md`, die Schritt-Reihenfolge in `ENTWICKLUNGSPLAN.md`.

---

## 1. Leitidee

Das System hat **einen reinen, testbaren Rechenkern** und **eine dünne UI-Schale** darum herum. Die gesamte Finanzlogik lebt in `calculator.js` als seiteneffektfreie Funktionen, die nichts über DOM, Alpine oder Chart.js wissen. Alles andere (HTML, Alpine, Chart.js) ist austauschbares Beiwerk, das nur Daten rein- und rausreicht.

**Warum diese Trennung?** Nur reine Funktionen lassen sich ohne Browser deterministisch unit-testen. Der Regressionsschutz (zentrale Anforderung aus `ENTWICKLUNGSPROZESS.md`) steht und fällt damit, dass die Logik **nicht** mit UI verwoben ist.

---

## 2. Schichtenmodell

```
┌─────────────────────────────────────────────────────────┐
│  Präsentation                                            │
│  index.html (Alpine x-data, x-model, x-effect)           │
│  css/style.css (Mobile-First)                            │
└───────────────┬─────────────────────────────────────────┘
                │ liest results.*, schreibt inputs.*
┌───────────────▼─────────────────────────────────────────┐
│  UI-Orchestrierung                                       │
│  app.js  — Alpine-Komponente:                            │
│    state { inputs, results }                             │
│    on inputs-change → results = runComparison(inputs)    │
│    on results-change → charts.update(results)            │
└───────┬───────────────────────────────┬─────────────────┘
        │ ruft auf                       │ ruft auf
┌───────▼──────────────┐      ┌──────────▼──────────────────┐
│  Visualisierung      │      │  Rechenkern (rein, DOM-frei) │
│  charts.js           │      │  calculator.js               │
│  (Chart.js wrappen,  │      │    runComparison(inputs)     │
│   update statt       │      │      └─ alle Teilfunktionen  │
│   destroy)           │      │  presets.js (reine Daten)    │
└──────────────────────┘      └──────────────────────────────┘
        ▲                                ▲
        │                                │
   tests/ testet ausschließlich calculator.js + presets.js
```

**Abhängigkeitsrichtung (streng):**
- `calculator.js` hängt von **nichts** ab (kein Import außer ggf. reinen Helfern). Kennt weder `presets.js` noch `app.js`.
- `presets.js` hängt von nichts ab (nur Daten + Default-Input-Fabrik).
- `app.js` importiert `calculator.js`, `presets.js`, `charts.js`.
- `charts.js` importiert nur Chart.js (CDN-global) und erhält fertige `results`.
- **Nie** zeigt ein Pfeil zurück nach oben: `calculator.js` darf nie etwas aus `app.js` brauchen.

---

## 3. Zentraler Datenfluss

```
Nutzer tippt
   │
   ▼
inputs (Alpine reactive state, einzige Schreibquelle via x-model)
   │  x-effect feuert bei jeder Änderung
   ▼
runComparison(inputs)            ← einziger Einstiegspunkt in calculator.js
   │
   ▼
results (read-only Objekt)
   │
   ├──► Templates (x-text, x-show) lesen results.* nur lesend
   └──► charts.js: chart.data = results.series; chart.update()
```

Die strikte Zweiteilung **inputs (schreibbar) / results (abgeleitet, read-only)** verhindert reaktive Endlosschleifen — siehe `SPEZIFIKATION.md` §4 "Alpine-State-Struktur".

---

## 4. Zentrale Datenverträge (Contracts)

Diese beiden Objektformen sind die wichtigsten Schnittstellen im System. Ändern wir sie, ändert sich vieles — daher hier fixiert und versioniert.

### 4.1 Das `inputs`-Objekt

Eine **flache** Struktur (erleichtert `x-model`-Bindings). Einheiten im Namen mitgedacht. Beispiel mit Defaults:

```js
const inputs = {
  // Immobilie & Kauf (2.1)
  region: "wien",
  pricePerSqm: 5500,
  livingAreaSqm: 70,
  // Kaufnebenkosten (Prozent vom Kaufpreis)
  transferTaxPct: 3.5,        // Grunderwerbsteuer
  landRegisterPct: 1.1,       // Grundbucheintragung
  brokerBuyPct: 3.0,          // Makler Kauf
  notaryPct: 1.5,             // Notar/Rechtsanwalt

  // Finanzierung (2.2)
  equityRatioPct: 20,
  // Finanzierungsnebenkosten (Prozent der Kreditsumme)
  mortgageLienPct: 1.2,       // Pfandrechtseintragung
  bankProcessingPct: 1.5,     // Bankbearbeitung
  rateModel: "fixed",         // "fixed" | "variable"
  interestRatePct: 3.5,       // Fixzins bzw. Startzins variabel
  variableSwitchYear: 10,     // nur bei rateModel="variable"
  variableRatePct: 5.0,       // nur bei rateModel="variable"
  loanTermYears: 30,
  annualExtraRepayment: 0,    // Sondertilgung €/Jahr (Phase 2)

  // Laufende Kosten Eigentum (2.3) — €/m²/Monat
  ownerCostsPerSqm: 2.75,
  operatingCostsPerSqm: 2.20, // Betriebskosten (neutral, beidseitig)
  appreciationPct: 2.5,       // Wertsteigerung p.a. (darf < 0 sein!)

  // Miete (2.4)
  rentPerSqm: 13.5,            // €/m²/Monat, brutto inkl. BK — analog pricePerSqm
  depositMonths: 3,            // Mietkaution in Monatsmieten

  // Annahmen (2.5)
  inflationPct: 2.0,
  investmentReturnPct: 6.0,
  applyVorabpauschale: false,
  vorabpauschaleHaircutPct: 0.5,
  kestPct: 27.5,
  horizonYears: 30,
  simulateSale: true,
  saleBrokerFeePct: 3.0,      // Maklerprovision beim Verkauf (Spec §1.5/§2.5)
  immoEstPct: 30,             // ImmoESt-Satz auf Wertgewinn (Spec §1.5/§2.5)
  primaryResidenceExempt: true,
};
```

**Regel:** `inputs` enthält **nur Rohwerte aus der UI**, nie abgeleitete Größen (kein `loanAmount`, kein `closingCosts` — die werden in `runComparison` berechnet).

### 4.2 Das `results`-Objekt

Read-only, vollständig von `runComparison(inputs)` erzeugt:

```js
const results = {
  // Kennzahlen (Bottom Line)
  buyerNetWealthNominal: Number,   // Jahr N, nominal
  renterNetWealthNominal: Number,
  differenceNominal: Number,       // buyer − renter
  buyerNetWealthReal: Number,      // kaufkraftbereinigt
  renterNetWealthReal: Number,
  differenceReal: Number,
  breakevenYear: Number | null,    // EIN Wert; real ≡ nominal (Spec §1.6)

  // Validierung/Warnungen
  warnings: [ { code: String, message: String } ],  // z.B. EK-Mindestquote

  // Zeitreihen für Charts (je ein Wert pro Jahr 0..N)
  series: {
    years: [Number],
    buyerNetWealthNominal: [Number],
    renterNetWealthNominal: [Number],
    buyerNetWealthReal: [Number],
    renterNetWealthReal: [Number],
    buyerMonthlyCost: [Number],    // Cashflow-Chart (inkl. BK)
    renterMonthlyCost: [Number],   // Miete inkl. BK
  },

  // abgeleitete Eckwerte für die Anzeige/Transparenz
  derived: {
    purchasePrice: Number,
    equity: Number,
    loanAmount: Number,
    closingCosts: Number,          // Kaufnebenkosten €
    financingCosts: Number,        // Finanzierungsnebenkosten €
    startCapital: Number,
    monthlyRent: Number,           // = rentPerSqm × livingAreaSqm, analog purchasePrice
    deposit: Number,               // Mietkaution € (= monthlyRent × depositMonths)
  },
};
```

---

## 5. Interne Berechnungspipeline (`runComparison`)

`runComparison` ist der **einzige öffentliche Einstiegspunkt** in `calculator.js`. Intern orchestriert es reine Teilfunktionen in dieser Reihenfolge:

```
runComparison(inputs):
  1. derived = deriveStartCapital(inputs)              // 1.1: purchasePrice (pricePerSqm × Fläche),
                                                        //      monthlyRent (rentPerSqm × Fläche),
                                                        //      EK, Kredit, NK, Startkapital, Kaution
                                                        //      + EK-Mindestvalidierung → warnings
  2. amort = buildAmortizationSchedule({...})           // [{year, monthlyPayment, interestPaid,
                                                        //   principalPaid, endBalance}]
  3. owner = simulateBuyerOwnerCosts(inputs)            // [{year, propertyValue, monthlyOwnerCosts}]
  4. port  = simulateMonthlyPortfolios(inputs, amort, owner, startCapital)
             // startCapital = { buyer: 0,
             //                   renter: derived.startCapital - derived.deposit }
             // (Käufer steckt sein gesamtes Startkapital in den Kauf, sein
             //  Portfolio startet bei 0 — siehe Spec §1.1)
             → { buyerPortfolioByYear:  [{year, value, costBasis}],
                 renterPortfolioByYear: [{year, value, costBasis}] }
  5. Pro Jahr Nettovermögen "bei Liquidation in diesem Jahr" bilden:
       buyerNet[y]  = owner.propertyValue[y] − amort.endBalance[y]
                      [− applySaleCosts(...) falls simulateSale]
                      + applyCapitalGainsTax(buyerPortfolio[y])
       renterNet[y] = applyCapitalGainsTax(renterPortfolio[y]) + deposit
  6. Realwert-Serien = Nominalserien / (1+inflation)^y  (nur für Anzeige/Kaufkraft)
  7. breakevenYear = findBreakevenYear(buyerNet, renterNet)   // nur nominal nötig;
     // real ≡ nominal, da beide Serien je Jahr durch denselben Faktor geteilt werden (Spec §1.6)
  8. results zusammenbauen (Kennzahlen Jahr N nominal+real + Serien + derived + warnings)
```

### Wichtige interne Strukturen

- **Kostenbasis-Tracking (cost basis):** Damit `applyCapitalGainsTax` den Gewinn kennt, führt `simulateMonthlyPortfolios` pro Portfolio die **Summe der Einzahlungen** mit (`costBasis`). Gewinn = `value − costBasis`; KESt nur auf positiven Gewinn. Beim Mieter ist der Startwert (Startkapital − Kaution) Teil der Kostenbasis.
- **Monatsschleife:** `simulateMonthlyPortfolios` iteriert `horizonYears × 12` Monate mit `q = 1 + p_pa/12`, schreibt aber nur Jahres-Endwerte raus (Chart-Datenpunkte). Siehe `SPEZIFIKATION.md` §1.3.

---

## 6. Modul-Verantwortlichkeiten

| Modul | Verantwortung | Darf NICHT |
|---|---|---|
| `calculator.js` | Gesamte Finanzmathematik, reine Funktionen | DOM/Alpine/Chart.js berühren, globalen State halten |
| `presets.js` | Regionale Defaults (2.7), `createDefaultInputs(region)` | Berechnen, UI kennen |
| `charts.js` | Chart.js-Instanzen erzeugen + `update()` | Rechnen, inputs schreiben |
| `app.js` | Alpine-Komponente, inputs↔results-Verdrahtung | Finanzlogik enthalten (nur `runComparison` aufrufen) |
| `index.html` | Markup + Bindings | Logik im Template (nur einfache Ausdrücke) |
| `tests/` | Unit-/Regressionstests für `calculator.js` + `presets.js` | — |

---

## 7. Designentscheidungen — **bestätigt (2026-06-15)**

Diese Punkte wurden bewusst getroffen und vom User bestätigt:

**D1 — Nettovermögen-Serie "bei Liquidation in diesem Jahr".**
Für Breakeven und Verlaufschart brauchen wir pro Jahr *einen* Nettovermögenswert. Vorschlag: für **jedes** Jahr so rechnen, als würde man in diesem Jahr verkaufen/auflösen — also KESt auf den bis dahin aufgelaufenen Gewinn **und** (falls "Verkauf simulieren") Verkaufskosten/ImmoESt auf den Immobilienteil anwenden. Das macht die beiden Linien fair vergleichbar ("was hätte ich, wenn ich heute aufhöre"). *Alternative:* Steuer/Verkaufskosten nur im Schlussjahr N, davor brutto — einfacher, aber die Breakeven-Linie hätte am Ende einen Knick. **Empfehlung: konsistente "Liquidation-heute"-Variante.**

**D2 — KESt-Berechnung auf Gewinn, nicht auf Gesamtwert.**
KESt wird auf `max(0, value − costBasis)` gerechnet, nicht auf den vollen Portfoliowert. Das erfordert das Kostenbasis-Tracking (§5). Korrekt und unstrittig, aber es macht `simulateMonthlyPortfolios` etwas komplexer (zwei Größen pro Jahr statt einer). **Empfehlung: so umsetzen.**

**D3 — EK-Mindestvalidierung: Warnung + Auto-Anhebung.**
Liegt das Eigenkapital unter Kauf+Finanzierungsnebenkosten, hebt `runComparison` die EK-Quote intern auf den Mindestwert und liefert eine `warning`. *Frage:* Soll das Ergebnis dann mit der **angehobenen** Quote gerechnet werden (Vorschlag) oder die Berechnung blockiert/auf 0 gesetzt werden, bis der Nutzer korrigiert? **Empfehlung: rechnen mit angehobener Quote + sichtbare Warnung.**

**D4 — Kein Test-Framework, nur Node Test Runner.**
`node --test` ist seit Node 18 eingebaut, kein npm-Install nötig — passt zur "keine Build-Pipeline"-Linie. ESM-Module (`import`/`export`) in `.js` mit `"type": "module"` in einer minimalen `package.json` (nur für Tests, nicht fürs Deployment nötig). **Empfehlung: so.**

**D5 — ES-Module auch im Browser ohne Bundler.**
`calculator.js` exportiert via `export`, `index.html` lädt `app.js` als `<script type="module">`. Funktioniert nativ auf GitHub Pages ohne Build. Chart.js/Alpine kommen weiter per CDN-`<script>` (globals). **Empfehlung: so.**

---

## 8. Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Rechenfehler bleibt lange unentdeckt | Test-First pro Funktion, Referenzwerte händisch nachgerechnet (Annuität, Zinseszins) |
| Monatslogik subtil falsch (Timing) | Dedizierter Test monatlich-vs-jährlich (Spec §5), beide Spar-Richtungen |
| Spätere Logikänderung bricht Bestehendes | Regressionssuite läuft bei jedem Step komplett (`ENTWICKLUNGSPROZESS.md`) |
| `inputs`-Schema wuchert / driftet | Schema hier in §4.1 fixiert; Erweiterung nur bewusst + dokumentiert |
| Reaktive Endlosschleife (Alpine) | inputs/results-Trennung (§3), results nie schreibend im Template |
| Chart-Memory-Leak auf Mobile | `chart.update()` statt `destroy()`/neu (Spec §4) |

---

**Kurzfassung:** Reiner Kern (`calculator.js`) + dünne Schale. Zwei fixe Verträge (`inputs`, `results`). Ein Einstiegspunkt (`runComparison`). Abhängigkeiten zeigen nur nach innen. Tests treffen ausschließlich den Kern.
