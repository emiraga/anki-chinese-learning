import type { Route } from "./+types/index";
import { PinyinTable } from "~/components/PinyinTable";
import { Tooltip } from "@base-ui-components/react/tooltip";
import MainToolbar from "~/toolbar/toolbar";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import SettingsPage from "~/components/Settings";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Anki Chinese Learning" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Index() {
  const { knownSounds, characters } = useOutletContext<OutletContext>();

  return (
    <Tooltip.Provider delay={0} closeDelay={0}>
      <MainToolbar />
      {Object.keys(characters).length ? (
        <main className="pt-4 pb-4">
          <section className="block">
            <PinyinTable knownSounds={knownSounds} />
          </section>
        </main>
      ) : (
        <main>
          <section className="block mx-4">
            <SettingsPage />
          </section>
        </main>
      )}
    </Tooltip.Provider>
  );
}
