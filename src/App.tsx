import { useState, useMemo, useEffect } from "react";
import { locations } from "./config/locations";
import { helicopters } from "./config/helicopters";
import {
  calculateMission,
  getNearestLocations,
  getOutboundAndReturnLegs,
  type MissionType,
  type MissionResult,
  type Leg,
} from "./services/calculation";
import { getLocationById, getBaseLocation } from "./config/locations";
import { fetchDrivingRoute, fetchDrivingRouteForWaypoints } from "./services/routing";
import { fetchWeather } from "./services/weather";
import { getSunTimes, formatTime } from "./services/sunriseSunset";
import type { WeatherData } from "./services/weather";
import type { SunTimes } from "./services/sunriseSunset";
import { RouteMap, FlightPlanCard, MapWeatherOverlay } from "./components/Map";
import { RouteCard } from "./components/RouteCard";
import { AddressSearch } from "./components/AddressSearch";
import { useTranslation } from "./i18n";
import { vfrWind, vfrCloudCover, vfrPrecipitation } from "./services/vfrLimits";
import type { VfrLight } from "./services/vfrLimits";
import DatePicker, { registerLocale } from "react-datepicker";
import { de, enGB } from "date-fns/locale";

registerLocale("de", de);
registerLocale("en", enGB);

const isEmbed =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("embed") === "1";

