import { MigrationEverything } from "~/components/Migration";
import type { Route } from "./+types/index";
import MainFrame from "~/toolbar/frame";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Migration" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Migration() {
  return (
    <MainFrame>
      <MigrationEverything />
    </MainFrame>
  );
}
