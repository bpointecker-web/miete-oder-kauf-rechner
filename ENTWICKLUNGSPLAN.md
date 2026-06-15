# Entwicklungsplan

Konkrete Schritt-für-Schritt-Reihenfolge der Umsetzung. Jeder Step folgt dem Ablauf aus `ENTWICKLUNGSPROZESS.md` (ankündigen → implementieren → testen inkl. Regression → Ergebnis zeigen → Freigabe abwarten). Grundlage: `SPEZIFIKATION.md` (Was) + `ARCHITEKTUR.md` (Struktur).

**Prinzip der Reihenfolge:** von innen nach außen. Erst der reine Rechenkern (test-getrieben, ohne Browser), dann Daten, dann UI, dann Visualisierung, zuletzt Deployment. So ist die gesamte Finanzlogik verifiziert, bevor irgendetwas Sichtbares entsteht — kein Debugging von Mathe durch die UI hindurch.

Legende: ⬜ offen · 🔄 in Arbeit · ✅ fertig & freigegeben

---

## Phase A — Rechenkern (`calculator.js`, test-getrieben)

> Ziel: Am Ende von Phase A ist die komplette Finanzlogik durch Unit-Tests abgedeckt und grün, ohne dass eine einzige HTML-Zeile existiert.

**A0 ✅ Test-Gerüst & Projektbasis**
Minimale `package.json` (`"type": "module"`, Test-Script `npm test` → `node --test`). Leere Modul-Dateien mit Export-Stubs anlegen. Ein trivialer Smoke-Test (`assert(true)`).
*Hinweis:* `node --test tests/` schlägt in der MSYS-Bash dieser Umgebung fehl (Pfad-Übersetzung); daher `node --test` (Default-Discovery) bzw. `npm test`.
*Verifikation:* erledigt — `npm test` grün, 1 Test, 0 Failures.

**A1 ✅ `calculateAnnuityPayment(principal, annualRatePct, remainingMonths)`**
Standard-Annuitätenformel, monatlich.
*Tests:* händisch nachgerechnetes Referenzbeispiel (z.B. 200.000 € / 3,5 % / 360 Monate ≈ 898 €/Monat); Sonderfall Zins 0 % → `principal/remainingMonths`.

**A2 ✅ `buildAmortizationSchedule` — Fixzins-Grundfall**
Nur `rateModel="fixed"`, keine Sondertilgung. Jahres-Aggregate {monthlyPayment, interestPaid, principalPaid, endBalance}.
*Tests:* Summe aller `principalPaid` ≈ Kreditsumme; `endBalance` im letzten Laufzeitjahr ≈ 0; `interestPaid` Jahr 1 **knapp unter** `Kreditsumme × Jahreszins` (bei monatlicher Tilgung sinkt die Restschuld unterjährig → Zins etwas niedriger; als Obergrenze/Bandbreite prüfen, **nicht** als Gleichheit).

**A3 ✅ `buildAmortizationSchedule` — variabler Zinswechsel**
Annuität wird im `variableSwitchYear` auf Restschuld/Restlaufzeit/neuen Zins neu berechnet.
*Tests:* Rate vor Wechsel konstant, ab Wechseljahr neue konstante (höhere) Rate; Kredit trotzdem am Laufzeitende getilgt. **Regression A1–A2 grün.**

**A4 ✅ `buildAmortizationSchedule` — Sondertilgung & Volltilgung**
`annualExtraRepayment` am Jahresende, gecappt bei Restschuld (nie negativ). Nach Volltilgung Folgejahre `monthlyPayment=0`.
*Tests:* Sondertilgung verkürzt Tilgungsdauer; `endBalance` nie < 0; Jahre nach Volltilgung liefern 0-Raten (Edge-Case-Tabelle Spec §2.2). **Regression A1–A3 grün.**

**A5 ✅ `simulateBuyerOwnerCosts(inputs)`**
Eigentümer- + Betriebskosten €/m²/Monat, jährlich inflationsindexiert; Immobilienwert jährlich mit Wertsteigerung (auch negativ).
*Tests:* Kosten Jahr 0 = Satz × Fläche; Indexierung über mehrere Jahre korrekt; **negative Wertsteigerung** senkt `propertyValue`. **Regression grün.**

