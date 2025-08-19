import type { Route } from "./+types/index";
import anki from "~/apis/anki";
import { useEffect, useState } from "react";
import MainFrame from "~/toolbar/frame";
import { LearnAllCharsLink, LearnLink } from "~/components/Learn";
import Section from "~/toolbar/section";
import { HanziText } from "~/components/HanziText";
import { StudyMore } from "~/components/StudyMore";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Study" },
    { name: "Studying related page", content: "Learn stuff" },
  ];
}

export default function Study() {
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const [errorCurrent, setErrorCurrent] = useState<Error | undefined>(
    undefined
  );

  useEffect(() => {
    const load = async () => {
      try {
        const x = await anki.graphical.guiCurrentCard();
        setCurrent(x?.fields["Traditional"]?.value);
        setErrorCurrent(undefined);
      } catch (e) {
        setCurrent(undefined);
        setErrorCurrent(e as Error);
      }
    };
    const id = setInterval(load, 1000);
    load();
    return () => {
      clearInterval(id);
    };
  }, []);

  return (
    <MainFrame>
      <Section className="m-1">
        <LearnAllCharsLink />
      </Section>

      <Section className="text-center" loading={!current} error={errorCurrent}>
        <h1 className="text-9xl mx-auto">
          <HanziText value={current} />
        </h1>
        <LearnLink char={current || ""} />
      </Section>

      <StudyMore />
    </MainFrame>
  );
}
