import type { SunTimes } from "../../services/sunriseSunset";
import { formatTime } from "../../services/sunriseSunset";
import { useTranslation } from "../../i18n";

interface SunriseSunsetProps {
  sunTimes: SunTimes | null;
  dateLabel?: string;
}

export function SunriseSunset({ sunTimes, dateLabel }: SunriseSunsetProps) {
  const { t, lang } = useTranslation();

  if (!sunTimes) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">{t("sunriseSunset")}</h3>
        <p className="mt-1 text-xs text-slate-500">{t("sunriseSunsetNoData")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{t("sunriseSunset")}</h3>
      {dateLabel && <p className="mt-0.5 text-xs text-slate-500">{dateLabel}</p>}
      <div className="mt-3 flex gap-4 text-xs">
        <div>
          <p className="text-slate-500">{t("sunrise")}</p>
          <p className="font-medium text-slate-800">{formatTime(sunTimes.sunrise, lang)}</p>
        </div>
        <div>
          <p className="text-slate-500">{t("sunset")}</p>
          <p className="font-medium text-slate-800">{formatTime(sunTimes.sunset, lang)}</p>
        </div>
      </div>
    </div>
  );
}
