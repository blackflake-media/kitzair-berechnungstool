import type { Helicopter } from "../../config/helicopters";
import type { Leg, MissionResult } from "../../services/calculation";
import { getOutboundAndReturnLegs, flightTimeHours } from "../../services/calculation";
import { useTranslation } from "../../i18n";
import type { Lang } from "../../i18n";

interface RouteCardProps {
  helicopter: Helicopter;
  result: MissionResult | null;
  legs: Leg[] | null;
  isRoundTrip: boolean;
  routeDriving: { durationMinutes: number; distanceKm: number } | null;
  /** Wie Reiseroute: Preis/Daten erst anzeigen wenn Ziel eingegeben */
  hasDestination?: boolean;
}

function formatHours(h: number, t: (k: "min" | "h") => string): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  if (hours === 0) return `${minutes} ${t("min")}`;
  if (minutes === 0) return `${hours} ${t("h")}`;
  return `${hours} ${t("h")} ${minutes} ${t("min")}`;
}

/** Autofahrt: Minuten → "X h Y min" (Vergleich mit Flugzeit) */
function formatDurationMinutes(totalMinutes: number, t: (k: "min" | "h") => string): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} ${t("min")}`;
  if (minutes === 0) return `${hours} ${t("h")}`;
  return `${hours} ${t("h")} ${minutes} ${t("min")}`;
}

/** Auf nächste 5 EUR aufrunden (z. B. 2043 → 2045) */
function roundUpToNearest5(value: number): number {
  return Math.ceil(value / 5) * 5;
}

function formatPrice(value: number, lang: Lang): string {
  const locale = lang === "de" ? "de-AT" : "en-GB";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Ein Wegpunkt: Punkt und Name in gleicher Höhe zentriert; links Punkte+Zeit, daneben Name */
const ROW_HEIGHT_FIRST = 14;
const ROW_HEIGHT_NEXT = 18; /* 2px Linie + 14px Punkt-Zone, Mitte bei 9px = Name-Mitte */

function RouteWaypointRow({
  name,
  duration,
  isFirst,
  isLast,
}: {
  name: string;
  duration: string | null;
  isFirst: boolean;
  isLast: boolean;
}) {
  const rowMinH = isFirst ? ROW_HEIGHT_FIRST : ROW_HEIGHT_NEXT;
  return (
    <div
      className="flex gap-1.5 items-center"
      style={{ minHeight: rowMinH }}
    >
      <div className="flex flex-col items-center shrink-0 w-10">
        {!isFirst && (
          <div className="w-px min-h-[2px] border-l border-dashed border-slate-400" aria-hidden />
        )}
        <div className="flex items-center justify-center h-[14px] shrink-0">
          <span className="h-2 w-2 rounded-full bg-slate-600 shrink-0" aria-hidden />
        </div>
        {!isLast && (
          <>
            <div className="w-px min-h-[1px] border-l border-dashed border-slate-400" aria-hidden />
            {duration ? (
              <span className="text-[9px] tabular-nums text-slate-600 font-medium py-0 leading-none">
                {duration}
              </span>
            ) : null}
            <div className="w-px min-h-[2px] border-l border-dashed border-slate-400" aria-hidden />
          </>
        )}
      </div>
      <div className="min-w-0 flex-1 flex items-center py-0">
        <div className="font-medium text-slate-800 truncate text-[11px] leading-tight w-full" title={name}>
          {name}
        </div>
      </div>
    </div>
  );
}

export function RouteCard({
  helicopter,
  result,
  legs,
  isRoundTrip,
  routeDriving,
  hasDestination = false,
}: RouteCardProps) {
  const { t, lang } = useTranslation();
  const showContent = hasDestination && result != null && legs != null && legs.length > 0;
  const { outboundLegs, returnLeg } = legs ? getOutboundAndReturnLegs(legs) : { outboundLegs: [], returnLeg: null };

  const outboundRows: { name: string; duration: string | null }[] = [];
  /** Gesamtstrecke und -flugzeit nur Legs (ohne Ferry Base→Start und Ziel→Base) */
  const customerDistanceKm =
    showContent && outboundLegs.length > 0
      ? outboundLegs.reduce((s, leg) => s + leg.distanceKm, 0) +
        (returnLeg ? returnLeg.distanceKm : 0)
      : 0;
  const customerFlightTimeHours =
    showContent && result && outboundLegs.length > 0
      ? outboundLegs.reduce((s, leg) => s + flightTimeHours(leg.distanceKm, helicopter.speedKts), 0) +
        (returnLeg ? flightTimeHours(returnLeg.distanceKm, helicopter.speedKts) : 0)
      : 0;

  if (showContent && result && outboundLegs.length > 0) {
    const names = [outboundLegs[0].from.name, ...outboundLegs.map((l) => l.to.name)];
    for (let i = 0; i < names.length; i++) {
      const duration =
        i < outboundLegs.length
          ? formatHours(flightTimeHours(outboundLegs[i].distanceKm, helicopter.speedKts), t)
          : null;
      outboundRows.push({ name: names[i] ?? "", duration });
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden shadow-sm w-full max-w-[360px] min-h-[300px] flex flex-col shrink-0">
      {/* Erste Zeile: links Name + Daten, rechts Bild */}
      <div className="flex gap-2 p-2 border-b border-slate-200/80">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <h3 className="text-xs font-semibold text-[var(--kitzair-red)] leading-tight">{helicopter.name}</h3>
            {showContent && isRoundTrip && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--kitzair-red)]">
                {t("roundTrip")}
              </span>
            )}
          </div>
          {helicopter.specs && helicopter.specs.length > 0 && (
            <ul className="mt-0.5 space-y-0 text-[11px] text-slate-600 list-none">
              {helicopter.specs.map((s, i) => (
                <li key={i} className="flex gap-1"><span className="shrink-0">•</span><span>{s}</span></li>
              ))}
            </ul>
          )}
          {showContent && result && (
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0 text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t("distance")}</dt>
                <dd className="font-medium text-slate-800 tabular-nums">
                  {customerDistanceKm.toFixed(1)} km
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t("flightTime")}</dt>
                <dd className="font-medium text-slate-800 tabular-nums">
                  {formatHours(customerFlightTimeHours, t)}
                </dd>
              </div>
            </dl>
          )}
        </div>
        {helicopter.imageUrl && (
          <div className="w-20 h-20 shrink-0 rounded overflow-hidden bg-slate-200">
            <img
              src={
                helicopter.imageUrl.startsWith("http")
                  ? helicopter.imageUrl
                  : `${import.meta.env.BASE_URL}${helicopter.imageUrl.replace(/^\//, "")}`
              }
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>

      {/* Inhalt: Itinerary + Auto-Vergleich oder Platzhalter */}
      {!showContent && (
        <div className="flex-1 flex items-center justify-center p-4 border-b border-slate-200/80">
          <p className="text-sm text-slate-500 text-center">{t("noRouteEntered")}</p>
        </div>
      )}
      {showContent && outboundRows.length > 0 && (
        <div className="grid grid-cols-[1fr,1fr] gap-1.5 p-1.5 border-b border-slate-200/80">
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
              {t("flightRoute")}
            </div>
            <div className="space-y-0">
              {outboundRows.map((row, i) => (
                <RouteWaypointRow
                  key={i}
                  name={row.name}
                  duration={row.duration}
                  isFirst={i === 0}
                  isLast={i === outboundRows.length - 1}
                />
              ))}
            </div>
            {isRoundTrip && returnLeg && (
              <div className="mt-1 pt-1 border-t border-slate-100 space-y-0">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                  {t("returnFlight")}
                </div>
                <RouteWaypointRow
                  name={returnLeg.to.name}
                  duration={formatHours(flightTimeHours(returnLeg.distanceKm, helicopter.speedKts), t)}
                  isFirst={true}
                  isLast={false}
                />
                <RouteWaypointRow
                  name={returnLeg.from.name}
                  duration={null}
                  isFirst={false}
                  isLast={true}
                />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--kitzair-red)] mb-0.5">
              {t("byCar")}
            </div>
            {routeDriving ? (
              <div className="text-[11px] text-slate-700">
                <p className="tabular-nums">
                  <span className="font-bold">{formatDurationMinutes(routeDriving.durationMinutes, t)}</span>
                  {" · "}
                  <span className="font-bold">{routeDriving.distanceKm.toFixed(1)} km</span>
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">{t("approx")} …</p>
            )}
          </div>
        </div>
      )}

      {/* Preis: Von–Bis fett, darunter * Preise indikativ */}
      <div className="p-2 mt-auto">
        {!showContent && <div className="min-h-[36px]" aria-hidden />}
        {showContent && result && (
          <>
            <div className="font-bold text-slate-900 text-sm">
              {formatPrice(roundUpToNearest5(result.priceFromGross), lang)} – {formatPrice(roundUpToNearest5(result.priceToGross), lang)}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t("pricesIncludeTaxesIndicative")}</p>
          </>
        )}
      </div>
    </article>
  );
}
