# Mieten vs. Kaufen — Rechner für Österreich

Ein transparenter, rein finanzieller Vergleichsrechner für den österreichischen Immobilienmarkt. Keine Pauschalantworten — nur Zahlen.

**[→ Rechner öffnen](https://bernhardpointecker.github.io/miete-oder-kauf-rechner/)**

---

## Methodik

### Grundprinzip: Opportunitätskosten-Vermögensvergleich

Beide Seiten starten mit demselben verfügbaren Kapital (Eigenkapital + Kaufnebenkosten, die der Käufer aufbringen muss):

**Käufer:** zahlt dieses Kapital sofort für Eigenkapital und Nebenkosten. Monatlich: Kreditrate + laufende Eigentümerkosten. Die Immobilie steigt gemäß Wertsteigerungsrate p.a. im Wert.

**Mieter:** investiert dasselbe Startkapital in ein Wertpapierportfolio (Anlagerendite p.a.). Monatlich zahlt er Miete; die Differenz zu den Käuferkosten wird ins Portfolio ein- oder ausgezahlt. Eine konfigurierbare Sparquote (0–100 %) modelliert, wie diszipliniert der Mieter die Ersparnis tatsächlich investiert.

**Am Ende des Horizonts:**
- **Käufer-Nettovermögen** = Immobilienwert − Restschuld − (optional: Maklerprovision + ImmoESt)
- **Mieter-Nettovermögen** = Portfoliowert − KESt auf realisierten Gewinn

Die Differenz entscheidet — wer liegt vorne?

### Berechnete Breakevens

- **Breakeven-Jahr:** Ab welchem Jahr liegt der Käufer erstmals vorne?
- **Sparquoten-Schwelle:** Welche Mindest-Sparquote braucht der Mieter, damit Mieten trotzdem gewinnt?

### Steuermodellierung (Österreich)

| Steuer | Modellierung |
|---|---|
| KESt (27,5 %) | Am Ende auf den realisierten Portfoliogewinn angewendet (Vereinfachung) |
| Laufende Fondsbesteuerung | Optional: jährlicher Haircut (%) auf den Portfoliowert — modelliert Vorabpauschale-Analogon für Meldefonds |
| ImmoESt (30 %) | Optional bei Verkauf, auf Wertgewinn; Hauptwohnsitzbefreiung konfigurierbar |
| Grunderwerbsteuer | 3,5 % vom Kaufpreis (Kaufnebenkosten) |
| Grundbucheintragung | 1,1 % vom Kaufpreis |

---

## Regionale Presets

Kaufpreise basieren auf Eurostat-Daten (automatisch aktualisiert via `scripts/update-data.mjs`). Mietrenditen sind Schätzwerte auf Basis allgemeiner Marktkenntnis — keine direkte Inserate-Auswertung.

| Region | Kaufpreis-Quelle | Mietrendite |
|---|---|---|
| Wien | Eurostat / OeNB-Wohnimmobilienpreisindex | Schätzwert ~2,8–3,0 % brutto |
| Graz, Linz, Salzburg, Innsbruck | Eurostat regional | Schätzwert ~3,0–3,4 % brutto |
| Österreich-Ø | Eurostat national | Schätzwert ~3,2–3,5 % brutto |

Alle Presets sind in der Oberfläche vollständig überschreibbar.

---

## Technischer Stack

- **HTML / CSS / Alpine.js v3** — keine Build-Pipeline, kein Framework
- **Chart.js** — Vermögensverlauf und Cashflow-Diagramme
- **Hosting:** GitHub Pages (statisch, kein Server)

### Projektstruktur

```
index.html          Benutzeroberfläche
css/style.css       Styling
js/
  calculator.js     Reine Berechnungslogik (testbar ohne DOM)
  presets.js        Regionale Defaultwerte
  charts.js         Chart.js-Rendering
  app.js            Alpine-Komponente, UI-Wiring
data/
  regional-generated.js   Auto-generierte Regionaldaten (Eurostat)
scripts/
  update-data.mjs   Aktualisiert Regionaldaten via Eurostat-API
tests/
  calculator.test.js  Unit-Tests (Node.js built-in test runner)
```

---

## Disclaimer

Dieser Rechner dient **ausschließlich zur allgemeinen Information** und stellt **keine Finanz-, Steuer- oder Rechtsberatung** dar.

- Alle Berechnungen basieren auf vereinfachten Modellannahmen
- Vergangene Renditen (Immobilien, Aktien) sind keine Garantie für zukünftige Entwicklungen
- Individuelle steuerliche Situation, persönliche Lebensumstände und nicht-finanzielle Faktoren (Flexibilität, Sicherheit, Lebensstil) bleiben bewusst außen vor
- Marktdaten und Presets stellen Näherungswerte dar — bitte vor Entscheidungen aktuelle Marktdaten und professionelle Beratung einholen

---

## Quellen & Literatur

- Kommer, G. (2021). *Kaufen oder mieten? Wie Sie für sich die richtige Entscheidung treffen.* Campus Verlag.
- Eurostat: [Housing price statistics](https://ec.europa.eu/eurostat/statistics-explained/index.php/Housing_price_statistics_-_house_price_index)
- OeNB: [Wohnimmobilienpreisindex Österreich](https://www.oenb.at/Statistik/Standardisierte-Tabellen/Immobilienmarkt.html)

---

*Stand: Juni 2026 · Lizenz: MIT*
