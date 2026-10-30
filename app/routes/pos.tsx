import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/pos";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { POS, type PosCode } from "~/data/pos";
import { POS_DETAILS } from "~/data/pos_details";
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

const VERB_KINDS: {
  name: string;
  meaning: string;
  hen: string;
  zai: string;
  negation: string;
  transitive: PosCode;
  intransitive: PosCode[];
  separable: PosCode;
}[] = [
  {
    name: "Action",
    meaning: "something you do",
    hen: "✗",
    zai: "✓ 在買",
    negation: "不 / 沒",
    transitive: "V",
    intransitive: ["Vi"],
    separable: "V-sep",
  },
  {
    name: "State",
    meaning: "a lasting quality or feeling",
    hen: "✓ 很冷",
    zai: "✗",
    negation: "不",
    transitive: "Vst",
    intransitive: ["Vs", "Vs-attr", "Vs-pred"],
    separable: "Vs-sep",
  },
  {
    name: "Process",
    meaning: "an instant change of state",
    hen: "✗",
    zai: "✗",
    negation: "沒",
    transitive: "Vpt",
    intransitive: ["Vp"],
    separable: "Vp-sep",
  },
];

const CELL = "border border-gray-300 dark:border-gray-600 px-3 py-2";

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
          <em>A Course in Contemporary Chinese</em>. Verbs are split by the
          kind of event they describe, and each kind by whether it takes an
          object.
        </p>

        <h2 className="text-2xl font-semibold mb-2">Verb classes</h2>
        <div className="overflow-x-auto mb-8">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className={CELL}>Kind</th>
                <th className={CELL}>Takes 很</th>
                <th className={CELL}>Progressive 在</th>
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
                  <td className={CELL}>{kind.zai}</td>
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
