import { useState, useEffect, useRef } from "react";
import { geocodeAddress, searchAddressSuggestions } from "../../services/geocoding";
import type { GeocodingResult } from "../../services/geocoding";
import { getNearestLocation } from "../../services/calculation";
import type { Location } from "../../config/locations";
import { useTranslation } from "../../i18n";

export interface AddressSearchResultCoords {
  lat: number;
  lon: number;
}

interface AddressSearchProps {
  onAddressSelected: (
    searchCoords: AddressSearchResultCoords,
    nearestLocation: Location,
    distanceKm: number
  ) => void;
  onClear?: () => void;
  placeholder?: string;
}

const SUGGEST_DEBOUNCE_MS = 350;

export function AddressSearch({
  onAddressSelected,
  onClear,
  placeholder,
}: AddressSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setResult] = useState<{ name: string; distanceKm: number } | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevQueryRef = useRef(query);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 3) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const list = await searchAddressSuggestions(query);
        setSuggestions(list);
        setSuggestionsOpen(list.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
        debounceRef.current = null;
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (query === "" && prevQueryRef.current !== "") {
      onClear?.();
    }
    prevQueryRef.current = query;
  }, [query, onClear]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function applySelection(geo: GeocodingResult) {
    setQuery(geo.displayName);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const nearest = getNearestLocation(geo.lat, geo.lon);
      if (!nearest) {
        setError(t("noLocationFound"));
        return;
      }
      setResult({ name: nearest.location.name, distanceKm: nearest.distanceKm });
      onAddressSelected({ lat: geo.lat, lon: geo.lon }, nearest.location, nearest.distanceKm);
    } catch {
      setError(t("searchFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSuggestionsOpen(false);
    setSuggestions([]);
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const geo = await geocodeAddress(query);
      if (!geo) {
        setError(t("addressNotFound"));
        return;
      }
      const nearest = getNearestLocation(geo.lat, geo.lon);
      if (!nearest) {
        setError(t("noLocationFound"));
        return;
      }
      setResult({ name: nearest.location.name, distanceKm: nearest.distanceKm });
      onAddressSelected({ lat: geo.lat, lon: geo.lon }, nearest.location, nearest.distanceKm);
    } catch {
      setError(t("searchFailed"));
    } finally {
      setLoading(false);
    }
  }

  const crosshairSvg = (
    <svg className="shrink-0 w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );

  return (
    <div className="relative z-[2000] rounded-lg border border-slate-200/80 bg-white/80 py-2 px-2.5" ref={containerRef}>
      <label htmlFor="address-search" className="sr-only">
        {t("nearestStart")}
      </label>
      <div className="flex items-center gap-1.5">
        {crosshairSvg}
        <input
          id="address-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
          placeholder={placeholder ?? t("addressSearchPlaceholder")}
          className="flex-1 min-w-0 rounded border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:border-[var(--kitzair-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--kitzair-primary)]/30"
          disabled={loading}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => {
            setSuggestionsOpen(false);
            setSuggestions([]);
            handleSearch();
          }}
          disabled={loading}
          className="shrink-0 rounded border border-[var(--kitzair-red)] bg-[var(--kitzair-red)] px-2.5 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--kitzair-red-hover)] disabled:opacity-50"
        >
          {loading ? "…" : t("search")}
        </button>
      </div>
      {suggestionsOpen && suggestions.length > 0 && (
        <ul
          className="absolute left-2.5 right-2.5 top-full z-[2100] mt-1 max-h-48 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat}-${s.lon}-${i}`}
              role="option"
              className="cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              onMouseDown={(e) => {
                e.preventDefault();
                applySelection(s);
              }}
            >
              {s.displayName}
            </li>
          ))}
        </ul>
      )}
      {suggestLoading && query.trim().length >= 3 && (
        <p className="mt-1 text-xs text-slate-400">{t("suggestionsLoading")}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-amber-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