**A6 ✅ `simulateMonthlyPortfolios(inputs, amort, owner, startCapital)` — Kern der Monatslogik**
Monatsschleife mit `q=1+p/12`, `diff = Käuferkosten − Miete`, zwei Portfolios mit Wertstand **und** Kostenbasis pro Jahr (§5 Architektur). Vorabpauschale-Haircut optional.
*Tests:* (a) **monatlich-vs-jährlich**: monatliche Akkumulation liefert höheren Endwert als jährliche Einmalbuchung (Spec §5); (b) beide Spar-Richtungen (Käufer spart / Mieter spart); (c) Kostenbasis = Summe Einzahlungen. **Regression grün.**

**A7 ✅ `applyCapitalGainsTax(portfolioSeries, kestPct)`**
KESt auf `max(0, value − costBasis)`.
*Tests:* Gewinn>0 → Steuer abgezogen; Verlust → keine negative Steuer; Referenzbeispiel von Hand. **Regression grün.**

**A8 ✅ `applySaleCosts(...)`**
Maklerprovision + ImmoESt 30 % auf Wertgewinn, Hauptwohnsitzbefreiung schaltet Steuer auf 0.
*Tests:* Befreiung an/aus; Provision korrekt; kein Gewinn → keine ImmoESt. **Regression grün.**

**A9 ✅ `findBreakevenYear(buyerSeries, renterSeries)`**
Erstes Jahr, in dem Käufer ≥ Mieter (bzw. Vorzeichenwechsel der Differenz). `null` falls nie. **Nur ein (nominaler) Aufruf** – kein realer Breakeven (mathematisch identisch, Spec §1.6).
*Tests:* klarer Breakeven; nie-Fall → `null`; bereits-ab-Jahr-0-Fall; **Regressionstest real ≡ nominal** (diskontierte Serien liefern dasselbe Jahr). **Regression grün.**

**A10 ✅ `deriveStartCapital(inputs)` + EK-Validierung**
`purchasePrice = pricePerSqm × livingAreaSqm`, `monthlyRent = rentPerSqm × livingAreaSqm` (analog, siehe Architektur §4.1), EK, Kreditsumme, Kauf-/Finanzierungsnebenkosten, Startkapital, Kaution (`monthlyRent × depositMonths`); EK-Mindestprüfung → Auto-Anhebung + Warning (Designentscheidung D3).
*Tests:* Default-Beispiel rechnerisch geprüft; Unter-Mindest-EK erzeugt Warning + angehobene Quote. **Regression grün.**

**A11 ✅ `runComparison(inputs)` — Integration**
Verdrahtet A1–A10 zur Pipeline (§5 Architektur), erzeugt das vollständige `results`-Objekt inkl. nominal+real Serien und **einem** Breakeven-Jahr.
*Tests:* ein vollständiges Referenzszenario (fixe inputs → erwartete Kennzahlen, als "Golden Master" eingefroren); Form von `results` vollständig (alle Felder aus Architektur §4.2 vorhanden). **Komplette Regression A1–A10 grün.**

---

## Phase B — Daten

**B1 ⬜ `presets.js`**
Regionaltabelle (Spec §2.7) + `createDefaultInputs(region)` liefert ein vollständiges `inputs`-Objekt (§4.1 Architektur).
*Tests:* jedes Preset erzeugt ein `inputs`-Objekt mit **allen** Pflichtfeldern; `runComparison(createDefaultInputs(r))` läuft für alle 6 Regionen ohne Fehler und liefert plausible (endliche, nicht NaN) Kennzahlen.

*Zusatzanforderung (aus Review-Szenario "1-Mio-Wohnung Wien"):* `rentPerSqm` soll nicht nur ein fixer Default pro Region sein, sondern abhängig vom `pricePerSqm` (Bruttorendite sinkt mit steigendem Kaufpreis/m² — Luxussegment hat tendenziell niedrigere Rendite). Default-Mietwert soll daraus abgeleitet werden, **bleibt aber jederzeit per `rentPerSqm`-Input überschreibbar** (UI-Override, kein Eingriff in `calculator.js` nötig — `rentPerSqm` ist dort bereits ein freier Parameter). Konkrete Yield-Kurve/Stützpunkte sind bei Umsetzung noch zu recherchieren/verifizieren.

