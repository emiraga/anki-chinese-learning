import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { TodoCharsList } from "~/components/TodoChars";
import Section from "~/toolbar/section";
import { useSettings } from "~/settings/SettingsContext";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chars" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function TodoChars() {
  const { phrases, characters } = useOutletContext<OutletContext>();
  const { settings } = useSettings();

  return (
    <main>
      <MainToolbar />
      <Section display={!!settings.characterNote?.noteType}>
        <TodoCharsList phrases={phrases} characters={characters} />
      </Section>
    </main>
  );
}
