# Spezifikation: "Mieten vs. Kaufen"-Rechner für Österreich

**Version 3** – finalisiert nach mehreren externen fachlichen Reviews (Österreich-Spezifika, symmetrisches Investmentmodell, Mobile-First/Alpine.js, Mietkaution, reale Kennzahlen). Spec wird ab hier eingefroren – Umsetzung beginnt.

## Context

Anlass ist eine wiederkehrende emotionale Diskussion im Freundeskreis ("Mieten ist verbranntes Geld") sowie der Fynup-Artikel zum Thema. Ziel ist ein **transparenter, rein finanzieller Vergleichsrechner** für den österreichischen Markt (Fokus Ballungsräume), der:
- Eingabeparameter mit sinnvollen Österreich-Durchschnittswerten vorbelegt, aber vollständig anpassbar lässt
- die Berechnungsmethodik offen erklärt (jede Annahme muss begründbar sein)
- als eigenständiges, neues Repository mit statischer GitHub-Pages-Seite umgesetzt wird (kein Server nötig)

---

## 1. Finanzmodell (Kernlogik)

**Methode: Symmetrischer Opportunity-Cost-Vermögensvergleich** + **Cashflow-Verlauf** + **Sensitivitätsanalyse**

### 1.1 Startkapital
Beide Seiten benötigen denselben "Eintrittspreis": das Kapital, das der Käufer sofort aufbringen muss.

```
Eigenkapital            = EK-Quote × Kaufpreis
Kreditsumme             = Kaufpreis − Eigenkapital
Kaufnebenkosten         = Kaufpreis × (GrESt + Grundbuch + Makler + Notar)
Finanzierungsnebenkosten = Kreditsumme × (Pfandrecht + Bankbearbeitung)   [NEU]
Startkapital            = Eigenkapital + Kaufnebenkosten + Finanzierungsnebenkosten
```

- **Käufer** bringt das Startkapital auf und kauft die Immobilie.
- **Mieter** investiert das Startkapital zu Beginn in sein Portfolio (Opportunity Cost).

### 1.2 Laufende Kosten
- **Käufer:** Kreditrate (Annuität, ggf. Zinswechsel/Sondertilgung) + Eigentümerkosten (**€/m²/Monat**, siehe 2.3 – **nicht** mehr % vom Marktwert) + Betriebskosten (**€/m²/Monat**, siehe 2.3 [NEU])
- **Mieter:** Miete brutto inkl. Betriebskosten (steigt mit Inflation)

Betriebskosten (Müll, Wasser, Hausbesorger etc.) fallen für **jeden Bewohner** an, unabhängig von Eigentum/Miete. Sie werden dem Käufer explizit zugeschlagen, beim Mieter stecken sie bereits in der Bruttomiete. **Wichtig (Klarstellung):** Das hebt sich in der `diff`-Berechnung (1.3) *nicht* automatisch auf null auf – wir ziehen dem Mieter keinen separaten BK-Anteil ab. Die BK sind nur dann für den Vergleich **fair/symmetrisch**, wenn der in der Bruttomiete enthaltene BK-Anteil ungefähr `operatingCostsPerSqm × Fläche` entspricht (was wir als plausible Annahme ansetzen). Ihr Hauptzweck bleibt: die angezeigten absoluten Monatskosten realistisch und vergleichbar zu machen (Cashflow-Chart, Leistbarkeits-Check). Setzt man die BK auf beiden Seiten gleich an, bleibt die `diff` praktisch unverändert – fairerweise tragen aber beide Seiten BK.

### 1.3 Symmetrisches Investment-Portfolio [NEU – ersetzt das alte "Mieter investiert Differenz"-Modell]

**Zentrale Modellannahme (explizit):** Beide Seiten haben in jedem Monat dasselbe verfügbare "Wohnbudget" in Höhe der jeweils **teureren** Option. Wer in einem Monat günstiger wohnt, spart die Differenz und legt sie an – niemand "konsumiert" die Ersparnis. Diese Gleich-Budget-Annahme ist die Voraussetzung dafür, dass der Vermögensvergleich fair ist (sonst verglichen wir unterschiedliche Sparquoten statt Wohnformen).

Jeden **Monat** wird verglichen, wessen laufende Kosten höher sind. Wer **weniger** zahlt, legt die Differenz in ein eigenes Portfolio:

