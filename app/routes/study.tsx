import type { Route } from "./+types/index";
import MainFrame from "~/toolbar/frame";
import { LearnAllCharsLink } from "~/components/Learn";
import Section from "~/toolbar/section";
import StudyComponent, { useStudyData } from "~/components/Study";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Study" },
    { name: "Studying related page", content: "Learn stuff" },
  ];
}

export default function Study() {
  const { current, errorCurrent } = useStudyData();

  return (
    <MainFrame>
      <Section className="m-1">
        <LearnAllCharsLink />
      </Section>

      <Section className="text-center" loading={!current} error={errorCurrent}>
        <StudyComponent />
      </Section>
    </MainFrame>
  );
}