---

## Phase C — UI-Schale (sichtbar, aber noch ohne Charts)

> Ab hier ist nichts mehr durch Unit-Tests abgedeckt → manuelle Browser-Verifikation pro Step.

**C1 ⬜ `index.html` Grundgerüst + Alpine-Einbindung**
Alpine via CDN, `x-data="appState()"`, Tab-/Akkordeon-Struktur (Spec §3), Eingabefelder mit `x-model` an `inputs` gebunden. Noch keine Ergebnisse.
*Verifikation:* Seite lädt, Tabs schalten, Eingaben ändern `inputs` (im Alpine-Devtools/Konsole sichtbar).

**C2 ⬜ `app.js` — inputs→results-Verdrahtung**
`appState()` mit `inputs` (aus `createDefaultInputs`) und `results` (via `x-effect`/`Alpine.effect` aus `runComparison`). Bottom-Line-Kennzahlen + Realwerte als Text rendern.
*Verifikation:* Kennzahlen erscheinen, ändern sich **live** bei jeder Eingabe ohne Reload; Werte stimmen mit Phase-A-Referenz überein.

**C3 ⬜ `css/style.css` — Mobile-First**
Sticky Bottom-Line-Bar, Tab-Styling, responsives Layout, Info-Icons/Tooltips.
*Verifikation:* sauber auf schmalem (≈375px) und breitem Viewport; Bottom-Bar bleibt sichtbar beim Scrollen.

---

## Phase D — Visualisierung

**D1 ⬜ `charts.js` — Vermögens-Verlaufschart**
Chart.js (CDN), zwei Linien (Käufer/Mieter nominal), `maintainAspectRatio:false`, `update()` statt `destroy()`.
*Verifikation:* Chart zeichnet `results.series`; bei Eingabeänderung aktualisiert er sich flackerfrei; Breakeven-Punkt visuell plausibel.

**D2 ⬜ `charts.js` — Cashflow-Chart**
Monatskosten Käufer (inkl. BK) vs. Miete über die Jahre.
*Verifikation:* zweiter Chart aktualisiert live; Werte plausibel.

**D3 ⬜ Sensitivitätsanzeige**
Was-wäre-wenn-Slider (Wertsteigerung, Zins, Anlagerendite) + Beispiel-Preset "Wertverlust (-1%)"; optional reale Linie.
*Verifikation:* Slider verändern Ergebnis/Charts live; Extremwerte (inkl. negativ) brechen nichts.

---

## Phase E — Abschluss

**E1 ⬜ `README.md`**
Methodik, Annahmen, Quellen pro Region mit Datum, Disclaimer ("keine Finanzberatung").

**E2 ⬜ `.github/workflows/pages.yml`**
Statischer GitHub-Pages-Deploy (kein Build-Step).
*Verifikation:* Workflow-Logik nachvollzogen; Seite deploybar.

**E3 ⬜ Browser-Gesamtverifikation**
Alle 6 Presets durchklicken; Edge Cases aus Spec §5 (EK 0/100 %, kurzer/langer Horizont, Zinswechsel, Sondertilgung>0, Vorabpauschale an/aus, Verkauf an/aus, Hauptwohnsitz an/aus); Live-Update; Mobile+Desktop.

---

## Mapping zur bestehenden Task-Liste

| Task-Liste | Plan-Phasen |
|---|---|
| #2 calculator.js Kernformeln | A1–A11 |
| #3 presets.js | B1 |
| #4 index.html + style.css | C1, C3 |
| #5 app.js UI-Wiring | C2 |
| #6 charts.js | D1, D2 |
| #7 Sensitivitätsanalyse | D3 |
| #8 Unit-Tests | laufend in Phase A (nicht separat am Ende!) |
| #9 README + Pages | E1, E2 |
| #10 Verifikation Browser | E3 |

> Hinweis: Task #8 "Unit-Tests" ist **kein** eigener Schlussschritt — Tests entstehen pro Funktion in Phase A. Die Task-Liste wird entsprechend angepasst.

---

**Nächster konkreter Step: A0** (Test-Gerüst & Projektbasis) — erst nach Freigabe von Architektur + Plan.
