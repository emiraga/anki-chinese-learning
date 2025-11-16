import { useEffect, useState } from "react";
import type { DongCharacter } from "~/types/dong_character";
import type { YellowBridgeCharacter } from "~/types/yellowbridge_character";
import {
  type SoundComponentCandidate,
  fetchDongCharacter,
  fetchYellowBridgeCharacter,
  getAllComponentsRecursive,
  extractYellowBridgePhoneticComponents,
  mergeCandidates,
  sortCandidates,
} from "~/utils/sound_component_helpers";

interface UseSoundComponentCandidatesOptions {
  mainCharacter: string;
  mainCharPinyin: string;
  dongCharacter?: DongCharacter | null;
  yellowBridgeCharacter?: YellowBridgeCharacter | null;
  // If true, will fetch dongChar and ybChar internally
  autoFetch?: boolean;
}

interface UseSoundComponentCandidatesResult {
  candidates: SoundComponentCandidate[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Custom hook to load and manage sound component candidates from DongChinese and YellowBridge sources.
 *
 * Can work in two modes:
 * 1. With pre-loaded data: Pass dongCharacter and yellowBridgeCharacter
 * 2. Auto-fetch mode: Set autoFetch=true and it will fetch the data internally
 */
export function useSoundComponentCandidates({
  mainCharacter,
  mainCharPinyin,
  dongCharacter,
  yellowBridgeCharacter,
  autoFetch = false,
}: UseSoundComponentCandidatesOptions): UseSoundComponentCandidatesResult {
  const [candidates, setCandidates] = useState<SoundComponentCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCandidates = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let dongChar = dongCharacter;
        let ybChar = yellowBridgeCharacter;

        // Auto-fetch mode: fetch data if not provided
        if (autoFetch && !dongChar && !ybChar) {
          [dongChar, ybChar] = await Promise.all([
            fetchDongCharacter(mainCharacter),
            fetchYellowBridgeCharacter(mainCharacter),
          ]);
        }

        let dongCandidates: SoundComponentCandidate[] = [];
        let ybCandidates: SoundComponentCandidate[] = [];

        // Get Dong candidates
        if (dongChar) {
          try {
            dongCandidates = await getAllComponentsRecursive(
              dongChar,
              mainCharPinyin,
              0,
              new Set([mainCharacter]),
            );
          } catch (err) {
            console.error("Error loading Dong candidates:", err);
          }
        }

        // Get YellowBridge candidates
        if (ybChar) {
          try {
            ybCandidates = extractYellowBridgePhoneticComponents(
              ybChar,
              mainCharPinyin,
            );
          } catch (err) {
            console.error("Error loading YellowBridge candidates:", err);
          }
        }

        // Merge, deduplicate, and sort candidates
        const mergedCandidates = mergeCandidates(dongCandidates, ybCandidates);
        const sortedCandidates = sortCandidates(mergedCandidates);

        if (!cancelled) {
          setCandidates(sortedCandidates);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadCandidates();

    return () => {
      cancelled = true;
    };
  }, [dongCharacter, yellowBridgeCharacter, mainCharacter, mainCharPinyin, autoFetch]);

  return { candidates, isLoading, error };
}
