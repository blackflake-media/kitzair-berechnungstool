/**
 * VFR-Grenzwerte für Ampelbewertung (grün / gelb / rot).
 * Orientierung an typischen VFR-Mindestbedingungen (Wind, Bewölkung, Niederschlag).
 */
export type VfrLight = "green" | "yellow" | "red";

/** Wind in km/h: grün im Rahmen, gelb knapp drüber, rot deutlich drüber */
const WIND_KMH_GREEN = 35;
const WIND_KMH_YELLOW = 50;

/** Bewölkung in %: grün wenig, gelb mittel, rot hoch */
const CLOUD_GREEN = 50;
const CLOUD_YELLOW = 90;

/** Niederschlag mm (stündlich): grün 0, gelb leicht, rot bedeutend */
const PRECIP_GREEN = 0;
const PRECIP_YELLOW = 3;

export function vfrWind(windKmh: number): VfrLight {
  if (windKmh <= WIND_KMH_GREEN) return "green";
  if (windKmh <= WIND_KMH_YELLOW) return "yellow";
  return "red";
}

export function vfrCloudCover(cloudPercent: number): VfrLight {
  if (cloudPercent <= CLOUD_GREEN) return "green";
  if (cloudPercent <= CLOUD_YELLOW) return "yellow";
  return "red";
}

export function vfrPrecipitation(precipMm: number): VfrLight {
  if (precipMm <= PRECIP_GREEN) return "green";
  if (precipMm <= PRECIP_YELLOW) return "yellow";
  return "red";
}
