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
import { useHackChineseOutlier } from "~/hooks/useHackChineseOutlier";
import { HackChineseOutlierDisplay } from "~/components/HackChineseOutlierDisplay";
import { usePlecoOutlier } from "~/hooks/usePlecoOutlier";
import { usePlecoOutlierDictionary } from "~/hooks/usePlecoOutlierDictionary";
import { PlecoOutlierDisplay } from "~/components/PlecoOutlierDisplay";
import { Tabs } from "~/components/Tabs";
import { useState } from "react";
import { SoundComponentCandidates } from "~/components/SoundComponentCandidates";

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
  const {
    characters,
    knownProps,
    characterList,
    phrases,
    charPhrasesPinyin,
    reload,
  } = useOutletContext<OutletContext>();
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

  // Load HackChinese Outlier character data
  const {
    character: hackChineseOutlierCharacter,
    loading: hackChineseOutlierLoading,
    error: hackChineseOutlierError,
  } = useHackChineseOutlier(char.traditional);

  // Load Pleco Outlier character data (series)
  const {
    character: plecoOutlierCharacter,
    loading: plecoOutlierLoading,
    error: plecoOutlierError,
  } = usePlecoOutlier(char.traditional);

  // Load Pleco Outlier Dictionary data
  const {
    dictionary: plecoOutlierDictionary,
    loading: plecoOutlierDictionaryLoading,
    error: plecoOutlierDictionaryError,
  } = usePlecoOutlierDictionary(char.traditional);

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

  // Build tabs array dynamically based on loaded content
  const tabs = [
    { id: "general", label: "General" },
    { id: "phrases", label: "Phrases" },
  ];

  if (!dongLoading && !dongError && dongCharacter) {
    tabs.push({ id: "dong", label: "Dong Chinese" });
  }
  if (!yellowBridgeLoading && !yellowBridgeError && yellowBridgeCharacter) {
    tabs.push({ id: "yellowbridge", label: "YellowBridge" });
  }
  if (!rtegaLoading && !rtegaError && rtegaCharacter) {
    tabs.push({ id: "rtega", label: "Rtega" });
  }
  if (!hanziYuanLoading && !hanziYuanError && hanziYuanCharacter) {
    tabs.push({ id: "hanziyuan", label: "HanziYuan" });
  }
  if (
    !hackChineseOutlierLoading &&
    !hackChineseOutlierError &&
    hackChineseOutlierCharacter
  ) {
    tabs.push({ id: "hcoutlier", label: "HC Outlier" });
  }
  // Show Pleco Outlier tab if either series or dictionary data exists
  const hasPlecoOutlierData =
    (!plecoOutlierLoading && !plecoOutlierError && plecoOutlierCharacter) ||
    (!plecoOutlierDictionaryLoading &&
      !plecoOutlierDictionaryError &&
      plecoOutlierDictionary);
  if (hasPlecoOutlierData) {
    tabs.push({ id: "plecooutlier", label: "Pleco Outlier" });
  }

  const samePronounciation = Object.values(characters)
    .filter(
      (c) =>
        char.traditional !== c.traditional &&
        char.pinyin[0].pinyinAccented == c.pinyin[0].pinyinAccented,
    )
    .sort((a, b) => a.pinyin[0].sylable.localeCompare(b.pinyin[0].sylable));

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

        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "general" && (
          <>
            <LearnLink char={char.traditional} />
            <PromptsLink char={char.traditional} />
            <hr className="my-4" />
            <CharCardDetails char={char} />
            <hr className="my-4" />
            <h2 className="text-2xl mb-2">Sound Component Candidates:</h2>
            <SoundComponentCandidates
              mainCharacter={char.traditional}
              mainCharPinyin={
                char.pinyin.length > 0
                  ? typeof char.pinyin[0] === "string"
                    ? char.pinyin[0]
                    : char.pinyin[0].pinyinAccented
                  : ""
              }
              dongCharacter={dongCharacter}
              yellowBridgeCharacter={yellowBridgeCharacter}
              currentSoundComponent={char.soundComponentCharacter}
              ankiId={char.ankiId}
              characters={characters}
              onUpdate={() => {
                // Reload the data
                reload();
              }}
            />
            <hr className="my-4" />
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
              ankiId={char.ankiId}
              characterTags={char.tags}
              onTagRemoved={() => reload()}
            />
            {charsUsingSoundComponent.length > 0 && (
              <>
                <hr className="my-4" />
                <h2 className="text-2xl">Sound component in:</h2>
                <CharList characters={charsUsingSoundComponent} />
              </>
            )}
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

            {samePronounciation.length > 0 ? (
              <>
                <h2 className="text-2xl">Same pronounciation:</h2>
                {samePronounciation.map((c, i) => (
                  <CharCardDetails key={i} char={c} />
                ))}
                <hr className="my-4" />
              </>
            ) : undefined}

            {/* Loading Errors Section */}
            {(dongError ||
              yellowBridgeError ||
              rtegaError ||
              hanziYuanError ||
              hackChineseOutlierError ||
              plecoOutlierError) && (
              <>
                <h2 className="text-2xl text-red-600 dark:text-red-400">
                  Data Loading Errors
                </h2>
                <div className="space-y-2">
                  {dongError && (
                    <div className="text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950 rounded">
                      <strong>Dong Chinese:</strong> {dongError}
                    </div>
                  )}
                  {yellowBridgeError && (
                    <div className="text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950 rounded">
                      <strong>YellowBridge:</strong> {yellowBridgeError}
                    </div>
                  )}
                  {rtegaError && (
                    <div className="text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950 rounded">
                      <strong>Rtega:</strong> {rtegaError}
                    </div>
                  )}
                  {hanziYuanError && (
                    <div className="text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950 rounded">
                      <strong>HanziYuan:</strong> {hanziYuanError}
                    </div>
                  )}
                  {hackChineseOutlierError && (
                    <div className="text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950 rounded">
                      <strong>HackChinese Outlier:</strong>{" "}
                      {hackChineseOutlierError}
                    </div>
                  )}
                  {plecoOutlierError && (
                    <div className="text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950 rounded">
                      <strong>Pleco Outlier:</strong> {plecoOutlierError}
                    </div>
                  )}
                </div>
                <hr className="my-4" />
              </>
            )}
          </>
        )}

        {activeTab === "phrases" && (
          <>
            <CharCardDetails char={char} />
            <hr className="my-4" />
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

            {char.exampleSentences ? (
              <>
                <hr className="my-4" />
                <h2 className="text-2xl">Example sentences:</h2>
                <div
                  className=""
                  dangerouslySetInnerHTML={{ __html: char.exampleSentences }}
                />
              </>
            ) : undefined}
          </>
        )}

        {activeTab === "rtega" && rtegaCharacter && (
          <RtegaCharacterView character={rtegaCharacter} />
        )}

        {activeTab === "dong" && dongCharacter && (
          <DongCharacterDisplay character={dongCharacter} />
        )}

        {activeTab === "yellowbridge" && yellowBridgeCharacter && (
          <YellowBridgeDisplay character={yellowBridgeCharacter} />
        )}

        {activeTab === "hanziyuan" && hanziYuanCharacter && (
          <HanziYuanDisplay character={hanziYuanCharacter} />
        )}

        {activeTab === "hcoutlier" && hackChineseOutlierCharacter && (
          <HackChineseOutlierDisplay character={hackChineseOutlierCharacter} />
        )}

        {activeTab === "plecooutlier" && hasPlecoOutlierData && (
          <PlecoOutlierDisplay
            character={plecoOutlierCharacter ?? undefined}
            dictionary={plecoOutlierDictionary ?? undefined}
          />
        )}
      </div>
    </MainFrame>
  );
}
