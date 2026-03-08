import type { Leg, MissionResult } from "../../services/calculation";
import { flightTimeHours, getOutboundAndReturnLegs, haversineDistanceKm } from "../../services/calculation";
import { helicopters } from "../../config/helicopters";
import { useTranslation } from "../../i18n";
import type { SunTimes } from "../../services/sunriseSunset";
import { formatTime } from "../../services/sunriseSunset";
import type { Helicopter } from "../../config/helicopters";

const speedKts = helicopters[0]?.speedKts ?? 120;
const BUFFER_MINUTES = 30;

function formatLegDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function formatLegDurationRange(minH: number, maxH: number): string {
  if (minH === maxH || maxH === 0) return formatLegDuration(minH);
  const minM = Math.round(minH * 60);
  const maxM = Math.round(maxH * 60);
  return `${minM}–${maxM} min`;
}

function getLegDurationMinMax(
  displayLegIndex: number,
  results: { helicopter: Helicopter; result: MissionResult }[]
): { minH: number; maxH: number } {
  let minH = Infinity;
  let maxH = -Infinity;
  const legIndex = displayLegIndex + 1;
  for (const { helicopter, result } of results) {
    if (result.legs[legIndex]) {
      const h = flightTimeHours(result.legs[legIndex].distanceKm, helicopter.speedKts);
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
    }
  }
  return { minH: minH === Infinity ? 0 : minH, maxH: maxH === -Infinity ? 0 : maxH };
}

/** Min/Max-Flugzeit für eine Distanz (z. B. Rückflug bei Multileg, der nicht in legs steht). */
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

/** Für "spätestens"-Zeiten: längste Flugzeit (langsamster Heli), damit Heli sicher 30 min vor Sunset an Basis ist. */
function getMaxOutboundHours(
  outboundLegs: Leg[],
  results: { helicopter: Helicopter; result: MissionResult }[]
): number {
  if (outboundLegs.length === 0) return 0;
  let maxTotal = 0;
  for (const { helicopter, result } of results) {
    let sum = 0;
    for (let i = 0; i < outboundLegs.length; i++) {
      const legIndex = i + 1;
      if (result.legs[legIndex]) {
        sum += flightTimeHours(result.legs[legIndex].distanceKm, helicopter.speedKts);
      }
    }
    maxTotal = Math.max(maxTotal, sum);
  }
  return maxTotal > 0 ? maxTotal : outboundLegs.reduce((s, leg) => s + flightTimeHours(leg.distanceKm, speedKts), 0);
}

/** Rückflug-Leg-Index in result.legs (bei 4 Legs: Index 2 = B→A). */
function getMaxReturnHours(
  returnLeg: Leg | null,
  returnDistanceKm: number,
  outboundLegsLength: number,
  results: { helicopter: Helicopter; result: MissionResult }[]
): number {
  if (returnLeg && results.length > 0) {
    const returnLegIndex = outboundLegsLength + 1;
    let maxH = 0;
    for (const { helicopter, result } of results) {
      if (result.legs[returnLegIndex]) {
        maxH = Math.max(maxH, flightTimeHours(result.legs[returnLegIndex].distanceKm, helicopter.speedKts));
      }
    }
    return maxH > 0 ? maxH : flightTimeHours(returnLeg.distanceKm, speedKts);
  }
  if (returnDistanceKm > 0 && results.length > 0) {
    return getDurationMinMaxForDistance(returnDistanceKm, results).maxH;
  }
  return returnDistanceKm > 0 ? flightTimeHours(returnDistanceKm, speedKts) : 0;
}

interface FlightPlanCardProps {
  legs: Leg[] | null;
  sunTimes: SunTimes | null;
  isRoundTrip: boolean;
  returnStopHours?: number;
  /** Für Min–Max-Flugzeiten pro Leg */
  results?: { helicopter: Helicopter; result: MissionResult }[];
  mapStart?: string | null;
  startLocationName?: string | null;
  stopoverNames?: string[];
  hasDestination?: boolean;
  driveDurationMinutes?: number | null;
  driveDistanceKm?: number | null;
  onReset: () => void;
}

/** Sektions-Überschrift im Flugplan */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-300/80 bg-slate-100/90 px-2.5 py-1">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
        {children}
      </h4>
    </div>
  );
}

