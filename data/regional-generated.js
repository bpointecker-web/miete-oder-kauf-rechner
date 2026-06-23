// AUTO-GENERIERT von data/regional.json — nicht manuell bearbeiten
export const REGIONAL_DATA = {
  "meta": {
    "schemaVersion": 1,
    "comment": "Regionale Ausgangsdaten mit Provenienz. 'anchor' = einmalig gesetzte Startwerte mit Quelle (nur manuell aendern). 'computed' = vom Script scripts/update-data.mjs automatisch fortgeschrieben. NICHT computed-Werte von Hand editieren.",
    "anchorDate": "2026-06",
    "index": {
      "source": "Eurostat prc_hpi_q (geo=AT, purchase=TOTAL, unit=I10_Q, Basis 2010=100)",
      "apiUrl": "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hpi_q?format=JSON&geo=AT&purchase=TOTAL&unit=I10_Q&lang=EN",
      "anchorIndexValue": 219,
      "anchorIndexQuarter": "2025-Q4",
      "appreciationMode": "10y_avg",
      "appreciationNote": "appreciationPct = gleitender Schnitt der jaehrlichen Aenderungsrate (Eurostat unit=RCH_A) ueber die letzten 40 Quartale (10 Jahre). National, nicht stadtspezifisch. 10J-Schnitt bevorzugt, da langfristiger Vergleichsrechner nicht von kurzfristigen Preisboom-Phasen verzerrt werden soll."
    },
    "lastAutoUpdate": {
      "timestamp": "2026-06-16T07:56:11.070Z",
      "currentIndexQuarter": "2025-Q4",
      "currentIndexValue": 219,
      "scaleFactor": 1,
      "appreciationPct": 5.38,
      "appreciationBasisQuarters": 40
    }
  },
  "regions": {
    "wien": {
      "label": "Wien",
      "anchor": {
        "pricePerSqm": 5500,
        "rentalYieldPct": 2.9,
        "appreciationPct": 3,
        "appreciationNote": "A-Lage: Inflation+Reallohn-Basis (2,5 %) + Aufschlag 0,5 % für strukturellen Flächenmangel und anhaltenden Netto-Zuzug. Eurostat 10J-Schnitt (inkl. Corona-Boom) steht in computed.appreciationPct.",
        "source": "selfimmo.at/wohnungsboerse.net Mai 2026: 5.512 EUR/m2 (Angebotspreise); RE/MAX ImmoSpiegel 2025: 5.512 EUR/m2. Miete abgeleitet: 2,9 % Rendite = ~13,3 EUR/m2/Mon. (plausibel, WKO-Bandbreite Wien: 8-14 EUR/m2).",
        "asOf": "2026-06"
      },
      "computed": {
        "pricePerSqm": 5500,
        "appreciationPct": 5.38,
        "indexScaleFactor": 1
      }
    },
    "graz": {
      "label": "Graz",
      "anchor": {
        "pricePerSqm": 4200,
        "rentalYieldPct": 2.6,
        "appreciationPct": 2.5,
        "appreciationNote": "Konservativer Langfrist-Default.",
        "source": "selfimmo.at/wohnungsboerse.net Mai 2026: 4.406 EUR/m2 (Angebotspreise); soldd.com Sept 2025: 3.800-4.500 Bandbreite; WKO Preisspiegel 2026: 3.690 EUR/m2 (Transaktionen). Miete: WKO 2026: 8,05 EUR/m2; Rendite 2,6 % ergibt ~9,1 EUR/m2.",
        "asOf": "2026-06"
      },
      "computed": {
        "pricePerSqm": 4200,
        "appreciationPct": 5.38,
        "indexScaleFactor": 1
      }
    },
    "linz": {
      "label": "Linz",
      "anchor": {
        "pricePerSqm": 3500,
        "rentalYieldPct": 2.9,
        "appreciationPct": 2,
        "appreciationNote": "Konservativer Langfrist-Default.",
        "source": "WKO Preisspiegel 2026: 3.125 EUR/m2 (Transaktionen); soldd.com Sept 2025: 3.000-4.000 Bandbreite. Miete: WKO 2026: 7,77 EUR/m2; Rendite 2,9 % ergibt ~8,5 EUR/m2.",
        "asOf": "2026-06"
      },
      "computed": {
        "pricePerSqm": 3500,
        "appreciationPct": 5.38,
        "indexScaleFactor": 1
      }
    },
    "salzburg": {
      "label": "Salzburg",
      "anchor": {
        "pricePerSqm": 6500,
        "rentalYieldPct": 2.1,
        "appreciationPct": 3,
        "appreciationNote": "A-Lage: Inflation+Reallohn-Basis (2,5 %) + Aufschlag 0,5 % für extreme geografische Flächenbegrenzung (Gebirge, Grenze) und hohe internationale Nachfrage.",
        "source": "selfimmo.at/wohnungsboerse.net Mai 2026: 7.349 EUR/m2 (Angebotspreise); WKO Preisspiegel 2026: 5.484 EUR/m2 (Transaktionen); Mitte ca. 6.500 EUR/m2. Miete: WKO 2026: 11,24 EUR/m2; Rendite 2,1 % ergibt ~11,4 EUR/m2.",
        "asOf": "2026-06"
      },
      "computed": {
        "pricePerSqm": 6500,
        "appreciationPct": 5.38,
        "indexScaleFactor": 1
      }
    },
    "innsbruck": {
      "label": "Innsbruck",
      "anchor": {
        "pricePerSqm": 6500,
        "rentalYieldPct": 2.4,
        "appreciationPct": 3,
        "appreciationNote": "A-Lage: Inflation+Reallohn-Basis (2,5 %) + Aufschlag 0,5 % für alpine Flächenknappheit, internationale Uni-Stadt und Tourismus-Nachfrage.",
        "source": "selfimmo.at/wohnungsboerse.net Mai 2026: 7.464 EUR/m2 (Angebotspreise); soldd.com Sept 2025: 5.400-5.700; Mitte ca. 6.500 EUR/m2. Miete: WKO 2026: 12,92 EUR/m2; Rendite 2,4 % ergibt ~13,0 EUR/m2.",
        "asOf": "2026-06"
      },
      "computed": {
        "pricePerSqm": 6500,
        "appreciationPct": 5.38,
        "indexScaleFactor": 1
      }
    },
    "oesterreich": {
      "label": "Österreich-Ø",
      "anchor": {
        "pricePerSqm": 4000,
        "rentalYieldPct": 3.0,
        "appreciationPct": 2,
        "appreciationNote": "Konservativer Langfrist-Default.",
        "source": "Statistik Austria Medianpreis Eigentumswohnungen 2025: 4.162 EUR/m2; soldd.com Sept 2025: ~4.200 EUR/m2. Miete: Rendite 3,0 % ergibt ~10 EUR/m2 (plausibel für Bundesschnitt).",
        "asOf": "2026-06"
      },
      "computed": {
        "pricePerSqm": 4000,
        "appreciationPct": 5.38,
        "indexScaleFactor": 1
      }
    }
  }
};
