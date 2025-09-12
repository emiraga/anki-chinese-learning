import { Tooltip } from "@base-ui-components/react/tooltip";
import MainToolbar from "~/toolbar/toolbar";
import { useNavigate } from "react-router";
import { useEffect } from "react";

const MainFrame: React.FC<{
  loading?: boolean;
  error?: Error;
  children: React.ReactNode;
  disableKeyboardShortcuts?: boolean;
}> = ({ loading, error, children, disableKeyboardShortcuts = false }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (disableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "p" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }

        event.preventDefault();
        const pinyin = window.prompt("Enter pinyin syllable:");
        if (pinyin && pinyin.trim()) {
          navigate(`/sylable/${pinyin.trim()}`);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate, disableKeyboardShortcuts]);
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
      <main className="p-4">{children}</main>
    </Tooltip.Provider>
  );
};
export default MainFrame;
