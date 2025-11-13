import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/$charHanzi";
import { Link, useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharCardDetails } from "~/components/CharCard";
import { PropList } from "~/components/PropList";
import { CharList } from "~/components/CharList";
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
import { useHanziYuanCharacter } from "~/hooks/useHanziYuanCharacter";
import { HanziYuanDisplay } from "~/components/HanziYuanDisplay";
import { useYellowBridgeCharacter } from "~/hooks/useYellowBridgeCharacter";
import { YellowBridgeDisplay } from "~/components/YellowBridgeDisplay";
import { Tabs } from "~/components/Tabs";
import { useState } from "react";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Char: ${params.charHanzi}` },
    { name: "description", content: `Details for prop ${params.charHanzi}` },
  ];
}

export default function CharDetail() {
  const { charHanzi } = useParams();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<string>("general");
  const { characters, knownProps, characterList, phrases, charPhrasesPinyin } =
    useOutletContext<OutletContext>();
  const chars = Object.values(characters).filter(
    (c) => c.traditional === charHanzi,
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
  const {
    character: dongCharacter,
    loading: dongLoading,
    error: dongError,
  } = useDongCharacter(char.traditional);

  // Load Rtega character data
  const {
    character: rtegaCharacter,
    loading: rtegaLoading,
    error: rtegaError,
  } = useRtegaCharacter(char.traditional);

  // Load HanziYuan character data
  const {
    character: hanziYuanCharacter,
    loading: hanziYuanLoading,
    error: hanziYuanError,
  } = useHanziYuanCharacter(char.traditional);

  // Load YellowBridge character data
  const {
    character: yellowBridgeCharacter,
    loading: yellowBridgeLoading,
    error: yellowBridgeError,
  } = useYellowBridgeCharacter(char.traditional);

  const filteredPhrases = phrases.filter((p) =>
    p.traditional.includes(char.traditional),
  );
  const propsName = char.tags.filter((t) => t.startsWith("prop::"));
  const miscTags = char.tags.filter((t) => PROP_MISC_TAGS.includes(t));
  const currentIndex = characterList.findIndex((c) => c === char.traditional);
  const nextCharacter =
    currentIndex < characterList.length - 1
      ? characterList[currentIndex + 1]
      : null;

  const noteTypes = settings.phraseNotes.map((pn) => pn.noteType);

  // Find characters that use this character as a sound component
  const charsUsingSoundComponent = Object.values(characters).filter(
    (c) => c.soundComponentCharacter === char.traditional,
  );

  // Find the prop tag for this character (if it exists)
  const propForThisChar = Object.values(knownProps).find(
    (prop) => prop.hanzi === char.traditional,
  );

  // Find characters that use this character as a prop
  const charsUsingAsProp = propForThisChar
    ? Object.values(characters).filter((c) =>
        c.tags.includes(propForThisChar.mainTagname),
      )
    : [];

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

        <Tabs
          tabs={[
            { id: "general", label: "General" },
            { id: "dong", label: "Dong Chinese" },
            { id: "yellowbridge", label: "YellowBridge" },
            { id: "rtega", label: "Rtega" },
            { id: "hanziyuan", label: "HanziYuan" },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === "general" && (
          <>
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
            {charsUsingSoundComponent.length > 0 && (
              <>
                <h2 className="text-2xl">Sound component in:</h2>
                <CharList characters={charsUsingSoundComponent} />
                <hr className="my-4" />
              </>
            )}
            {charsUsingAsProp.length > 0 && propForThisChar && (
              <>
                <h2 className="text-2xl">
                  Used as prop{" "}
                  <Link
                    to={`/prop/${propForThisChar.prop}`}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                  >
                    {propForThisChar.prop}
                  </Link>{" "}
                  in:
                </h2>
                <CharList characters={charsUsingAsProp} />
                <hr className="my-4" />
              </>
            )}
          </>
        )}

        {activeTab === "rtega" && (
          <>
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
          </>
        )}

        {activeTab === "dong" && (
          <>
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
          </>
        )}

        {activeTab === "yellowbridge" && (
          <>
            {yellowBridgeLoading && (
              <div className="text-xl text-gray-600 dark:text-gray-400">
                Loading YellowBridge data...
              </div>
            )}
            {yellowBridgeError && (
              <div className="text-xl text-red-600 dark:text-red-400">
                Error: {yellowBridgeError}
              </div>
            )}
            {!yellowBridgeLoading &&
              !yellowBridgeError &&
              !yellowBridgeCharacter && (
                <div className="text-xl text-gray-600 dark:text-gray-400">
                  No YellowBridge data found
                </div>
              )}
            {yellowBridgeCharacter && (
              <YellowBridgeDisplay character={yellowBridgeCharacter} />
            )}
          </>
        )}

        {activeTab === "hanziyuan" && (
          <>
            <h2 className="text-2xl">HanziYuan Character Information:</h2>
            {hanziYuanLoading && (
              <div className="text-xl text-gray-600 dark:text-gray-400">
                Loading HanziYuan data...
              </div>
            )}
            {hanziYuanError && (
              <div className="text-xl text-red-600 dark:text-red-400">
                Error: {hanziYuanError}
              </div>
            )}
            {!hanziYuanLoading && !hanziYuanError && !hanziYuanCharacter && (
              <div className="text-xl text-gray-600 dark:text-gray-400">
                No HanziYuan data found
              </div>
            )}
            {hanziYuanCharacter && (
              <HanziYuanDisplay character={hanziYuanCharacter} />
            )}
          </>
        )}
      </div>
    </MainFrame>
  );
}
