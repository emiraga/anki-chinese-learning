import { useState } from "react";
import { updateSoundComponentInAnki } from "~/utils/sound_component_helpers";

interface UseSoundComponentUpdateProps {
  ankiId: number | null;
  onUpdate?: () => void;
  getPropTagsForCharacter?: (char: string) => string[];
}

export function useSoundComponentUpdate({
  ankiId,
  onUpdate,
  getPropTagsForCharacter,
}: UseSoundComponentUpdateProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateSoundComponent = async (candidateChar: string) => {
    if (!ankiId) {
      alert("No Anki note found for this character");
      return;
    }

    setIsUpdating(true);
    try {
      // Get prop tags from the sound component character
      const propTags = getPropTagsForCharacter?.(candidateChar);
      await updateSoundComponentInAnki(ankiId, candidateChar, propTags);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      alert(`Failed to update sound component: ${error}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return { updateSoundComponent, isUpdating };
}
