import { useEffect, useState } from "react";
import type { DongCharacter } from "~/types/dong_character";
import type { YellowBridgeCharacter } from "~/types/yellowbridge_character";
import anki from "~/apis/anki";
import {
  type SoundComponentCandidate,
  getAllComponentsRecursive,
  extractYellowBridgePhoneticComponents,
  mergeCandidates,
  sortCandidates,
} from "~/utils/sound_component_helpers";
import { CandidateBadge } from "~/components/CandidateBadge";
import { ScoreLegend } from "~/components/ScoreLegend";

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
  const [candidates, setCandidates] = useState<SoundComponentCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load candidates when data changes
  useEffect(() => {
    let cancelled = false;

    const loadCandidates = async () => {
      setIsLoading(true);

      let dongCandidates: SoundComponentCandidate[] = [];
      let ybCandidates: SoundComponentCandidate[] = [];

      // Get Dong candidates
      if (dongCharacter) {
        try {
          dongCandidates = await getAllComponentsRecursive(
            dongCharacter,
            mainCharPinyin,
            0,
            new Set([mainCharacter]),
          );
        } catch {
          // Error loading Dong candidates
        }
      }

      // Get YellowBridge candidates
      if (yellowBridgeCharacter) {
        try {
          ybCandidates = extractYellowBridgePhoneticComponents(
            yellowBridgeCharacter,
            mainCharPinyin,
          );
        } catch {
          // Error loading YellowBridge candidates
        }
      }

      // Merge, deduplicate, and sort candidates
      const mergedCandidates = mergeCandidates(dongCandidates, ybCandidates);
      const sortedCandidates = sortCandidates(mergedCandidates);

      if (!cancelled) {
        setCandidates(sortedCandidates);
        setIsLoading(false);
      }
    };

    loadCandidates();

    return () => {
      cancelled = true;
    };
  }, [dongCharacter, yellowBridgeCharacter, mainCharacter, mainCharPinyin]);

  const setSoundComponent = async (candidateChar: string) => {
    if (!ankiId) {
      alert("No Anki note found for this character");
      return;
    }

    setIsUpdating(true);
    try {
      await anki.note.updateNoteFields({
        note: {
          id: ankiId,
          fields: { "Sound component character": candidateChar },
        },
      });
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
