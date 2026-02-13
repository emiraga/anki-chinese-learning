import anki from "~/apis/anki";
import { useCallback, useEffect, useState } from "react";
export type PropType = {
  hanzi: string;
  prop: string;
  description: string;
  mainTagname: string;
  tagnames: string[];
};
export type KnownPropsType = { [key: string]: PropType };

// Position types for prop placement in characters
export type PropPosition = "left" | "right" | "top" | "bottom";
export type PropPositionAxis = "horizontal" | "vertical" | null;

const POSITION_PREFIXES: Record<PropPosition, string> = {
  left: "prop-left::",
  right: "prop-right::",
  top: "prop-top::",
  bottom: "prop-bottom::",
};

// Extract position info from character tags
// Returns a map of prop name (e.g., "sun") to its position
export function extractPropPositions(
  tags: string[],
): Map<string, PropPosition> {
  const positions = new Map<string, PropPosition>();

  for (const tag of tags) {
    for (const [position, prefix] of Object.entries(POSITION_PREFIXES)) {
      if (tag.startsWith(prefix)) {
        const propName = tag.substring(prefix.length);
        positions.set(propName, position as PropPosition);
      }
    }
  }

  return positions;
}

// Determine the current axis based on existing positions
// horizontal = left/right used, vertical = top/bottom used
export function getPositionAxis(
  positions: Map<string, PropPosition>,
): PropPositionAxis {
  for (const position of positions.values()) {
    if (position === "left" || position === "right") {
      return "horizontal";
    }
    if (position === "top" || position === "bottom") {
      return "vertical";
    }
  }
  return null;
}

// Get the position tag for a prop
export function getPositionTag(propName: string, position: PropPosition): string {
  return POSITION_PREFIXES[position] + propName;
}

// Get available positions for a prop given current state
export function getAvailablePositions(
  propName: string,
  positions: Map<string, PropPosition>,
): PropPosition[] {
  const currentAxis = getPositionAxis(positions);
  const currentPosition = positions.get(propName);
  const takenPositions = new Set(positions.values());

  const allPositions: PropPosition[] = ["left", "right", "top", "bottom"];

  return allPositions.filter((pos) => {
    // If this prop already has this position, it's not "available" (it's current)
    if (currentPosition === pos) return false;

    // If position is taken by another prop, not available
    if (takenPositions.has(pos) && currentPosition !== pos) return false;

    // Check axis compatibility
    if (currentAxis === "horizontal" && (pos === "top" || pos === "bottom")) {
      return false;
    }
    if (currentAxis === "vertical" && (pos === "left" || pos === "right")) {
      return false;
    }

    return true;
  });
}

export const PROP_MISC_TAGS = [
  "chinese::repeated-duplicated-prop",
  "chinese::some-props-missing",
];

// Create a custom hook to load and manage Anki data with reload capability
export function useAnkiProps() {
  const [props, setProps] = useState<PropType[]>([]);
  const [knownProps, setKnownProps] = useState<KnownPropsType>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Define the load function with useCallback so it doesn't recreate on every render
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load from Anki
      const notesId = await anki.note.findNotes({ query: "note:Props" });
      const notes = await anki.note.notesInfo({ notes: notesId });

      const loadedProps: PropType[] = [];
      const loadedKnownProps: { [key: string]: PropType } = {};

      for (const note of notes) {
        const tagname = "prop::" + note.fields["Prop"].value;
        if (!note.tags.includes(tagname)) {
          throw new Error(
            "Prop " +
              note.fields["Prop"].value +
              " invalid tags: " +
              note.tags.join(", "),
          );
        }

        const info: PropType = {
          hanzi: note.fields["Hanzi"].value,
          prop: note.fields["Prop"].value,
          description: note.fields["Description"].value,
          mainTagname: tagname,
          tagnames: note.tags,
        };

        loadedProps.push(info);
        loadedKnownProps[info.mainTagname] = info;
      }

      setProps(loadedProps);
      setKnownProps(loadedKnownProps);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array means this function won't change

  // Initial load on component mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Return the data and the reload function
  return {
    props,
    knownProps,
    loading,
    error,
    reload: loadData, // Expose the reload function
  };
}
