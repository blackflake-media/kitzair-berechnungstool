/**
 * Wetter-Overlay im Meteoblue-Stil:
 * - Bewölkung & Niederschlag: glatte, interpolierte Flächen (keine Kreise), zoomstabil
 * - Wind: animierte Partikel mit Regenbogen-Farbcodierung (Geschwindigkeit)
 */
import L from "leaflet";
import type { WeatherGridPoint, WeatherHourIndex } from "../../services/weather";
import { fetchWeatherGrid } from "../../services/weather";

const GRID_COLS = 5;
const GRID_ROWS = 5;

/** Feinheit des Interpolations-Gitters für Bewölkung/Niederschlag (in lat/lon-Raum) */
const MESH_COLS = 80;
const MESH_ROWS = 80;

/** Bewölkung: maximale Deckung, weiche Flächen */
const CLOUD_OPACITY_MAX = 0.5;

/** Niederschlag: Transparenz nach Menge */
const PRECIP_OPACITY_SCALE = 0.4;
const PRECIP_OPACITY_MAX = 0.7;

/** Wind-Partikel */
const WIND_PARTICLE_COUNT = 180;
const WIND_PARTICLE_SIZE = 1.8;
const WIND_SPEED_SCALE = 0.00012; // Grad pro Frame bei 1 km/h (lat/lon)
const WIND_RAINBOW_SPEED_MIN = 0;
const WIND_RAINBOW_SPEED_MAX = 60; // km/h für Regenbogen-Skala

export interface WeatherLayerFlags {
  showClouds: boolean;
  showPrecipitation: boolean;
  showWind: boolean;
}

/** Bilineare Interpolation aus dem 5×5-Gitter (sortiert: zuerst nördlichste Zeile, dann lon aufsteigend) */
function getBoundsFromGrid(grid: WeatherGridPoint[]): { south: number; north: number; west: number; east: number } {
  if (grid.length === 0)
    return { south: 0, north: 0, west: 0, east: 0 };
  let south = grid[0]!.lat, north = grid[0]!.lat, west = grid[0]!.lon, east = grid[0]!.lon;
  for (const p of grid) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lon);
    east = Math.max(east, p.lon);
  }
  return { south, north, west, east };
}

/** Liefert interpolierten Wert an (lat, lon). grid ist 5×5, zeilenweise (nord→süd), pro Zeile west→east. */
function interpolate(
  lat: number,
  lon: number,
  grid: WeatherGridPoint[],
  bounds: { south: number; north: number; west: number; east: number }
): { cloudCover: number; precipitationMm: number; windSpeedKmh: number; windDirection: number } {
  if (grid.length < 4) {
    const p = grid[0];
    return p
      ? { cloudCover: p.cloudCover, precipitationMm: p.precipitationMm, windSpeedKmh: p.windSpeedKmh, windDirection: p.windDirection }
      : { cloudCover: 0, precipitationMm: 0, windSpeedKmh: 0, windDirection: 0 };
  }
  const { south, north, west, east } = bounds;
  const r = (lat - south) / (north - south || 1e-6); // 0 = south, 1 = north
  const c = (lon - west) / (east - west || 1e-6);   // 0 = west, 1 = east
  // Grid: row 0 = north, row ROWS-1 = south; col 0 = west, col COLS-1 = east
  const r0 = Math.max(0, Math.min(GRID_ROWS - 1.001, (1 - r) * (GRID_ROWS - 1)));
  const c0 = Math.max(0, Math.min(GRID_COLS - 1.001, c * (GRID_COLS - 1)));
  const ri = Math.floor(r0);
  const ci = Math.floor(c0);
  const rf = r0 - ri;
  const cf = c0 - ci;
  const p00 = grid[ri * GRID_COLS + ci]!;
  const p01 = grid[ri * GRID_COLS + Math.min(ci + 1, GRID_COLS - 1)] ?? p00;
  const p10 = grid[Math.min(ri + 1, GRID_ROWS - 1) * GRID_COLS + ci] ?? p00;
  const p11 = grid[Math.min(ri + 1, GRID_ROWS - 1) * GRID_COLS + Math.min(ci + 1, GRID_COLS - 1)] ?? p00;
  const lerp = (a: number, b: number, c: number, d: number) =>
    (1 - cf) * (1 - rf) * a + cf * (1 - rf) * b + (1 - cf) * rf * c + cf * rf * d;
  const windDir = (a: number, b: number, c: number, d: number) => {
    const u = lerp(Math.cos((a * Math.PI) / 180), Math.cos((b * Math.PI) / 180), Math.cos((c * Math.PI) / 180), Math.cos((d * Math.PI) / 180));
    const v = lerp(Math.sin((a * Math.PI) / 180), Math.sin((b * Math.PI) / 180), Math.sin((c * Math.PI) / 180), Math.sin((d * Math.PI) / 180));
    return (Math.atan2(v, u) * 180) / Math.PI;
  };
  return {
    cloudCover: lerp(p00.cloudCover, p01.cloudCover, p10.cloudCover, p11.cloudCover),
    precipitationMm: lerp(p00.precipitationMm, p01.precipitationMm, p10.precipitationMm, p11.precipitationMm),
    windSpeedKmh: lerp(p00.windSpeedKmh, p01.windSpeedKmh, p10.windSpeedKmh, p11.windSpeedKmh),
    windDirection: windDir(p00.windDirection, p01.windDirection, p10.windDirection, p11.windDirection),
  };
}

