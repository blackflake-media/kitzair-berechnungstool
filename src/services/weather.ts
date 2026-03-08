/**
 * Wetter für Flugroute – Open-Meteo (kostenlos, kein API-Key).
 */
export interface WeatherData {
  temperature: number;
  windSpeedKmh: number;
  windDirection: number;
  cloudCover: number;
  precipitationMm: number;
  description?: string;
}

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

/**
 * Holt Wetter für ein Datum und Koordinaten (z.B. Strecken-Mittelpunkt).
 * @param hourIndex Stunde des Tages (0–23) für besseren Forecast; 9=Vormittag, 12=Mittag, 15=Nachmittag.
 */
export async function fetchWeather(
  lat: number,
  lon: number,
  date: Date,
  hourIndex: number = 12
): Promise<WeatherData | null> {
  const dateStr = date.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: dateStr,
    end_date: dateStr,
    hourly: "temperature_2m,precipitation,windspeed_10m,winddirection_10m,cloudcover",
  });
  try {
    const res = await fetch(`${OPEN_METEO}?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      hourly?: {
        temperature_2m?: number[];
        precipitation?: number[];
        windspeed_10m?: number[];
        winddirection_10m?: number[];
        cloudcover?: number[];
        time?: string[];
      };
    };
    const h = data.hourly;
    if (!h?.time?.length) return null;
    const idx = Math.min(hourIndex, h.time.length - 1);
    return {
      temperature: h.temperature_2m?.[idx] ?? 0,
      windSpeedKmh: (h.windspeed_10m?.[idx] ?? 0) * 3.6,
      windDirection: h.winddirection_10m?.[idx] ?? 0,
      cloudCover: h.cloudcover?.[idx] ?? 0,
      precipitationMm: h.precipitation?.[idx] ?? 0,
    };
  } catch {
    return null;
  }
}

/** Wetter-Gitterpunkt für Overlay (lat/lon + gleiche Werte wie WeatherData) */
export interface WeatherGridPoint extends WeatherData {
  lat: number;
  lon: number;
}

/** Stunde des Tages für Wetter (0–23). Vormittag=9, Mittag=12, Nachmittag=15. */
export type WeatherHourIndex = 9 | 12 | 15;

/**
 * Holt Wetter für ein Raster von Punkten (für Karten-Overlay).
 * Nutzt die angegebene Stunde des Tages (Vormittag/Mittag/Nachmittag); max. 25 Punkte pro Aufruf (5×5).
 */
export async function fetchWeatherGrid(
  bounds: { north: number; south: number; east: number; west: number },
  date: Date,
  cols = 5,
  rows = 5,
  hourIndex: WeatherHourIndex = 12
): Promise<WeatherGridPoint[]> {
  const lats: number[] = [];
  const lons: number[] = [];
  for (let r = 0; r < rows; r++) {
    const lat = bounds.south + (bounds.north - bounds.south) * (r / (rows - 1 || 1));
    for (let c = 0; c < cols; c++) {
      const lon = bounds.west + (bounds.east - bounds.west) * (c / (cols - 1 || 1));
      lats.push(lat);
      lons.push(lon);
    }
  }
  const dateStr = date.toISOString().slice(0, 10);
  const results: WeatherGridPoint[] = [];
  const hour = hourIndex;
  await Promise.all(
    lats.map((lat, i) => {
      const lon = lons[i]!;
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        start_date: dateStr,
        end_date: dateStr,
        hourly: "precipitation,windspeed_10m,winddirection_10m,cloudcover",
      });
      return fetch(`${OPEN_METEO}?${params}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: unknown) => {
          const h = (data as { hourly?: { precipitation?: number[]; windspeed_10m?: number[]; winddirection_10m?: number[]; cloudcover?: number[] } }).hourly;
          if (!h) return;
          const idx = Math.min(hour, (h.windspeed_10m?.length ?? 24) - 1);
          const windKmh = h.windspeed_10m?.[idx] ?? 0;
          results.push({
            lat,
            lon,
            temperature: 0,
            windSpeedKmh: windKmh,
            windDirection: h.winddirection_10m?.[idx] ?? 0,
            cloudCover: h.cloudcover?.[idx] ?? 0,
            precipitationMm: h.precipitation?.[idx] ?? 0,
          });
        })
        .catch(() => {});
    })
  );
  return results.sort((a, b) => a.lat !== b.lat ? b.lat - a.lat : a.lon - b.lon);
}
