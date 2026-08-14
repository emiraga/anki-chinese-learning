import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useLocalStorageState } from "~/utils/localStorage";
import { translations } from "./translations";

export type Language = "en" | "zh-Hant";

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "EN",
  "zh-Hant": "中文",
};

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  /**
   * Translate an English source string. Unknown strings fall back to the
   * source, so wrapping a label with t() is always safe even before a
   * translation exists -- untranslated UI simply stays in English.
   */
  t: (source: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // English is the default per product requirement.
  const [language, setLanguage] = useLocalStorageState<Language>(
    "language",
    "en",
  );

  const value = useMemo<LanguageContextType>(() => {
    const t = (source: string): string => {
      if (language === "en") return source;
      return translations[source]?.[language] ?? source;
    };
    return {
      language,
      setLanguage,
      toggleLanguage: () =>
        setLanguage(language === "en" ? "zh-Hant" : "en"),
      t,
    };
  }, [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

// Toggle button, styled to match DarkModeToggle so they sit together.
export const LanguageToggle = () => {
  const { language, toggleLanguage } = useLanguage();
  // Show the language you would switch TO, matching common toggle convention.
  const next: Language = language === "en" ? "zh-Hant" : "en";
  const title =
    language === "en" ? "切換到中文 / Switch to Chinese" : "Switch to English";

  return (
    <button
      onClick={toggleLanguage}
      className="p-2 rounded-lg text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 bg-gray-100 dark:bg-gray-700 transition-colors text-sm font-medium min-w-9"
      title={title}
      aria-label={title}
    >
      {LANGUAGE_LABELS[next]}
    </button>
  );
};
