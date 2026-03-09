import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Location } from "../../config/locations";
import type { Leg, MissionResult } from "../../services/calculation";
import { flightTimeHours, getNearestLocations, getOutboundAndReturnLegs, haversineDistanceKm } from "../../services/calculation";
import type { Helicopter } from "../../config/helicopters";
import { getBaseLocation, getLocationById } from "../../config/locations";

/** Kontrollpunkt für Flugbogen (quadratischer Bezier). reverse=true = Gegenschwung für Rückflug. */
function getArcControlPoint(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  reverse = false
): { lat: number; lng: number } {
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  const offset = reverse ? -0.05 : 0.05;
  return {
    lat: midLat + Math.abs(start.lng - end.lng) * offset,
    lng: midLng + Math.abs(start.lat - end.lat) * offset,
  };
}

/** Punkt exakt in der Mitte des Flugbogens (t = 0.5) – für Label auf der Linie */
function getArcMidpoint(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  reverse = false
): { lat: number; lng: number } {
  const cp = getArcControlPoint(start, end, reverse);
  const t = 0.5;
  return {
    lat: (1 - t) * (1 - t) * start.lat + 2 * (1 - t) * t * cp.lat + t * t * end.lat,
    lng: (1 - t) * (1 - t) * start.lng + 2 * (1 - t) * t * cp.lng + t * t * end.lng,
  };
}

/** Zeichnet einen gebogenen Flugbogen. reverse=true = Gegenschwung (Rückflug). */
function drawFlightArc(
  _map: L.Map,
  layer: L.LayerGroup,
  start: L.LatLng,
  end: L.LatLng,
  color: string,
  reverse = false
): L.LatLng[] {
  const cp = getArcControlPoint(start, end, reverse);
  const pts: L.LatLng[] = [];
  for (let t = 0; t <= 1; t += 0.02) {
    const lat =
      Math.pow(1 - t, 2) * start.lat + 2 * (1 - t) * t * cp.lat + Math.pow(t, 2) * end.lat;
    const lng =
      Math.pow(1 - t, 2) * start.lng + 2 * (1 - t) * t * cp.lng + Math.pow(t, 2) * end.lng;
    pts.push(L.latLng(lat, lng));
  }
  L.polyline(pts, {
    color,
    weight: 4,
    opacity: 1,
    dashArray: "2, 8",
  }).addTo(layer);
  return pts;
}
import { helicopters } from "../../config/helicopters";
import type { Lang, TranslationKey } from "../../i18n";

const DEFAULT_ZOOM = 8;
const speedKts = helicopters[0]?.speedKts ?? 120;

function formatLegDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Min/Max-Flugzeit (beide Helis) für Karten-Label, z. B. "45–52 min". */
function getLegDurationMinMax(
  displayLegIndex: number,
  results: { helicopter: Helicopter; result: MissionResult }[]
): { minH: number; maxH: number } {
  let minH = Infinity;
  let maxH = -Infinity;
  const legIndex = displayLegIndex + 1; // displayLegs = legs.slice(1, -1)
  for (const { helicopter, result } of results) {
    if (result.legs[legIndex]) {
      const h = flightTimeHours(result.legs[legIndex].distanceKm, helicopter.speedKts);
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
    }
  }
  return { minH: minH === Infinity ? 0 : minH, maxH: maxH === -Infinity ? 0 : maxH };
}

function formatLegDurationRange(minH: number, maxH: number): string {
  if (minH === maxH || maxH === 0) return formatLegDuration(minH);
  const minM = Math.round(minH * 60);
  const maxM = Math.round(maxH * 60);
  return `${minM}–${maxM} min`;
}

