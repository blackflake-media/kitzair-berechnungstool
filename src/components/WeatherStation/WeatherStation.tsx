import type { WeatherData } from "../../services/weather";
import { useTranslation } from "../../i18n";

interface WeatherStationProps {
  data: WeatherData | null;
  loading?: boolean;
  dateLabel?: string;
}

export function WeatherStation({
  data,
  loading,
  dateLabel,
}: WeatherStationProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">{t("weather")}</h3>
        <p className="mt-1 text-xs text-slate-500">{t("weatherLoading")}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">{t("weather")}</h3>
        <p className="mt-1 text-xs text-slate-500">{t("weatherNoData")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{t("weather")}</h3>
      {dateLabel && <p className="mt-0.5 text-xs text-slate-500">{dateLabel}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <p className="text-slate-500">{t("temperature")}</p>
          <p className="font-medium text-slate-800">{Math.round(data.temperature)} °C</p>
        </div>
        <div>
          <p className="text-slate-500">{t("wind")}</p>
          <p className="font-medium text-slate-800">{data.windSpeedKmh.toFixed(0)} km/h</p>
          <p className="text-slate-500">{data.windDirection}°</p>
        </div>
        <div>
          <p className="text-slate-500">{t("cloudCover")}</p>
          <p className="font-medium text-slate-800">{data.cloudCover} %</p>
        </div>
        <div>
          <p className="text-slate-500">{t("precipitation")}</p>
          <p className="font-medium text-slate-800">{data.precipitationMm} mm</p>
        </div>
      </div>
    </div>
  );
}
