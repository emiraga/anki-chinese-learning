import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import SettingsPage from "~/components/Settings";

export function meta({}: Route.MetaArgs) {
  return [{ title: "settings" }, { name: "description", content: "Settings" }];
}

export default function Settings() {
  return (
    <main>
      <MainToolbar />
      <section className="block m-4">
        <SettingsPage />
      </section>
    </main>
  );
}