```
diff_Monat = Käuferkosten_Monat − Miete_Monat

diff > 0  → Mieter zahlt weniger  → Mieter-Portfolio += diff
diff < 0  → Käufer zahlt weniger  → Käufer-Portfolio += −diff
```

- **Käufer-Portfolio** startet bei 0 (sein ganzes Kapital steckt in der Immobilie)
- **Mieter-Portfolio** startet beim **Startkapital** (1.1) **minus Mietkaution [NEU, siehe 2.4]** – die Kaution ist gebunden, wird nicht investiert und unverzinst am Ende des Horizonts zum Mieter-Nettovermögen zurückaddiert (1.5)
- Beide Portfolios verzinsen sich mit derselben Anlagerendite und unterliegen derselben Besteuerung (siehe 1.4)

Das ist die Korrektur zum alten Modell, in dem der Mieter bei negativem Delta (z.B. wenn die Miete durch Inflation die fixe Kreditrate übersteigt) implizit aus seinem Portfolio "entnehmen" musste – das hätte realisierte KESt-pflichtige Verkäufe unterstellt, die so nicht spezifiziert waren. Jetzt behält jede Seite ihr eigenes Portfolio.

**Emergentes Verhalten bei vollständiger Tilgung [NEU, zur Klarstellung]**: Sobald die Restschuld 0 erreicht (regulär am Laufzeitende oder früher durch Sondertilgung, siehe 2.2), fällt die Kreditrate auf 0 € – `buildAmortizationSchedule` cappt Tilgung/Sondertilgung ohnehin auf die Restschuld, sodass diese nie negativ wird. Dadurch sinken die Käuferkosten/Monat automatisch unter die Miete, und die Differenz fließt ab diesem Zeitpunkt **automatisch** über den bestehenden `diff`-Mechanismus ins Käufer-Portfolio – keine Sonderbehandlung nötig. Dieses Verhalten wird als expliziter Testfall in Abschnitt 5 verifiziert.

#### Monatliche Granularität [NEU]

Miete und Kreditrate werden real **monatlich** gezahlt – eine jährliche Einmalbuchung würde dem Portfolio den unterjährigen Zinseszinseffekt monatlicher Sparraten vorenthalten und über 30 Jahre spürbar verfälschen. Daher gilt verbindlich:

- `simulateInvestmentPortfolio` rechnet auf **Monatsbasis** mit dem monatlichen Zinsfaktor `q = 1 + p_pa / 12` (dieselbe vereinfachte Umrechnung wie bereits bei der Annuitätenberechnung verwendet)
- Käuferkosten/Monat = Kreditrate (aus dem ohnehin monatlich rechnenden Tilgungsplan) + Eigentümerkosten/Monat + Betriebskosten/Monat (2.3, beide direkt in €/m²/Monat gegeben)
- Miete/Monat = Jahresmiete (brutto inkl. BK) / 12 (innerhalb eines Jahres konstant, Anpassung nur an Jahresgrenzen durch Inflationsindexierung)
- Die Immobilien-Wertsteigerung (2.3) bleibt jährlich, da sie nur das Endvermögen am Horizont-Ende beeinflusst, nicht die monatlichen Cashflows
- Chart.js erhält für die Visualisierung nur **Jahres-Datenpunkte** (Portfolio-/Vermögenswert am Ende jedes Jahres) – die monatliche Rechnung ist ein internes Detail von `calculator.js`

### 1.4 Besteuerung der Portfolios

