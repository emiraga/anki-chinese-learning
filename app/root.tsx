import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { useAnkiProps } from "./data/props";
import type { OutletContext } from "./data/types";
import { useAnkiPhrases } from "./data/phrases";
import { useAnkiCharacters } from "./data/characters";
import { MainToolbarNoOutlet } from "./toolbar/toolbar";
import { SettingsProvider } from "./settings/SettingsContext";
import { DarkModeProvider, useDarkMode } from "./components/DarkModeToggle";

export const links: Route.LinksFunction = () => [
  // { rel: "preconnect", href: "https://fonts.googleapis.com" },
  // {
  //   rel: "preconnect",
  //   href: "https://fonts.gstatic.com",
  //   crossOrigin: "anonymous",
  // },
  // {
  //   rel: "stylesheet",
  //   href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  // },
];

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useDarkMode();
  
  return (
    <html lang="en" className={isDarkMode ? 'dark' : ''}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className={isDarkMode ? 'dark' : ''}>
        <SettingsProvider>{children}</SettingsProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DarkModeProvider>
      <LayoutContent>{children}</LayoutContent>
    </DarkModeProvider>
  );
}

export default function App() {
  const {
    knownProps,
    props,
    loading: loadingProps,
    error: errorProps,
    reload: reloadProps,
  } = useAnkiProps();
  const {
    phrases,
    charPhrasesPinyin,
    loading: loadingPhrases,
    error: errorPhrases,
    reload: reloadPhrases,
  } = useAnkiPhrases();
  const {
    characters,
    knownSounds,
    characterList,
    loading: loadingCharacters,
    error: errorCharacters,
    reload: reloadCharacters,
  } = useAnkiCharacters(charPhrasesPinyin);

  // Handle loading state
  const loading = loadingProps || loadingPhrases || loadingCharacters;
  if (loading) {
    return (
      <>
        <MainToolbarNoOutlet
          knownProps={{}}
          characters={{}}
          phrases={[]}
          charPhrasesPinyin={{}}
          reload={() => {}}
          loading={loading}
        />
        <main className="pt-16 p-4 container mx-auto flex flex-col items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
          <p className="text-lg">Loading data...</p>
        </main>
      </>
    );
  }

  const reload = () => {
    reloadProps();
    reloadPhrases();
    reloadCharacters();
  };

  // Handle error state from hooks
  const error = errorProps || errorPhrases || errorCharacters || null;
  if (error) {
    return (
      <main className="pt-16 p-4 container mx-auto">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Error Loading Data
        </h1>
        <p className="mb-4">
          {error.message || "An unexpected error occurred while loading data."}
        </p>
        <button
          onClick={reload}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </main>
    );
  }
  const context: OutletContext = {
    knownProps,
    props,
    phrases,
    charPhrasesPinyin,
    characters,
    knownSounds,
    characterList,
    reload,
    loading,
  };

  return <Outlet context={context} />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
