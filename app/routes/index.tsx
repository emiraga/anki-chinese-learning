import type { Route } from "./+types/index";
import { PinyinTable } from "~/components/PinyinTable";
import MainFrame from "~/toolbar/frame";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import SettingsPage from "~/components/Settings";
import { useSettings } from "~/settings/SettingsContext";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Anki Chinese Learning" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Index() {
  const { knownSounds, characters } = useOutletContext<OutletContext>();
  const { settings } = useSettings();
  const hasCharacters = Object.keys(characters).length > 0;

  return (
    <MainFrame disablePadding={hasCharacters}>
      {hasCharacters ? (
        <section className="block">
          <PinyinTable
            knownSounds={knownSounds}
            showZhuyin={settings.features?.showZhuyin}
          />
        </section>
      ) : (
        <section className="block mx-4">
          <SettingsPage />
        </section>
      )}
    </MainFrame>
  );
}
