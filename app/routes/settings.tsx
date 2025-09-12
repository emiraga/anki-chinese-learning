import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import SettingsPage from "~/components/Settings";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Settings" }, { name: "description", content: "Settings" }];
}

export default function Settings() {
  return (
    <MainFrame>
      <section className="block mx-4">
        <SettingsPage />
      </section>
    </MainFrame>
  );
}
