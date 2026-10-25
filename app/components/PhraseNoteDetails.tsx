import {
  TOCFL_CONTEXTS,
  type PhraseType,
  type SentenceCloze,
} from "~/data/phrases";
import AnkiAudioPlayer from "./AnkiAudioPlayer";
import { HanziInlineText, HanziText } from "./HanziText";
import {
  PhraseDictionaryLinks,
  PhraseLink,
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

/** Anki field HTML, with each [sound:...] tag turned into an audio player. */
const FieldWithSounds: React.FC<{ html: string }> = ({ html }) => (
  <>
    {html.split(/(\[sound:[^\]]+\])/).map((part, i) =>
      part.startsWith("[sound:") ? (
        <AnkiAudioPlayer key={i} audioField={part} />
      ) : (
        part.trim() && (
          <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
        )
      ),
    )}
  </>
);

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
    {children}
  </span>
);

const Examples: React.FC<{
  examples: NonNullable<PhraseType["examples"]>;
  // The example sentence that "Sentence Audio" was recorded for
  sentenceTraditional: string;
  sentenceAudio?: string;
}> = ({ examples, sentenceTraditional, sentenceAudio }) => {
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
                    chinese={
                      <>
                        <HanziInlineText value={example.traditional} />
                        {sentenceAudio &&
                          example.traditional === sentenceTraditional && (
                            <AnkiAudioPlayer audioField={sentenceAudio} />
                          )}
                      </>
                    }
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
 * used - with dictionary links and the note's Anki details beside the word.
 */
export const PhraseNoteDetails: React.FC<{
  phrase: PhraseType;
  phrases: PhraseType[];
  phraseHanzi: string;
}> = ({ phrase, phrases, phraseHanzi }) => {
  const sentence = phrase.sentenceTraditional.trim();
  return (
    <div className="mx-6 mb-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
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
          <div className="flex flex-wrap items-center gap-2">
            <POSList posString={phrase.partOfSpeech || ""} />
            {phrase.level && <Badge>Level {phrase.level}</Badge>}
            {phrase.context?.map((context) => (
              <Badge key={context}>
                {context} · {TOCFL_CONTEXTS[context]}
              </Badge>
            ))}
          </div>
          {phrase.variants && phrase.variants.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-3 text-sm text-gray-600 dark:text-gray-400">
              <span>Variants:</span>
              {phrase.variants.map((variant, i) => (
                <span key={i}>
                  <span className="font-serif text-base">
                    <PhraseLink value={variant.traditional} />
                  </span>{" "}
                  {variant.pinyin}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          <PhraseDictionaryLinks phraseHanzi={phraseHanzi} />
          <span className="flex flex-wrap items-center justify-end gap-2">
            <TagList tags={phrase.tags} />
            <PhraseSourceButton phrase={phrase} />
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-lg">
          <PhraseMeaning meaning={phrase.meaning} />
        </div>
        {phrase.meaning2 && (
          <PhraseMeaning
            meaning={phrase.meaning2}
            className="block text-gray-600 dark:text-gray-400"
          />
        )}
        {phrase.explanation && (
          <div className="text-gray-600 dark:text-gray-400 italic">
            <FieldWithSounds html={phrase.explanation} />
          </div>
        )}
      </div>

      {phrase.connections && (
        <PhraseConnectionsSection
          phrase={phrase}
          connections={phrase.connections}
          phrases={phrases}
        />
      )}

      {phrase.sentenceCloze && <ClozeSentence cloze={phrase.sentenceCloze} />}

      {phrase.examples && (
        <Examples
          examples={phrase.examples}
          sentenceTraditional={sentence}
          sentenceAudio={phrase.sentenceAudio}
        />
      )}

      {/* fill_props_field.py picks Sentence Traditional from Examples JSON, so
          it is only shown for notes that have no examples */}
      {!phrase.examples && sentence && sentence !== phrase.traditional && (
        <section>
          <h3 className="text-xl font-semibold mb-2">Sentence</h3>
          <Sentence chinese={<HanziInlineText value={sentence} />} english="" />
        </section>
      )}
    </div>
  );
};
