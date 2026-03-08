/**
 * Straßenrouting (OSRM) für Fahrtdauer und Strecke von A nach B.
 */
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

export interface DrivingRouteResult {
  coordinates: [number, number][];
  durationMinutes: number;
  distanceKm: number;
}

export async function fetchDrivingRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): Promise<DrivingRouteResult | null> {
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{
        duration: number;
        distance: number;
        geometry?: { coordinates: [number, number][] };
      }>;
    };
    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;
    const coordinates = route.geometry.coordinates.map(
      ([lon, lat]) => [lat, lon] as [number, number]
    );
    return {
      coordinates,
      durationMinutes: Math.round(route.duration / 60),
      distanceKm: route.distance / 1000,
    };
  } catch {
    return null;
  }
}

/** Straßen-Route über mehrere Wegpunkte (Reihenfolge bleibt). Gibt Gesamt-Dauer und -Distanz zurück. */
export async function fetchDrivingRouteForWaypoints(
  waypoints: { lat: number; lon: number }[]
): Promise<{ durationMinutes: number; distanceKm: number } | null> {
  if (waypoints.length < 2) return null;
  const coords = waypoints.map((w) => `${w.lon},${w.lat}`).join(";");
  const url = `${OSRM_BASE}/${coords}?overview=false`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{ duration: number; distance: number }>;
    };
    const route = data.routes?.[0];
    if (route == null) return null;
    return {
      durationMinutes: Math.round(route.duration / 60),
      distanceKm: route.distance / 1000,
    };
  } catch {
    return null;
  }
}
