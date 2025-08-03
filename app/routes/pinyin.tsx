import type { Route } from "./+types/index";
import { PinyinTable } from "~/components/PinyinTable";
import { Tooltip } from "@base-ui-components/react/tooltip";
import MainToolbar from "~/toolbar/toolbar";
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
    <Tooltip.Provider delay={0} closeDelay={0}>
      <MainToolbar />
      <main className="pt-4 pb-4">
        <section className="block">
          <PinyinTable
            knownSounds={knownSounds}
            showZhuyin={settings.features?.showZhuyin}
          />
        </section>
      </main>
    </Tooltip.Provider>
  );
}
