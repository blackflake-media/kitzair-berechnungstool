import type { WeatherData } from "../../services/weather";
import { useTranslation } from "../../i18n";
import {
  vfrWind,
  vfrCloudCover,
  vfrPrecipitation,
  type VfrLight,
} from "../../services/vfrLimits";

export interface WeatherRow {
  label: string;
  data: WeatherData | null;
}

interface MapWeatherOverlayProps {
  rows: WeatherRow[];
  loading?: boolean;
  /** Format DD.MM.YYYY – angezeigt wenn keine Wetterdaten (z.B. Open-Meteo ~16 Tage) */
  dataAvailableUntil?: string | null;
  /** Flugdatum formatiert (z.B. DD.MM.YYYY) für die Überschrift */
  flightDateFormatted?: string | null;
}

function Light({ status }: { status: VfrLight }) {
  const isGreen = status === "green";
  const isYellow = status === "yellow";
  const bg = isGreen ? "bg-emerald-500" : isYellow ? "bg-amber-400" : "bg-red-500";
  const glow = isGreen
    ? "shadow-[0_0_8px_2px_rgba(16,185,129,0.7)]"
    : isYellow
      ? "shadow-[0_0_8px_2px_rgba(251,191,36,0.7)]"
      : "shadow-[0_0_8px_2px_rgba(239,68,68,0.7)]";
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ring-1 ring-black/25 ${bg} ${glow}`}
      title={status}
      aria-hidden
    />
  );
}

export function MapWeatherOverlay({ rows, loading, dataAvailableUntil, flightDateFormatted }: MapWeatherOverlayProps) {
  const { t } = useTranslation();
  const noData = !loading && rows.length > 0 && rows.every((r) => r.data == null);

  if (rows.length === 0) return null;

  const title = flightDateFormatted
    ? `${t("weatherForecast")} ${t("weatherForecastForDate").replace("DATE", flightDateFormatted)}`
    : t("weatherForecast");

  return (
    <div
      className="absolute top-2 right-2 z-[1000] rounded-xl border border-white/40 bg-white/60 backdrop-blur-lg shadow-xl p-2.5 min-w-[200px]"
      aria-label={t("weather")}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
        {title}
      </div>
      {noData ? (
        <p className="text-xs text-slate-600 leading-snug">
          {dataAvailableUntil
            ? t("weatherDataOnlyUntil").replace("DATE", dataAvailableUntil)
            : t("weatherDataNotAvailable")}
        </p>
      ) : (
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left font-semibold text-slate-700 py-0.5 pr-2 w-0 whitespace-nowrap">
                {" "}
              </th>
              <th className="font-semibold text-slate-700 py-0.5 px-1 text-center">
                {t("wind")}
              </th>
              <th className="font-semibold text-slate-700 py-0.5 px-1 text-center">
                {t("precipitation")}
              </th>
              <th className="font-semibold text-slate-700 py-0.5 px-1 text-center">
                {t("cloudCover")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-200/80">
                <td className="py-0.5 pr-2 font-medium text-slate-700 whitespace-nowrap">
                  {row.label}
                </td>
                {loading || !row.data ? (
                  <>
                    <td className="px-1 py-0.5 text-center">
                      <span className="inline-block h-3 w-3 rounded-full bg-slate-300 animate-pulse" />
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      <span className="inline-block h-3 w-3 rounded-full bg-slate-300 animate-pulse" />
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      <span className="inline-block h-3 w-3 rounded-full bg-slate-300 animate-pulse" />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-1 py-0.5 text-center">
                      <Light status={vfrWind(row.data.windSpeedKmh)} />
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      <Light status={vfrPrecipitation(row.data.precipitationMm)} />
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      <Light status={vfrCloudCover(row.data.cloudCover)} />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