/** Eine Zeile Zeitfenster (Frühester/Spätester Start) */
function TimeWindowRow({ label, time }: { label: string; time: Date }) {
  const { lang } = useTranslation();
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-slate-600 shrink-0">{label}</span>
      <span className="tabular-nums font-semibold text-slate-800">
        {formatTime(time, lang)}
      </span>
    </div>
  );
}

/** Ein Wegpunkt: links Label + Name; rechts: großer Punkt bei Location, dazwischen kleine Punkte (Linie) + Zeit + kleine Punkte */
function RouteWaypoint({
  label,
  name,
  durationMinMax,
  isFirst,
  isLast,
}: {
  label: string;
  name: string;
  durationMinMax: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1 py-0.5">
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </div>
        <div className="font-semibold text-slate-800 truncate text-xs" title={name}>
          {name}
        </div>
      </div>
      <div className="flex flex-col items-center shrink-0 w-14 mt-[14px]">
        {!isFirst && (
          <div className="w-px min-h-[6px] border-l border-dashed border-slate-400" aria-hidden />
        )}
        <span className="h-3 w-3 rounded-full bg-slate-600 shrink-0" aria-hidden />
        {!isLast && (
          <>
            <div className="w-px min-h-[4px] border-l border-dashed border-slate-400" aria-hidden />
            {durationMinMax ? (
              <span className="text-[10px] tabular-nums text-slate-700 font-semibold py-0.5">
                {durationMinMax}
              </span>
            ) : null}
            <div className="w-px min-h-[6px] border-l border-dashed border-slate-400" aria-hidden />
          </>
        )}
      </div>
    </div>
  );
}

