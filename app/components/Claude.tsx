import { useOutletContext } from "react-router";
import { CLAUDE_NEW_QUERY, sentencesPrompt } from "~/apis/claude";
import type { OutletContext } from "~/data/types";

export const LearnLink: React.FC<{ char?: string }> = ({ char }) => {
  const { characters } = useOutletContext<OutletContext>();
  return (
    <a
      className="rounded-2xl border-2 p-1 hover:bg-red-200"
      href={
        CLAUDE_NEW_QUERY +
        encodeURIComponent(sentencesPrompt(characters, { learn: char }))
      }
      target="_blank"
      rel="noreferrer"
    >
      AI {char ?? "all chars"}
    </a>
  );
};
