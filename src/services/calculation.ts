/**
 * Berechnungslogik: Distanz (Haversine), Flugzeit, Kosten.
 * Missionstypen: Base→A→B→Base, Multileg, Hin & Retour.
 */
import type { Location } from "../config/locations";
import type { Helicopter } from "../config/helicopters";
import {
  getLocationById,
  getBaseLocation,
  locations,
} from "../config/locations";

/** Nächste Location zu gegebenen Koordinaten (für Adresssuche). */
export function getNearestLocation(
  lat: number,
  lon: number
): { location: Location; distanceKm: number } | null {
  const list = getNearestLocations(lat, lon, 1, true);
  return list.length ? list[0] : null;
}

/** Bis zu n nächste Locations (optional ohne Basis), sortiert nach Distanz. */
export function getNearestLocations(
  lat: number,
  lon: number,
  n: number,
  excludeBase = false
): { location: Location; distanceKm: number }[] {
  const list = (excludeBase ? locations.filter((l) => l.id !== "base") : locations)
    .map((loc) => ({
      location: loc,
      distanceKm: haversineDistanceKm(lat, lon, loc.lat, loc.lon),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return list.slice(0, n);
}

const EARTH_RADIUS_KM = 6371;

/** Distanz zwischen zwei Punkten in km (Haversine) */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export interface Leg {
  from: Location;
  to: Location;
  distanceKm: number;
}

/** Flugzeit in Stunden bei gegebener Distanz (km) und Geschwindigkeit (kts) */
export function flightTimeHours(distanceKm: number, speedKts: number): number {
  const distanceNm = distanceKm / 1.852;
  return distanceNm / speedKts;
}

/** Einzelleg mit Distanz */
function buildLeg(from: Location, to: Location): Leg {
  const distanceKm = haversineDistanceKm(from.lat, from.lon, to.lat, to.lon);
  return { from, to, distanceKm };
}

export type MissionType = "a-to-b" | "multileg" | "round-trip";

/**
 * Erzeugt die Legs für die gewählte Mission.
 * - a-to-b: Base → A → B → Base
 * - round-trip: Base → A → B → A → Base
 * - multileg: Base → P1 → P2 → … → Pn → Base
 */
export function buildMissionLegs(
  missionType: MissionType,
  locationIds: string[]
): Leg[] {
  const base = getBaseLocation();
  const legs: Leg[] = [];

  if (missionType === "a-to-b" && locationIds.length >= 2) {
    const a = getLocationById(locationIds[0]);
    const b = getLocationById(locationIds[1]);
    if (!a || !b) return [];
    legs.push(buildLeg(base, a), buildLeg(a, b), buildLeg(b, base));
    return legs;
  }

  if (missionType === "round-trip" && locationIds.length >= 2) {
    const a = getLocationById(locationIds[0]);
    const b = getLocationById(locationIds[1]);
    if (!a || !b) return [];
    legs.push(
      buildLeg(base, a),
      buildLeg(a, b),
      buildLeg(b, a),
      buildLeg(a, base)
    );
    return legs;
  }

  if (missionType === "multileg" && locationIds.length >= 1) {
    legs.push(buildLeg(base, getLocationById(locationIds[0])!));
    for (let i = 0; i < locationIds.length - 1; i++) {
      const from = getLocationById(locationIds[i]);
      const to = getLocationById(locationIds[i + 1]);
      if (from && to) legs.push(buildLeg(from, to));
    }
    const last = getLocationById(locationIds[locationIds.length - 1]);
    if (last) legs.push(buildLeg(last, base));
    return legs;
  }

  return legs;
}

/**
 * Einheitliche Aufteilung der Legs in Hinweg und optional Rückflug.
 * - 2 Orte (a-to-b oder round-trip): outbound = [A→B], return = B→A nur bei round-trip.
 * - Multileg (3+ Orte): outbound = alle Kunden-Legs ohne Basis, return = null (wird bei Bedarf berechnet).
 */
export function getOutboundAndReturnLegs(legs: Leg[]): {
  outboundLegs: Leg[];
  returnLeg: Leg | null;
} {
  if (legs.length < 2) return { outboundLegs: [], returnLeg: null };
  if (legs.length === 3) {
    return { outboundLegs: [legs[1]], returnLeg: null };
  }
  if (legs.length === 4) {
    const middle = [legs[1], legs[2]];
    const isReturnLastMiddle = middle[middle.length - 1].to.id === legs[1].from.id;
    if (isReturnLastMiddle) {
      return { outboundLegs: [legs[1]], returnLeg: legs[2] };
    }
    return { outboundLegs: middle, returnLeg: null };
  }
  return {
    outboundLegs: legs.slice(1, -1),
    returnLeg: null,
  };
}

export interface MissionResult {
  legs: Leg[];
  totalDistanceKm: number;
  totalFlightTimeHours: number;
  /** Von-Bis-Preis (inkl. Zusatzkosten der Locations) */
  priceFromNet: number;
  priceToNet: number;
  priceFromVat: number;
  priceToVat: number;
  priceFromGross: number;
  priceToGross: number;
}

/** Summe der Zusatzkosten aller besuchten Locations (ohne Basis doppelt zu zählen) */
function getExtraCostsForLocationIds(locationIds: string[]): number {
  let sum = 0;
  const seen = new Set<string>();
  for (const id of locationIds) {
    if (id === "base" || seen.has(id)) continue;
    seen.add(id);
    const loc = getLocationById(id);
    if (loc?.extraCosts != null) sum += loc.extraCosts;
  }
  return sum;
}

/** Wartezeit-Kosten pro Stunde (z. B. Aufenthalt bis Rückflug) in EUR – nur bei Hin & Retour */
const WAITING_COST_PER_HOUR_EUR = 100;

export function calculateMission(
  heli: Helicopter,
  missionType: MissionType,
  locationIds: string[],
  /** Bei Hin & Retour: Aufenthaltsdauer in Stunden – pro Stunde €100 werden addiert */
  returnStopHours = 0
): MissionResult | null {
  const legs = buildMissionLegs(missionType, locationIds);
  if (legs.length === 0) return null;

  const totalDistanceKm = legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  const totalFlightTimeHours = flightTimeHours(totalDistanceKm, heli.speedKts);
  const extraCosts = getExtraCostsForLocationIds(locationIds);
  const waitingCost = missionType === "round-trip" ? returnStopHours * WAITING_COST_PER_HOUR_EUR : 0;

  const vatFactor = 1 + heli.vatPercent / 100;
  const priceFromNet = heli.priceFromPerFlightHourNet * totalFlightTimeHours + extraCosts + waitingCost;
  const priceToNet = heli.priceToPerFlightHourNet * totalFlightTimeHours + extraCosts + waitingCost;
  const priceFromGross = priceFromNet * vatFactor;
  const priceToGross = priceToNet * vatFactor;

  return {
    legs,
    totalDistanceKm,
    totalFlightTimeHours,
    priceFromNet,
    priceToNet,
    priceFromVat: priceFromGross - priceFromNet,
    priceToVat: priceToGross - priceToNet,
    priceFromGross,
    priceToGross,
  };
}

/** Koordinaten-Array für Leaflet-Polyline (Reihenfolge der Legs) */
export function getRouteCoordinates(legs: Leg[]): [number, number][] {
  const coords: [number, number][] = [];
  legs.forEach((leg, i) => {
    if (i === 0) coords.push([leg.from.lat, leg.from.lon]);
    coords.push([leg.to.lat, leg.to.lon]);
  });
  return coords;
}
