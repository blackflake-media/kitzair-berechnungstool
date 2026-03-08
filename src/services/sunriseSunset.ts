/**
 * Sunrise/Sunset per Berechnung (suncalc) – keine externe API.
 */
import SunCalc from "suncalc";

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
}

/**
 * Sonnenauf- und -untergang für ein Datum und einen Ort (lat/lon).
 */
export function getSunTimes(date: Date, lat: number, lon: number): SunTimes {
  const times = SunCalc.getTimes(date, lat, lon);
  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    solarNoon: times.solarNoon,
  };
}

const localeMap = { de: "de-AT", en: "en-GB" } as const;
export function formatTime(d: Date, lang: keyof typeof localeMap = "de"): string {
  return d.toLocaleTimeString(localeMap[lang], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
