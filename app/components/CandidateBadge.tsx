import { CharLink } from "~/components/CharCard";
import {
  type SoundComponentCandidate,
  getComponentTypeStyle,
  getScoreBadgeClasses,
} from "~/utils/sound_component_helpers";

interface CandidateBadgeProps {
  candidate: SoundComponentCandidate;
  isCurrent?: boolean;
  onSelect?: (character: string) => void;
  isUpdating?: boolean;
  disabled?: boolean;
}

export function CandidateBadge({
  candidate,
  isCurrent = false,
  onSelect,
  isUpdating = false,
  disabled = false,
}: CandidateBadgeProps) {
  const typeStyle = getComponentTypeStyle(candidate.componentType);

  return (
    <div
      className={`inline-flex items-center gap-1 border ${typeStyle.borderColor} ${typeStyle.bgColor} rounded px-2 py-1 ${
        isCurrent ? "ring-2 ring-green-500 dark:ring-green-400" : ""
      }`}
    >
      <CharLink traditional={candidate.character} className="font-bold" />
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {candidate.pinyin}
      </span>
      <span
        className={`px-1.5 py-0.5 rounded text-xs font-semibold ${getScoreBadgeClasses(candidate.score)}`}
      >
        {candidate.score.toFixed(1)}
      </span>
      <span
        className={`text-xs px-1 py-0.5 rounded ${typeStyle.badgeColor}`}
        title={`Component type: ${candidate.componentType.join(", ")}`}
      >
        {candidate.componentType[0]}
      </span>
      {candidate.depth > 0 && (
        <span
          className="text-xs text-gray-400 dark:text-gray-500"
          title={`Recursion depth: ${candidate.depth}`}
        >
          (d{candidate.depth})
        </span>
      )}
      <span
        className={`text-xs px-1 py-0.5 rounded ${
          candidate.source === "yellowbridge"
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
        }`}
        title={`Source: ${candidate.source === "yellowbridge" ? "YellowBridge" : "DongChinese"}`}
      >
        {candidate.source === "yellowbridge" ? "YB" : "DC"}
      </span>
      {onSelect && !isCurrent && (
        <button
          onClick={() => onSelect(candidate.character)}
          disabled={isUpdating || disabled}
          className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          title="Set as sound component"
        >
          +
        </button>
      )}
      {isCurrent && (
        <span
          className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded text-xs"
          title="Current sound component"
        >
          ✓
        </span>
      )}
    </div>
  );
}
