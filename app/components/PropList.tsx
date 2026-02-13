import { useState } from "react";
import type { PropType, PropPosition } from "~/data/props";
import {
  extractPropPositions,
  getAvailablePositions,
  getPositionTag,
} from "~/data/props";
import { PropCard } from "./PropCard";
import anki from "~/apis/anki";

type PropListProps = {
  props: PropType[];
  miscTags?: string[];
  ankiId?: number | null;
  characterTags?: string[];
  onTagRemoved?: () => void;
  characterCounts?: Record<string, number>;
};

const PositionLabel: React.FC<{ position: PropPosition }> = ({ position }) => {
  const isVertical = position === "left" || position === "right";

  if (isVertical) {
    return (
      <span className="flex flex-col items-center leading-none text-[10px]">
        {position.split("").map((char, i) => (
          <span key={i}>{char}</span>
        ))}
      </span>
    );
  }

  return <span className="text-[10px]">{position}</span>;
};

const PropPositionPill: React.FC<{
  position: PropPosition;
  isActive: boolean;
  isAvailable: boolean;
  isLoading: boolean;
  onClick: () => void;
}> = ({ position, isActive, isAvailable, isLoading, onClick }) => {
  if (!isActive && !isAvailable) return null;

  const isVertical = position === "left" || position === "right";
  const baseClasses = `${isVertical ? "w-4 py-1" : "h-5 px-1"} text-xs font-bold rounded flex items-center justify-center transition-colors`;

  if (isLoading) {
    return (
      <span
        className={`${baseClasses} bg-gray-200 dark:bg-gray-600 text-gray-400`}
      >
        ...
      </span>
    );
  }

  if (isActive) {
    return (
      <button
        onClick={onClick}
        className={`${baseClasses} bg-blue-500 text-white hover:bg-red-500 group`}
        title={`Remove ${position} position`}
      >
        <span className="group-hover:hidden">
          <PositionLabel position={position} />
        </span>
        <span className="hidden group-hover:inline">✕</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 hover:bg-blue-300 dark:hover:bg-blue-700 hover:text-blue-700 dark:hover:text-blue-200 cursor-pointer`}
      title={`Set as ${position}`}
    >
      <PositionLabel position={position} />
    </button>
  );
};

const DUPLICATED_PROP_TAG = "chinese::repeated-duplicated-prop";

const PropWithPosition: React.FC<{
  prop: PropType;
  currentPositions: PropPosition[];
  availablePositions: PropPosition[];
  ankiId: number | null;
  characterCount?: number;
  onPositionChange: () => void;
  showPositionButtons: boolean;
}> = ({
  prop,
  currentPositions,
  availablePositions,
  ankiId,
  characterCount,
  onPositionChange,
  showPositionButtons,
}) => {
  const [loadingPosition, setLoadingPosition] = useState<PropPosition | null>(
    null,
  );

  const propName = prop.mainTagname.substring(6); // Remove "prop::" prefix
  const isDuplicated = prop.tagnames.includes(DUPLICATED_PROP_TAG);
  const currentPositionSet = new Set(currentPositions);

  const handlePositionClick = async (position: PropPosition) => {
    if (!ankiId) return;

    setLoadingPosition(position);
    try {
      if (currentPositionSet.has(position)) {
        // Remove this position
        const tag = getPositionTag(propName, position);
        await anki.note.removeTags({ notes: [ankiId], tags: tag });
      } else {
        // For non-duplicated props, remove old position(s) first
        if (!isDuplicated) {
          for (const oldPos of currentPositions) {
            const oldTag = getPositionTag(propName, oldPos);
            await anki.note.removeTags({ notes: [ankiId], tags: oldTag });
          }
        }
        // Add new position
        const newTag = getPositionTag(propName, position);
        await anki.note.addTags({ notes: [ankiId], tags: newTag });
      }
      onPositionChange();
    } catch (error) {
      throw new Error(`Failed to update position: ${error}`);
    } finally {
      setLoadingPosition(null);
    }
  };

  const availableSet = new Set(availablePositions);

  // If no position buttons needed, just render the prop card
  if (!showPositionButtons) {
    return <PropCard prop={prop} characterCount={characterCount} />;
  }

  return (
    <div className="flex items-start gap-2">
      {/* Position controls arranged around the prop card */}
      <div className="flex flex-col items-center gap-1">
        {/* Top position */}
        <PropPositionPill
          position="top"
          isActive={currentPositionSet.has("top")}
          isAvailable={availableSet.has("top")}
          isLoading={loadingPosition === "top"}
          onClick={() => handlePositionClick("top")}
        />

        <div className="flex items-center gap-1">
          {/* Left position */}
          <PropPositionPill
            position="left"
            isActive={currentPositionSet.has("left")}
            isAvailable={availableSet.has("left")}
            isLoading={loadingPosition === "left"}
            onClick={() => handlePositionClick("left")}
          />

          {/* Prop card */}
          <div className="flex-1 min-w-0">
            <PropCard prop={prop} characterCount={characterCount} />
          </div>

          {/* Right position */}
          <PropPositionPill
            position="right"
            isActive={currentPositionSet.has("right")}
            isAvailable={availableSet.has("right")}
            isLoading={loadingPosition === "right"}
            onClick={() => handlePositionClick("right")}
          />
        </div>

        {/* Bottom position */}
        <PropPositionPill
          position="bottom"
          isActive={currentPositionSet.has("bottom")}
          isAvailable={availableSet.has("bottom")}
          isLoading={loadingPosition === "bottom"}
          onClick={() => handlePositionClick("bottom")}
        />
      </div>
    </div>
  );
};

export const PropList: React.FC<PropListProps> = ({
  props,
  miscTags = [],
  ankiId,
  characterTags = [],
  onTagRemoved,
  characterCounts,
}) => {
  const [removingTag, setRemovingTag] = useState<string | null>(null);

  const positions = extractPropPositions(characterTags);

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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 mx-2">
      {props.map((prop, i) => {
        const propName = prop.mainTagname.substring(6);
        const currentPositions = positions.get(propName) || [];
        const isDuplicated = miscTags.includes(DUPLICATED_PROP_TAG);
        const availablePositions = getAvailablePositions(
          propName,
          positions,
          isDuplicated,
        );

        return (
          <PropWithPosition
            key={i}
            prop={prop}
            currentPositions={currentPositions}
            availablePositions={ankiId ? availablePositions : []}
            ankiId={ankiId ?? null}
            characterCount={characterCounts?.[prop.mainTagname]}
            onPositionChange={() => onTagRemoved?.()}
            showPositionButtons={props.length > 1 || isDuplicated}
          />
        );
      })}
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
