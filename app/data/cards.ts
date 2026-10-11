// TODO: migrate this to config
export const CARDS_INFO: { [key: string]: { name: string; deck: string }[] } = {
  TOCFL: [
    // { name: "traditional", deck: "Chinese::dPhrases" },
    { name: "meaning", deck: "Chinese::dPhrases" },
    { name: "listening", deck: "Chinese::sListening" },
    { name: "reading", deck: "Chinese::dPhrases" },
  ],
  Hanzi: [
    { name: "Recognize Hanzi", deck: "Chinese::wCharsProps" },
    { name: "Simplified", deck: "Chinese::Simplified" },
  ],
  Props: [
    { name: "Recognize prop", deck: "Chinese::wCharsProps" },
    { name: "Name of prop", deck: "Chinese::wCharsProps" },
  ],
  Actors: [
    { name: "Actor", deck: "Chinese::wCharsProps" },
    { name: "Actor", deck: "Chinese::wCharsProps" },
  ],
  Places: [
    { name: "Place", deck: "Chinese::wCharsProps" },
    { name: "Place", deck: "Chinese::wCharsProps" },
  ],
  Location: [
    { name: "Location", deck: "Chinese::wCharsProps" },
    { name: "Location", deck: "Chinese::wCharsProps" },
  ],
};
