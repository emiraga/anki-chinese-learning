import { deckMatches } from "./cards";

describe("deckMatches", () => {
  it("matches the letter prefix of a placeholder component", () => {
    expect(deckMatches("Chinese::.Connect", "Chinese::aConnect")).toBe(true);
    expect(deckMatches("Chinese::.Connect", "Chinese::ZConnect")).toBe(true);
  });

  it("requires exactly one Latin letter in place of the placeholder", () => {
    expect(deckMatches("Chinese::.Connect", "Chinese::Connect")).toBe(false);
    expect(deckMatches("Chinese::.Connect", "Chinese::abConnect")).toBe(false);
    expect(deckMatches("Chinese::.Connect", "Chinese::1Connect")).toBe(false);
  });

  it("compares other components exactly", () => {
    expect(deckMatches("Chinese", "Chinese")).toBe(true);
    expect(deckMatches("Chinese::.Connect", "Japanese::aConnect")).toBe(false);
    expect(deckMatches("Chinese::.Connect", "Chinese::aPhrases")).toBe(false);
  });

  it("does not match parent or child decks", () => {
    expect(deckMatches("Chinese::.Connect", "Chinese")).toBe(false);
    expect(deckMatches("Chinese::.Connect", "Chinese::aConnect::sub")).toBe(
      false,
    );
  });
});
