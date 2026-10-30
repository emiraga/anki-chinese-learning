import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/$posKey";
import { Link, useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { POS, isPosCode } from "~/data/pos";
import { POS_DETAILS, type PosExample } from "~/data/pos_details";
import { POSDisplay } from "~/components/POSDisplay";
import { PhraseList } from "~/components/Phrase";
import { HanziText } from "~/components/HanziText";
import { usePhrasesByPos } from "~/components/PosPhrases";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Part of speech: ${params.posKey}` },
    {
      name: "description",
      content: `Explanation of the ${params.posKey} part of speech`,
    },
  ];
}

const ExampleSentence: React.FC<{ example: PosExample }> = ({ example }) => (
  <li className={example.wrong ? "text-red-700 dark:text-red-400" : ""}>
    <span className="text-lg">
      {example.wrong && <span title="ungrammatical">*</span>}
      <HanziText value={example.zh} />
    </span>
    <span className="ml-3 text-gray-600 dark:text-gray-400">{example.en}</span>
  </li>
);

export default function PosDetail() {
  const { posKey } = useParams();
  const { phrases } = useOutletContext<OutletContext>();
  const phrasesByPos = usePhrasesByPos(phrases);

  if (!posKey || !isPosCode(posKey)) {
    throw new Error(`Unknown part of speech: ${posKey}`);
  }

  const [englishName, chineseName, examples] = POS[posKey];
  const detail = POS_DETAILS[posKey];
  const matching = phrasesByPos.get(posKey) ?? [];

  return (
    <MainFrame>
      <div className="mx-4 max-w-5xl">
        <h3 className="font-serif text-4xl my-4">
          <Link to="/pos" className="text-blue-800 dark:text-blue-300">
            POS
          </Link>
          : {posKey}{" "}
          <span className="text-2xl text-gray-600 dark:text-gray-400">
            {englishName} {chineseName}
          </span>
        </h3>
        <p className="text-lg mb-2">{detail.summary}</p>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          {detail.description}
        </p>
        {examples && (
          <p className="mb-4">
            <span className="font-semibold">Typical words: </span>
            <HanziText value={examples} />
          </p>
        )}

        <h4 className="text-xl font-semibold mb-2">How to recognize it</h4>
        <ul className="list-disc ml-6 mb-4 space-y-1">
          {detail.tests.map((test, i) => (
            <li key={i}>{test}</li>
          ))}
        </ul>

        <h4 className="text-xl font-semibold mb-2">Examples</h4>
        <ul className="mb-4 space-y-1">
          {detail.examples.map((example, i) => (
            <ExampleSentence key={i} example={example} />
          ))}
        </ul>

        <h4 className="text-xl font-semibold mb-2">Don&apos;t confuse with</h4>
        <ul className="mb-6 space-y-2">
          {detail.contrasts.map((contrast, i) => (
            <li key={i}>
              <span className="inline-block w-20">
                <POSDisplay posKey={contrast.pos} />
              </span>
              {contrast.note}
            </li>
          ))}
        </ul>

        <h4 className="text-xl font-semibold mb-2">
          Your phrases ({matching.length})
        </h4>
        <PhraseList phrases={matching} />
      </div>
    </MainFrame>
  );
}
