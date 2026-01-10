import { Tooltip } from "@base-ui-components/react/tooltip";
import MainToolbar from "~/toolbar/toolbar";
import { useNavigate } from "react-router";
import { useEffect, useMemo } from "react";
import {
  createKeyboardHandler,
  fetchCurrentStudyTraditional,
  type KeyboardShortcut,
} from "~/utils/keyboard";

const MainFrame: React.FC<{
  loading?: boolean;
  error?: Error;
  children: React.ReactNode;
  disableKeyboardShortcuts?: boolean;
  disablePadding?: boolean;
}> = ({ loading, error, children, disableKeyboardShortcuts = false, disablePadding = false }) => {
  const navigate = useNavigate();

  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: "p",
        handler: () => {
          const pinyin = window.prompt("Enter pinyin syllable:");
          if (pinyin && pinyin.trim()) {
            navigate(`/sylable/${pinyin.trim()}`);
          }
        },
      },
      {
        key: "h",
        handler: () => {
          const hanzi = window.prompt("Enter character (hanzi):");
          if (hanzi && hanzi.trim()) {
            navigate(`/char/${hanzi.trim()}`);
          }
        },
      },
      {
        key: "s",
        handler: async () => {
          const traditional = await fetchCurrentStudyTraditional();
          if (!traditional) {
            return;
          }
          if (traditional.length === 1) {
            navigate(`/char/${traditional}`);
          } else {
            navigate(`/phrase/${traditional}`);
          }
        },
      },
    ],
    [navigate],
  );

  useEffect(() => {
    if (disableKeyboardShortcuts) return;

    const handleKeyDown = createKeyboardHandler(shortcuts);

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, disableKeyboardShortcuts]);
  if (error) {
    return (
      <Tooltip.Provider delay={0} closeDelay={0}>
        <MainToolbar />
        <main className="pt-4 pb-4 text-center">
          Error: {error.name} {error.message}
        </main>
      </Tooltip.Provider>
    );
  }

  if (loading) {
    return (
      <Tooltip.Provider delay={0} closeDelay={0}>
        <MainToolbar />
        <main className="pt-16 p-4 container mx-auto flex flex-col items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
          <p className="text-lg">Loading data...</p>
        </main>
      </Tooltip.Provider>
    );
  }

  return (
    <Tooltip.Provider delay={0} closeDelay={0}>
      <MainToolbar />
      <main className={disablePadding ? "" : "p-4"}>{children}</main>
    </Tooltip.Provider>
  );
};
export default MainFrame;
