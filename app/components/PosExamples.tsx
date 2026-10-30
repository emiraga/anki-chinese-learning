import { Tooltip } from "@base-ui-components/react/tooltip";
import type { PosCode } from "~/data/pos";
import type { PosExample, VerbKind, VerbKindTrait } from "~/data/pos_details";
import type { PosSentence, PosToken } from "~/data/pos_sentences";
import { POSDisplay } from "./POSDisplay";
import { HanziText } from "./HanziText";
import styles from "./index.module.css";
import { useDarkMode } from "./DarkModeToggle";

export const SourceNote: React.FC<{ source?: string }> = ({ source }) => {
  if (!source) {
    return null;
  }
  return (
    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
      ({source})
    </span>
  );
};

/**
 * Chinese text of an example. `compact` renders plain text in a smaller font,
 * for tooltips, where HanziText's character links and popups would get in the
 * way.
 */
const ExampleZh: React.FC<{ value: string; compact: boolean }> = ({
  value,
  compact,
}) => (compact ? value : <HanziText value={value} />);

export const ExampleSentence: React.FC<{
  example: PosExample;
  compact?: boolean;
}> = ({ example, compact = false }) => {
  const zhSize = compact ? "text-base" : "text-lg";
  if (!example.wrong) {
    return (
      <li>
        <span className="mr-2 font-semibold text-green-700 dark:text-green-400">
          ✓
        </span>
        <span className={zhSize}>
          <ExampleZh value={example.zh} compact={compact} />
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
        <span
          className={`${zhSize} text-red-700 dark:text-red-400 line-through decoration-1`}
        >
          <ExampleZh value={example.zh} compact={compact} />
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
        <span className={zhSize}>
          <ExampleZh value={example.wrong.correct} compact={compact} />
        </span>
        <SourceNote source={example.source} />
      </div>
    </li>
  );
};

const TRAIT_MARK: Record<NonNullable<VerbKindTrait["allowed"]>, string> = {
  yes: "✓",
  no: "✗",
  some: "",
};

const TRAIT_COLOR: Record<NonNullable<VerbKindTrait["allowed"]>, string> = {
  yes: "text-green-700 dark:text-green-400",
  no: "text-red-700 dark:text-red-400",
  some: "text-amber-700 dark:text-amber-400",
};

/** The ✓/✗ mark and label of a verb kind trait, e.g. "✓ 很冷". */
export const VerbTraitValue: React.FC<{ trait: VerbKindTrait }> = ({
  trait,
}) => {
  const { allowed, label } = trait;
  const mark = allowed ? TRAIT_MARK[allowed] : "";
  return (
    <span className={allowed ? TRAIT_COLOR[allowed] : undefined}>
      {mark && <span className="font-semibold">{mark}</span>}
      {mark && label && " "}
      {label && (
        <span className={mark ? "text-gray-900 dark:text-gray-100" : undefined}>
          {label}
        </span>
      )}
    </span>
  );
};

/** Hover target that shows a heading, a note and example sentences. */
const ExamplesTooltip: React.FC<{
  heading: React.ReactNode;
  note: string;
  source?: string;
  examples: PosExample[];
  children: React.ReactNode;
}> = ({ heading, note, source, examples, children }) => {
  const { isDarkMode } = useDarkMode();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        className="cursor-help text-left underline decoration-dotted decoration-gray-400 underline-offset-4"
        render={<span />}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={10}>
          <Tooltip.Popup
            className={`${styles.Popup} max-w-lg text-sm`}
            data-dark-mode={isDarkMode}
          >
            <div className="font-semibold">{heading}</div>
            <div className="mt-1">
              {note}
              <SourceNote source={source} />
            </div>
            <ul className="mt-2 space-y-2">
              {examples.map((example, i) => (
                <ExampleSentence key={i} example={example} compact />
              ))}
            </ul>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

/** The trait value, with its note and examples in a tooltip. */
export const VerbTraitTooltip: React.FC<{
  trait: VerbKindTrait;
  title: string;
  kindName: string;
}> = ({ trait, title, kindName }) => (
  <ExamplesTooltip
    heading={
      <>
        {kindName} verbs · {title}: <VerbTraitValue trait={trait} />
      </>
    }
    note={trait.note}
    examples={trait.examples}
  >
    <VerbTraitValue trait={trait} />
  </ExamplesTooltip>
);

/** The verb kind's name and meaning, with simple examples in a tooltip. */
export const VerbKindTooltip: React.FC<{ kind: VerbKind }> = ({ kind }) => (
  <ExamplesTooltip
    heading={
      <>
        {kind.name} verbs: {kind.meaning}
      </>
    }
    note={kind.description}
    source={kind.descriptionSource}
    examples={kind.examples}
  >
    <span className="block font-semibold">{kind.name}</span>
    <span className="block text-xs text-gray-500 dark:text-gray-400">
      {kind.meaning}
    </span>
  </ExamplesTooltip>
);

/** Background and border of a word box, by group of part of speech. */
function tokenColor(pos: PosCode): string {
  if (pos === "Vaux") {
    return "bg-teal-50 border-teal-300 dark:bg-teal-950 dark:border-teal-700";
  }
  if (pos.startsWith("V")) {
    return "bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700";
  }
  switch (pos) {
    case "N":
      return "bg-slate-50 border-slate-300 dark:bg-slate-900 dark:border-slate-600";
    case "Adv":
      return "bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700";
    case "Ptc":
      return "bg-pink-50 border-pink-300 dark:bg-pink-950 dark:border-pink-700";
    case "Conj":
      return "bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-700";
    case "Prep":
      return "bg-indigo-50 border-indigo-300 dark:bg-indigo-950 dark:border-indigo-700";
    case "Det":
      return "bg-sky-50 border-sky-300 dark:bg-sky-950 dark:border-sky-700";
    case "M":
      return "bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-700";
    default:
      return "bg-gray-50 border-gray-300 dark:bg-gray-900 dark:border-gray-600";
  }
}

/** One word of an annotated sentence: POS label, the word, its meaning. */
const AnnotatedToken: React.FC<{ token: PosToken }> = ({ token }) => {
  if (!token.pos) {
    return <span className="self-center text-2xl">{token.zh}</span>;
  }
  return (
    <span
      className={`inline-flex flex-col items-center rounded border px-2 py-1 ${tokenColor(token.pos)}`}
    >
      <span className="text-xs">
        <POSDisplay posKey={token.pos} note={token.note} />
      </span>
      <span className="text-2xl">
        <HanziText value={token.zh} />
      </span>
      {token.gloss && (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {token.gloss}
        </span>
      )}
    </span>
  );
};

/** A sentence split into words, each labeled with its part of speech. */
export const AnnotatedSentence: React.FC<{ sentence: PosSentence }> = ({
  sentence,
}) => (
  <div>
    <div className="flex flex-wrap items-stretch gap-1">
      {sentence.tokens.map((token, i) => (
        <AnnotatedToken key={i} token={token} />
      ))}
    </div>
    <div className="mt-1 text-gray-700 dark:text-gray-300">{sentence.en}</div>
    <div className="text-sm text-gray-500 dark:text-gray-400">
      {sentence.note}
    </div>
  </div>
);
