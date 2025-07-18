import rawJson from "./pinyin_table.json";
interface RawJSON {
  data: string[][];
  finals: string[];
  initials: string[];
}

var typeFemale = [
  "bi-",
  "di-",
  "ji-",
  "li-",
  "mi-",
  "ni-",
  "pi-",
  "qi-",
  "ti-",
  "xi-",
  "y-",
];

var typeFictional = [
  "ru-",
  "w-",
  "bu-",
  "pu-",
  "mu-",
  "fu-",
  "du-",
  "tu-",
  "nu-",
  "lu-",
  "gu-",
  "ku-",
  "hu-",
  "zhu-",
  "chu-",
  "shu-",
  "zu-",
  "cu-",
  "su-",
];

var typeExtra = ["yu-", "lv-", "nv-", "qu-", "xu-", "ju-"];

let JSON_DATA = rawJson as RawJSON;
let INITIAL_TYPE: { [key1: string]: string } = {};
JSON_DATA.initials.forEach((initial) => {
  if (typeFemale.includes(initial)) {
    INITIAL_TYPE[initial] = "female";
  } else if (typeExtra.includes(initial)) {
    INITIAL_TYPE[initial] = "extra";
  } else if (typeFictional.includes(initial)) {
    INITIAL_TYPE[initial] = "fictional";
  } else {
    INITIAL_TYPE[initial] = "male";
  }
});

// JSON_DATA.initials.sort((x, y) => {
//   return INITIAL_TYPE[x] > INITIAL_TYPE[y] ? 0 : 1;
// });

let FULL_MAP: {
  [key1: string]: {
    [key2: string]: string;
  };
} = {};
JSON_DATA.initials.forEach((initial, initialIndex) => {
  FULL_MAP[initial] = {};
  JSON_DATA.finals.forEach((final, finalIndex) => {
    FULL_MAP[initial][final] = JSON_DATA.data[initialIndex][finalIndex];
  });
});

const REVERSE_FULL_MAP: { [key: string]: { initial: string; final: string } } =
  {};
Object.entries(FULL_MAP).forEach(([initial, rest]) => {
  Object.entries(rest).forEach(([final, sylable]) => {
    if (sylable.length === 0) {
      return;
    }
    REVERSE_FULL_MAP[sylable] = { initial, final };
  });
});

export const ACTOR_NAMES_MAP: { [key: string]: string } = {
  // Male actors
  "_-": "Einstein",
  "d-": "Dracula",
  "y-": "Isabelle",
  "sh-": "Sheldon Cooper",
  "l-": "Leonardo",
  "p-": "Peter Parker",
  "z-": "Zorro",
  "r-": "Rock",
  "w-": "Woody",
  "t-": "Terminator",
  "zh-": "Johnny Cash",
  "g-": "Gandalf",
  "m-": "Max",
  "h-": "Hamza",
  "k-": "Keanu",
  "n-": "Neil Degrasse Tyson",
  "f-": "Ferran",
  "ch-": "Charlie Chaplin",
  "b-": "Bruce Lee",
  "c-": "Caesar",
  "s-": "Sammy",

  // Female girls
  "mi-": "Sibei",
  "ji-": "Jing",
  "qi-": "Chiharu",
  "xi-": "Shirley",
  "ni-": "Nicole",
  "li-": "Linh K Vu",
  "ti-": "Rhea Tulod",
  "pi-": "Phatima",
  "bi-": "Bonnie",
  "di-": "Diane",

  // Fictional
  "mu-": "Mulan",
  "zu-": "Zoolander",
  "gu-": "Goofy",
  "bu-": "Bugs-bunny",
  "shu-": "Sherlock Holmes",
  "hu-": "Hugo",
  "ru-": "Rooster",
  "du-": "Donald Duck",
  "su-": "Superman",
  "zhu-": "Juliet",
  "lu-": "Luigi",
  "chu-": "Chewbacca",
  "fu-": "Fury Nick Marvel",
  "ku-": "Cookie Monster",
  "tu-": "Turk",
  "cu-": "Cupid",
  "nu-": "Naruto",
  "pu-": "Popeye",

  // Scientists
  "nv-": "Newton Isaac",
  "ju-": "James Prescott Joule",
  "qu-": "Curie Maria",
  "xu-": "Schrödinger",
  "lv-": "Lovelace Ada",
  "yu-": "Leonhard Euler",
};

const ACTOR_TAGS_MAP: { [key: string]: string } = Object.fromEntries(
  Object.entries(ACTOR_NAMES_MAP).map(([k, v]) => [
    k,
    `actor::${k}${v.toLowerCase().replaceAll(" ", "-")}`,
  ])
);

const PLACE_NAMES_MAP: { [key: string]: string } = {
  "-_": "My childhood Apartment where I grew up",
  "-er": "My childhood Apartment where I grew up",
  "-e": "Elementary school",
  "-ai": "Highschool",
  "-(e)n": "My brothers house in Sweden",
  "-(o)u": "Bowling Place",
  "-o": "Facebook Office",
  "-a": "Amsterdam apartment",
  "-ong": "Gym at the Menlo Park at the office",
  "-ang": "Taiwan apartment",
  "-(e)i": "Coffeeshop like Starbucks",
  "-an": "Macchu Picchu in Andes",
  "-ao": "Cousins House in San Jose",
  "-(e)ng": "Engineering (where I studied at university)",
};

const PLACE_TAGS_MAP: { [key: string]: string } = {
  "-_": "place::null-apartment",
  "-er": "place::null-apartment",
  "-e": "place::e-elementary",
  "-ai": "place::ai-highschool",
  "-(e)n": "place::en-n-sweden",
  "-(o)u": "place::ou-u-bowling",
  "-o": "place::o-office",
  "-a": "place::a-amsterdam",
  "-ong": "place::ong-gym",
  "-ang": "place::ang-taiwan",
  "-(e)i": "place::ei-i-coffeeshop",
  "-an": "place::an-andes",
  "-ao": "place::ao-house",
  "-(e)ng": "place::eng-ng-engineering",
};

const LOCATION_NAMES_MAP: { [key: number]: string } = {
  1: "in front of the entrance to indicate high tone (first tone)",
  2: "in the hallway to indicate rising tone (second tone)",
  3: "in the bedroom or some resting place (with a seat, bed or bench) to indicate low tone (third tone)",
  4: "in the bathroom or backyard to indicate falling tone (fourth tone)",
  5: "on the roof to indicate neutral tone (fifth tone)",
};

const LOCATION_TAGS_MAP: { [key: number]: string } = {
  1: "tone::t1-front-high",
  2: "tone::t2-hallway-rising",
  3: "tone::t3-bedroom-resting-low",
  4: "tone::t4-bathroom-backyard-falling",
  5: "tone::t5-roof-short",
};

export {
  JSON_DATA,
  FULL_MAP,
  REVERSE_FULL_MAP,
  INITIAL_TYPE,
  ACTOR_TAGS_MAP,
  PLACE_NAMES_MAP,
  PLACE_TAGS_MAP,
  LOCATION_NAMES_MAP,
  LOCATION_TAGS_MAP,
};
