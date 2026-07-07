# Referenzszenario ("Golden Master")

Dieses Dokument erklärt das **Golden-Master-Referenzszenario** aus
`tests/calculator.test.js` (`GOLDEN_MASTER_INPUTS`) im Detail: alle Eingaben,
der vollständige Rechenweg durch `runComparison()` und die Endergebnisse nach
30 Jahren. Es dient als nachvollziehbares Beispiel für die Methodik und als
Referenz, wenn sich durch spätere Änderungen Werte verschieben.

> **Hinweis:** Die hier gezeigten Zahlen sind durch den Golden-Master-Test
> regressionsgeschützt (`npm test`) und wurden direkt mit `runComparison()`
> nachgerechnet (siehe `npm test` bzw. die Assertions ab Zeile 607 in
> `tests/calculator.test.js`). Ändert sich an diesen Werten etwas, ohne dass
> die Eingaben bewusst geändert wurden, ist das ein Bug.

---

## 1. Eingaben (`inputs`)

Default-Szenario: **Wien, 70 m² Wohnung, 30 Jahre Betrachtungshorizont.**

| Parameter | Wert | Bedeutung |
|---|---|---|
| `pricePerSqm` | 5.500 € | Kaufpreis pro m² |
| `livingAreaSqm` | 70 | Wohnfläche |
| `transferTaxPct` | 3,5% | Grunderwerbsteuer |
| `landRegisterPct` | 1,1% | Grundbucheintragung |
| `brokerBuyPct` | 3,0% | Makler (Kauf) |
| `notaryPct` | 1,5% | Notar/Rechtsanwalt |
| `equityRatioPct` | 20% | Eigenkapitalquote |
| `mortgageLienPct` | 1,2% | Pfandrechtseintragung |
| `bankProcessingPct` | 1,5% | Bankbearbeitung |
| `rateModel` | `fixed` | Zinsmodell |
| `interestRatePct` | 3,5% | Fixzins p.a. |
| `loanTermYears` | 30 | Kreditlaufzeit |
| `annualExtraRepayment` | 0 | Sondertilgung |
| `maintenancePctOfValue` | 1,2% p.a. | Instandhaltung, % des aktuellen Immobilienwerts |
| `operatingCostsPerSqm` | 2,20 €/m²/Monat | Betriebskosten (Jahr 0, wächst mit Inflation) |
| `appreciationPct` | 2,5% | Wertsteigerung Immobilie p.a. |
| `rentPerSqm` | 13,5 €/m²/Monat | Miete (brutto inkl. BK) |
| `depositMonths` | 3 | Mietkaution in Monatsmieten |
| `inflationPct` | 2,0% | Inflation p.a. (Miete + Betriebskosten-Indexierung) |
| `investmentReturnPct` | 6,0% | Anlagerendite Mieter-Portfolio p.a. |
| `kestPct` | 27,5% | KESt auf Kapitalgewinne |
| `horizonYears` | 30 | Betrachtungshorizont |
| `simulateSale` | `true` | Verkauf am Ende simulieren |
| `saleBrokerFeePct` | 3,0% | Maklerprovision beim Verkauf |
| `immoEstPct` | 30% | ImmoESt-Satz auf Wertgewinn |
| `primaryResidenceExempt` | `true` | Hauptwohnsitzbefreiung (→ 0% ImmoESt) |
| `renovationCost` | 0 € | kein Sanierungsstau in diesem Szenario |

---

## 2. Rechenweg (`runComparison`)

### Schritt 1 — `deriveStartCapital`: Startwerte ableiten

- **Kaufpreis** = 5.500 €/m² × 70 m² = **385.000 €**
- **Eigenkapital** (20%) = **77.000 €**
- **Kaufnebenkosten** = 385.000 € × (3,5 + 1,1 + 3,0 + 1,5)% = 385.000 × 9,1% = **35.035 €**
- **Kreditsumme** (nach `loanAmount` aufgelöst, da die Finanzierungsnebenkosten von
  der Kredithöhe abhängen):
  `(385.000 − 77.000 + 35.035) / (1 − 2,7%)` = **352.553,96 €**
- **Finanzierungsnebenkosten** = 352.553,96 € × (1,2 + 1,5)% = **9.518,96 €**
- **Anzahlung** (Rest des Eigenkapitals, der in den Kaufpreis fließt)
  = 77.000 − 35.035 − 9.518,96 = **32.446,04 €**
- **Startkapital = Eigenkapital = 77.000 €** — das gesamte Bargeld, das der Käufer
  einsetzt; es deckt Kaufnebenkosten, Finanzierungsnebenkosten und Anzahlung.
- **Monatsmiete** = 13,5 €/m² × 70 m² = **945 €**
- **Kaution** = 945 € × 3 = **2.835 €**
- EK-Mindestprüfung: Anzahlung ist positiv (32.446,04 € > 0) → **keine Warnung**.

### Schritt 2 — Tilgungsplan (`buildAmortizationSchedule`)