function App() {
  const { t, lang, setLang } = useTranslation();
  const [flightDate, setFlightDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  /** Bei Hin & Retour: Stop in Stunden bis zum Rückflug (für Wetter-Rückflug-Zeit), Standard 3 */
  const [returnStopHours, setReturnStopHours] = useState(3);
  const [mapStart, setMapStart] = useState<string | null>(null);
  const [mapStopovers, setMapStopovers] = useState<string[]>([]);
  const [mapDestination, setMapDestination] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [routeWeatherRows, setRouteWeatherRows] = useState<
    { label: string; data: WeatherData | null }[]
  >([]);
  const [routeWeatherLoading, setRouteWeatherLoading] = useState(false);
  /** Vormittag / Mittag / Nachmittag – für besseren Fliegbarkeits-Forecast */
  const [flightTimeOfDay, setFlightTimeOfDay] = useState<"morning" | "noon" | "afternoon">("noon");
  const [sunTimes, setSunTimes] = useState<SunTimes | null>(null);
  const [userLocationCoords, setUserLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  /** Standort vom Browser (einmalig beim Laden), um Adressfeld vorzufüllen */
  const [browserLocationForAddress, setBrowserLocationForAddress] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [nearestFromAddress, setNearestFromAddress] = useState<import("./config/locations").Location | null>(null);
  const [driveRoute, setDriveRoute] = useState<{
    coordinates: [number, number][];
    durationMinutes: number;
    distanceKm: number;
  } | null>(null);
  const [twoNearestLocations, setTwoNearestLocations] = useState<
    { location: import("./config/locations").Location; distanceKm: number }[]
  >([]);
  /** Auto-Route (gleiche Wegpunkte wie Flug) für Vergleich in Heli-Karten */
  const [routeDriving, setRouteDriving] = useState<{
    durationMinutes: number;
    distanceKm: number;
  } | null>(null);
  const twoNearestToBase = useMemo(() => {
    if (userLocationCoords || (driveRoute?.coordinates?.length ?? 0) > 0) return [];
    const base = getBaseLocation();
    return getNearestLocations(base.lat, base.lon, 2, true);
  }, [userLocationCoords, driveRoute]);

  // Route ab mind. 2 Orten (Start+Ziel oder Start+Stopover) – Zeichnung auch ohne Ziel
  const locationIds = useMemo(() => {
    if (!mapStart) return [];
    return [mapStart, ...mapStopovers, mapDestination].filter(Boolean) as string[];
  }, [mapStart, mapStopovers, mapDestination]);

  const missionType: MissionType =
    locationIds.length > 2
      ? "multileg"
      : isRoundTrip
        ? "round-trip"
        : "a-to-b";

  const results = useMemo(() => {
    if (locationIds.length < 2) return [];
    const arr: { helicopter: (typeof helicopters)[0]; result: MissionResult }[] = [];
    for (const heli of helicopters) {
      const result = calculateMission(heli, missionType, locationIds, returnStopHours);
      if (result) arr.push({ helicopter: heli, result });
    }
    return arr;
  }, [missionType, locationIds, isRoundTrip, returnStopHours]);

  const legs: Leg[] | null = useMemo(() => {
    if (results.length === 0) return null;
    return results[0].result.legs;
  }, [results]);

  const hasValidInput = !!mapStart && !!mapDestination;

  /** Beim Laden: Standort abfragen, um Adressfeld automatisch vorzufüllen (Browser zeigt Berechtigungs-Dialog) */
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBrowserLocationForAddress({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 }
    );
  }, []);

  /** Sunrise/Sunset nur vom Flugdatum abhängig – sofort sichtbar */
  useEffect(() => {
    if (!flightDate) {
      setSunTimes(null);
      return;
    }
    const date = new Date(flightDate);
    const base = getBaseLocation();
    setSunTimes(getSunTimes(date, base.lat, base.lon));
  }, [flightDate]);

  useEffect(() => {
    if (!flightDate || !legs?.length) {
      setWeather(null);
      setRouteWeatherRows([]);
      return;
    }
    const date = new Date(flightDate);
    const midLat =
      legs.reduce((s, leg) => s + leg.from.lat + leg.to.lat, 0) /
      (legs.length * 2);
    const midLon =
      legs.reduce((s, leg) => s + leg.from.lon + leg.to.lon, 0) /
      (legs.length * 2);
    const hour = flightTimeOfDay === "morning" ? 9 : flightTimeOfDay === "noon" ? 12 : 15;
    setWeatherLoading(true);
    fetchWeather(midLat, midLon, date, hour)
      .then(setWeather)
      .finally(() => setWeatherLoading(false));

    const { outboundLegs: displayLegs } = getOutboundAndReturnLegs(legs);

    if (displayLegs.length === 0) {
      setRouteWeatherRows([]);
      return;
    }
    const singleEnroute = displayLegs.length === 1;
    const points: { label: string; lat: number; lon: number; hourOffset?: number }[] = [
      { label: t("departure"), lat: displayLegs[0].from.lat, lon: displayLegs[0].from.lon },
      ...displayLegs.map((leg, i) => ({
        label: singleEnroute ? t("enroute") : `${t("enroute")} ${i + 1}`,
        lat: (leg.from.lat + leg.to.lat) / 2,
        lon: (leg.from.lon + leg.to.lon) / 2,
      })),
      { label: t("destination"), lat: displayLegs[displayLegs.length - 1].to.lat, lon: displayLegs[displayLegs.length - 1].to.lon },
    ];
    if (isRoundTrip) {
      points.push({
        label: t("returnFlight"),
        lat: displayLegs[0].from.lat,
        lon: displayLegs[0].from.lon,
        hourOffset: returnStopHours,
      });
    }
    setRouteWeatherLoading(true);
    Promise.all(
      points.map((p) => {
        const h = (hour + (p.hourOffset ?? 0)) % 24;
        return fetchWeather(p.lat, p.lon, date, h);
      })
    )
      .then((data) =>
        setRouteWeatherRows(points.map((p, i) => ({ label: p.label, data: data[i] ?? null })))
      )
      .finally(() => setRouteWeatherLoading(false));
  }, [flightDate, legs, flightTimeOfDay, isRoundTrip, returnStopHours, t]);

  /** Auto-Route für gleiche Wegpunkte wie Flug (Vergleich in Heli-Karte) */
  useEffect(() => {
    if (!legs?.length) {
      setRouteDriving(null);
      return;
    }
    const { outboundLegs, returnLeg } = getOutboundAndReturnLegs(legs);
    if (outboundLegs.length === 0) {
      setRouteDriving(null);
      return;
    }
    const waypoints: { lat: number; lon: number }[] = [
      outboundLegs[0].from,
      ...outboundLegs.map((l) => l.to),
    ];
    if (isRoundTrip && returnLeg) {
      waypoints.push(outboundLegs[0].from);
    }
    fetchDrivingRouteForWaypoints(waypoints).then((r) =>
      setRouteDriving(r ? { durationMinutes: r.durationMinutes, distanceKm: r.distanceKm } : null)
    );
  }, [legs, isRoundTrip]);

  const locale = lang === "de" ? "de-AT" : "en-GB";
  const weatherDataAvailableUntil = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 16);
    return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  }, [locale]);

  const dateLabel = flightDate
    ? new Date(flightDate).toLocaleDateString(locale, {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : undefined;

  /** Schlechtester VFR-Status über alle Wegpunkte (für Wetter-Status-Kachel) */
  const weatherStatus = useMemo((): VfrLight | null => {
    if (routeWeatherLoading || routeWeatherRows.length === 0) return null;
    const withData = routeWeatherRows.filter((r) => r.data != null) as { label: string; data: import("./services/weather").WeatherData }[];
    if (withData.length === 0) return null;
    let worst: VfrLight = "green";
    for (const row of withData) {
      const d = row.data;
      const w = vfrWind(d.windSpeedKmh);
      const c = vfrCloudCover(d.cloudCover);
      const p = vfrPrecipitation(d.precipitationMm);
      if (w === "red" || c === "red" || p === "red") worst = "red";
      else if (worst !== "red" && (w === "yellow" || c === "yellow" || p === "yellow")) worst = "yellow";
    }
    return worst;
  }, [routeWeatherRows, routeWeatherLoading]);

  function handleMapSelectStart(id: string) {
    setMapStart(id);
    setMapStopovers([]);
    setMapDestination(null);
  }
  function handleMapSelectStopover(id: string) {
    if (mapStopovers.includes(id)) return;
    setMapStopovers((prev) => [...prev, id]);
  }
  function handleMapSelectDestination(id: string) {
    setMapDestination(id);
  }
  function handleMapReset() {
    setMapStart(null);
    setMapStopovers([]);
    setMapDestination(null);
    setUserLocationCoords(null);
    setNearestFromAddress(null);
    setDriveRoute(null);
    setTwoNearestLocations([]);
    setIsRoundTrip(false);
  }

  // Straßenroute + 2 nächste Punkte wenn Adresse gewählt
  useEffect(() => {
    if (!userLocationCoords) {
      setDriveRoute(null);
      setTwoNearestLocations([]);
      return;
    }
    const two = getNearestLocations(
      userLocationCoords.lat,
      userLocationCoords.lon,
      2,
      true
    );
    setTwoNearestLocations(two);
    const startId = mapStart ?? nearestFromAddress?.id ?? null;
    if (!startId || two.length === 0) {
      setDriveRoute(null);
      return;
    }
    const startLoc = getLocationById(startId);
    if (!startLoc) {
      setDriveRoute(null);
      return;
    }
    fetchDrivingRoute(userLocationCoords, { lat: startLoc.lat, lon: startLoc.lon })
      .then((route) => setDriveRoute(route ? { coordinates: route.coordinates, durationMinutes: route.durationMinutes, distanceKm: route.distanceKm } : null))
      .catch(() => setDriveRoute(null));
  }, [userLocationCoords, mapStart, nearestFromAddress?.id]);

  return (
    <div className="min-h-screen w-full bg-slate-100 py-2 px-3 sm:py-3 sm:px-4">
      <div className="mx-auto w-full max-w-[1600px] rounded-lg border border-slate-200/90 bg-white shadow-sm overflow-hidden">
        {/* Header: kompakt, eine Zeile wo möglich */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-slate-800 sm:text-base">
              {t("title")}
              {!isEmbed && (
                <span className="font-normal text-slate-500 ml-1.5 hidden sm:inline">– {t("subtitle")}</span>
              )}
            </h1>
            {!isEmbed && (
              <p className="mt-0.5 text-[11px] text-slate-500 sm:hidden">
                {t("subtitle")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-slate-200 bg-slate-50/80 p-0.5" role="group" aria-label={t("language")}>
              <button
                type="button"
                onClick={() => setLang("de")}
                aria-pressed={lang === "de"}
                title="Deutsch"
                className={`rounded px-2 py-1 text-base leading-none transition ${
                  lang === "de"
                    ? "bg-slate-200/80 ring-1 ring-slate-300"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                🇩🇪
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
                title="English"
                className={`rounded px-2 py-1 text-base leading-none transition ${
                  lang === "en"
                    ? "bg-slate-200/80 ring-1 ring-slate-300"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                🇬🇧
              </button>
            </div>
          </div>
        </header>

        <div className="p-3 sm:p-4 space-y-2">
          {/* Eingabe: kompakt */}
          <section className="rounded-lg border border-slate-200/90 bg-slate-50/50 px-3 py-2 sm:px-3 sm:py-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
              <div className="flex-1 min-w-0 sm:min-w-[180px]">
                <label className="mb-0.5 block text-[11px] font-medium text-slate-500">
                  {t("address")}
                </label>
                <AddressSearch
                    onAddressSelected={(searchCoords, nearestLocation, _distanceKm) => {
                      setUserLocationCoords(searchCoords);
                      setNearestFromAddress(nearestLocation);
                    }}
                    onClear={() => {
                      setUserLocationCoords(null);
                      setNearestFromAddress(null);
                      setDriveRoute(null);
                      setTwoNearestLocations([]);
                      setMapStart(null);
                      setMapStopovers([]);
                      setMapDestination(null);
                    }}
                    initialPosition={browserLocationForAddress}
                  />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <div className="kitzair-datepicker-wrapper">
                  <label
                    htmlFor="flight-date"
                    className="mb-0.5 block text-[11px] font-medium text-slate-500"
                  >
                    {t("flightDate")}
                  </label>
                  <DatePicker
                    id="flight-date"
                    selected={flightDate ? new Date(flightDate + "T12:00:00") : null}
                    onChange={(d: Date | null) => setFlightDate(d ? d.toISOString().slice(0, 10) : "")}
                    minDate={new Date()}
                    locale={lang === "de" ? "de" : "en"}
                    dateFormat={lang === "de" ? "dd.MM.yyyy" : "dd/MM/yyyy"}
                    placeholderText={lang === "de" ? "TT.MM.JJJJ" : "DD/MM/YYYY"}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[var(--kitzair-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--kitzair-primary)]/25 sm:w-[9.5rem]"
                  />
                </div>
                <div>
                  <span className="mb-0.5 block text-[11px] font-medium text-slate-500">
                    {t("flightTimeOfDay")}
                  </span>
                  <div className="flex rounded border border-slate-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setFlightTimeOfDay("morning")}
                      aria-pressed={flightTimeOfDay === "morning"}
                      className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                        flightTimeOfDay === "morning"
                          ? "bg-slate-200/80 text-slate-800"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      {t("morning")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlightTimeOfDay("noon")}
                      aria-pressed={flightTimeOfDay === "noon"}
                      className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                        flightTimeOfDay === "noon"
                          ? "bg-slate-200/80 text-slate-800"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      {t("midday")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlightTimeOfDay("afternoon")}
                      aria-pressed={flightTimeOfDay === "afternoon"}
                      className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                        flightTimeOfDay === "afternoon"
                          ? "bg-slate-200/80 text-slate-800"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      {t("afternoon")}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="mb-0.5 block text-[11px] font-medium text-slate-500">
                    {t("missionType")}
                  </span>
                  <div className="flex rounded border border-slate-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setIsRoundTrip(false)}
                      aria-pressed={!isRoundTrip}
                      className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                        !isRoundTrip
                          ? "bg-slate-200/80 text-slate-800"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      {t("onewayTransfer")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRoundTrip(true)}
                      aria-pressed={isRoundTrip}
                      className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                        isRoundTrip
                          ? "bg-slate-200/80 text-slate-800"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      {t("roundTrip")}
                    </button>
                  </div>
                </div>
                {isRoundTrip && (
                  <div>
                    <label
                      htmlFor="return-stop-hours"
                      className="mb-0.5 block text-[11px] font-medium text-slate-500"
                    >
                      {t("stopUntilReturn")}
                    </label>
                    <select
                      id="return-stop-hours"
                      value={returnStopHours}
                      onChange={(e) => setReturnStopHours(Number(e.target.value))}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-[var(--kitzair-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--kitzair-primary)]/25 sm:w-[4rem]"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                        <option key={h} value={h}>
                          {h} {t("h")}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Reiseroute + Karte + Heli-Karten */}
          <section>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
              {/* Linke Spalte: Reiseroute + Kacheln (Sunrise/Sunset, Indikativ, Wetter-Status) */}
              <div className="flex flex-col gap-2 shrink-0 w-full max-w-sm lg:w-auto">
                <FlightPlanCard
                legs={legs}
                sunTimes={sunTimes}
                isRoundTrip={isRoundTrip}
                returnStopHours={returnStopHours}
                results={results}
                mapStart={mapStart}
                startLocationName={mapStart ? getLocationById(mapStart)?.name ?? null : null}
                stopoverNames={mapStopovers.map((id) => getLocationById(id)?.name).filter(Boolean) as string[]}
                hasDestination={!!mapDestination}
                driveDurationMinutes={driveRoute?.durationMinutes ?? null}
                driveDistanceKm={driveRoute?.distanceKm ?? null}
                onReset={handleMapReset}
              />
                {/* Kacheln unter der Reiseroute – volle Spaltenbreite */}
                <div className="flex flex-col gap-1.5 w-full" role="status">
                  <div className="w-full rounded border border-slate-200 bg-slate-50/80 px-2 py-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                      {t("sunriseSunset")}
                    </div>
                    {(dateLabel || sunTimes) ? (
                      <p className="text-[11px] text-slate-700">
                        {[dateLabel, sunTimes && `${t("sunrise")} ${formatTime(sunTimes.sunrise, lang)}, ${t("sunset")} ${formatTime(sunTimes.sunset, lang)}`].filter(Boolean).join(" · ")}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500">{t("sunriseSunsetNoData")}</p>
                    )}
                  </div>
                  <div className="w-full rounded border border-slate-200 bg-slate-50/80 px-2 py-1.5">
                    <p className="text-[11px] font-bold text-[var(--kitzair-red)] leading-tight">{t("indicativeDisclaimer")}</p>
                  </div>
                </div>
              </div>
              {/* Karte: Höhe begrenzen (max-h), damit Wetter-Bar wirklich am Karten-Unterrand klebt (nicht unter der Spalte). */}
              <div className="flex-1 min-w-0 flex flex-col min-h-[280px] max-h-[112vh] md:max-h-[75vh] lg:min-h-[260px] lg:max-h-none">
                <div className="flex-1 min-w-0 min-h-0 rounded-lg overflow-hidden relative flex flex-col">
                  <RouteMap
                    locations={locations}
                    legs={legs}
                    results={results}
                    mapStart={mapStart}
                    mapStopovers={mapStopovers}
                    mapDestination={mapDestination}
                    isRoundTrip={isRoundTrip}
                    userLocationCoords={userLocationCoords}
                    driveRoute={driveRoute}
                    twoNearestLocations={twoNearestLocations}
                    twoNearestToBase={twoNearestToBase}
                    onSelectStart={handleMapSelectStart}
                    onSelectStopover={handleMapSelectStopover}
                    onSelectDestination={handleMapSelectDestination}
                    t={t}
                    className="flex-1"
                  />
                  {/* Wettervorhersage-Box (mit LEDs): nur ab Tablet */}
                  {legs && legs.length > 0 && (
                    <div className="hidden md:block absolute top-2 right-2 z-[1000]">
                      <MapWeatherOverlay
                        rows={routeWeatherRows}
                        loading={routeWeatherLoading}
                        dataAvailableUntil={weatherDataAvailableUntil}
                        flightDateFormatted={
                          flightDate
                            ? new Date(flightDate).toLocaleDateString(lang === "de" ? "de-AT" : "en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : null
                        }
                      />
                    </div>
                  )}
                  {/* Wetter-Meldung: ein Feld am unteren Rand der Karte (volle Breite), Inhalt rechtsbündig – wie vorher */}
                  <div
                    className="absolute bottom-0 left-0 right-0 z-[1000] flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-2 py-1.5 bg-slate-900/90 text-slate-100 text-[11px] leading-tight rounded-b-lg"
                    aria-label={t("weather")}
                  >
                    {weatherStatus != null && (
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            weatherStatus === "green"
                              ? "bg-emerald-400"
                              : weatherStatus === "yellow"
                                ? "bg-amber-400"
                                : "bg-red-400"
                          }`}
                          aria-hidden
                        />
                        <span>
                          {weatherStatus === "green"
                            ? t("weatherStatusGood")
                            : weatherStatus === "yellow"
                              ? t("weatherStatusObserve")
                              : t("weatherStatusPoor")}
                        </span>
                      </span>
                    )}
                    <span className="tabular-nums">
                      {weatherLoading
                        ? t("weatherLoading")
                        : weather
                          ? `${Math.round(weather.temperature)} °C, ${t("wind")} ${weather.windSpeedKmh.toFixed(0)} km/h, ${weather.cloudCover} % ${t("cloudCover")}, ${weather.precipitationMm} mm ${t("precipitation")}`
                          : hasValidInput && flightDate
                            ? t("weatherNoData")
                            : "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4 items-end shrink-0 w-full max-w-[360px]">
                {helicopters.map((helicopter) => (
                  <RouteCard
                    key={helicopter.id}
                    helicopter={helicopter}
                    result={results.find((r) => r.helicopter.id === helicopter.id)?.result ?? null}
                    legs={legs}
                    isRoundTrip={isRoundTrip}
                    routeDriving={routeDriving}
                    hasDestination={hasValidInput}
                  />
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>
      <p className="text-center text-[11px] text-slate-400 py-1.5" aria-label="Powered by KitzAir OS">
        Powered by KitzAir OS
        {getBaseLocation().icao && (
          <span className="ml-1 opacity-80">· Basis {getBaseLocation().icao}</span>
        )}
      </p>
    </div>
  );
}

export default App;
