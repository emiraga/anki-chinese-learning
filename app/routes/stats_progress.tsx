import type { Route } from "./+types/index";
// import { useOutletContext } from "react-router";
// import type { OutletContext } from "~/data/types";
import MainFrame from "~/toolbar/frame";
import Section from "~/toolbar/section";
import { AnkiHanziProgress } from "~/components/StatsProgress";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stats Progress" },
    { name: "description", content: "Progress statistics!" },
  ];
}

export default function StatsProgress() {
  return (
    <MainFrame>
      <Section className="block" display={true}>
        <AnkiHanziProgress />
      </Section>
    </MainFrame>
  );
}
