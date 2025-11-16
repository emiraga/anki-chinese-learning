import { useState } from "react";
import type { DongCharacter } from "~/types/dong_character";
import type { YellowBridgeCharacter } from "~/types/yellowbridge_character";
import { updateSoundComponentInAnki } from "~/utils/sound_component_helpers";
import { CandidateBadge } from "~/components/CandidateBadge";
import { ScoreLegend } from "~/components/ScoreLegend";
import { useSoundComponentCandidates } from "~/hooks/useSoundComponentCandidates";

interface SoundComponentCandidatesProps {
  mainCharacter: string;
  mainCharPinyin: string;
  dongCharacter: DongCharacter | null;
  yellowBridgeCharacter: YellowBridgeCharacter | null;
  currentSoundComponent?: string;
  ankiId: number | null;
  onUpdate?: () => void;
}

export function SoundComponentCandidates({
  mainCharacter,
  mainCharPinyin,
  dongCharacter,
  yellowBridgeCharacter,
  currentSoundComponent,
  ankiId,
  onUpdate,
}: SoundComponentCandidatesProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Load candidates using custom hook
  const { candidates, isLoading } = useSoundComponentCandidates({
    mainCharacter,
    mainCharPinyin,
    dongCharacter,
    yellowBridgeCharacter,
  });

  const setSoundComponent = async (candidateChar: string) => {
    if (!ankiId) {
      alert("No Anki note found for this character");
      return;
    }

    setIsUpdating(true);
    try {
      await updateSoundComponentInAnki(ankiId, candidateChar);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      alert(`Failed to update sound component: ${error}`);
    } finally {
      setIsUpdating(false);
    }
  };

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
            onSelect={setSoundComponent}
            isUpdating={isUpdating}
            disabled={!ankiId}
          />
        ))}
      </div>
      <ScoreLegend />
    </div>
  );
}
