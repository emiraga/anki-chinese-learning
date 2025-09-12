import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { useAsync } from "react-async-hook";
import anki from "~/apis/anki";
import Section from "~/toolbar/section";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [{ title: "tags" }, { name: "description", content: "See all tags" }];
}

export default function Tags() {
  const { result, error, loading } = useAsync(
    async () => await anki.note.getTags(),
    []
  );

  return (
    <MainFrame>
      <Section
        className="block mx-4"
        error={error}
        loading={loading}
        display={result && result.length > 0}
      >
        <h3 className="font-serif text-4xl">List of all tags:</h3>
        <ul>
          {result?.map((tag) => (
            <li key={tag}>
              <Link to={"/tag/" + tag}>{tag}</Link>
            </li>
          ))}
        </ul>
      </Section>
    </MainFrame>
  );
}
