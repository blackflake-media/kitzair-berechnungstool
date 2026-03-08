/**
 * Geocoding: Adresse → Koordinaten (Nominatim/OSM).
 * Nächste Location wird im Frontend per Haversine ermittelt.
 */
export interface GeocodingResult {
  lat: number;
  lon: number;
  displayName: string;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/** Europa: min_lon, min_lat, max_lon, max_lat (Nominatim viewbox) */
const EUROPE_VIEWBOX = "-25,34,40,72";

export async function geocodeAddress(query: string): Promise<GeocodingResult | null> {
  if (!query.trim()) return null;
  const params = new URLSearchParams({
    q: query.trim(),
    format: "json",
    limit: "1",
    viewbox: EUROPE_VIEWBOX,
    bounded: "1",
  });
  try {
    const res = await fetch(`${NOMINATIM}?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!data.length) return null;
    const first = data[0];
    return {
      lat: parseFloat(first.lat),
      lon: parseFloat(first.lon),
      displayName: first.display_name,
    };
  } catch {
    return null;
  }
}

/** Vorschläge für Adress-Autocomplete (mehrere Treffer). */
export async function searchAddressSuggestions(
  query: string
): Promise<GeocodingResult[]> {
  if (!query.trim() || query.trim().length < 3) return [];
  const params = new URLSearchParams({
    q: query.trim(),
    format: "json",
    limit: "6",
    addressdetails: "0",
    viewbox: EUROPE_VIEWBOX,
    bounded: "1",
  });
  try {
    const res = await fetch(`${NOMINATIM}?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    return data.map((item) => ({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      displayName: item.display_name,
    }));
  } catch {
    return [];
  }
}

/** Reverse Geocoding: Koordinaten → Adress-String (Nominatim). */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<GeocodingResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string; display_name: string };
    if (!data?.display_name) return null;
    return {
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      displayName: data.display_name,
    };
  } catch {
    return null;
  }
}