- **KESt 27,5%** auf den kumulierten Gewinn (`max(0, Wert − Kostenbasis)`, für beide Portfolios identisch). **Timing-Klarstellung (siehe Architektur-Entscheidung D1):** Für die **Bottom-Line in Jahr N** wird die KESt einmal am Horizont-Ende angewandt. Für die **Verlaufs-Serie und den Breakeven** wird jeder Jahres-Datenpunkt nach dem Prinzip "Liquidation in genau diesem Jahr" berechnet – d.h. die bis dahin aufgelaufene KESt wird *je Jahr* abgezogen. Beides ergibt im Jahr N denselben Wert; die Serie ist dadurch knickfrei und fair vergleichbar.
- **Vorabpauschale-Toggle [NEU]**: Checkbox "Laufende Besteuerung thesaurierender Fonds berücksichtigen (österreichische Vorabpauschale)". Wenn aktiv, wird die nominale Anlagerendite für **beide** Portfolios um einen editierbaren Haircut reduziert (Default **0,5 %-Punkte**). Infotext erklärt: die Vorabpauschale besteuert jährlich einen pauschalen Mindestertrag thesaurierender Fonds, auch wenn nichts verkauft wird – das dämpft den Zinseszinseffekt etwas. Der Haircut ist eine Vereinfachung dieses Effekts, keine exakte Nachbildung (die echte Vorabpauschale hängt vom jährlich wechselnden Basiszinssatz ab). **Ehrlicher Hinweis im Infotext:** In der Realität wird die jährlich vorausgezahlte Vorabpauschale bei der finalen KESt **angerechnet** (keine Doppelbesteuerung). Unser Modell rechnet den Renditeabschlag **zusätzlich** zur vollen End-KESt – die Variante mit aktiviertem Toggle ist daher bewusst **konservativ/leicht pessimistisch** für die Anlage-Seite, nicht exakt.

### 1.5 Endvermögen (Jahr N)

```
Käufer-Nettovermögen = Immobilienwert − Restschuld [− Verkaufskosten/-steuer]
                        + Käufer-Portfolio (nach Steuer)

Mieter-Nettovermögen = Mieter-Portfolio (nach Steuer) + Mietkaution [NEU]
```

Verkaufskosten/-steuer (Maklerprovision 3%, ImmoESt 30% mit Hauptwohnsitzbefreiung) optional über "Verkauf simulieren?". **Analog zur KESt (1.4) gilt das "Liquidation-heute"-Prinzip auch hier:** Ist "Verkauf simulieren" aktiv, werden Maklerprovision und ggf. ImmoESt in **jedem** Jahr der Verlaufs-Serie auf den dann gültigen Immobilienwert angewandt (nicht nur im Schlussjahr) – sonst hätte die Käuferlinie am Ende einen künstlichen Knick.

### 1.6 Output
- **Bottom Line**: Differenz Käufer- vs. Mieter-Nettovermögen nach N Jahren + Breakeven-Jahr (ein einziges, siehe unten)
- **Kaufkraftbereinigung [NEU]**: Jeder Endvermögens-Betrag wird **immer zusätzlich** als heutiger Realwert angezeigt (kein Toggle, beide Werte stehen nebeneinander, z.B. "Nominal: 500.000 € (entspricht heute ca. 276.000 € Kaufkraft)"). Formel: `Realwert = Nominalwert_Jahr_N / (1 + Inflation)^N`. Begründung im Infotext: Inflation reduziert die Kaufkraft über lange Horizonte erheblich – ein rein nominaler Vergleich würde Laien in die Irre führen
- **Nur EIN Breakeven-Jahr (Klarstellung, vormals "realer Breakeven" verworfen):** Es gibt bewusst **kein** separates "Breakeven (real)". Grund: Die Realwert-Diskontierung teilt in jedem Jahr *beide* Vermögensserien durch denselben positiven Faktor `(1+Inflation)^y`. Das Vorzeichen der Differenz `Käufer − Mieter` bleibt dadurch in jedem Jahr unverändert (`diff_real_y = diff_nominal_y / (1+Inflation)^y`), also ist das reale Breakeven-Jahr **mathematisch immer identisch** zum nominalen. Ein zweiter Wert würde nur Scheingenauigkeit suggerieren. Die Realwerte sind ausschließlich für die **Endwert-/Verlaufs-Anzeige** (Kaufkraft) relevant, nicht für ein eigenes Breakeven.
- **Vermögens-Verlaufsdiagramm**: beide Nettovermögen über die Jahre (nominal; optional zweite Linie real – siehe Sensitivitätsanzeige)
- **Cashflow-Diagramm**: Käuferkosten (inkl. Betriebskosten) vs. Miete über die Jahre
- **Sensitivitätsanzeige**: Was-wäre-wenn-Slider für Wertsteigerung, Zins, Anlagerendite

---

## 2. Eingabeparameter & Berechnungslogik im Detail

