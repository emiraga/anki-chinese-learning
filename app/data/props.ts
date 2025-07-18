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

export const PROP_MISC_TAGS = [
  "some-props-ignored",
  "repeated-duplicated-prop",
  "some-props-missing",
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
              note.tags.join(", ")
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