/** Regenbogen-Farbe nach Geschwindigkeit (0 = blau/grün, hohe Werte = rot/gelb) */
function windSpeedToRainbowColor(kmh: number): string {
  const t = Math.max(0, Math.min(1, (kmh - WIND_RAINBOW_SPEED_MIN) / (WIND_RAINBOW_SPEED_MAX - WIND_RAINBOW_SPEED_MIN)));
  const r = Math.round(255 * (t < 0.5 ? 0 : (t - 0.5) * 2));
  const g = Math.round(255 * (t < 0.5 ? t * 2 : 2 * (1 - t)));
  const b = Math.round(255 * (1 - t * 2));
  return `rgb(${r},${g},${b})`;
}

export function createWeatherOverlay(
  map: L.Map,
  flightDate: string | null,
  layers: WeatherLayerFlags,
  hourIndex: WeatherHourIndex,
  onLoading?: (loading: boolean) => void
): { remove: () => void; refresh: () => void; updateLayers: (l: WeatherLayerFlags) => void } {
  const container = map.getContainer();
  if (!container)
    return { remove: () => {}, refresh: () => {}, updateLayers: () => {} };

  const wrap = document.createElement("div");
  wrap.className = "leaflet-weather-overlay";
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1000;";
  const canvas = document.createElement("canvas");
  wrap.appendChild(canvas);
  container.style.position = "relative";
  container.appendChild(wrap);

  let gridData: WeatherGridPoint[] = [];
  let gridBounds = getBoundsFromGrid([]);
  let layerFlags: WeatherLayerFlags = { ...layers };
  let rafId: number | null = null;
  let windAnimationId: number | null = null;
  const windParticles: { lat: number; lon: number }[] = [];

  function getMapSize(): { x: number; y: number } | null {
    const size = map.getSize();
    if (size && size.x > 0 && size.y > 0) return size;
    const c = map.getContainer();
    if (c && c.offsetWidth > 0 && c.offsetHeight > 0)
      return { x: c.offsetWidth, y: c.offsetHeight };
    return null;
  }

  function setCanvasSize(): boolean {
    const size = getMapSize();
    if (!size) return false;
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.width = size.x + "px";
    canvas.style.height = size.y + "px";
    return true;
  }

  function drawStaticLayers() {
    const size = getMapSize();
    if (!size || size.x < 10 || size.y < 10) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!gridData.length) return;

    gridBounds = getBoundsFromGrid(gridData);
    const { south, north, west, east } = gridBounds;

    // —— Bewölkung & Niederschlag: dichtes Gitter in lat/lon, pro Zelle ein Quad (zoomstabil) ——
    if (layerFlags.showClouds || layerFlags.showPrecipitation) {
      for (let row = 0; row < MESH_ROWS; row++) {
        for (let col = 0; col < MESH_COLS; col++) {
          const lat0 = south + (north - south) * (row / MESH_ROWS);
          const lon0 = west + (east - west) * (col / MESH_COLS);
          const lat1 = south + (north - south) * ((row + 1) / MESH_ROWS);
          const lon1 = west + (east - west) * ((col + 1) / MESH_COLS);
          const cLat = (lat0 + lat1) / 2;
          const cLon = (lon0 + lon1) / 2;
          const val = interpolate(cLat, cLon, gridData, gridBounds);
          const p00 = map.latLngToContainerPoint(L.latLng(lat0, lon0));
          const p10 = map.latLngToContainerPoint(L.latLng(lat1, lon0));
          const p01 = map.latLngToContainerPoint(L.latLng(lat0, lon1));
          const p11 = map.latLngToContainerPoint(L.latLng(lat1, lon1));
          const minX = Math.min(p00.x, p10.x, p01.x, p11.x);
          const maxX = Math.max(p00.x, p10.x, p01.x, p11.x);
          const minY = Math.min(p00.y, p10.y, p01.y, p11.y);
          const maxY = Math.max(p00.y, p10.y, p01.y, p11.y);
          if (maxX < -2 || minX > size.x + 2 || maxY < -2 || minY > size.y + 2) continue;

          if (layerFlags.showClouds && val.cloudCover > 2) {
            const alpha = (val.cloudCover / 100) * CLOUD_OPACITY_MAX;
            ctx.fillStyle = `rgba(248,252,255,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p00.x, p00.y);
            ctx.lineTo(p10.x, p10.y);
            ctx.lineTo(p11.x, p11.y);
            ctx.lineTo(p01.x, p01.y);
            ctx.closePath();
            ctx.fill();
          }
          if (layerFlags.showPrecipitation && val.precipitationMm > 0.01) {
            const alpha = Math.min(PRECIP_OPACITY_MAX, val.precipitationMm * PRECIP_OPACITY_SCALE);
            ctx.fillStyle = `rgba(70,130,220,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p00.x, p00.y);
            ctx.lineTo(p10.x, p10.y);
            ctx.lineTo(p11.x, p11.y);
            ctx.lineTo(p01.x, p01.y);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
  }

  function drawWindParticles() {
    const size = getMapSize();
    if (!size || !gridData.length || !layerFlags.showWind) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    for (const p of windParticles) {
      const val = interpolate(p.lat, p.lon, gridData, gridBounds);
      const pt = map.latLngToContainerPoint(L.latLng(p.lat, p.lon));
      if (pt.x < -5 || pt.x > size.x + 5 || pt.y < -5 || pt.y > size.y + 5) continue;
      ctx.fillStyle = windSpeedToRainbowColor(val.windSpeedKmh);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, WIND_PARTICLE_SIZE, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function tickWind() {
    if (!gridData.length || !layerFlags.showWind) return;
    const { south, north, west, east } = gridBounds;
    const dLat = (north - south) * 0.1;
    const dLon = (east - west) * 0.1;
    for (const p of windParticles) {
      const val = interpolate(p.lat, p.lon, gridData, gridBounds);
      // Windrichtung = woher der Wind weht (0°=Nord); Partikel in Blasrichtung (+180°). Kompass: (d_lon,d_lat)=(sin(to),cos(to))
      const toDeg = val.windDirection + 180;
      const rad = (toDeg * Math.PI) / 180;
      const step = val.windSpeedKmh * WIND_SPEED_SCALE;
      p.lon += Math.sin(rad) * step;
      p.lat += Math.cos(rad) * step;
      if (p.lat < south - dLat) p.lat = north + dLat * 0.5;
      if (p.lat > north + dLat) p.lat = south - dLat * 0.5;
      if (p.lon < west - dLon) p.lon = east + dLon * 0.5;
      if (p.lon > east + dLon) p.lon = west - dLon * 0.5;
    }
  }

  function draw() {
    if (!setCanvasSize()) return;
    drawStaticLayers();
    drawWindParticles();
  }

  function runAnimation() {
    tickWind();
    draw();
    windAnimationId = requestAnimationFrame(runAnimation);
  }

  function initWindParticles() {
    windParticles.length = 0;
    if (!gridData.length) return;
    gridBounds = getBoundsFromGrid(gridData);
    const { south, north, west, east } = gridBounds;
    for (let i = 0; i < WIND_PARTICLE_COUNT; i++) {
      windParticles.push({
        lat: south + Math.random() * (north - south),
        lon: west + Math.random() * (east - west),
      });
    }
  }

  function load() {
    if (!flightDate || !flightDate.trim()) {
      gridData = [];
      if (windAnimationId != null) {
        cancelAnimationFrame(windAnimationId);
        windAnimationId = null;
      }
      scheduleDraw();
      return;
    }
    const size = getMapSize();
    if (!size || size.x < 10 || size.y < 10) {
      setTimeout(load, 100);
      return;
    }
    onLoading?.(true);
    const bounds = map.getBounds();
    const date = new Date(flightDate + "T12:00:00");
    if (Number.isNaN(date.getTime())) {
      gridData = [];
      onLoading?.(false);
      scheduleDraw();
      return;
    }
    fetchWeatherGrid(
      { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() },
      date,
      GRID_COLS,
      GRID_ROWS,
      hourIndex
    )
      .then((data) => {
        gridData = data;
        gridBounds = getBoundsFromGrid(gridData);
        setCanvasSize();
        initWindParticles();
        if (layerFlags.showWind) {
          if (windAnimationId != null) cancelAnimationFrame(windAnimationId);
          runAnimation();
        } else {
          scheduleDraw();
        }
      })
      .catch(() => {
        gridData = [];
        scheduleDraw();
      })
      .finally(() => onLoading?.(false));
  }

  function scheduleDraw() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      draw();
      rafId = null;
    });
  }

  function updateLayers(l: WeatherLayerFlags) {
    const wasWindOn = layerFlags.showWind;
    layerFlags = { ...l };
    if (l.showWind && gridData.length && !wasWindOn) {
      initWindParticles();
      if (windAnimationId != null) cancelAnimationFrame(windAnimationId);
      runAnimation();
    } else if (!l.showWind && windAnimationId != null) {
      cancelAnimationFrame(windAnimationId);
      windAnimationId = null;
      scheduleDraw();
    } else if (l.showWind && windAnimationId == null && gridData.length) {
      runAnimation();
    } else {
      scheduleDraw();
    }
  }

  const onZoomEnd = () => {
    if (layerFlags.showWind && windAnimationId != null) return;
    scheduleDraw();
  };
  const onResize = () => {
    setCanvasSize();
    if (layerFlags.showWind && gridData.length) draw();
    else scheduleDraw();
  };

  setCanvasSize();
  map.on("moveend", load);
  map.on("zoomend", onZoomEnd);
  map.on("resize", onResize);
  map.whenReady(() => setTimeout(load, 150));

  return {
    remove() {
      map.off("moveend", load);
      map.off("zoomend", onZoomEnd);
      map.off("resize", onResize);
      if (rafId != null) cancelAnimationFrame(rafId);
      if (windAnimationId != null) cancelAnimationFrame(windAnimationId);
      wrap.remove();
    },
    refresh: load,
    updateLayers,
  };
}