### 2.1 Immobilie & Kauf
| Parameter | Default-Logik |
|---|---|
| Region/Preset | Dropdown: Wien, Graz, Linz, Salzburg, Innsbruck, Österreich-Ø |
| Kaufpreis/m² | aus Preset, editierbar |
| Wohnfläche (m²) | Default 70 m², editierbar |
| Kaufnebenkosten | Itemisiert, editierbar: Grunderwerbsteuer 3,5%, Grundbucheintragung 1,1%, Makler 3,0%, Notar/Rechtsanwalt 1,5% → Default-Summe ≈ 9,1% vom Kaufpreis |

### 2.2 Finanzierung
| Parameter | Default-Logik |
|---|---|
| Eigenkapitalquote | Default 20% des Kaufpreises |
| **Mindest-Eigenkapital-Validierung [NEU]** | Mindest-EK = Kaufnebenkosten + Finanzierungsnebenkosten (≈11,8% vom Kaufpreis bei den Default-Sätzen). Falls die eingegebene Eigenkapitalquote × Kaufpreis darunter liegt: Warnhinweis "Mindest-Eigenkapital beträgt X € (Nebenkosten werden von Banken praktisch nicht mitfinanziert, keine 110%-Finanzierung)" und automatisches Anheben der EK-Quote auf den Mindestwert |
| **Finanzierungsnebenkosten [NEU]** | Itemisiert, % der **Kreditsumme**: Pfandrechtseintragung 1,2%, Bankbearbeitungsgebühr 1,5% → Default-Summe ≈ 2,7% der Kreditsumme. Infotext erklärt: Pfandrecht wird oft auf 120% der Kreditsumme (Höchstbetragshypothek) berechnet – 1,2% ist bereits eine vereinfachte Pauschale auf die Kreditsumme |
| Zinsmodell | Toggle "fix" / "variabel" |
| Zinssatz (fix) | Default 3,5% p.a., Annuitätendarlehen |
| Zinssatz variabel | Startzins (Default 3,5%) + "Wechsel nach X Jahren" (Default 10) → neuer Zinssatz (Default 5,0%); Annuität wird bei Wechsel auf Restschuld/Restlaufzeit neu berechnet |
| Kreditlaufzeit | Default 30 Jahre, Slider 10–35 |
| **Jährliche Sondertilgung [NEU, Phase 2/optional]** | Default 0€. Falls > 0: wird am Jahresende von der Restschuld abgezogen (gecappt bei Restschuld). Verkürzt effektiv die Tilgungsdauer, Annuität bleibt sonst unverändert |

**Edge-Case-Tabelle Annuität/Zinswechsel/Sondertilgung [NEU, zur Klarstellung]** – konsolidiert bereits getroffene Festlegungen, keine neue Logik:

| Fall | Verhalten |
|---|---|
| Zinswechsel (variabel) | Annuität wird zu Beginn des Wechseljahres auf Basis von Restschuld, Restlaufzeit und neuem Zinssatz neu berechnet (`calculateAnnuityPayment`) |
| Sondertilgung | Wird am **Jahresende** von der Restschuld abgezogen, gecappt bei Restschuld (nie negativ). Annuität bleibt bis zum nächsten Zinswechsel bzw. bis zur planmäßigen Neuberechnung unverändert – die Laufzeit verkürzt sich faktisch |
| Restschuld erreicht 0 (regulär oder durch Sondertilgung) | Kreditrate fällt ab diesem Zeitpunkt auf 0 €; `buildAmortizationSchedule` liefert für Folgejahre `monthlyPayment = 0`, `interestPaid = principalPaid = 0` (siehe 1.3 "Emergentes Verhalten") |
| Tilgungs-Endjahr (Restschuld wird < reguläre Jahrestilgung) | `interestPaid + principalPaid` < `monthlyPayment × 12`; für die monatliche Portfolio-Simulation wird `(interestPaid+principalPaid)/12` als Monatsrate dieses Jahres verwendet (siehe Signatur in Abschnitt 4) |
| Horizont < Kreditlaufzeit | Restschuld am Horizont-Ende ist > 0 und fließt in `Käufer-Nettovermögen = Immobilienwert − Restschuld` ein |
| Horizont > Kreditlaufzeit | Ab dem Jahr nach Tilgungsende gilt `monthlyPayment = 0` (wie Volltilgungsfall) |

