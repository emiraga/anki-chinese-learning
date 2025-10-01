import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import MainFrame from "~/toolbar/frame";
import Section from "~/toolbar/section";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Migration" },
    { name: "description", content: "Data migration tools" },
  ];
}

export default function Migration() {
  useOutletContext<OutletContext>();

  return (
    <MainFrame>
      <Section className="block" display={true}>
        <h2 className="font-serif text-4xl my-2">Migration Tools</h2>
        <p>No migrations currently available.</p>
      </Section>
    </MainFrame>
  );
}
