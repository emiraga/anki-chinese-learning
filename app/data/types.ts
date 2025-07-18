import type { CharactersType, KnownSoundsType } from "./characters";
import type { CharsToPhrasesPinyin, PhraseType } from "./phrases";
import type { KnownPropsType, PropType } from "./props";

export interface InvalidDataRecord {
  message: string;
  details?: { pinyin?: string; pinyinPart?: string; traditional?: string };
}

export interface OutletContext {
  reload: () => void;
  loading: boolean;
  knownProps: KnownPropsType;
  props: PropType[];
  phrases: PhraseType[];
  characters: CharactersType;
  knownSounds: KnownSoundsType;
  characterList: string[];
  charPhrasesPinyin: CharsToPhrasesPinyin;
  invalidData: InvalidDataRecord[];
}
