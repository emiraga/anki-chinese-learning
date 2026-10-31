import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/pos";
import { Link, useOutletContext } from "react-router";
import { grammarPointsWithPos } from "~/data/tbcl_grammar";
import type { OutletContext } from "~/data/types";
import { POS, type PosCode } from "~/data/pos";
import { POS_DETAILS, VERB_KINDS, VERB_KIND_TRAITS } from "~/data/pos_details";
import { POSDisplay } from "~/components/POSDisplay";
import {
  AnnotatedSentence,
  VerbKindTooltip,
  VerbTraitTooltip,
} from "~/components/PosExamples";
import { POS_SENTENCES } from "~/data/pos_sentences";
import { usePhrasesByPos } from "~/components/PosPhrases";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Parts of speech" },
    {
      name: "description",
      content: "Part of speech codes used by the TOCFL word list",
    },
  ];
}

const CELL = "border border-gray-300 dark:border-gray-600 px-3 py-2";
const SOURCE = "mt-1 text-xs text-gray-500 dark:text-gray-400";

/** Number of TBCL grammar points with this code, linking to them. */
const GrammarCountLink: React.FC<{ code: PosCode }> = ({ code }) => {
  const count = grammarPointsWithPos(code).length;
  if (count === 0) {
    return <>0</>;
  }
  return (
    <Link
      to={`/grammar?pos=${encodeURIComponent(code)}`}
      className="text-blue-700 dark:text-blue-300 hover:underline"
    >
      {count}
    </Link>
  );
};

