# Entwicklungsprozess & Best Practices

Dieses Dokument legt verbindlich fest, **wie** wir an diesem Projekt arbeiten – unabhängig davon, was inhaltlich gebaut wird (siehe `SPEZIFIKATION.md`). Ziel: kleine, überprüfbare Schritte statt einer großen Implementierung, die am Ende schwer zu debuggen ist ("Negativ-Spirale").

---

## 1. Grundprinzip: Step-by-Step

- Jede Aufgabe (siehe Task-Liste) wird in **kleine, einzeln testbare Schritte** zerlegt.
- Ein Step ist so geschnitten, dass er **eine zusammenhängende Sache** tut – z.B. "eine Funktion implementieren + ihre Tests", nicht "calculator.js komplett".
- **Kein Schritt beginnt, bevor der vorherige verifiziert und freigegeben ist.** Kein "ich implementiere mal schon den Rest, während du das prüfst".

## 2. Ablauf pro Step

Für **jeden** Step gilt diese Reihenfolge:

1. **Ankündigen**: Kurz beschreiben, was der Step umfasst (welche Funktion(en), welches Verhalten) – 1-2 Sätze.
2. **Implementieren**: Nur den Code für diesen Step schreiben.
3. **Tests schreiben/ausführen**:
   - Neue Unit-Tests für die neue Logik (siehe Abschnitt 3).
   - **Alle bestehenden Tests laufen lassen** (Regressionstest) – `npm test` (= `node --test`).
4. **Ergebnis berichten**: Was wurde gebaut, welche Tests laufen, welche Werte/Outputs kamen bei Beispieleingaben raus (kurze konkrete Zahlen, keine Bauchgefühl-Aussagen wie "sollte passen").
5. **Warten auf Freigabe** des Users, bevor der nächste Step beginnt.

➡️ Kein Step gilt als "fertig", solange nicht **alle** Tests (neu + alt) grün sind.

## 3. Test-Strategie

- **Jede neue Funktion in `calculator.js` bekommt mind. 1-2 Unit-Tests**, bevor zur nächsten Funktion übergegangen wird.
- **AAA-Pattern** (Arrange – Act – Assert) für jeden Test.
- Tests laufen mit Node's eingebautem Test-Runner: `npm test` (= `node --test`; das explizite `node --test tests/` schlägt in der MSYS-Bash dieser Umgebung an der Pfad-Übersetzung fehl).
- **Regressionsschutz**: Bereits geschriebene Tests werden **nie gelöscht oder "auskommentiert", um sie grün zu kriegen**. Wenn ein bestehender Test durch eine Änderung bricht:
  - Erst klären: Ist der Test falsch (veraltete Annahme) oder der Code falsch (Bug eingebaut)?
  - Root Cause fixen, nicht den Test anpassen, um das Problem zu verstecken.
- Referenzwerte für Tests wo möglich **händisch nachrechnen** (z.B. Annuität mit bekannter Formel) statt nur "Code gegen Code" zu testen.
- Edge Cases aus der Spec (Abschnitt 5 "Verifikation" in `SPEZIFIKATION.md`) werden **mit** abgearbeitet, nicht erst am Schluss.

## 4. Umgang mit Fehlern

- Kein "Quick Fix", der das Symptom verdeckt (z.B. Toleranzen in Tests aufweichen, try/catch um unklare Fehler, Sonderfälle hardcoden).
- Bei unklaren/unerwarteten Ergebnissen: anhalten, Ursache erklären, Lösungsvorschlag bringen – **nicht** einfach weitercoden in der Hoffnung, dass es sich später löst.
- Wenn ein Fehler auf eine unklare Spec-Stelle hinweist: Rückfrage an den User, statt eine Annahme zu treffen.

## 5. Granularität & Commits

- Commits nur, wenn der User es explizit sagt (siehe globale Vorgabe).
- Wenn committet wird: **ein Step = ein Commit** (logisch zusammenhängend, beschreibende Commit-Message auf Deutsch).

## 6. Code-Stil (Ergänzung zur globalen CLAUDE.md)

- `calculator.js` bleibt **rein und DOM-frei** – keine Seiteneffekte, keine globalen Variablen, alle Abhängigkeiten als Parameter.
- Funktionssignaturen folgen den in `SPEZIFIKATION.md` Abschnitt 4 definierten Signaturen. Falls sich beim Implementieren eine Signatur als unpraktisch erweist: kurz ansprechen, gemeinsam anpassen, Spec aktualisieren – nicht stillschweigend abweichen.

---

**Kurzfassung für mich (Claude)**: Klein anfangen → Code → Tests (neu + alle alten) → Ergebnis zeigen → warten. Nie mehrere Funktionen auf einmal ohne Zwischenstopp. Nie Tests schwächen, um sie grün zu kriegen.
