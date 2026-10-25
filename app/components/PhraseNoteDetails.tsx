import type { PhraseType, SentenceCloze } from "~/data/phrases";
import AnkiAudioPlayer from "./AnkiAudioPlayer";
import { HanziInlineText, HanziText } from "./HanziText";
import {
  PhraseDictionaryLinks,
  PhraseMeaning,
  PhraseSourceButton,
} from "./Phrase";
import { PhraseConnectionsSection } from "./PhraseConnections";
import { POSDisplay, POSList } from "./POSDisplay";
import { TagList } from "./TagList";

/** A Chinese sentence with its English translation below. */
const Sentence: React.FC<{
  chinese: React.ReactNode;
  english: string;
}> = ({ chinese, english }) => (
  <>
    <div className="font-serif text-lg">{chinese}</div>
    {english && (
      <div className="text-gray-500 dark:text-gray-400">{english}</div>
    )}
  </>
);

/** The cloze sentence, with each cloze answer highlighted and its hint on hover. */
const ClozeSentence: React.FC<{ cloze: SentenceCloze }> = ({ cloze }) => (
  <section>
    <h3 className="text-xl font-semibold mb-2">Cloze sentence</h3>
    <Sentence
      chinese={cloze.parts.map((part, i) =>
        part.kind === "cloze" ? (
          <span
            key={i}
            title={part.hint}
            className="px-1 rounded bg-blue-100 dark:bg-blue-900 font-bold text-blue-800 dark:text-blue-200"
          >
            {part.text}
          </span>
        ) : (
          <HanziInlineText key={i} value={part.text} />
        ),
      )}
      english={cloze.english}
    />
  </section>
);

const Examples: React.FC<{
  examples: NonNullable<PhraseType["examples"]>;
}> = ({ examples }) => {
  const entries = Object.entries(examples).filter(
    ([, list]) => list.length > 0,
  );
  if (entries.length === 0) {
    return null;
  }
  // The POS label only tells something when the examples cover several of them
  const showPos = entries.length > 1;
  return (
    <section>
      <h3 className="text-xl font-semibold mb-2">Examples</h3>
      <div className="space-y-3">
        {entries.map(([pos, list]) => (
          <div key={pos}>
            {showPos && (
              <div className="text-sm mb-1">
                <POSDisplay posKey={pos} />
              </div>
            )}
            <ul className="space-y-1.5">
              {list.map((example, i) => (
                <li key={i}>
                  <Sentence
                    chinese={<HanziInlineText value={example.traditional} />}
                    english={example.english}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};

/**
 * Everything one Anki note says about a phrase, in study order: the word and
 * how it sounds, what it means, how it relates to other words, and how it is
 * used - with dictionary links and the note's Anki details at the bottom.
 */
export const PhraseNoteDetails: React.FC<{
  phrase: PhraseType;
  phrases: PhraseType[];
  phraseHanzi: string;
}> = ({ phrase, phrases, phraseHanzi }) => {
  const sentence = phrase.sentenceTraditional.trim();
  return (
    <div className="mx-6 mb-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="text-6xl font-serif">
          <HanziText value={phrase.traditional} />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-3">
            {phrase.zhuyin && (
              <span className="text-xl text-gray-700 dark:text-gray-300">
                {phrase.zhuyin}
              </span>
            )}
            <span
              className="text-xl"
              dangerouslySetInnerHTML={{ __html: phrase.pinyin }}
            />
            <AnkiAudioPlayer audioField={phrase.audio} />
          </div>
          <POSList posString={phrase.partOfSpeech || ""} />
        </div>
      </div>

      <div className="text-lg">
        <PhraseMeaning meaning={phrase.meaning} />
      </div>

      {phrase.connections && (
        <PhraseConnectionsSection
          phrase={phrase}
          connections={phrase.connections}
          phrases={phrases}
        />
      )}

      {phrase.sentenceCloze && <ClozeSentence cloze={phrase.sentenceCloze} />}

      {phrase.examples && <Examples examples={phrase.examples} />}

      {/* fill_props_field.py picks Sentence Traditional from Examples JSON, so
          it is only shown for notes that have no examples */}
      {!phrase.examples && sentence && sentence !== phrase.traditional && (
        <section>
          <h3 className="text-xl font-semibold mb-2">Sentence</h3>
          <Sentence chinese={<HanziInlineText value={sentence} />} english="" />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <PhraseDictionaryLinks phraseHanzi={phraseHanzi} />
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <TagList tags={phrase.tags} />
          <PhraseSourceButton phrase={phrase} />
        </span>
      </div>
    </div>
  );
};
