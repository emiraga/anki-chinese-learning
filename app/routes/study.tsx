import type { Route } from "./+types/index";
import { Link } from "react-router";
import anki from "~/apis/anki";
import { useEffect, useState } from "react";
import { useAsync } from "react-async-hook";
import { getProblematicCardsComprehensive } from "~/data/problematic";
import MainFrame from "~/toolbar/frame";
import ProblematicTable from "~/components/Problematic";
import { LearnLink } from "~/components/Claude";
import Section from "~/toolbar/section";
import { HanziText } from "~/components/HanziText";
import { StudyMore } from "~/components/StudyMore";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Study" }, { name: "description", content: "Learn stuff" }];
}

export default function Study() {
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const [errorCurrent, setErrorCurrent] = useState<Error | undefined>(
    undefined
  );

  const {
    loading: loadingProblem,
    error: errorProblem,
    result: problematic,
  } = useAsync(async () => await getProblematicCardsComprehensive(20), []);

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
        <LearnLink />
      </Section>

      <Section className="text-center" loading={!current} error={errorCurrent}>
        <h1 className="text-9xl mx-auto">
          <HanziText value={current} />
        </h1>
        <LearnLink char={current} />
      </Section>

      <Section
        className="mt-5"
        loading={loadingProblem}
        error={errorProblem}
        display={problematic && problematic.length > 0}
      >
        <Link to="/problematic" className="text-xl">
          Problematic cards:
        </Link>
        <ProblematicTable result={problematic} />
      </Section>
      <StudyMore />
    </MainFrame>
  );
}