### 2.3 Laufende Kosten Eigentum [GEÄNDERT]
| Parameter | Default-Logik |
|---|---|
| Eigentümerkosten | **€/m²/Monat** statt % vom Marktwert. Default **2,75 €/m²/Monat** (Aufschlüsselung im Infotext: Instandhaltungsrücklage ~1,3€, Versicherung ~0,3€, Grundsteuer ~0,2€, Verwaltung/Sonstiges ~0,95€). Steigt jährlich mit der **Inflationsrate** (nicht mit der Wertsteigerung) – begründet durch Bezug zu Baukosten/Lohnkosten statt Grundstücksspekulationswert. Wert ist bundesweit ähnlich, daher **kein** regionales Preset-Feld |
| **Betriebskosten [NEU]** | **€/m²/Monat**, Default **2,20 €/m²/Monat** (Müll, Wasser, Hausbesorger/Allgemeinstrom etc.). Steigt mit der Inflationsrate. Wird zu den Käuferkosten addiert; die Miete (2.4) ist bereits brutto inkl. BK. Der Posten ist **fair/symmetrisch** (nicht exakt "neutral"): beide Seiten tragen BK, sofern der in der Bruttomiete enthaltene BK-Anteil ≈ `2,20 €/m² × Fläche` entspricht – wir setzen das als plausible Annahme an (siehe Klarstellung 1.2). Zweck: realistische, vergleichbare absolute Monatskosten in Cashflow-Chart und Leistbarkeits-Check |
| Wertsteigerung Immobilie p.a. | aus Preset, editierbar (betrifft nur den Immobilienwert, nicht die Eigentümer-/Betriebskosten). **Negative Werte sind explizit zulässig [NEU]** – das Eingabefeld erlaubt Werte < 0% (z.B. -1%), um Wertverlust-Szenarien abzubilden. Kein Code-Sonderfall: `propertyValue *= (1 + appreciationPct/100)` funktioniert für negative Prozentwerte unverändert. Die Sensitivitätsanzeige (1.6) enthält dafür ein Beispiel-Preset "Wertverlust (-1%)" |

### 2.4 Miete
| Parameter | Default-Logik |
|---|---|
| Monatsmiete (kalt+BK) | aus Preset (Miete/m² × Wohnfläche), editierbar |
| Mietsteigerung p.a. | = Inflationsrate (gekoppelt, siehe 2.5) |
| **Mietkaution [NEU]** | Default **3 Monatsmieten** (kalt), editierbar. Wird vom Mieter-Startkapital abgezogen, nicht investiert/verzinst, und am Ende des Horizonts unverändert zum Mieter-Nettovermögen zurückaddiert (siehe 1.3, 1.5). Infotext: Kaution ist in Österreich übliche Praxis (meist 3–6 Monatsmieten), Rückzahlung bei Auszug vorausgesetzt |

### 2.5 Annahmen (gemeinsam)
| Parameter | Default-Logik |
|---|---|
| Inflation p.a. | Default 2,0% |
| Anlagerendite (beide Portfolios) | Default 6,0% nominal, editierbar |
| **Vorabpauschale-Haircut [NEU]** | Checkbox (Default: aus). Wenn aktiv: zusätzliches Eingabefeld Haircut in %-Punkten, Default 0,5. Reduziert effektive Anlagerendite für beide Portfolios |
| KESt auf Portfolio-Gewinne | fix 27,5%, am Ende auf realisierten Gesamtgewinn (beide Portfolios) |
| Betrachtungshorizont | Default = Kreditlaufzeit, frei änderbar via Slider 5–35 Jahre |
| Verkauf simulieren? | Checkbox (**Default: aktiv**). Falls aktiv: Maklerprovision 3% + ImmoESt 30% (Hauptwohnsitzbefreiung-Checkbox, Default aktiv → 0% Steuer). **Begründung des Defaults:** Nur wenn *beide* Seiten zum Vergleichszeitpunkt liquidiert werden (Immobilie verkaufen vs. Portfolio mit KESt auflösen), vergleichen wir gleiche Einheiten ("verfügbares Geld in der Hand"). Würde man die Immobilie brutto bewerten, das Portfolio aber netto, wäre der Vergleich verzerrt. Wer plant, nie zu verkaufen, kann die Checkbox deaktivieren – dann wird der Immobilienwert brutto (ohne Makler/Steuer) angesetzt. Mit Hauptwohnsitzbefreiung trägt der Käufer im Default nur die Maklerprovision, keine ImmoESt |

