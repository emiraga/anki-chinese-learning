import { Link } from "react-router";
import {
  CONNECTIONS_REGIONS,
  phraseForms,
  type PhraseConnections,
  type PhraseType,
  type WordDiff,
} from "~/data/phrases";
import { PhraseLink } from "./Phrase";

type PhrasesByForm = Map<string, PhraseType>;

/**
 * Map every "/"-separated form of every phrase to its phrase. Phrases are only
 * loaded for unsuspended, non-new notes, so a word found here is a learned one.
 */
function buildPhrasesByForm(phrases: PhraseType[]): PhrasesByForm {
  const result: PhrasesByForm = new Map();
  for (const phrase of phrases) {
    for (const form of phraseForms(phrase)) {
      if (!result.has(form)) {
        result.set(form, phrase);
      }
    }
  }
  return result;
}

/** Learned words first, keeping the order within each part. */
function learnedFirst<T>(
  items: T[],
  word: (item: T) => string,
  phrasesByForm: PhrasesByForm,
): T[] {
  return [...items].sort(
    (a, b) =>
      Number(!phrasesByForm.has(word(a))) - Number(!phrasesByForm.has(word(b))),
  );
}

/**
 * A related word: bold with its pinyin when learned, gray otherwise - matching
 * how fill_connections_field.py renders "Connections HTML" on the card.
 */
const RelatedWord: React.FC<{ word: string; phrasesByForm: PhrasesByForm }> = ({
  word,
  phrasesByForm,
}) => {
  const phrase = phrasesByForm.get(word);
  if (phrase === undefined) {
    return (
      <Link
        to={`/phrase/${encodeURIComponent(word)}`}
        className="font-serif text-gray-400 dark:text-gray-500 hover:underline"
      >
        {word}
      </Link>
    );
  }
  return (
    <span className="whitespace-nowrap">
      <span className="font-serif font-bold text-lg">
        <PhraseLink value={word} />
      </span>{" "}
      <span
        className="text-gray-500 dark:text-gray-400 text-sm"
        dangerouslySetInnerHTML={{ __html: phrase.pinyin }}
      />
    </span>
  );
};

const RelatedWordList: React.FC<{
  words: string[];
  phrasesByForm: PhrasesByForm;
}> = ({ words, phrasesByForm }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1">
    {learnedFirst(words, (w) => w, phrasesByForm).map((w) => (
      <RelatedWord key={w} word={w} phrasesByForm={phrasesByForm} />
    ))}
  </div>
);

/** Related words, each with how this phrase differs from it below the word. */
const WordDiffList: React.FC<{
  words: WordDiff[];
  phrasesByForm: PhrasesByForm;
}> = ({ words, phrasesByForm }) => (
  <ul className="space-y-2">
    {learnedFirst(words, (w) => w.w, phrasesByForm).map((w) => (
      <li key={w.w}>
        <RelatedWord word={w.w} phrasesByForm={phrasesByForm} />
        <div
          className={
            phrasesByForm.has(w.w)
              ? "text-gray-700 dark:text-gray-300"
              : "text-gray-400 dark:text-gray-500"
          }
        >
          {w.diff}
        </div>
      </li>
    ))}
  </ul>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <>
    <dt className="font-semibold text-gray-600 dark:text-gray-300 pt-0.5">
      {title}
    </dt>
    <dd>{children}</dd>
  </>
);

/**
 * Show a phrase's "Connections JSON": its meaning hint, similar words with how
 * they differ, opposites, correlative pairings, measure words, regional
 * equivalents and register.
 *
 * Synonyms and antonyms are symmetric, so words whose own connections list
 * this phrase are shown too, as on the Anki card.
 */
export const PhraseConnectionsSection: React.FC<{
  phrase: PhraseType;
  connections: PhraseConnections;
  phrases: PhraseType[];
}> = ({ phrase, connections, phrases }) => {
  const phrasesByForm = buildPhrasesByForm(phrases);
  const forms = new Set(phraseForms(phrase));

  // A diff names both words, so it reads correctly from either side
  const synonyms = [...connections.synonyms];
  const antonyms = [...connections.antonyms];
  for (const other of phrases) {
    if (other.connections === undefined || other.noteId === phrase.noteId) {
      continue;
    }
    const otherWord = phraseForms(other)[0];
    const addListedBy = (listed: WordDiff[], into: WordDiff[]) => {
      for (const related of listed) {
        if (forms.has(related.w) && into.every((r) => r.w !== otherWord)) {
          into.push({ w: otherWord, diff: related.diff });
        }
      }
    };
    addListedBy(other.connections.synonyms, synonyms);
    addListedBy(other.connections.antonyms, antonyms);
  }

  const { region } = connections;
  const equivalents = learnedFirst(
    region.equivalents,
    (e) => e.w,
    phrasesByForm,
  );

  const hasSections =
    synonyms.length > 0 ||
    antonyms.length > 0 ||
    connections.pairsWith.length > 0 ||
    connections.measureWords.length > 0 ||
    equivalents.length > 0 ||
    connections.register !== "neutral";

  if (!connections.hint && !hasSections) {
    return null;
  }

  return (
    <section>
      <h3 className="text-xl font-semibold mb-2">Connections</h3>

      {connections.hint && (
        <div className="mb-4 px-3 py-2 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100 italic">
          {connections.hint}
        </div>
      )}

      {hasSections && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3">
          {synonyms.length > 0 && (
            <Section title="Similar words">
              <WordDiffList words={synonyms} phrasesByForm={phrasesByForm} />
            </Section>
          )}

          {antonyms.length > 0 && (
            <Section title="Opposites">
              <WordDiffList words={antonyms} phrasesByForm={phrasesByForm} />
            </Section>
          )}

          {connections.pairsWith.length > 0 && (
            <Section title="Pairs with">
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-serif text-lg">
                {connections.pairsWith.map((p) => (
                  <span key={p.pattern}>{p.pattern}</span>
                ))}
              </div>
            </Section>
          )}

          {connections.measureWords.length > 0 && (
            <Section title="Measure words">
              <RelatedWordList
                words={connections.measureWords}
                phrasesByForm={phrasesByForm}
              />
            </Section>
          )}

          {/* Only shown with an equivalent word: "Mainly used in Taiwan" alone
              tells a learner of Taiwan Mandarin nothing */}
          {equivalents.length > 0 && (
            <Section title="Region">
              {region.usage !== "both" && (
                <div>Mainly used in {CONNECTIONS_REGIONS[region.usage]}</div>
              )}
              {equivalents.map((e) => (
                <div key={e.w}>
                  {CONNECTIONS_REGIONS[e.region]}:{" "}
                  <RelatedWord word={e.w} phrasesByForm={phrasesByForm} />
                </div>
              ))}
            </Section>
          )}

          {connections.register !== "neutral" && (
            <Section title="Register">
              <span className="capitalize">{connections.register}</span>
            </Section>
          )}
        </dl>
      )}
    </section>
  );
};