/** Min/Max-Flugzeit für eine gegebene Distanz über alle Helis (z. B. Rückflug ohne Leg in results). */
function getDurationMinMaxForDistance(
  distanceKm: number,
  results: { helicopter: Helicopter; result: MissionResult }[]
): { minH: number; maxH: number } {
  let minH = Infinity;
  let maxH = -Infinity;
  for (const { helicopter } of results) {
    const h = flightTimeHours(distanceKm, helicopter.speedKts);
    minH = Math.min(minH, h);
    maxH = Math.max(maxH, h);
  }
  return { minH: minH === Infinity ? 0 : minH, maxH: maxH === -Infinity ? 0 : maxH };
}

function escapeHtml(s: string): string {
  const el = document.createElement("div");
  el.textContent = s;
  return el.innerHTML;
}

function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
}

const crosshairSvg =
  '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="5"/><path d="M8 2v4M8 10v4M2 8h4M10 8h4"/></svg>';

const carSvg =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14v-5H5v5zm2-7l1.5-4.5h9L19 10H7z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>';

// Lucide-Standard-Icons wie am Flughafen: Departure (plane-takeoff), Arrival (plane-landing)
const lucideSvgAttrs = 'width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const iconStartSvg =
  `<svg ${lucideSvgAttrs} stroke="#22c55e"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z"/></svg>`;
// Zwischenstop: zwei goldene Balken
const iconStopoverSvg =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="4" y="7" width="16" height="3" rx="1" fill="#eab308"/><rect x="4" y="14" width="16" height="3" rx="1" fill="#eab308"/></svg>';
const iconDestinationSvg =
  `<svg ${lucideSvgAttrs} stroke="#dc2626"><path d="M2 22h20"/><path d="M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z"/></svg>`;

// Normale Punkte (Basis, nicht gewählte Orte): blinkende Kreise wie vorher
function pointIconHtml(color: string, type: "base" | "blue"): string {
  const size = 16;
  const bg = type === "base"
    ? "linear-gradient(to bottom, #0f172a 0%, #0f172a 50%, #b91c1c 50%, #b91c1c 100%)"
    : color;
  return `<span class="map-marker map-marker-${type} marker-led marker-blink" style="background:${bg};width:${size}px;height:${size}px;border-radius:50%;display:block;box-shadow:0 0 0 2px rgba(255,255,255,0.9);"></span>`;
}

// Nur Start, Zwischenstop, Ziel: schwarzes blinkendes Quadrat mit Icon (blinkender Schatten)
function markerIconHtml(type: "start" | "stopover" | "destination" | "base" | "blue", color: string): string {
  if (type === "base" || type === "blue") {
    return pointIconHtml(color, type);
  }
  const size = 24;
  let icon = type === "start" ? iconStartSvg : type === "stopover" ? iconStopoverSvg : iconDestinationSvg;
  return `<span class="map-marker map-marker-square map-marker-${type} marker-square-blink" style="width:${size}px;height:${size}px;background:#0f172a;border-radius:3px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px rgba(255,255,255,0.8);">${icon}</span>`;
}

interface RouteMapProps {
  locations: Location[];
  legs: Leg[] | null;
  /** Beide Helis – für Min/Max-Flugzeit auf der Karte */
  results?: { helicopter: Helicopter; result: MissionResult }[];
  lang: Lang;
  mapStart: string | null;
  mapStopovers: string[];
  mapDestination: string | null;
  isRoundTrip?: boolean;
  userLocationCoords?: { lat: number; lon: number } | null;
  driveRoute?: { coordinates: [number, number][]; durationMinutes: number; distanceKm: number } | null;
  twoNearestLocations?: { location: Location; distanceKm: number }[];
  twoNearestToBase?: { location: Location; distanceKm: number }[];
  onSelectStart: (id: string) => void;
  onSelectStopover: (id: string) => void;
  onSelectDestination: (id: string) => void;
  t: (key: TranslationKey) => string;
  className?: string;
}

const ROUTE_ARC_COLOR = "#EE7000";
const ROUTE_RETURN_ARC_COLOR = "#0284c7"; // Rückflug (Hin & Retour): andere Farbe, Gegenschwung

