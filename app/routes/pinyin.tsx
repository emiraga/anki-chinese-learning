import type { Route } from "./+types/index";
import { PinyinTable } from "~/components/PinyinTable";
import MainFrame from "~/toolbar/frame";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { useSettings } from "~/settings/SettingsContext";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Pinyin table" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Index() {
  const { knownSounds } = useOutletContext<OutletContext>();
  const { settings } = useSettings();

  return (
    <MainFrame disablePadding>
      <section className="block">
        <PinyinTable
          knownSounds={knownSounds}
          showZhuyin={settings.features?.showZhuyin}
        />
      </section>
    </MainFrame>
  );
}
