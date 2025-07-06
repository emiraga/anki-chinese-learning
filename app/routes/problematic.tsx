import type { Route } from "./+types/index";
import { getProblematicCardsComprehensive } from "~/data/problematic";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Problematic" },
    { name: "description", content: "Learn stuff" },
  ];
}
import { useAsync } from "react-async-hook";
import MainFrame from "~/toolbar/frame";
import ProblematicTable from "~/components/Problematic";

export default function Problematic() {
  const { loading, error, result } = useAsync(
    async () => await getProblematicCardsComprehensive(100),
    []
  );

  return (
    <MainFrame loading={loading} error={error}>
      <section className="text-center">
        <ProblematicTable result={result} />
      </section>
    </MainFrame>
  );
}
