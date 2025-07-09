import raw_json from "./pinyin_table.json";
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

let JSON_DATA = raw_json as RawJSON;
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

const ACTOR_TAGS_MAP: { [key: string]: string } = {
  // Male actors
  "_-": "actor::er-einstein",
  "d-": "actor::d-dracula",
  "y-": "actor::yi-isabelle",
  "sh-": "actor::sh-sheldon",
  "l-": "actor::l-leonardo",
  "p-": "actor::p-peter-parker",
  "z-": "actor::z-zorro",
  "r-": "actor::r-rock",
  "w-": "actor::w-wu-woody",
  "t-": "actor::t-terminator",
  "zh-": "actor::zh-johnny-cash",
  "g-": "actor::g-gandalf",
  "m-": "actor::m-max",
  "h-": "actor::h-hamza",
  "k-": "actor::k-keanu",
  "n-": "actor::n-neil-degrasse-tyson",
  "f-": "actor::f-ferran",
  "ch-": "actor::ch-charlie-chaplin",
  "b-": "actor::b-bruce",
  "c-": "actor::c-caesar",
  "s-": "actor::s-sammy",

  // Female girls
  "mi-": "actor::mi-sibei",
  "ji-": "actor::ji-jing",
  "qi-": "actor::qi-chiharu",
  "xi-": "actor::xi-shirley",
  "ni-": "actor::ni-nicole",
  "li-": "actor::li-linh-k-vu",
  "ti-": "actor::ti-rhea-tulod",
  "pi-": "actor::pi-phatima",
  "bi-": "actor::bi-bonnie",
  "di-": "actor::di-diane",

  // Fictional
  "mu-": "actor::mu-mulan",
  "zu-": "actor::zu-zoolander",
  "gu-": "actor::gu-goofy",
  "bu-": "actor::bu-bugs-bunny",
  "shu-": "actor::shu-sherlock-holmes",
  "hu-": "actor::hu-hugo",
  "ru-": "actor::ru-rooster",
  "du-": "actor::du-donald-duck",
  "su-": "actor::su-superman",
  "zhu-": "actor::zhu-juliet",
  "lu-": "actor::lu-luigi",
  "chu-": "actor::chu-chewbacca",
  "fu-": "actor::fu-fury-nick-marvel",
  "ku-": "actor::ku-cookie-monster",
  "tu-": "actor::tu-turk",
  "cu-": "actor::cu-DECIDE",

  // Scientists
  "nv-": "actor::nu-newton-isaac",
  "ju-": "actor::ju-joule",
  "qu-": "actor::qu-curie-maria",
  "xu-": "actor::xu-schrödinger",
  "lv-": "actor::lv-lovelace-ada",
  "yu-": "actor::yu-euler",
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
  INITIAL_TYPE,
  ACTOR_TAGS_MAP,
  PLACE_TAGS_MAP,
  LOCATION_TAGS_MAP,
};
