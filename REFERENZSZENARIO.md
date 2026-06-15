# Referenzszenario ("Golden Master")

Dieses Dokument erklärt das **Golden-Master-Referenzszenario** aus
`tests/calculator.test.js` (`GOLDEN_MASTER_INPUTS`) im Detail: alle Eingaben,
der vollständige Rechenweg durch `runComparison()` und die Endergebnisse nach
30 Jahren. Es dient als nachvollziehbares Beispiel für die Methodik und als
Referenz, wenn sich durch spätere Änderungen Werte verschieben.

> **Hinweis:** Die hier gezeigten Zahlen sind durch den Golden-Master-Test
> regressionsgeschützt (`npm test`). Ändert sich an diesen Werten etwas, ohne
> dass die Eingaben bewusst geändert wurden, ist das ein Bug.

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
| `ownerCostsPerSqm` | 2,75 €/m²/Monat | Eigentümerkosten |
| `operatingCostsPerSqm` | 2,20 €/m²/Monat | Betriebskosten |
| `appreciationPct` | 2,5% | Wertsteigerung Immobilie p.a. |
| `rentPerSqm` | 13,5 €/m²/Monat | Miete (brutto inkl. BK) |
| `depositMonths` | 3 | Mietkaution in Monatsmieten |
| `inflationPct` | 2,0% | Inflation p.a. (Miete + Eigentümerkosten) |
| `investmentReturnPct` | 6,0% | Anlagerendite Mieter-Portfolio p.a. |
| `applyVorabpauschale` | `false` | Vorabpauschale-Haircut |
| `vorabpauschaleHaircutPct` | 0,5% | (nur falls aktiv) |
| `kestPct` | 27,5% | KESt auf Kapitalgewinne |
| `horizonYears` | 30 | Betrachtungshorizont |
| `simulateSale` | `true` | Verkauf am Ende simulieren |
| `saleBrokerFeePct` | 3,0% | Maklerprovision beim Verkauf |
| `immoEstPct` | 30% | ImmoESt-Satz auf Wertgewinn |
| `primaryResidenceExempt` | `true` | Hauptwohnsitzbefreiung (→ 0% ImmoESt) |

---

## 2. Rechenweg (`runComparison`)

### Schritt 1 — `deriveStartCapital`: Startwerte ableiten

- **Kaufpreis** = 5.500 €/m² × 70 m² = **385.000 €**
- **Eigenkapital** (20%) = **77.000 €** → **Kreditsumme** = 385.000 − 77.000 = **308.000 €**
- **Kaufnebenkosten** = 385.000 € × (3,5 + 1,1 + 3,0 + 1,5)% = 385.000 × 9,1% = **35.035 €**
- **Finanzierungsnebenkosten** = 308.000 € × (1,2 + 1,5)% = 308.000 × 2,7% = **8.316 €**
- **Startkapital gesamt** = 77.000 + 35.035 + 8.316 = **120.351 €**
- **Monatsmiete** = 13,5 €/m² × 70 m² = **945 €**
- **Kaution** = 945 € × 3 = **2.835 €**
- EK-Mindestprüfung: nötig wären 35.035 + 385.000 × 2,7% = **45.430 €**. Vorhandenes EK (77.000 €) liegt darüber → **keine Warnung**.

### Schritt 2 — Tilgungsplan (`buildAmortizationSchedule`)

Annuität für 308.000 € / 3,5% / 30 Jahre (fix) → monatliche Rate ≈ **1.383,06 €**,
konstant über alle 30 Jahre (kein Zinswechsel, keine Sondertilgung). Restschuld
Jahr 30 = **0 €** (vollständig getilgt).

### Schritt 3 — Eigentümerkosten & Immobilienwert (`simulateBuyerOwnerCosts`)

- Laufende Kosten Jahr 0: (2,75 + 2,20) €/m² × 70 m² = **346,50 €/Monat**,
  danach jährlich mit 2% Inflation indexiert.
- Immobilienwert wächst mit 2,5% p.a.: Jahr 0 = 385.000 € → Jahr 30 ≈ **807.563,52 €**.

### Schritt 4 — Gemeinsames Wohnbudget (`simulateMonthlyPortfolios`)

**Käufer-Startportfolio = 0 €** (gesamtes Startkapital steckt im Kauf).
**Mieter-Startportfolio = 120.351 − 2.835 (Kaution) = 117.516 €**, sofort zu 6% p.a. investiert.

Regel pro Monat:
```
sharedBudget = max(Käuferkosten, Miete)
Käufer-Sparrate = sharedBudget − Käuferkosten
Mieter-Sparrate = sharedBudget − Miete
```

In Jahr 1: Käuferkosten = 1.383,06 + 346,50 = **1.729,56 €/Monat**, Miete = **945,00 €/Monat**.
`sharedBudget = 1.729,56 €` (Käufer ist teurer) → Käufer spart 0, **Mieter spart
≈ 784,56 €/Monat** und legt das zu 6% p.a. (monatlich verzinst) ins Portfolio.
Über die 30 Jahre verändert sich diese Differenz (Miete steigt mit Inflation,
Kreditrate bleibt fix, Eigentümerkosten steigen mit Inflation), der Mieter
bleibt aber durchgehend der Sparer.

Endwert Jahr 30: Mieter-Portfolio = **1.351.074,09 €**, Kostenbasis (Summe
Einzahlungen inkl. Startkapital) = **324.056,80 €**.

### Schritt 5 — Steuern & Verkauf (Liquidation "heute", Jahr 30)

**Käufer:**
- Immobilienwert 807.563,52 € − Restschuld 0 €
- − Maklerprovision (3%) = 24.226,91 €
- − ImmoESt: **0 €** (Hauptwohnsitzbefreiung aktiv)
- = **783.336,61 €**

**Mieter:**
- Portfolio-Endwert 1.351.074,09 € − Kostenbasis 324.056,80 € = Gewinn 1.027.017,29 €
- KESt (27,5%) = **282.429,75 €**
- Portfolio nach Steuer = **1.068.644,34 €**
- \+ Kaution (nominal, unverzinst zurückgezahlt) = 2.835 €
- = **1.071.479,34 €**

---

## 3. Endergebnis (Jahr 30)

| | Wert |
|---|---|
| Käufer-Nettovermögen | **783.336,61 €** |
| Mieter-Nettovermögen | **1.071.479,34 €** |
| **Differenz (Käufer − Mieter)** | **−288.142,73 €** nominal |
| Differenz real (÷ 1,02³⁰, kaufkraftbereinigt) | **−159.075,21 €** |
| Breakeven-Jahr | **keiner** (`null`) |

**Interpretation:** Bei diesen Annahmen liegt **Mieten + Investieren über 30
Jahre vorne**. Der Hauptgrund: die unterstellte Anlagerendite (6%) liegt
deutlich über der Wertsteigerung der Immobilie (2,5%) — der Zinseszins-Effekt
auf die monatlich gesparte Differenz wirkt stärker als der Wertzuwachs der
Immobilie auf das gebundene Kapital. Wie empfindlich das Ergebnis auf einzelne
Annahmen reagiert, soll später über die Sensitivitätsanzeige (Phase D3)
interaktiv erkundbar sein.

---

## 4. Nachvollziehen / Regressionsschutz

```bash
npm test
```

→ Test `runComparison: "Golden Master" Referenzszenario (Default Wien, 30 Jahre)`
prüft alle oben genannten Endwerte sowie die Form von `results` (31 Serien-
einträge für Jahre 0–30, alle Werte endlich).
