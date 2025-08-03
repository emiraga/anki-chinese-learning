import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { IGNORE_PHRASE_CHARS } from "~/data/phrases";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import {
  HanziCardDetails,
  // HanziText,
  HanziSegmentedText,
} from "~/components/HanziText";
import {
  removeDuplicateChars,
  useLocalStorageState,
  type SegmentationAlgorithm,
} from "~/data/utils";
import Section from "~/toolbar/section";
import { useSettings } from "~/settings/SettingsContext";
import Textarea from "react-textarea-autosize";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chars" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function TodoCharsSentenceInput() {
  const { characters } = useOutletContext<OutletContext>();
  let [sentence, setSentence] = useLocalStorageState(
    "todoCharsSentenceInput",
    ""
  );
  let [algorithm, setAlgorithm] = useLocalStorageState<SegmentationAlgorithm>(
    "segmentationAlgorithm",
    "intl-tw"
  );
  const { settings } = useSettings();

  return (
    <main>
      <MainToolbar />
      <section className="block">
        <h3 className="font-serif text-2xl m-4">
          <p>Write some chinese text (or copy-paste it):</p>
          <Textarea
            className="border-2"
            value={sentence}
            minRows={2}
            maxRows={6}
            cols={60}
            onChange={(v) => setSentence(v.target.value)}
          />
        </h3>

        <div className="m-4">
          <label
            htmlFor="segmentationAlgorithm"
            className="block text-sm font-medium mb-2"
          >
            Segmentation Algorithm:
          </label>
          <select
            id="segmentationAlgorithm"
            value={algorithm}
            onChange={(e) =>
              setAlgorithm(e.target.value as SegmentationAlgorithm)
            }
            className="border border-gray-300 rounded px-3 py-1"
          >
            <option value="intl-tw">Intl.Segmenter Taiwan (Browser)</option>
            <option value="intl-cn">Intl.Segmenter China (Browser)</option>
            <option value="character">Character by Character</option>
          </select>
        </div>

        {/*<div className="m-4">
          <h4 className="text-lg font-semibold mb-2">Original Text:</h4>
          <div className="text-2xl">
            <HanziText value={sentence} />
          </div>
        </div>*/}

        <div className="m-4">
          <h4 className="text-lg font-semibold mb-2">Segmented Text:</h4>
          <div className="text-2xl">
            <HanziSegmentedText value={sentence} algorithm={algorithm} />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Words are underlined to show segmentation boundaries
          </p>
        </div>
      </section>
      <Section display={!!settings.characterNote?.noteType}>
        {[...removeDuplicateChars(sentence, IGNORE_PHRASE_CHARS)].map(
          (c, i) => (
            <HanziCardDetails key={i} c={c} characters={characters} />
          )
        )}
      </Section>
    </main>
  );
}
