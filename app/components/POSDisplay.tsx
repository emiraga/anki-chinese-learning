import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { POS } from "~/data/pos";

export const POSDisplay: React.FC<{ posKey: string }> = ({ posKey }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (showTooltip && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top + window.scrollY - 8,
        left: rect.left + rect.width / 2 + window.scrollX,
      });
    }
  }, [showTooltip]);

  if (!posKey) {
    return null;
  }

  // Try to find the POS in the dictionary
  const posInfo = POS[posKey];

  if (!posInfo) {
    // If not found in dictionary, just display the raw key
    return <span className="text-gray-600 dark:text-gray-400">{posKey}</span>;
  }

  const [englishName, chineseName, examples] = posInfo;

  return (
    <span
      ref={triggerRef}
      className="inline-block cursor-help"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-purple-600 dark:text-purple-400 font-medium">
        {posKey}
      </span>
      {showTooltip &&
        createPortal(
          <div
            className="fixed z-9999 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg shadow-lg whitespace-nowrap"
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="font-semibold">{englishName}</div>
            <div className="text-gray-300 dark:text-gray-600">
              {chineseName}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              e.g. {examples}
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
          </div>,
          document.body,
        )}
    </span>
  );
};

export const POSList: React.FC<{ posString: string }> = ({ posString }) => {
  if (!posString) {
    return null;
  }

  // Remove HTML tags and split by common separators
  const cleanString = posString.replace(/<[^>]*>/g, "").trim();

  // Split by comma, semicolon, slash, or space (common POS separators)
  const posParts = cleanString.split(/[,;、/\s]+/).filter(Boolean);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {posParts.map((part, index) => (
        <span key={index} className="inline-flex items-center">
          {index > 0 && (
            <span className="text-gray-400 dark:text-gray-500 mx-1">·</span>
          )}
          <POSDisplay posKey={part.trim()} />
        </span>
      ))}
    </span>
  );
};
