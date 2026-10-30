import { Tooltip } from "@base-ui-components/react/tooltip";
import { Link } from "react-router";
import { POS, isPosCode, parsePOSString } from "~/data/pos";
import { POS_DETAILS } from "~/data/pos_details";
import styles from "./index.module.css";
import { useDarkMode } from "./DarkModeToggle";

/**
 * A part of speech code, with its name and summary in a tooltip. `note`
 * describes the word's role in a particular sentence, shown above the summary.
 */
export const POSDisplay: React.FC<{ posKey: string; note?: string }> = ({
  posKey,
  note,
}) => {
  const { isDarkMode } = useDarkMode();

  if (!posKey) {
    return null;
  }

  if (!isPosCode(posKey)) {
    // If not found in dictionary, just display the raw key
    return <span className="text-gray-600 dark:text-gray-400">{posKey}</span>;
  }

  const [englishName, chineseName, examples] = POS[posKey];

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        className="inline-block cursor-help text-purple-600 dark:text-purple-400 font-medium hover:underline"
        render={<Link to={`/pos/${encodeURIComponent(posKey)}`} />}
      >
        {posKey}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={10}>
          <Tooltip.Popup
            className={`${styles.Popup} max-w-xs`}
            data-dark-mode={isDarkMode}
          >
            <div className="font-semibold">
              {englishName}
              {chineseName && (
                <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                  {chineseName}
                </span>
              )}
            </div>
            {note && <div className="text-sm mt-1 font-medium">{note}</div>}
            <div className="text-sm mt-1">{POS_DETAILS[posKey].summary}</div>
            {examples && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                e.g. {examples}
              </div>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
              Click for details
            </div>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

export const POSList: React.FC<{ posString: string }> = ({ posString }) => {
  if (!posString) {
    return null;
  }

  const posParts = parsePOSString(posString);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {posParts.map((part, index) => (
        <span key={index} className="inline-flex items-center">
          {index > 0 && (
            <span className="text-gray-400 dark:text-gray-500 mx-1">·</span>
          )}
          <POSDisplay posKey={part} />
        </span>
      ))}
    </span>
  );
};