### 2.6 Leistbarkeits-Check [NEU, Phase 2/optional]
| Parameter | Default-Logik |
|---|---|
| Haushaltsnettoeinkommen (monatlich) | Optional, Default leer. Falls ausgefüllt: Anzeige "Deine Kreditrate (Jahr 1) entspricht X% deines Haushaltsnettoeinkommens" mit Hinweis, dass Banken eine Rate von üblicherweise max. ~30–40% als nachhaltig finanzierbar einstufen (informeller Richtwert; die frühere KIM-V-Vorgabe von 40% ist seit Mitte 2025 ausgelaufen und nicht mehr gesetzlich verpflichtend) |

### 2.7 Regionale Presets (Platzhalter – bei Umsetzung zu verifizieren)

| Region | Kaufpreis Bestand €/m² | Miete (brutto inkl. BK) €/m² | Wertsteigerung p.a. (Annahme) |
|---|---|---|---|
| Wien | ~5.500 | ~13–14 | 2,5% |
| Graz | ~4.000–5.000 | ~11 | 2,5% |
| Linz | ~3.800 (Schätzung) | ~10 | 2,0% |
| Salzburg | ~5.000–6.500 | ~14 | 2,5% |
| Innsbruck | ~5.700–6.500 | ~14 | 2,5% |
| Österreich-Ø | ~3.000–3.500 | ~10 | 2,0% |

