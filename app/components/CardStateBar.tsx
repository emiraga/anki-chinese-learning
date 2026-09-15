import * as React from "react";

export type CardStateSegment = {
  key: string;
  label: string;
  count: number;
  /** Tailwind background classes, used both for the bar slice and the legend swatch. */
  colorClassName: string;
  /** Anki search query, when the segment should be clickable. */
  query?: string;
};

export const CardStateBar: React.FC<{
  title: string;
  segments: CardStateSegment[];
  onSegmentClick?: (segment: CardStateSegment) => void;
}> = ({ title, segments, onSegmentClick }) => {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total === 0) return null;

  const visible = segments.filter((segment) => segment.count > 0);

  return (
    <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {total} cards
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-6 mb-3 dark:bg-gray-700">
        <div className="h-6 rounded-full flex">
          {visible.map((segment, i) => {
            const percent = (segment.count / total) * 100;
            const rounded = `${i === 0 ? "rounded-l-full" : ""} ${
              i === visible.length - 1 ? "rounded-r-full" : ""
            }`;
            return (
              <div
                key={segment.key}
                className={`${segment.colorClassName} ${rounded} flex items-center justify-center text-xs text-white font-medium overflow-hidden`}
                style={{ width: `${percent}%` }}
                title={`${segment.label}: ${segment.count}`}
              >
                {percent > 15 && segment.count}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {segments.map((segment) => {
          const content = (
            <>
              <div
                className={`w-3 h-3 ${segment.colorClassName} rounded mr-2`}
              ></div>
              <span className="text-gray-700 dark:text-gray-300">
                {segment.label}: {segment.count}
              </span>
            </>
          );
          return onSegmentClick && segment.query ? (
            <button
              key={segment.key}
              className="flex items-center hover:underline"
              onClick={() => onSegmentClick(segment)}
              title={`Browse in Anki: ${segment.query}`}
            >
              {content}
            </button>
          ) : (
            <div key={segment.key} className="flex items-center">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
};
