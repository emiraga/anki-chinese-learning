import { isPosCode } from "./pos";
import { POS_SENTENCES } from "./pos_sentences";

// pos_sentences.json is cast to PosSentence[], so the POS codes are not
// checked by the compiler; check them here instead.
describe("POS_SENTENCES", () => {
  it("tags every token with a known POS code", () => {
    const invalid = POS_SENTENCES.flatMap((sentence) =>
      sentence.tokens
        .filter((token) => token.pos !== undefined && !isPosCode(token.pos))
        .map((token) => `${token.zh}: ${token.pos}`),
    );
    expect(invalid).toEqual([]);
  });

  it("has an English translation and at least one tagged token per sentence", () => {
    for (const sentence of POS_SENTENCES) {
      expect(sentence.en).not.toBe("");
      expect(sentence.tokens.some((token) => token.pos)).toBe(true);
    }
  });
});
