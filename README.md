# Mieten vs. Kaufen — Rechner für Österreich

Ein transparenter, rein finanzieller Vergleichsrechner für den österreichischen Immobilienmarkt. Keine Pauschalantworten — nur Zahlen.

**[→ Rechner öffnen](https://bernhardpointecker.github.io/miete-oder-kauf-rechner/)**

---

## Methodik

### Grundprinzip: Opportunitätskosten-Vermögensvergleich

Beide Seiten starten mit demselben verfügbaren Kapital (Anzahlung/Eigenkapital + Kaufnebenkosten + Finanzierungsnebenkosten):

**Käufer:** setzt dieses Kapital sofort für Anzahlung und Nebenkosten ein. Monatlich: Kreditrate + laufende Eigentümerkosten. Die Immobilie steigt gemäß Wertsteigerungsrate p.a. im Wert.

**Mieter:** investiert dasselbe Startkapital in ein Wertpapierportfolio (Anlagerendite p.a.). Monatlich zahlt er Miete; wer günstiger wohnt, investiert die Differenz. Eine konfigurierbare Sparquote (0–100 %) modelliert, wie diszipliniert der Mieter die Ersparnis tatsächlich anlegt.

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
| KESt (27,5 %) | Am Ende auf den realisierten Portfoliogewinn angewendet (Vereinfachung); laufende Besteuerung bei Meldefonds nicht separat modelliert |
| ImmoESt (30 %) | Optional bei Verkauf, auf Wertgewinn; Hauptwohnsitzbefreiung konfigurierbar (§ 30 Abs. 2 Z 1 EStG) |
| Grunderwerbsteuer | 3,5 % vom Kaufpreis (GrEStG 1987) |
| Grundbuch/Pfandrecht | 1,1 % Eigentumsrecht / 1,2 % Pfandrecht (GGG Tarifpost 9) |

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
  presets.js        Österreich-Durchschnittswerte als Defaults
  charts.js         Chart.js-Rendering
  app.js            Alpine-Komponente, UI-Wiring
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
- Eurostat: [Housing price statistics](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Housing_price_statistics_-_house_price_index)
- OeNB: [Wohnimmobilienpreisindex Österreich](https://www.oenb.at/Statistik/Standardisierte-Tabellen/Preise-Wettbewerbsfaehigkeit/immobilien/wohnimmobilienpreisindex.html)

---

*Stand: Juni 2026 · Lizenz: MIT*