Quellen: [Immobilienpreise Österreich 2025](https://blog.soldd.com/immobilienpreise-%C3%B6sterreich-2025), [immopreise.at](https://www.immopreise.at/), [INFINA Mietpreisentwicklung](https://www.infina.at/trends/entwicklung-der-mietpreise/), [Richtwertmietzins INFINA](https://www.infina.at/ratgeber/richtwertmietzins/). Bei Umsetzung pro Stadt konkrete Einzelquellen mit Datum im README zitieren, inkl. Hinweis "Richtwerte Stand 2025/2026, bitte selbst prüfen/anpassen".

---

## 3. UI/UX-Struktur [Mobile-First, NEU]

Da B2C-Nutzer überwiegend mobil zugreifen, ist das Layout **Mobile-First**:

1. **Header**: Titel, kurze Einleitung ("rein finanzieller Vergleich, andere Faktoren bewusst ausgeblendet")
2. **Sticky Bottom-Line-Bar**: zeigt jederzeit das aktuelle Ergebnis ("Kaufen ist um X € günstiger/teurer") + Breakeven-Jahr, auch während man scrollt
3. **Eingabebereich als Tabs/Akkordeons** (statt langer Scroll-Liste):
   - Tab 1: Immobilie & Kauf (2.1)
   - Tab 2: Finanzierung (2.2)
   - Tab 3: Laufende Kosten & Miete (2.3, 2.4)
   - Tab 4: Annahmen & Verkauf (2.5, 2.6 optional)
   - Jedes Feld mit Info-Icon/Tooltip, das die Annahme erklärt
4. **Ergebnisbereich** (live aktualisiert):
   - Vermögens-Verlaufsdiagramm (Chart.js, `maintainAspectRatio: false` für Mobile)
   - Cashflow-Diagramm
   - Sensitivitäts-Sliders
5. **Erklär-/Methodik-Bereich** (eigene Sektion/Tab): Formel-Erklärung, Annahmen, Quellen, Disclaimer

---

## 4. Tech-Stack & Projektstruktur

**Neues, eigenständiges Repository** (`miete-oder-kauf-rechner`), Hosting via GitHub Pages.

Stack: **HTML/CSS + Vanilla-JS-Module** für die Berechnungslogik + **Alpine.js (CDN)** für UI-Reaktivität/State-Binding + **Chart.js (CDN)** für Diagramme. Keine Build-Pipeline.

**Begründung Alpine.js [NEU]**: Bei ~30 interagierenden Parametern (Zinswechsel → neue Annuität → Cashflow → zwei Portfolios → Charts) würde reines Vanilla JS mit manuellen Event-Listenern schnell unübersichtlich. Alpine bindet Eingabefelder direkt per `x-model` an ein reaktives State-Objekt, das bei Änderung automatisch `calculator.js` neu aufruft. `calculator.js` bleibt dabei eine reine, DOM-freie Funktionsbibliothek – Trennung Logik/UI bleibt erhalten.

**Alpine-State-Struktur [NEU]**: Um zyklische Reaktivitäts-Schleifen zu vermeiden, ist der State strikt zweigeteilt:
- `inputs`: alles, was der Nutzer direkt eingibt/togglet (Kaufpreis, EK-Quote, Zinssatz, Checkboxen, ...) – einzige Quelle für `x-model`-Bindings
- `results`: read-only, abgeleitet via `Alpine.effect()`/`x-effect` bei jeder `inputs`-Änderung durch einmaligen Aufruf von `runComparison(inputs)` aus `calculator.js`. Templates lesen `results.*` nur lesend, nie schreibend – verhindert, dass ein Ergebnis-Wert wieder einen Input verändert und eine Endlosschleife auslöst

**Chart.js Re-Rendering [NEU]**: Bei jedem `inputs`-Update wird die bestehende Chart.js-Instanz **nicht** via `chart.destroy()` neu erzeugt (Memory-Leak/Flacker-Risiko auf Mobile), sondern `chart.data.datasets[i].data` wird mit den neuen `results`-Werten überschrieben und anschließend `chart.update()` aufgerufen.

```
miete-oder-kauf-rechner/
├── index.html              # Alpine x-data + Tabs/Sektionen
├── css/style.css           # Mobile-First Styles
├── js/
│   ├── calculator.js       # reine Berechnungsfunktionen (Annuität, Tilgungsplan, symm. Portfolios, Breakeven, Verkauf) – testbar
│   ├── presets.js          # Regionale Default-Daten (2.7)
│   ├── charts.js           # Chart.js-Rendering
│   └── app.js               # Alpine-Komponente: state, watchers, ruft calculator.js auf
├── tests/
│   └── calculator.test.js  # Unit-Tests (Node Test Runner)
├── README.md                # Methodik, Annahmen, Quellen, Disclaimer (Deutsch)
└── .github/workflows/pages.yml
```

### Kernfunktionen in `calculator.js` (Signaturen, aktualisiert)
- `calculateAnnuityPayment(principal, annualRatePct, remainingMonths) → monthlyPayment`
- `buildAmortizationSchedule({ loanAmount, loanTermYears, rateModel, interestRatePct, variableSwitchYear, variableRatePct, horizonYears, annualExtraRepayment }) → [{year, monthlyPayment, interestPaid, principalPaid, endBalance}]` – `monthlyPayment` ist die in diesem Jahr gültige Annuitätsrate (ändert sich nur bei Zinswechsel); im Tilgungs-Endjahr ist `interestPaid+principalPaid` ggf. kleiner als `monthlyPayment×12` (Restschuld < reguläre Tilgung) – für die monatliche Portfolio-Simulation wird in diesem Jahr vereinfachend `(interestPaid+principalPaid)/12` als Monatsrate verwendet
- `simulateBuyerOwnerCosts(inputs) → [{year, propertyValue, monthlyOwnerCosts}]` – Eigentümerkosten/Monat (2.3, inflationsindexiert), Immobilienwert (jährlich, wertsteigerungsindexiert)
- `simulateMonthlyPortfolios(inputs, amortization, ownerCosts) → { buyerPortfolioByYear: [{year, value, costBasis}], renterPortfolioByYear: [{year, value, costBasis}] }` – läuft **monatlich** über den gesamten Horizont (`q = 1 + p_pa/12`, inkl. Vorabpauschale-Haircut), berechnet pro Monat `diff = Käuferkosten_Monat − Miete_Monat`. Führt je Portfolio neben dem Wert auch die **Kostenbasis** (Summe der Einzahlungen) mit, damit die KESt nur auf den Gewinn `max(0, value − costBasis)` greift. Schreibt Jahres-Endwerte für Charts/weitere Berechnung
- `applyCapitalGainsTax(portfolioSeries, kestPct) → netWealthSeries` – wendet KESt auf `max(0, value − costBasis)` je Jahres-Datenpunkt an ("Liquidation-heute", siehe 1.4)
- `applySaleCosts(propertyValue, originalPrice, remainingDebt, brokerFeePct, taxRate, isPrimaryResidence) → netProceeds`
- `findBreakevenYear(buyerNetWealthSeries, renterNetWealthSeries) → year | null` – **ein** Aufruf auf den nominalen Netto-Serien. Kein separater realer Breakeven (mathematisch identisch, siehe 1.6)
- `runComparison(inputs) → results` – Rückgabe ist das vollständige `results`-Objekt gemäß **ARCHITEKTUR.md §4.2** (Kennzahlen nominal+real, `series`, `derived`, `warnings`). Diese reiche Struktur ist maßgeblich; ältere Kurzformen sind überholt

---

## 5. Verifikation

- Unit-Tests für Kernformeln: Annuität, Tilgungsplan (inkl. Zinswechsel + Sondertilgung), symmetrisches Portfolio (beide Richtungen: Käufer spart UND Mieter spart), Vorabpauschale-Haircut, Breakeven (ein nominaler Wert), Verkaufskosten, Mietkaution (Abzug vom Startkapital + Rückaddition am Ende)
- Optional/Regressionsschutz: ein Test, der belegt, dass das reale Breakeven-Jahr (auf diskontierten Serien) mit dem nominalen übereinstimmt – dokumentiert die bewusste Entscheidung gegen einen separaten Realwert (1.6)
- Unit-Test, der **monatliche vs. jährliche Verzinsung** vergleicht: bei identischer effektiver Jahresrendite muss die monatliche Sparplan-Simulation über z.B. 30 Jahre einen spürbar höheren Endwert liefern als eine jährliche Einmalbuchung – belegt, dass `simulateMonthlyPortfolios` tatsächlich monatlich akkumuliert
- Manuelles Testen im Browser (Mobile- und Desktop-Viewport):
  - Alle 6 Presets durchklicken, plausible Default-Ergebnisse prüfen
  - Edge Cases: Eigenkapital 0%/100%, sehr kurzer/langer Horizont, variabler Zinswechsel, Sondertilgung > 0, Vorabpauschale-Toggle an/aus, "Verkauf simulieren" an/aus, Hauptwohnsitzbefreiung an/aus
  - Szenario, in dem Miete die Käuferkosten in späten Jahren übersteigt → Käufer-Portfolio sollte wachsen
  - Live-Update bei Eingabeänderung ohne Page-Reload
- GitHub Pages Deployment testen

---

## Phase 2 / Optionale Erweiterungen (nicht MVP-blockierend)
- Jährliche Sondertilgung (2.2)
- Leistbarkeits-Check / Haushaltsnettoeinkommen (2.6)

## Erwogen, aber bewusst nicht umgesetzt [NEU]
Aus dem 4. externen Review wurden folgende Punkte geprüft und **nicht** in die Spezifikation übernommen, um den Fokus "rein finanzieller Vergleich, transparent, nicht überwältigend" zu wahren:
- **Separater Sanierungs-/Großreparaturkosten-Block**: überlappt mit der bereits enthaltenen Instandhaltungsrücklage in den Eigentümerkosten (2.3) – ein zusätzlicher Block würde unrealistische Prognose-Genauigkeit suggerieren
- **Liquiditätsreserve/Notgroschen-Pflichtfeld**: gehört zur Haushalts-/Budgetplanung, nicht zum Vermögensvergleich – ggf. später Teil des optionalen Leistbarkeits-Checks (2.6)
- **Verpflichtende Base/Best/Worst-Case-Szenarien**: überlappt mit der vorhandenen Sensitivitätsanzeige (1.6); feste Szenario-Presets könnten später eine UI-Vereinfachung der Sensitivität sein, sind aber kein eigenständiger Spec-Punkt
- **Präzisere Steuerlogik (Anlageart, ausschüttend/thesaurierend)**: bewusste Vereinfachung via Vorabpauschale-Haircut (1.4) – exakte Nachbildung würde Transparenz für Laien verschlechtern
- **Ampel-/Cashflow-Leistbarkeitssystem mit mehreren Kennzahlen**: würde das Tool von "Vermögensvergleich" zu "Budgetplaner" verschieben; der optionale Leistbarkeits-Check (2.6) reicht für den definierten Scope

## Offene Punkte
- Exakte Quellenangaben pro Region bei Umsetzung verifizieren (Recherche lieferte z.T. nur Bandbreiten)
