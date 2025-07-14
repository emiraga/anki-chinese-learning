import { useOutletContext } from "react-router";
import { CLAUDE_NEW_QUERY, sentencesPrompt } from "~/apis/claude";
import type { OutletContext } from "~/data/types";

export const LearnAllCharsLink: React.FC<{}> = ({}) => {
  const { characters } = useOutletContext<OutletContext>();
  return (
    <a
      className="rounded-2xl border-2 p-1 hover:bg-red-200"
      href={
        CLAUDE_NEW_QUERY + encodeURIComponent(sentencesPrompt(characters, {}))
      }
      target="_blank"
      rel="noreferrer"
    >
      AI all chars
    </a>
  );
};

export const LearnLink: React.FC<{ char: string }> = ({ char }) => {
  const { characters, knownProps } = useOutletContext<OutletContext>();
  const c = characters[char];

  console.log();

  return (
    <>
      <a
        className="rounded-2xl m-1 border-2 p-1 hover:bg-red-200"
        href={
          CLAUDE_NEW_QUERY +
          encodeURIComponent(sentencesPrompt(characters, { learn: char }))
        }
        target="_blank"
        rel="noreferrer"
      >
        AI char
      </a>
      <button
        className="rounded-2xl m-1 border-2 p-1 hover:bg-red-200"
        onClick={async () => {
          const prompt = `I am using mnemonic system to remember Chinese characters.
I want to learn ${c.traditional}
which has a meaning: "${c.meaning}"
and it's pronounced: "${c.pinyin_1}"

This character consists of following props:
${c.tags
  .filter((t) => t.startsWith("prop::"))
  .map((tag) => {
    const t = knownProps[tag];
    return `${t.hanzi} ${t.prop.replace("-", " ")}`;
  })
  .join("\n")}

Actor is Isabelle (my ex girlfriend)
Location is Engineering (where I studied at university) in the bathroom.

Come up with several stories, they should involve mentioned props,
and that story should associate towards the primary meaning of the character.
Then on those props actor should interact with at the specified location.

Make stories interesting and succinct to make them easier to remember.
Sometimes you can ignore some props if there are too many of them,
and story would flow better without a particular prop.`;
          await navigator.clipboard.writeText(prompt);
        }}
      >
        Copy mnemonic prompt
      </button>
    </>
  );
};