Annuität für 352.553,96 € / 3,5% / 30 Jahre (fix) → monatliche Rate ≈ **1.583,12 €**,
konstant über alle 30 Jahre (kein Zinswechsel, keine Sondertilgung). Restschuld
Jahr 30 = **0 €** (vollständig getilgt).

### Schritt 3 — Eigentümerkosten & Immobilienwert (`simulateBuyerOwnerCosts`)

- Instandhaltung Jahr 0: 1,2% von 385.000 € / 12 = **385 €/Monat** (wächst danach mit
  der Wertsteigerung, nicht nur der Inflation — eine teurere Wohnung ist teurer zu
  erhalten).
- Betriebskosten Jahr 0: 2,20 €/m² × 70 m² = **154 €/Monat** (wächst mit 2% Inflation).
- Laufende Kosten Jahr 0 gesamt: 385 + 154 = **539 €/Monat**.
- Immobilienwert wächst mit 2,5% p.a.: Jahr 0 = 385.000 € → Jahr 30 ≈ **807.563,52 €**.

### Schritt 4 — Gemeinsames Wohnbudget (`simulateMonthlyPortfolios`)

**Käufer-Startportfolio = 0 €** (gesamtes Startkapital steckt im Kauf).
**Mieter-Startportfolio = 77.000 − 2.835 (Kaution) = 74.165 €**, sofort zu 6% p.a. investiert.

Regel pro Monat:
```
sharedBudget = max(Käuferkosten, Miete)
Käufer-Sparrate = sharedBudget − Käuferkosten
Mieter-Sparrate = sharedBudget − Miete
```

In Jahr 1: Käuferkosten = 1.583,12 € (Rate) + 539,00 € (Eigentümerkosten) =
**2.122,12 €/Monat**, Miete = **945,00 €/Monat**.
`sharedBudget = 2.122,12 €` (Käufer ist deutlich teurer, u. a. wegen der
werterhaltungsbasierten Instandhaltung) → Käufer spart 0, **Mieter spart
≈ 1.177,12 €/Monat** und legt das zu 6% p.a. (monatlich verzinst) ins Portfolio.
Über die 30 Jahre verändert sich diese Differenz (Miete steigt mit Inflation,
Kreditrate bleibt fix, Eigentümerkosten steigen mit Wertsteigerung bzw. Inflation),
der Mieter bleibt aber durchgehend der Sparer.

Endwert Jahr 30 (vor Steuer): Mieter-Portfolio = **1.559.251,65 €**, Kostenbasis
(Summe Einzahlungen inkl. Startkapital) = **461.848,21 €**.

### Schritt 5 — Steuern & Verkauf (Liquidation "heute", Jahr 30)

**Käufer:**
- Immobilienwert 807.563,52 € − Restschuld 0 €
- − Maklerprovision (3%) = 24.226,91 €
- − ImmoESt: **0 €** (Hauptwohnsitzbefreiung aktiv — sonst würde die Steuer auf
  Immobilienwert minus Kaufpreis **inklusive** Kaufnebenkosten von 35.035 €
  berechnet, siehe `applySaleCosts`)
- = **783.336,61 €**

**Mieter:**
- Portfolio-Endwert 1.559.251,65 € − Kostenbasis 461.848,21 € = Gewinn 1.097.403,44 €
- KESt (27,5%) = **301.785,95 €**
- Portfolio nach Steuer = **1.257.465,71 €**
- \+ Kaution (nominal, unverzinst zurückgezahlt) = 2.835 €
- = **1.260.300,71 €**

---

## 3. Endergebnis (Jahr 30)

| | Wert |
|---|---|
| Käufer-Nettovermögen | **783.336,61 €** |
| Mieter-Nettovermögen | **1.260.300,71 €** |
| **Differenz (Käufer − Mieter)** | **−476.964,10 €** nominal |
| Differenz real (÷ 1,02³⁰, kaufkraftbereinigt) | **−263.317,99 €** |
| Breakeven-Jahr | **keiner** (`null`) |

**Interpretation:** Bei diesen Annahmen liegt **Mieten + Investieren über 30
Jahre deutlich vorne**. Der Hauptgrund: die unterstellte Anlagerendite (6%)
liegt deutlich über der Wertsteigerung der Immobilie (2,5%) — der
Zinseszins-Effekt auf die monatlich gesparte Differenz wirkt stärker als der
Wertzuwachs der Immobilie auf das gebundene Kapital. Wie empfindlich das
Ergebnis auf einzelne Annahmen reagiert (v. a. Anlagerendite und
Wertsteigerung), lässt sich am besten interaktiv im Rechner selbst prüfen.

---

## 4. Nachvollziehen / Regressionsschutz

```bash
npm test
```

→ Test `runComparison: "Golden Master" Referenzszenario (Default Wien, 30 Jahre)`
prüft alle oben genannten Endwerte sowie die Form von `results` (31 Serien-
einträge für Jahre 0–30, alle Werte endlich).