export function RouteMap({
  locations,
  legs,
  results = [],
  lang,
  mapStart,
  mapStopovers,
  mapDestination,
  isRoundTrip = false,
  userLocationCoords = null,
  driveRoute = null,
  twoNearestLocations = [],
  twoNearestToBase = [],
  onSelectStart,
  onSelectStopover,
  onSelectDestination,
  t,
  className = "",
}: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const durationLabelsRef = useRef<L.Marker[]>([]);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const driveRouteLayerRef = useRef<L.LayerGroup | null>(null);
  const handlersRef = useRef({
    onSelectStart,
    onSelectStopover,
    onSelectDestination,
  });
  handlersRef.current = { onSelectStart, onSelectStopover, onSelectDestination };

  const destinationSet = !!mapDestination;

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    const base = getBaseLocation();
    const map = L.map(mapRef.current).setView([base.lat, base.lon], DEFAULT_ZOOM);

    const makeTileLayer = (l: Lang) => {
      // Ziel: Kartenbeschriftung je Sprache (de: OSM-DE Tiles), sonst CARTO Voyager.
      if (l === "de") {
        return L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>',
          maxZoom: 20,
        });
      }
      // Kräftige, edle Basiskarte (CartoDB Voyager): klare Kontraste, Straßen, Ortsnamen
      return L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      );
    };

    tileLayerRef.current = makeTileLayer(lang).addTo(map);
    mapInstanceRef.current = map;
    map.whenReady(() => setMapReady(true));

    const onPopupClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-action][data-location-id]");
      if (!target) return;
      const action = (target as HTMLElement).dataset.action;
      const id = (target as HTMLElement).dataset.locationId;
      if (!id || !action) return;
      const h = handlersRef.current;
      if (action === "start") h.onSelectStart(id);
      else if (action === "stopover") h.onSelectStopover(id);
      else if (action === "destination") h.onSelectDestination(id);
      map.closePopup();
    };

    map.on("popupopen", (e: L.LeafletEvent) => {
      const popup = (e as L.PopupEvent).popup;
      const pane = map.getPane("popupPane");
      if (pane) pane.addEventListener("click", onPopupClick);
      const el = popup.getElement();
      if (el) {
        const onLeave = () => popup.close();
        el.addEventListener("mouseleave", onLeave);
        (el as HTMLElement & { _popupCleanup?: () => void })._popupCleanup = () => {
          el.removeEventListener("mouseleave", onLeave);
        };
      }
    });
    map.on("popupclose", (e: L.LeafletEvent) => {
      const popup = (e as L.PopupEvent).popup;
      const pane = map.getPane("popupPane");
      if (pane) pane.removeEventListener("click", onPopupClick);
      const el = popup?.getElement() as HTMLElement & { _popupCleanup?: () => void };
      if (el?._popupCleanup) el._popupCleanup();
    });

    return () => {
      map.off("popupopen popupclose");
      routeLayerRef.current?.remove();
      routeLayerRef.current = null;
      driveRouteLayerRef.current?.remove();
      driveRouteLayerRef.current = null;
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markersRef.current = [];
      durationLabelsRef.current = [];
      setMapReady(false);
    };
  }, []);

  // Bei Sprachwechsel: Tile-Layer austauschen (Labels/Attribution).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const makeTileLayer = (l: Lang) => {
      if (l === "de") {
        return L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>',
          maxZoom: 20,
        });
      }
      return L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      );
    };

    tileLayerRef.current?.remove();
    tileLayerRef.current = makeTileLayer(lang).addTo(map);
  }, [lang]);

  // Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const selectedIds = destinationSet
      ? [mapStart, ...mapStopovers, mapDestination].filter(Boolean)
      : null;
    const isVisible = (loc: Location) =>
      loc.id === "base" || !selectedIds || selectedIds.includes(loc.id);

    locations.forEach((loc) => {
      if (!isVisible(loc)) return;
      const isBase = loc.id === "base";
      const isStart = loc.id === mapStart;
      const isStopover = mapStopovers.includes(loc.id);
      const isDest = loc.id === mapDestination;

      let color = "#1e3a5f";
      let iconType: "start" | "stopover" | "destination" | "base" | "blue" = "blue";
      if (isStart) {
        color = "#22c55e";
        iconType = "start";
      } else if (isStopover) {
        color = "#eab308";
        iconType = "stopover";
      } else if (isDest) {
        color = "#dc2626";
        iconType = "destination";
      } else if (isBase) {
        color = "#b91c1c";
        iconType = "base";
      }

      const isSquare = iconType === "start" || iconType === "stopover" || iconType === "destination";
      const icon = L.divIcon({
        className: "map-marker-wrapper",
        html: markerIconHtml(iconType, color),
        iconSize: isSquare ? [24, 24] : [16, 16],
        iconAnchor: isSquare ? [12, 12] : [8, 8],
      });
      const marker = L.marker([loc.lat, loc.lon], { icon }).addTo(map);

      const hasStart = !!mapStart;
      const canSetStart = !hasStart;
      const canSetStopover = hasStart && !mapDestination;
      const canSetDest = hasStart && !mapDestination;

      const buttons: string[] = [];
      if (canSetStart && !isStart) buttons.push(`<button type="button" data-action="start" data-location-id="${loc.id}" class="map-popup-btn">${t("setAsStart")}</button>`);
      if (canSetStopover && !isStart && !isDest && !isStopover && mapStopovers.length < 3) buttons.push(`<button type="button" data-action="stopover" data-location-id="${loc.id}" class="map-popup-btn">${t("asStopover")}</button>`);
      if (canSetDest && !isStart && !isDest) buttons.push(`<button type="button" data-action="destination" data-location-id="${loc.id}" class="map-popup-btn">${t("asDestination")}</button>`);

      const coordsLine =
        `<div class="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1.5 font-mono" style="letter-spacing:0.02em">` +
        `<span class="map-popup-crosshair opacity-70">${crosshairSvg}</span>` +
        `<span>${formatCoords(loc.lat, loc.lon)}</span></div>`;

      const isBaseNotSelectable = isBase && destinationSet;
      if (!isBaseNotSelectable) {
        const popupContent =
          `<div class="map-popup-content">
            <div class="font-semibold text-slate-800 tracking-tight">${loc.name}</div>
            ${loc.address ? `<div class="text-xs text-slate-500 mt-0.5">${loc.address}</div>` : ""}
            ${coordsLine}
            <div class="map-popup-btns">${buttons.join("")}</div>
          </div>`;
        marker.bindPopup(popupContent, {
          maxWidth: 280,
          className: "map-popup map-popup-elegant",
        });
        marker.on("mouseover", () => marker.openPopup());
      }

      markersRef.current.push(marker);
    });

  }, [
    locations,
    mapStart,
    mapStopovers,
    mapDestination,
    destinationSet,
    t,
  ]);

  // Karte zoomen: beim Start Basis zentriert, Zoom 8 (~70 % aller Punkte sichtbar); bei Auswahl gesamte Route einrahmen
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!mapStart && mapStopovers.length === 0 && !mapDestination) {
      // Start: Basis zentriert, Zoom so dass schön ~70 % aller Punkte sichtbar sind (wie früher)
      const base = getBaseLocation();
      map.setView([base.lat, base.lon], DEFAULT_ZOOM, { animate: false });
      return;
    }

    let points: L.LatLng[] = [];
    if (mapStart) {
      const loc = locations.find((l) => l.id === mapStart);
      if (loc) points.push(L.latLng(loc.lat, loc.lon));
    }
    mapStopovers.forEach((id) => {
      const loc = locations.find((l) => l.id === id);
      if (loc) points.push(L.latLng(loc.lat, loc.lon));
    });
    if (mapDestination) {
      const loc = locations.find((l) => l.id === mapDestination);
      if (loc) points.push(L.latLng(loc.lat, loc.lon));
    }
    if (points.length === 1 && mapStart && !mapDestination && mapStopovers.length === 0) {
      const startLoc = locations.find((l) => l.id === mapStart);
      if (startLoc) {
        const nearest = getNearestLocations(startLoc.lat, startLoc.lon, 5, false);
        const others = nearest.filter(({ location }) => location.id !== mapStart).slice(0, 4);
        others.forEach(({ location }) => points.push(L.latLng(location.lat, location.lon)));
      }
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], animate: true, maxZoom: 14 });
    }
  }, [mapStart, mapStopovers, mapDestination, locations]);

  // Route zeichnen: zuerst die gesamte Hin-Route (Start → … → Ziel), dann bei Hin & Retour eine NEUE Linie vom ZIEL zum START
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    durationLabelsRef.current.forEach((m) => m.remove());
    durationLabelsRef.current = [];
    routeLayerRef.current?.remove();
    routeLayerRef.current = null;

    const { outboundLegs, returnLeg: returnLegFromData } = legs ? getOutboundAndReturnLegs(legs) : { outboundLegs: [], returnLeg: null };
    const hasFullRoute = outboundLegs.length > 0;

    const ids = [mapStart, ...mapStopovers, mapDestination].filter(Boolean) as string[];
    const waypoints = ids
      .map((id) => getLocationById(id))
      .filter(Boolean)
      .map((loc) => ({ lat: loc!.lat, lon: loc!.lon, name: loc!.name, id: loc!.id }));

    if (hasFullRoute && waypoints.length >= 2 && waypoints.length - 1 <= outboundLegs.length) {
      const routeLayer = L.layerGroup().addTo(map);
      routeLayerRef.current = routeLayer;
      const allPoints: L.LatLng[] = [];

      for (let i = 0; i < waypoints.length - 1; i++) {
        const start = L.latLng(waypoints[i].lat, waypoints[i].lon);
        const end = L.latLng(waypoints[i + 1].lat, waypoints[i + 1].lon);
        const arcPts = drawFlightArc(map, routeLayer, start, end, ROUTE_ARC_COLOR, false);
        allPoints.push(...arcPts);
        const leg = outboundLegs[i];
        const mid = getArcMidpoint(
          { lat: waypoints[i].lat, lng: waypoints[i].lon },
          { lat: waypoints[i + 1].lat, lng: waypoints[i + 1].lon },
          false
        );
        const durationStr = leg
          ? (results.length > 0
              ? formatLegDurationRange(getLegDurationMinMax(i, results).minH, getLegDurationMinMax(i, results).maxH)
              : formatLegDuration(flightTimeHours(leg.distanceKm, speedKts)))
          : "";
        const kmStr = leg ? `${leg.distanceKm.toFixed(1)} km` : "";
        const enrouteLabel = waypoints.length === 2 ? t("enroute") : `${t("enroute")} ${i + 1}`;
        if (durationStr) {
          const durationIcon = L.divIcon({
            className: "map-duration-label-wrapper map-label-scaled",
            html: `<span class="map-duration-label map-flight-duration"><span class="map-duration-enroute">${enrouteLabel}</span><span class="map-flight-duration-time">${durationStr}</span><span class="map-flight-duration-km">${kmStr}</span></span>`,
            iconSize: [56, 38],
            iconAnchor: [28, 19],
          });
          const durationMarker = L.marker([mid.lat, mid.lng], { icon: durationIcon, interactive: false, zIndexOffset: 800 }).addTo(routeLayer);
          durationLabelsRef.current.push(durationMarker);
        }
      }

      if (isRoundTrip && waypoints.length >= 2) {
        const destination = waypoints[waypoints.length - 1];
        const startOfOutbound = waypoints[0];
        const segStart = L.latLng(destination.lat, destination.lon);
        const segEnd = L.latLng(startOfOutbound.lat, startOfOutbound.lon);
        const arcPts = drawFlightArc(map, routeLayer, segStart, segEnd, ROUTE_RETURN_ARC_COLOR, true);
        allPoints.push(...arcPts);
        const returnDistanceKm = returnLegFromData
          ? returnLegFromData.distanceKm
          : haversineDistanceKm(destination.lat, destination.lon, startOfOutbound.lat, startOfOutbound.lon);
        const mid = getArcMidpoint(
          { lat: destination.lat, lng: destination.lon },
          { lat: startOfOutbound.lat, lng: startOfOutbound.lon },
          true
        );
        const { minH: returnMinH, maxH: returnMaxH } =
          results.length > 0 && returnLegFromData
            ? getLegDurationMinMax(outboundLegs.length, results)
            : results.length > 0
              ? getDurationMinMaxForDistance(returnDistanceKm, results)
              : { minH: flightTimeHours(returnDistanceKm, speedKts), maxH: flightTimeHours(returnDistanceKm, speedKts) };
        const returnDurationStr = formatLegDurationRange(returnMinH, returnMaxH);
        const kmStr = `${returnDistanceKm.toFixed(1)} km`;
        const returnLabel = t("returnFlight");
        const durationIcon = L.divIcon({
          className: "map-duration-label-wrapper map-label-scaled",
          html: `<span class="map-duration-label map-flight-duration"><span class="map-duration-enroute">${returnLabel}</span><span class="map-flight-duration-time">${returnDurationStr}</span><span class="map-flight-duration-km">${kmStr}</span></span>`,
          iconSize: [56, 38],
          iconAnchor: [28, 19],
        });
        const durationMarker = L.marker([mid.lat, mid.lng], { icon: durationIcon, interactive: false, zIndexOffset: 800 }).addTo(routeLayer);
        durationLabelsRef.current.push(durationMarker);
      }

      waypoints.forEach((wp) => allPoints.push(L.latLng(wp.lat, wp.lon)));

      waypoints.forEach((wp, index) => {
        const pos = L.latLng(wp.lat, wp.lon);
        const isFirst = index === 0;
        const isLast = index === waypoints.length - 1;
        const isBase = wp.id === "base";
        const isDestination = isLast && !!mapDestination && wp.id === mapDestination;

        let fillColor = ROUTE_ARC_COLOR;
        let radius = 6;
        if (isBase) {
          fillColor = "#b91c1c";
          radius = 9;
        } else if (isFirst) {
          fillColor = "#22c55e";
          radius = 9;
        } else if (isDestination) {
          fillColor = "#ef4444";
          radius = 9;
        } else {
          fillColor = "#ffd700";
          radius = 9;
        }

        L.circleMarker(pos, {
          radius,
          fillColor,
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
        }).addTo(routeLayer);
      });

      if (allPoints.length > 0) {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50], animate: true, maxZoom: 14 });
      }
    }
  }, [legs, results, isRoundTrip, mapStart, mapStopovers, mapDestination, locations, t]);

  // "Dein Standort"-Pin bei Adressauswahl: blinkender blauer Pin, Karte zentrieren
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    userLocationMarkerRef.current?.remove();
    userLocationMarkerRef.current = null;

    if (userLocationCoords) {
      const pos = L.latLng(userLocationCoords.lat, userLocationCoords.lon);
      const label = t("yourLocation");
      const icon = L.divIcon({
        className: "user-location-marker-wrapper",
        html: `
          <div class="user-location-pin">
            <span class="user-location-dot"></span>
            <span class="user-location-label">${escapeHtml(label)}</span>
          </div>`,
        iconSize: [100, 48],
        iconAnchor: [50, 10],
      });
      const marker = L.marker(pos, { icon, zIndexOffset: 2000 }).addTo(map);
      userLocationMarkerRef.current = marker;

      map.setView(pos, Math.max(map.getZoom(), 12), { animate: true });
    }
  }, [userLocationCoords, t]);

  // Keine Adresse: Karte auf Basis zentrieren und 2 nächste Punkte einrahmen (nur wenn noch keine Auswahl)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || userLocationCoords || (driveRoute?.coordinates?.length ?? 0) > 0) return;
    if (!mapStart && !mapDestination) return; // Beim Start: Basis bleibt zentriert
    if (mapStart || mapDestination) return;  // Bei Auswahl: Start/Route-Effect übernimmt
    if (twoNearestToBase.length === 0) return;
    try {
      const base = getBaseLocation();
      const points: L.LatLng[] = [L.latLng(base.lat, base.lon)];
      twoNearestToBase.forEach(({ location }) => points.push(L.latLng(location.lat, location.lon)));
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60], animate: true });
    } catch {}
  }, [userLocationCoords, driveRoute, twoNearestToBase, mapStart, mapDestination]);

  // Straßenroute (blau, gestrichelt, Schatten) + Bounds auf Dein Standort + Route + 2 nächste Punkte
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    driveRouteLayerRef.current?.remove();
    driveRouteLayerRef.current = null;

    if (driveRoute?.coordinates?.length) {
      const layer = L.layerGroup().addTo(map);
      driveRouteLayerRef.current = layer;
      const latLngs = driveRoute.coordinates.map(([lat, lon]) => L.latLng(lat, lon));
      L.polyline(latLngs, {
        color: "#2563eb",
        weight: 4,
        opacity: 1,
        dashArray: "2, 8",
        className: "drive-route-polyline",
      }).addTo(layer);

      // Fahrtdauer + km in der Mitte der Strecke
      const midIdx = Math.floor(driveRoute.coordinates.length / 2);
      const midCoord = driveRoute.coordinates[midIdx];
      if (midCoord && driveRoute.durationMinutes != null) {
        const distStr = typeof driveRoute.distanceKm === "number"
          ? `${driveRoute.distanceKm.toFixed(1)} km`
          : "";
        const icon = L.divIcon({
          className: "map-duration-label-wrapper map-drive-duration-compact",
          html: `<span class="map-duration-label map-drive-duration">${carSvg}<span class="map-drive-duration-inner"><span class="map-drive-duration-time">${driveRoute.durationMinutes} min</span>${distStr ? `<span class="map-drive-duration-km">${distStr}</span>` : ""}</span></span>`,
          iconSize: [58, 30],
          iconAnchor: [29, 15],
        });
        L.marker([midCoord[0], midCoord[1]], { icon }).addTo(layer);
      }

      // Zweiten nächsten Punkt als kleinen Marker anzeigen (1. ist bereits Start)
      if (twoNearestLocations.length >= 2) {
        const second = twoNearestLocations[1].location;
        L.circleMarker([second.lat, second.lon], {
          radius: 6,
          fillColor: "#64748b",
          color: "#fff",
          weight: 1.5,
          fillOpacity: 1,
        }).addTo(layer);
      }

      const allPoints: L.LatLng[] = [...latLngs];
      if (userLocationCoords) {
        allPoints.push(L.latLng(userLocationCoords.lat, userLocationCoords.lon));
      }
      twoNearestLocations.forEach(({ location }) => {
        allPoints.push(L.latLng(location.lat, location.lon));
      });
      if (allPoints.length > 0) {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [60, 60], animate: true });
      }
    }
  }, [driveRoute, userLocationCoords, twoNearestLocations]);

  return (
    <div className={`relative h-full w-full min-h-[240px] rounded-lg ${className}`}>
      <div className="h-full min-h-[240px] w-full rounded-lg" ref={mapRef} />
      {!mapReady && (
        <div
          className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-100"
          aria-hidden
        >
          <img
            src="/images/logo_Kitzair.png"
            alt=""
            className="h-10 w-auto max-h-12 object-contain opacity-90"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div
            className="h-8 w-8 rounded-full border-2 border-[var(--kitzair-red)] border-t-transparent animate-spin"
            aria-hidden
          />
          <span className="text-sm font-medium text-slate-600">Karte wird geladen…</span>
        </div>
      )}
    </div>
  );
}
