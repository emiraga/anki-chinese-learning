import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/pos";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { POS, type PosCode } from "~/data/pos";
import { POS_DETAILS, VERB_KINDS } from "~/data/pos_details";
import { POSDisplay } from "~/components/POSDisplay";
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

        <h2 className="text-2xl font-semibold mb-2">Verb classes</h2>
        <div className="overflow-x-auto mb-8">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className={CELL}>Kind</th>
                <th className={CELL}>Takes 很</th>
                <th className={CELL}>Completive 了</th>
                <th className={CELL}>Progressive 在</th>
                <th className={CELL}>Durative 著</th>
                <th className={CELL}>Reduplication</th>
                <th className={CELL}>Negation</th>
                <th className={CELL}>Transitive</th>
                <th className={CELL}>Intransitive</th>
                <th className={CELL}>Separable</th>
              </tr>
            </thead>
            <tbody>
              {VERB_KINDS.map((kind) => (
                <tr key={kind.name}>
                  <td className={CELL}>
                    <div className="font-semibold">{kind.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {kind.meaning}
                    </div>
                  </td>
                  <td className={CELL}>{kind.hen}</td>
                  <td className={CELL}>{kind.le}</td>
                  <td className={CELL}>{kind.zai}</td>
                  <td className={CELL}>{kind.zhe}</td>
                  <td className={CELL}>{kind.reduplication}</td>
                  <td className={CELL}>{kind.negation}</td>
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
          <p className={SOURCE}>
            Source: <em>A Course in Contemporary Chinese 1</em>, Introduction §F
            (verb classes), p. XIV, and §G (negation), p. XV. Durative 著: Yu
            Liu, &ldquo;The Acquisition of Durative Marker zhe&rdquo;, in{" "}
            <em>
              Pedagogical Grammar and Grammar Pedagogy in Chinese as a Second
              Language
            </em>{" "}
            (2022), ch. 12.
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
        </ul>
        <p className={`${SOURCE} mb-8`}>
          Source: <em>A Course in Contemporary Chinese 1</em>, Introduction §H,
          pp. XVI–XVII, and Parts of Speech table, p. XXIV.
        </p>

        <h2 className="text-2xl font-semibold mb-2">All codes</h2>
        <table className="border-collapse text-sm mb-8">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className={CELL}>Code</th>
              <th className={CELL}>Name</th>
              <th className={CELL}>Summary</th>
              <th className={CELL}>Examples</th>
              <th className={CELL}>Your phrases</th>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MainFrame>
  );
}