export function FlightPlanCard({
  legs,
  sunTimes,
  isRoundTrip,
  returnStopHours = 3,
  results = [],
  mapStart,
  startLocationName,
  stopoverNames = [],
  hasDestination = false,
  driveDurationMinutes,
  driveDistanceKm = null,
  onReset,
}: FlightPlanCardProps) {
  const { t } = useTranslation();

  const hasStart = !!mapStart && !!startLocationName;
  const hasRoute = hasStart && hasDestination && legs?.length;
  const startPointLine = startLocationName ? `${t("startPoint")} ${startLocationName}` : null;

  const MAX_STOPOVERS = 3;

  if (!hasRoute) {
    return (
      <div className="w-full max-w-sm shrink-0 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b-2 border-slate-200 bg-[#0f172a] px-2.5 py-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-200">
            {t("flightPlan")}
          </h3>
          {hasStart && (
            <button
              type="button"
              onClick={onReset}
              className="rounded border border-slate-500 bg-slate-700/80 px-1.5 py-0.5 text-[11px] font-medium text-slate-200 hover:bg-slate-600 transition-colors"
            >
              {t("resetRoute")}
            </button>
          )}
        </div>
        <div className="px-2.5 py-2 space-y-1.5">
          {/* Schritt 1: Start auswählen */}
          <div
            className={`rounded border px-2.5 py-2 transition-colors ${
              hasStart
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-slate-200 bg-slate-50/50"
            }`}
          >
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              1. {t("stepSelectStart")}
            </div>
            {hasStart && (
              <div className="mt-0.5 font-semibold text-slate-800 text-xs">
                {startLocationName}
              </div>
            )}
          </div>

          {/* Schritt 2: Ziel oder Zwischenstopp auswählen (nur sichtbar wenn Start gewählt) */}
          {hasStart && (
            <>
              <div className="rounded border border-slate-200 bg-slate-50/50 px-2.5 py-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  2. {t("stepSelectDestOrStopover")}
                </div>
                {stopoverNames.length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {stopoverNames.map((name, i) => (
                      <div key={i} className="pl-1.5 border-l-2 border-slate-200 font-semibold text-slate-800 text-xs">
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schritt 3: mit Info wie viele Zwischenstopps noch möglich (wenn bereits mind. ein Stopp) */}
              {stopoverNames.length > 0 && (
                <div className="rounded border border-slate-200 bg-slate-50/50 px-2.5 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    3. {t("stepSelectDestOrStopover")}{" "}
                    <span className="normal-case font-normal text-slate-500">
                      ({t("stopoversRemaining").replace("N", String(Math.max(0, MAX_STOPOVERS - stopoverNames.length)))})
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Anreise-Info wenn Adresse vorhanden */}
          {hasStart && driveDurationMinutes != null && (
            <div className="border-t border-slate-100 pt-1.5 mt-0.5 text-[11px]">
              <span className="font-medium text-slate-700 tabular-nums">
                {t("driveDuration")} {driveDurationMinutes} {t("min")}
              </span>
              {startPointLine && (
                <span className="text-slate-500 ml-1">→ {startLocationName}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const { outboundLegs, returnLeg: returnLegFromData } = getOutboundAndReturnLegs(legs!);

  const bufferHours = BUFFER_MINUTES / 60;
  const toHours = (leg: Leg) => flightTimeHours(leg.distanceKm, speedKts);

  const ferryToStartFromResults = results
    .filter(({ result }) => result.legs[0])
    .map(({ helicopter, result }) => flightTimeHours(result.legs[0].distanceKm, helicopter.speedKts));
  const ferryToStartHours =
    ferryToStartFromResults.length > 0 ? Math.max(...ferryToStartFromResults) : toHours(legs![0]!);

  const lastLegIdx = legs!.length - 1;
  const ferryBackFromResults = results
    .filter(({ result }) => result.legs[lastLegIdx])
    .map(({ helicopter, result }) => flightTimeHours(result.legs[lastLegIdx].distanceKm, helicopter.speedKts));
  const ferryBackHours =
    ferryBackFromResults.length > 0 ? Math.max(...ferryBackFromResults) : toHours(legs![lastLegIdx]!);

  const returnDistanceKm =
    outboundLegs.length > 0 && isRoundTrip
      ? returnLegFromData
        ? returnLegFromData.distanceKm
        : haversineDistanceKm(
            outboundLegs[outboundLegs.length - 1]!.to.lat,
            outboundLegs[outboundLegs.length - 1]!.to.lon,
            outboundLegs[0]!.from.lat,
            outboundLegs[0]!.from.lon
          )
      : 0;

  const outboundTotalHoursForLatest =
    results.length > 0 ? getMaxOutboundHours(outboundLegs, results) : outboundLegs.reduce((sum, leg) => sum + toHours(leg), 0);
  const returnHoursForLatest =
    results.length > 0
      ? getMaxReturnHours(returnLegFromData, returnDistanceKm, outboundLegs.length, results)
      : returnDistanceKm > 0 ? flightTimeHours(returnDistanceKm, speedKts) : 0;
  const returnHoursSingle = returnDistanceKm > 0 ? flightTimeHours(returnDistanceKm, speedKts) : 0;

  const earliestStartAtA =
    sunTimes &&
    new Date(sunTimes.sunrise.getTime() + (ferryToStartHours + bufferHours) * 3600 * 1000);

  let latestStartAtA: Date | null = null;
  let latestDepartFromDest: Date | null = null;

  if (sunTimes && legs!.length >= 3) {
    const latestArrivalAtBase = sunTimes.sunset.getTime() - bufferHours * 3600 * 1000;
    // Heli muss 30 min vor Sunset an Basis KitzAir sein; alle "spätestens"-Zeiten rückwärts daraus
    if (!isRoundTrip) {
      latestStartAtA = new Date(
        latestArrivalAtBase - (ferryBackHours + outboundTotalHoursForLatest) * 3600 * 1000
      );
    } else {
      latestStartAtA = new Date(
        latestArrivalAtBase -
          (ferryBackHours + returnHoursForLatest + returnStopHours + outboundTotalHoursForLatest) * 3600 * 1000
      );
      latestDepartFromDest = new Date(
        latestArrivalAtBase - (ferryBackHours + returnHoursForLatest) * 3600 * 1000
      );
    }
  }

  const startName = outboundLegs[0]?.from.name ?? legs![0]!.to.name;

  const waypointNames: string[] =
    outboundLegs.length > 0
      ? [outboundLegs[0]!.from.name, ...outboundLegs.map((leg) => leg.to.name)]
      : [];

  const outboundRows: { label: string; name: string; durationMinMax: string }[] = waypointNames.map((name, i) => {
    const isFirst = i === 0;
    const isLast = i === waypointNames.length - 1;
    const label = isFirst ? t("routeLabelStart") : isLast ? t("routeLabelEnd") : t("routeLabelStop");
    const durationMinMax =
      isLast
        ? ""
        : results.length > 0
          ? formatLegDurationRange(getLegDurationMinMax(i, results).minH, getLegDurationMinMax(i, results).maxH)
          : formatLegDuration(flightTimeHours(outboundLegs[i]!.distanceKm, speedKts));
    return { label, name, durationMinMax };
  });

  let returnRows: { label: string; name: string; durationMinMax: string }[] = [];
  if (isRoundTrip && outboundLegs.length > 0) {
    const destName = outboundLegs[outboundLegs.length - 1]!.to.name;
    const returnDurationMinMax =
      results.length > 0
        ? returnLegFromData
          ? formatLegDurationRange(
              getLegDurationMinMax(outboundLegs.length, results).minH,
              getLegDurationMinMax(outboundLegs.length, results).maxH
            )
          : formatLegDurationRange(
              getDurationMinMaxForDistance(returnDistanceKm, results).minH,
              getDurationMinMaxForDistance(returnDistanceKm, results).maxH
            )
        : formatLegDuration(returnHoursSingle);
    returnRows = [
      { label: t("routeLabelStart"), name: destName, durationMinMax: returnDurationMinMax },
      { label: t("routeLabelEnd"), name: startName, durationMinMax: "" },
    ];
  }

  return (
    <div className="w-full max-w-sm shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b-2 border-slate-200 bg-[#0f172a] px-2.5 py-2">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-200">
          {t("flightPlan")}
        </h3>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-slate-500 bg-slate-700/80 px-1.5 py-0.5 text-[11px] font-medium text-slate-200 hover:bg-slate-600 transition-colors"
        >
          {t("resetRoute")}
        </button>
      </div>

      {/* Sektion: Anreise */}
      <div className="border-b border-slate-200">
        <SectionTitle>{t("arrival")}</SectionTitle>
        <div className="px-2.5 py-2">
          {driveDurationMinutes != null ? (
            <div className="flex gap-2">
              <div className="min-w-0 flex-1 py-0.5">
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {t("driveDurationFromLocationTo")}
                </div>
                <div className="font-semibold text-slate-800 truncate text-xs" title={startLocationName ?? undefined}>
                  {startLocationName ?? startPointLine ?? ""}
                </div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">
                  {driveDurationMinutes} {t("min")}
                  {driveDistanceKm != null && (
                    <span className="ml-1.5 text-xs text-slate-600 font-normal">
                      {driveDistanceKm.toFixed(1)} km
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : startLocationName ? (
            <p className="text-slate-600 text-[11px]">
              {t("noArrivalPlanned").replace("NAME", startLocationName)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Sektion: Flugroute */}
      <div className="border-b border-slate-200">
        <SectionTitle>{t("flightRoute")}</SectionTitle>
        <div className="px-2.5 py-2 space-y-0">
          {outboundRows.map((row, i) => (
            <RouteWaypoint
              key={i}
              label={row.label}
              name={row.name}
              durationMinMax={row.durationMinMax}
              isFirst={i === 0}
              isLast={i === outboundRows.length - 1}
            />
          ))}
        </div>
        {(earliestStartAtA || latestStartAtA) && (
          <div className="px-2.5 pb-2 pt-0.5 space-y-0.5 border-t border-slate-100">
            {earliestStartAtA && <TimeWindowRow label={t("earliestStart")} time={earliestStartAtA} />}
            {latestStartAtA && <TimeWindowRow label={t("latestStart")} time={latestStartAtA} />}
          </div>
        )}
      </div>

      {/* Sektion: Rückflug */}
      {isRoundTrip && returnRows.length > 0 && (
        <div>
          <SectionTitle>{t("returnFlight")}</SectionTitle>
          <div className="px-2.5 py-2 space-y-0">
            {returnRows.map((row, i) => (
              <RouteWaypoint
                key={i}
                label={row.label}
                name={row.name}
                durationMinMax={row.durationMinMax}
                isFirst={i === 0}
                isLast={i === returnRows.length - 1}
              />
            ))}
          </div>
          {latestDepartFromDest && (
            <div className="px-2.5 pb-2 pt-0.5 space-y-0.5 border-t border-slate-100">
              <TimeWindowRow label={t("latestReturn")} time={latestDepartFromDest} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
