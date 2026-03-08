/**
 * RainViewer Weather Maps API – Radardaten als Kartenlayer.
 * @see https://www.rainviewer.com/api.html
 */

const API_URL = "https://api.rainviewer.com/public/weather-maps.json";

export interface RainViewerFrame {
  time: number;
  path: string;
}

export interface RainViewerResponse {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: RainViewerFrame[];
    nowcast?: RainViewerFrame[];
  };
}

/**
 * Liefert die Tile-URL-Vorlage für den neuesten Radar-Frame.
 * Format: {host}{path}/256/{z}/{x}/{y}/2/1_1.png (color=2, smooth=1, snow=1)
 * Max zoom für Radar ist 7.
 */
export async function getRadarTileUrl(): Promise<string | null> {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as RainViewerResponse;
    const host = data.host?.replace(/\/$/, "") ?? "https://tilecache.rainviewer.com";
    const past = data.radar?.past;
    if (!past?.length) return null;
    const latest = past[past.length - 1];
    const path = latest.path.replace(/^\//, "");
    return `${host}/${path}/256/{z}/{x}/{y}/2/1_1.png`;
  } catch {
    return null;
  }
}
