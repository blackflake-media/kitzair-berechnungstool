/**
 * Beide Hubschrauber-Typen – Flugstundenpreis (Netto + MwSt getrennt), Base, Geschwindigkeit (kts).
 * Beide werden nach Eingabe sofort berechnet und angezeigt (keine Auswahl).
 */
export interface Helicopter {
  id: string;
  name: string;
  /** Base = Location-ID oder Koordinaten-Referenz (wir nutzen locationId) */
  baseLocationId: string;
  /** Geschwindigkeit in Knoten */
  speedKts: number;
  /** Von-Preis Netto pro Flugstunde (EUR) */
  priceFromPerFlightHourNet: number;
  /** Bis-Preis Netto pro Flugstunde (EUR) */
  priceToPerFlightHourNet: number;
  /** Mehrwertsteuer in Prozent (z.B. 20) */
  vatPercent: number;
  /** Optional: MwSt-Betrag pro Flugstunde fest; sonst aus vatPercent berechnet */
  vatAmountPerFlightHour?: number;
  /** Optional: Bild-URL für Heli-Karte (ohne Berechnung) */
  imageUrl?: string;
  /** Optional: Kurze Specs für Anzeige ohne Berechnung */
  specs?: string[];
}

/** 220 km/h in Knoten (für Berechnung) */
const KMH_220_KTS = 220 / 1.852;

export const helicopters: Helicopter[] = [
  {
    id: "h1",
    name: "Airbus H125 B3",
    baseLocationId: "base",
    speedKts: Math.round(KMH_220_KTS),
    priceFromPerFlightHourNet: 2040,
    priceToPerFlightHourNet: 2170,
    vatPercent: 20,
    imageUrl: "/images/helicopters/as350.jpg",
    specs: ["1 Pilot + 5 Passagiere", "Reisegeschw. ca. 119 kt (220 km/h)", "Single Engine"],
  },
  {
    id: "h2",
    name: "Bell 505",
    baseLocationId: "base",
    speedKts: 110,
    priceFromPerFlightHourNet: 1695,
    priceToPerFlightHourNet: 1830,
    vatPercent: 20,
    imageUrl: "/images/helicopters/b505.jpg",
    specs: ["1 Pilot + 4 Passagiere", "Reisegeschw. ca. 110 kt (204 km/h)", "Single Engine"],
  },
];

export function getHelicopterById(id: string): Helicopter | undefined {
  return helicopters.find((h) => h.id === id);
}

/** MwSt-Betrag pro Flugstunde (Basis: Von-Preis; wenn nicht fest hinterlegt) */
export function getVatAmountPerFlightHour(heli: Helicopter): number {
  if (heli.vatAmountPerFlightHour != null) return heli.vatAmountPerFlightHour;
  return (heli.priceFromPerFlightHourNet * heli.vatPercent) / 100;
}

/** Bruttopreis Von pro Flugstunde */
export function getPriceFromPerFlightHourGross(heli: Helicopter): number {
  const vat = (heli.priceFromPerFlightHourNet * heli.vatPercent) / 100;
  return heli.priceFromPerFlightHourNet + vat;
}

/** Bruttopreis Bis pro Flugstunde */
export function getPriceToPerFlightHourGross(heli: Helicopter): number {
  const vat = (heli.priceToPerFlightHourNet * heli.vatPercent) / 100;
  return heli.priceToPerFlightHourNet + vat;
}
