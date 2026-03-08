import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { translations, type Lang, type TranslationKey } from "./translations";

type T = (key: TranslationKey) => string;

const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: T } | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === "undefined") return "de";
    const stored = localStorage.getItem("kitzair-lang") as Lang | null;
    return stored === "en" || stored === "de" ? stored : "de";
  });

  const setLangPersist = useCallback((l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem("kitzair-lang", l);
    } catch {}
  }, []);

  const t: T = useCallback(
    (key: TranslationKey) => translations[lang][key] ?? key,
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang: setLangPersist, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}
