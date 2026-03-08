/**
 * Locations für Hubschrauber-Transfers (Koordinaten = Single Source of Truth).
 * Basis Kitz-Air + alle Flughäfen und Flugplätze in Österreich.
 */
export interface Location {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  description?: string;
  visibleOnMap?: boolean;
  /** ICAO-Code (z. B. Heliport LOJE) */
  icao?: string;
  /** Zusatzkosten (z. B. Flughafengebühren) – nur für Preisberechnung */
  extraCosts?: number;
}

export const locations: Location[] = [
  {
    id: "base",
    name: "Basis Kitz-Air / Heliport Erpfendorf (LOJE)",
    lat: 47.576134,
    lon: 12.473443,
    address: "KITZ-AIR GmbH, Brandwiesweg 3, A-6383 Erpfendorf",
    description: "Hauptbasis, Heliport LOJE",
    icao: "LOJE",
    visibleOnMap: true,
    extraCosts: 250,
  },
  // === Verkehrsflughäfen Österreich ===
  {
    id: "wien-schwechat",
    name: "Flughafen Wien-Schwechat",
    lat: 48.1103,
    lon: 16.5697,
    address: "Schwechat",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "salzburg",
    name: "Flughafen Salzburg",
    lat: 47.7948,
    lon: 13.0043,
    address: "Salzburg",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "innsbruck",
    name: "Flughafen Innsbruck",
    lat: 47.2692,
    lon: 11.4041,
    address: "Innsbruck",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "graz",
    name: "Flughafen Graz",
    lat: 46.9911,
    lon: 15.4396,
    address: "Graz",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "linz",
    name: "Flughafen Linz",
    lat: 48.2332,
    lon: 14.1875,
    address: "Hörsching",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "klagenfurt",
    name: "Flughafen Klagenfurt",
    lat: 46.6425,
    lon: 14.3377,
    address: "Klagenfurt",
    visibleOnMap: true,
    extraCosts: 250,
  },
  // === Regionalflugplätze / Flugplätze Österreich ===
  {
    id: "zell-am-see",
    name: "Flugplatz Zell am See",
    lat: 47.2923,
    lon: 12.7876,
    address: "Zell am See",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "st-johann-tirol",
    name: "Flugplatz St. Johann in Tirol",
    lat: 47.3511,
    lon: 12.6892,
    address: "St. Johann in Tirol",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "hohenems",
    name: "Flugplatz Hohenems-Dornbirn",
    lat: 47.3847,
    lon: 9.6992,
    address: "Hohenems",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "wiener-neustadt",
    name: "Flugplatz Wiener Neustadt",
    lat: 47.8433,
    lon: 16.2603,
    address: "Wiener Neustadt",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "tulln",
    name: "Flugplatz Tulln-Langenlebarn",
    lat: 48.3183,
    lon: 16.1122,
    address: "Tulln",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "aigen-ennstal",
    name: "Flugplatz Aigen im Ennstal",
    lat: 47.5333,
    lon: 14.1333,
    address: "Aigen im Ennstal",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "eisenstadt",
    name: "Flugplatz Eisenstadt",
    lat: 47.8494,
    lon: 16.5303,
    address: "Eisenstadt",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "st-poelten",
    name: "Flugplatz St. Pölten",
    lat: 48.3153,
    lon: 15.8042,
    address: "St. Pölten",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "gmunden",
    name: "Flugplatz Gmunden-Laakirchen",
    lat: 47.9502,
    lon: 13.8667,
    address: "Laakirchen",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "feldkirchen",
    name: "Flugplatz Feldkirchen/Kärnten",
    lat: 46.7055,
    lon: 14.0733,
    address: "Feldkirchen",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "lienz",
    name: "Flugplatz Lienz-Nikolsdorf",
    lat: 46.7853,
    lon: 12.8833,
    address: "Nikolsdorf",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "zeltweg",
    name: "Militärflugplatz Zeltweg",
    lat: 47.2028,
    lon: 14.7442,
    address: "Zeltweg",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "eferding",
    name: "Flugplatz Eferding",
    lat: 48.3367,
    lon: 13.9853,
    address: "Eferding",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "kapfenberg",
    name: "Flugplatz Kapfenberg",
    lat: 47.4583,
    lon: 15.3303,
    address: "Kapfenberg",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "altlichtenwarth",
    name: "Flugplatz Altlichtenwarth",
    lat: 48.6661,
    lon: 16.8252,
    address: "Altlichtenwarth",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "reichenau",
    name: "Flugplatz Reichenau",
    lat: 46.8536,
    lon: 14.8453,
    address: "Reichenau",
    visibleOnMap: true,
    extraCosts: 250,
  },
  {
    id: "bad-voeslau",
    name: "Flugplatz Bad Vöslau",
    lat: 47.9653,
    lon: 16.2603,
    address: "Bad Vöslau",
    visibleOnMap: true,
    extraCosts: 250,
  },
  // München (nahe Österreich, oft angefragt)
  {
    id: "muenchen",
    name: "Flughafen München",
    lat: 48.3538,
    lon: 11.7751,
    address: "München",
    visibleOnMap: true,
    extraCosts: 250,
  },
];

export function getLocationById(id: string): Location | undefined {
  return locations.find((l) => l.id === id);
}

export function getBaseLocation(): Location {
  const base = locations.find((l) => l.id === "base");
  if (!base) throw new Error("Base location must be defined in config.");
  return base;
}
