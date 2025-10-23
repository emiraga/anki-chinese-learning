import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/$charHanzi";
import { Link, useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharCardDetails } from "~/components/CharCard";
import { PropList } from "~/components/PropList";
import { PROP_MISC_TAGS } from "~/data/props";
import { PhraseList } from "~/components/Phrase";
import { LearnLink, PromptsLink } from "~/components/Learn";
import { getNewCharacter } from "~/data/characters";
import { SearchMorePhrases } from "~/components/MorePhrases";
import { PinyinText } from "~/components/PinyinText";
import { useSettings } from "~/settings/SettingsContext";
import { comparePinyin } from "~/utils/pinyin";
import { useDongCharacter } from "~/hooks/useDongCharacter";
import { DongCharacterDisplay } from "~/components/DongCharacterDisplay";
import { useRtegaCharacter } from "~/hooks/useRtegaCharacter";
import { RtegaCharacterView } from "~/components/RtegaCharacterView";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Char: ${params.charHanzi}` },
    { name: "description", content: `Details for prop ${params.charHanzi}` },
  ];
}

export default function CharDetail() {
  const { charHanzi } = useParams();
  const { settings } = useSettings();
  const { characters, knownProps, characterList, phrases, charPhrasesPinyin } =
    useOutletContext<OutletContext>();
  const chars = Object.values(characters).filter(
    (c) => c.traditional === charHanzi
  );
  if (chars.length > 1) {
    throw new Error("Duplicate char: " + charHanzi);
  }
  if (charHanzi === undefined) {
    throw new Error("Missing param hanziChar");
  }

  const char = chars.length === 0 ? getNewCharacter(charHanzi) : chars[0];
  if (char === null) {
    throw new Error("Could not load character");
  }

  // Load Dong Chinese character data
  const { character: dongCharacter, loading: dongLoading, error: dongError } = useDongCharacter(char.traditional);

  // Load Rtega character data
  const { character: rtegaCharacter, loading: rtegaLoading, error: rtegaError } = useRtegaCharacter(char.traditional);

  const filteredPhrases = phrases.filter((p) =>
    p.traditional.includes(char.traditional)
  );
  const propsName = char.tags.filter((t) => t.startsWith("prop::"));
  const miscTags = char.tags.filter((t) => PROP_MISC_TAGS.includes(t));
  const currentIndex = characterList.findIndex((c) => c === char.traditional);
  const nextCharacter =
    currentIndex < characterList.length - 1
      ? characterList[currentIndex + 1]
      : null;

  const noteTypes = settings.phraseNotes.map((pn) => pn.noteType);
  return (
    <MainFrame>
      <div className="mx-4">
        <h3 className="font-serif text-4xl">
          <Link to="/chars" className="text-blue-800">
            Char
          </Link>
          : {char.traditional}
          {nextCharacter !== null ? (
            <Link
              className="text-sm text-gray-500 ml-5"
              to={"/char/" + nextCharacter}
            >
              Next &gt;&gt;
            </Link>
          ) : undefined}
        </h3>
        <hr className="my-4" />
        <LearnLink char={char.traditional} />
        <PromptsLink char={char.traditional} />
        <hr className="my-4" />
        <CharCardDetails char={char} />
        <div>
          <span className="tw-kai text-8xl">{char.traditional}</span>
          {/*<span className="font-mono text-8xl">{char.traditional}</span>*/}
          <span className="font-thin text-8xl">{char.traditional}</span>
          <span className="font-serif text-8xl">{char.traditional}</span>
          {/*<span className="hanzipen-tc text-8xl">{char.traditional}</span>*/}
          {/*<span className="libian-tc text-8xl">{char.traditional}</span>*/}
          {/*<span className="wawati-tc text-8xl">{char.traditional}</span>*/}
          {/*<span className="xingkai-tc text-8xl">{char.traditional}</span>*/}
          {/*<span className="lingwai-tc text-8xl">{char.traditional}</span>*/}
        </div>
        <hr className="my-4" />
        <PropList
          props={propsName.map((name) => knownProps[name])}
          miscTags={miscTags}
        />
        <hr className="my-4" />
        {charPhrasesPinyin[charHanzi] &&
        Object.keys(charPhrasesPinyin[charHanzi]).length > 1 ? (
          <>
            {Object.values(charPhrasesPinyin[charHanzi])
              .sort(comparePinyin)
              .map((pinyin) => (
                <div key={pinyin.pinyinAccented}>
                  <PinyinText v={pinyin} /> - {pinyin.count}
                </div>
              ))}
            <hr className="my-4" />
          </>
        ) : undefined}
        <PhraseList phrases={filteredPhrases} />
        <hr className="my-4" />
        <h2 className="text-2xl">Known character phrases:</h2>
        <SearchMorePhrases
          noteTypes={noteTypes}
          search={char.traditional}
          filterKnownChars={true}
        />
        <hr className="my-4" />
        <h2 className="text-2xl">Phrases with unknown characters:</h2>
        <SearchMorePhrases
          noteTypes={noteTypes}
          search={char.traditional}
          filterUnknownChars={true}
        />
        <hr className="my-4" />
        <h2 className="text-2xl">Rtega Mnemonic:</h2>
        {rtegaLoading && (
          <div className="text-xl text-gray-600 dark:text-gray-400">
            Loading Rtega mnemonic...
          </div>
        )}
        {rtegaError && (
          <div className="text-xl text-red-600 dark:text-red-400">
            Error: {rtegaError}
          </div>
        )}
        {!rtegaLoading && !rtegaError && !rtegaCharacter && (
          <div className="text-xl text-gray-600 dark:text-gray-400">
            No Rtega mnemonic found
          </div>
        )}
        {rtegaCharacter && (
          <RtegaCharacterView character={rtegaCharacter} />
        )}
        <hr className="my-4" />
        <h2 className="text-2xl">Character Etymology:</h2>
        {dongLoading && (
          <div className="text-xl text-gray-600 dark:text-gray-400">
            Loading character data...
          </div>
        )}
        {dongError && (
          <div className="text-xl text-red-600 dark:text-red-400">
            Error: {dongError}
          </div>
        )}
        {!dongLoading && !dongError && !dongCharacter && (
          <div className="text-xl text-gray-600 dark:text-gray-400">
            No character data found
          </div>
        )}
        {dongCharacter && (
          <DongCharacterDisplay
            character={dongCharacter}
            filterKnownChars={true}
          />
        )}
      </div>
    </MainFrame>
  );
}
