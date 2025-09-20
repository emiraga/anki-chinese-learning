import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useLocalStorageState } from "~/utils/localStorage";

// Dark mode context
interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isSystemMode: boolean;
  resetToSystem: () => void;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(
  undefined
);

// Dark mode provider component
export const DarkModeProvider = ({ children }: { children: ReactNode }) => {
  // Use localStorage hook for dark mode override (null means use system preference)
  const [darkModeOverride, setDarkModeOverride] = useLocalStorageState<boolean | null>(
    "darkModeOverride",
    null
  );

  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  // Initialize and listen for system preference changes
  useEffect(() => {
    const updateSystemPreference = () => {
      try {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setSystemPrefersDark(prefersDark);
      } catch {
        // SSR fallback
        setSystemPrefersDark(false);
      }
    };

    // Set initial value
    updateSystemPreference();

    // Listen for changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateSystemPreference);
    return () => mediaQuery.removeEventListener("change", updateSystemPreference);
  }, []);

  // Determine current dark mode state and system mode status
  const isDarkMode = darkModeOverride !== null ? darkModeOverride : systemPrefersDark;
  const isSystemMode = darkModeOverride === null;

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setDarkModeOverride(newMode);
  };

  const resetToSystem = () => {
    setDarkModeOverride(null);
  };

  return (
    <DarkModeContext.Provider
      value={{ isDarkMode, toggleDarkMode, isSystemMode, resetToSystem }}
    >
      {children}
    </DarkModeContext.Provider>
  );
};

// Hook to use dark mode
export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error("useDarkMode must be used within a DarkModeProvider");
  }
  return context;
};

// Dark mode toggle button component
export const DarkModeToggle = () => {
  const { isDarkMode, toggleDarkMode, isSystemMode, resetToSystem } =
    useDarkMode();

  const getTitle = () => {
    if (isSystemMode) {
      return `Following system preference (${
        isDarkMode ? "dark" : "light"
      } mode). Click to override.`;
    }
    return `${
      isDarkMode ? "Switch to light mode" : "Switch to dark mode"
    }. Right-click to reset to system preference.`;
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSystemMode) {
      resetToSystem();
    }
  };

  return (
    <button
      onClick={toggleDarkMode}
      onContextMenu={handleRightClick}
      className={`p-2 rounded-lg text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${
        !isSystemMode
          ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-800"
          : "bg-gray-100 dark:bg-gray-700"
      }`}
      title={getTitle()}
      aria-label={getTitle()}
    >
      <div className="relative">
        {isDarkMode ? (
          // Sun icon for light mode
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          // Moon icon for dark mode
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
        {!isSystemMode && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
        )}
      </div>
    </button>
  );
};
