import { useState } from "react";
import { updateSoundComponentInAnki } from "~/utils/sound_component_helpers";

interface UseSoundComponentUpdateProps {
  ankiId: number | null;
  onUpdate?: () => void;
}

export function useSoundComponentUpdate({
  ankiId,
  onUpdate,
}: UseSoundComponentUpdateProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateSoundComponent = async (candidateChar: string) => {
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

  return { updateSoundComponent, isUpdating };
}
