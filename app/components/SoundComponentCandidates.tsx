import type { DongCharacter } from "~/types/dong_character";
import type { YellowBridgeCharacter } from "~/types/yellowbridge_character";
import { useSoundComponentUpdate } from "~/hooks/useSoundComponentUpdate";
import { CandidateBadge } from "~/components/CandidateBadge";
import { ScoreLegend } from "~/components/ScoreLegend";
import { useSoundComponentCandidates } from "~/hooks/useSoundComponentCandidates";
import type { CharactersType } from "~/data/characters";
import { useCallback } from "react";

interface SoundComponentCandidatesProps {
  mainCharacter: string;
  mainCharPinyin: string;
  dongCharacter: DongCharacter | null;
  yellowBridgeCharacter: YellowBridgeCharacter | null;
  currentSoundComponent?: string;
  ankiId: number | null;
  onUpdate?: () => void;
  characters?: CharactersType;
}

export function SoundComponentCandidates({
  mainCharacter,
  mainCharPinyin,
  dongCharacter,
  yellowBridgeCharacter,
  currentSoundComponent,
  ankiId,
  onUpdate,
  characters,
}: SoundComponentCandidatesProps) {
  // Load candidates using custom hook
  const { candidates, isLoading } = useSoundComponentCandidates({
    mainCharacter,
    mainCharPinyin,
    dongCharacter,
    yellowBridgeCharacter,
  });

  // Get prop tags for a character from the characters context
  const getPropTagsForCharacter = useCallback(
    (char: string): string[] => {
      if (!characters) return [];
      const charData = characters[char];
      if (!charData) return [];
      return charData.tags.filter((tag) => tag.startsWith("prop::"));
    },
    [characters],
  );

  const { updateSoundComponent, isUpdating } = useSoundComponentUpdate({
    ankiId,
    onUpdate,
    getPropTagsForCharacter,
  });

  if (isLoading) {
    return (
      <div className="text-gray-400 dark:text-gray-500">
        Loading sound component candidates...
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-gray-400 dark:text-gray-500">
        No sound component candidates found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate, idx) => (
          <CandidateBadge
            key={`${candidate.character}-${idx}`}
            candidate={candidate}
            isCurrent={currentSoundComponent === candidate.character}
            onSelect={updateSoundComponent}
            isUpdating={isUpdating}
            disabled={!ankiId}
          />
        ))}
      </div>
      <ScoreLegend />
    </div>
  );
}