export default function PartsOfSpeech() {
  const { phrases } = useOutletContext<OutletContext>();
  const phrasesByPos = usePhrasesByPos(phrases);
  const codes = Object.keys(POS) as PosCode[];

  return (
    <MainFrame>
      <div className="mx-4 max-w-5xl">
        <h1 className="font-serif text-4xl my-4">Parts of speech</h1>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          The codes come from the TOCFL 8000 word list (華語八千詞表), which
          follows the classification of 鄧守信 used in{" "}
          <em>A Course in Contemporary Chinese</em>. Verbs are split by the kind
          of event they describe, and each kind by whether it takes an object.
        </p>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          Notes marked &ldquo;Teng 2009&rdquo; come from 鄧守信,{" "}
          <em>對外漢語教學語法 (A Pedagogical Grammar of Chinese)</em>, revised
          ed., Taipei: 文鶴, 2009. Most of its wrong sentences are real errors
          made by English-speaking learners. Notes marked &ldquo;Yuan et al.
          2023&rdquo; come from F. Yuan, B. He and W. Hu (eds.),{" "}
          <em>
            Pedagogical Grammar and Grammar Pedagogy in Chinese as a Second
            Language
          </em>
          , Routledge, 2023, a collection of studies by several authors, many
          based on learner corpora. Notes marked &ldquo;ACCC 1&rdquo; come from{" "}
          <em>A Course in Contemporary Chinese 1</em> (當代中文課程 1), ed.
          鄧守信, Taipei: 聯經: its introduction (pages in Roman numerals) and
          the grammar notes of its lessons.
        </p>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          The{" "}
          <Link to="/grammar" className="text-blue-700 dark:text-blue-300">
            grammar points
          </Link>{" "}
          of the TBCL benchmark (臺灣華語文能力基準) are written with the same
          codes.
        </p>

        <h2 className="text-2xl font-semibold mb-2">Verb classes</h2>
        <div className="overflow-x-auto mb-8">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className={CELL}>Kind</th>
                {VERB_KIND_TRAITS.map(({ key, title }) => (
                  <th key={key} className={CELL}>
                    {title}
                  </th>
                ))}
                <th className={CELL}>Transitive</th>
                <th className={CELL}>Intransitive</th>
                <th className={CELL}>Separable</th>
              </tr>
            </thead>
            <tbody>
              {VERB_KINDS.map((kind) => (
                <tr key={kind.name}>
                  <td className={CELL}>
                    <VerbKindTooltip kind={kind} />
                  </td>
                  {VERB_KIND_TRAITS.map(({ key, title }) => (
                    <td key={key} className={CELL}>
                      <VerbTraitTooltip
                        trait={kind.traits[key]}
                        title={title}
                        kindName={kind.name}
                      />
                    </td>
                  ))}
                  <td className={CELL}>
                    <POSDisplay posKey={kind.transitive} />
                  </td>
                  <td className={CELL}>
                    <span className="inline-flex gap-2">
                      {kind.intransitive.map((code) => (
                        <POSDisplay key={code} posKey={code} />
                      ))}
                    </span>
                  </td>
                  <td className={CELL}>
                    <POSDisplay posKey={kind.separable} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Hover over a cell for examples, including typical mistakes.
          </p>
          <p className={SOURCE}>
            Source: <em>A Course in Contemporary Chinese 1</em>, Introduction §F
            (verb classes), p. XIV, and §G (negation), p. XV. Sentence 了 with
            state verbs: Teng 2009, pp. 217, 223. Durative 著: Yu Liu,
            &ldquo;The Acquisition of Durative Marker zhe&rdquo;, in Yuan et al.
            2023, ch. 12.
          </p>
        </div>

        <h2 className="text-2xl font-semibold mb-2">Default values</h2>
        <p className="mb-2 text-gray-700 dark:text-gray-300">
          A code without extra marking stands for the most common case, so only
          the unusual properties are spelled out:
        </p>
        <ul className="list-disc ml-6 mb-2 space-y-1">
          <li>
            <POSDisplay posKey="V" /> is an action verb, and transitive.
          </li>
          <li>
            <POSDisplay posKey="Vs" /> and <POSDisplay posKey="Vp" /> are
            intransitive; a trailing <code>t</code> (
            <POSDisplay posKey="Vst" />, <POSDisplay posKey="Vpt" />) marks the
            transitive ones.
          </li>
          <li>
            <POSDisplay posKey="Vs" /> can both modify a noun and be the
            predicate. <POSDisplay posKey="Vs-attr" /> can only stand before a
            noun (主要道路, but not *這條路很主要), and{" "}
            <POSDisplay posKey="Vs-pred" /> can only be the predicate (時間夠,
            but not *夠時間).
          </li>
          <li>
            <code>-sep</code> verbs are intransitive. They split to let in the
            target, frequency, duration or completion of the event: 生他的氣,
            結過三次婚.
          </li>
          <li>
            A word used in two classes is learned as two words: 報告 &ldquo;a
            report&rdquo; is <POSDisplay posKey="N" />, 報告 &ldquo;to
            report&rdquo; is <POSDisplay posKey="V" />.
          </li>
        </ul>
        <p className="mb-2 text-gray-700 dark:text-gray-300">
          The defaults depend on the learner&apos;s native language too:
          properties that carry over from English (跑 and 哭 take no object in
          either language) need no explanation, while ones that differ (結婚 and
          破 take no object, unlike &ldquo;marry&rdquo; and &ldquo;break&rdquo;)
          are where mistakes happen.
        </p>
        <p className={`${SOURCE} mb-8`}>
          Source: <em>A Course in Contemporary Chinese 1</em>, Introduction §H,
          pp. XVI–XVII, and Parts of Speech table, p. XXIV. Teng 2009, ch. 13,
          pp. 179–184.
        </p>

        <h2 className="text-2xl font-semibold mb-2">Examples</h2>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          Sentences split into words, each labeled with its code from the TOCFL
          list. Hover over a label for what the word does in the sentence.
        </p>
        <div className="mb-8 space-y-6">
          {POS_SENTENCES.map((sentence) => (
            <AnnotatedSentence key={sentence.en} sentence={sentence} />
          ))}
        </div>

        <h2 className="text-2xl font-semibold mb-2">All codes</h2>
        <table className="border-collapse text-sm mb-8">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className={CELL}>Code</th>
              <th className={CELL}>Name</th>
              <th className={CELL}>Summary</th>
              <th className={CELL}>Examples</th>
              <th className={CELL}>Your phrases</th>
              <th className={CELL}>Grammar points</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => {
              const [englishName, chineseName, examples] = POS[code];
              return (
                <tr key={code}>
                  <td className={CELL}>
                    <POSDisplay posKey={code} />
                  </td>
                  <td className={CELL}>
                    <div>{englishName}</div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {chineseName}
                    </div>
                  </td>
                  <td className={CELL}>{POS_DETAILS[code].summary}</td>
                  <td className={CELL}>{examples}</td>
                  <td className={`${CELL} text-right`}>
                    {phrasesByPos.get(code)?.length ?? 0}
                  </td>
                  <td className={`${CELL} text-right`}>
                    <GrammarCountLink code={code} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MainFrame>
  );
}
