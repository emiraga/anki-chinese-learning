import {
  InvalidPosBreakdownError,
  buildPosBreakdownPrompt,
  parsePosBreakdownResponse,
  tocflEntriesIn,
  type TocflLexicon,
} from "./pos_breakdown";
import { POS_SENTENCES } from "~/data/pos_sentences";

const LEXICON: TocflLexicon = {
  回: ["V", "M"],
  回家: ["V-sep"],
  走: ["V"],
  家: ["N"],
};

const reply = (tokens: object[]) =>
  JSON.stringify({ sentences: [{ en: "He walked home.", note: "", tokens }] });

describe("tocflEntriesIn", () => {
  it("lists every word of the list in the text, overlapping ones too", () => {
    expect(tocflEntriesIn("他走回家。", LEXICON)).toEqual([
      ["走", ["V"]],
      ["回", ["V", "M"]],
      ["回家", ["V-sep"]],
      ["家", ["N"]],
    ]);
  });
});

describe("buildPosBreakdownPrompt", () => {
  it("includes the guide, the examples and the TOCFL entries", () => {
    const prompt = buildPosBreakdownPrompt(
      "他走回家。",
      POS_SENTENCES,
      LEXICON,
    );
    expect(prompt).toContain("### Vs-pred");
    expect(prompt).toContain(POS_SENTENCES[0].en);
    expect(prompt).toContain("回家: V-sep");
    expect(prompt).toMatch(/他走回家。$/);
  });
});

describe("parsePosBreakdownResponse", () => {
  it("converts a valid reply, dropping codes on punctuation", () => {
    const sentences = parsePosBreakdownResponse(
      "他走 回家。",
      reply([
        { zh: "他", pos: "N", gloss: "he" },
        { zh: "走", pos: "V", gloss: "walk", note: "" },
        { zh: "回", pos: "V" },
        { zh: "家", pos: "N" },
        { zh: "。", pos: "Ptc" },
      ]),
    );
    expect(sentences[0].tokens).toEqual([
      { zh: "他", pos: "N", gloss: "he", note: undefined },
      { zh: "走", pos: "V", gloss: "walk", note: undefined },
      { zh: "回", pos: "V", gloss: undefined, note: undefined },
      { zh: "家", pos: "N", gloss: undefined, note: undefined },
      { zh: "。" },
    ]);
  });

  it("rejects words that don't add up to the text", () => {
    expect(() =>
      parsePosBreakdownResponse(
        "他走。",
        reply([{ zh: "他" }, { zh: "他" }, { zh: "走" }, { zh: "。" }]),
      ),
    ).toThrow(InvalidPosBreakdownError);
  });

  it("rejects unknown codes", () => {
    expect(() =>
      parsePosBreakdownResponse("走", reply([{ zh: "走", pos: "Adj" }])),
    ).toThrow(/unknown POS code "Adj"/);
  });

  it("rejects replies that are not JSON", () => {
    expect(() => parsePosBreakdownResponse("走", "oops")).toThrow(
      InvalidPosBreakdownError,
    );
  });
});
