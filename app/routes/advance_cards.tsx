import type { Route } from "./+types/index";
import MainFrame from "~/toolbar/frame";
import AdvanceCardsManager from "~/components/AdvanceCardsManager";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Advance Cards" },
    { name: "Advance Cards page", content: "Advance Anki cards" },
  ];
}

export default function AdvanceCards() {
  return (
    <MainFrame>
      <AdvanceCardsManager />
    </MainFrame>
  );
}