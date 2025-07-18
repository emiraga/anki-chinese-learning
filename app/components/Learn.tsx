import { useOutletContext } from "react-router";
import { CLAUDE_NEW_QUERY, sentencesPrompt } from "~/apis/claude";
import {
  ACTOR_NAMES_MAP,
  LOCATION_NAMES_MAP,
  PLACE_NAMES_MAP,
  REVERSE_FULL_MAP,
} from "~/data/pinyin_table";
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
  const { characters } = useOutletContext<OutletContext>();

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
    </>
  );
};

export const PromptsLink: React.FC<{ char: string }> = ({ char }) => {
  const { characters, knownProps } = useOutletContext<OutletContext>();
  const c = characters[char];

  if (c === undefined) {
    return undefined;
  }

  if (REVERSE_FULL_MAP[c.sylable] === undefined) {
    console.error(c.sylable);
    console.error(Object.keys(REVERSE_FULL_MAP));
    throw new Error("REVERSE_FULL_MAP[char.sylable] === undefined");
  }
  const { initial, final } = REVERSE_FULL_MAP[c.sylable] || {
    initial: "???",
    final: "???",
  };

  const ordinals: { [key: number]: string } = {
    1: "first",
    2: "second",
    3: "third",
    4: "fourth",
    5: "fifth",
  };

  return (
    <>
      <button
        className="rounded-2xl m-1 border-2 p-1 hover:bg-red-200"
        onClick={async () => {
          const prompt = `I am using mnemonic system to remember Chinese characters.
I want to learn ${c.traditional}
which has a meaning: "${c.meaning}"
and it's pronounced: "${c.pinyin_1}" basically ${c.sylable} with a ${
            ordinals[c.tone]
          } tone.

This character consists of following props:
${c.tags
  .filter((t) => t.startsWith("prop::"))
  .map((tag) => {
    const t = knownProps[tag];
    return `${t.hanzi} ${t.prop.replaceAll("-", " ")}`;
  })
  .join("\n")}

Actor is ${ACTOR_NAMES_MAP[initial]}.
Location is ${PLACE_NAMES_MAP[final]} ${LOCATION_NAMES_MAP[c.tone]}.

Come up with several stories, they should involve mentioned props,
and that story should associate towards the primary meaning of the character.

Props should should visually appear in the image as elements.

Then on those props actor should interact with at the specified location.

Make stories interesting and succinct to make them easier to remember.
Sometimes you can ignore some props if there are too many of them,
and story would flow better without a particular prop.

For every story, add extra sections giving a succinct versions of the story,
but also mention the actor and a location.
`;
          await navigator.clipboard.writeText(prompt);
        }}
      >
        Copy mnemonic prompt
      </button>
    </>
  );
};
