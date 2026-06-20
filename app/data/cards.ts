// TODO: migrate this to config
export const CARDS_INFO: { [key: string]: { name: string; deck: string }[] } = {
  TOCFL: [
    // { name: "traditional", deck: "Chinese::Phrases" },
    { name: "meaning", deck: "Chinese::Phrases" },
    { name: "listening", deck: "Chinese::zListening" },
  ],
  Hanzi: [
    { name: "Recognize Hanzi", deck: "Chinese::CharsProps" },
    { name: "Simplified", deck: "Chinese::Simplified" },
  ],
  Props: [
    { name: "Recognize prop", deck: "Chinese::CharsProps" },
    { name: "Name of prop", deck: "Chinese::CharsProps" },
  ],
  Actors: [
    { name: "Actor", deck: "Chinese::CharsProps" },
    { name: "Actor", deck: "Chinese::CharsProps" },
  ],
  Places: [
    { name: "Place", deck: "Chinese::CharsProps" },
    { name: "Place", deck: "Chinese::CharsProps" },
  ],
  Location: [
    { name: "Location", deck: "Chinese::CharsProps" },
    { name: "Location", deck: "Chinese::CharsProps" },
  ],
};
