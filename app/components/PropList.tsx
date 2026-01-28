import { useState } from "react";
import type { PropType } from "~/data/props";
import { PropCard } from "./PropCard";
import anki from "~/apis/anki";

type PropListProps = {
  props: PropType[];
  miscTags?: string[];
  ankiId?: number | null;
  onTagRemoved?: () => void;
  characterCounts?: Record<string, number>;
};

export const PropList: React.FC<PropListProps> = ({
  props,
  miscTags = [],
  ankiId,
  onTagRemoved,
  characterCounts,
}) => {
  const [removingTag, setRemovingTag] = useState<string | null>(null);

  const handleRemoveTag = async (tag: string) => {
    if (!ankiId) return;

    setRemovingTag(tag);
    try {
      await anki.note.removeTags({ notes: [ankiId], tags: tag });
      onTagRemoved?.();
    } catch (error) {
      throw new Error(`Failed to remove tag: ${error}`);
    } finally {
      setRemovingTag(null);
    }
  };

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 mx-2">
      {props.map((prop, i) => (
        <div key={i}>
          <PropCard
            prop={prop}
            characterCount={characterCounts?.[prop.mainTagname]}
          />
        </div>
      ))}
      {miscTags.map((tag) => (
        <div className="italic flex items-center gap-2" key={tag}>
          <span>{tag}</span>
          {ankiId &&
            props.length > 0 &&
            tag === "chinese::some-props-missing" && (
              <button
                onClick={() => handleRemoveTag(tag)}
                disabled={removingTag === tag}
                className="text-red-500 hover:text-red-700 disabled:opacity-50 text-sm font-bold px-1"
                title={`Remove tag "${tag}"`}
              >
                {removingTag === tag ? "..." : "✕"}
              </button>
            )}
        </div>
      ))}
    </div>
  );
};
