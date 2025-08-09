import { IntegrityEverything } from "~/components/Integrity";
import type { Route } from "./+types/index";
import MainFrame from "~/toolbar/frame";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Integrity" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Integrity() {
  return (
    <MainFrame>
      <IntegrityEverything />
    </MainFrame>
  );
}
