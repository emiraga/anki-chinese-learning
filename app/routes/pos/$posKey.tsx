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

const SourceNote: React.FC<{ source?: string }> = ({ source }) => {
  if (!source) {
    return null;
  }
  return (
    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
      ({source})
    </span>
  );
};

const ExampleSentence: React.FC<{ example: PosExample }> = ({ example }) => {
  if (!example.wrong) {
    return (
      <li>
        <span className="text-lg">
          <HanziText value={example.zh} />
        </span>
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          {example.en}
        </span>
        <SourceNote source={example.source} />
      </li>
    );
  }
  return (
    <li className="border-l-4 border-red-400 dark:border-red-600 pl-3 py-1">
      <div>
        <span className="mr-2 rounded bg-red-100 dark:bg-red-900 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:text-red-200">
          ✗ Incorrect
        </span>
        <span className="text-lg text-red-700 dark:text-red-400 line-through decoration-1">
          <HanziText value={example.zh} />
        </span>
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          {example.en}
        </span>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <span className="font-semibold">Why: </span>
        {example.wrong.why}
      </div>
      <div className="text-sm">
        <span className="font-semibold text-green-700 dark:text-green-400">
          ✓ Correct:{" "}
        </span>
        <span className="text-lg">
          <HanziText value={example.wrong.correct} />
        </span>
        <SourceNote source={example.source} />
      </div>
    </li>
  );
};

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
        <ul className="mb-4 space-y-2">
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
              <SourceNote source={contrast.source} />
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
