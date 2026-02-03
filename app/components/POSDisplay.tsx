import { Tooltip } from "@base-ui-components/react/tooltip";
import { POS } from "~/data/pos";
import styles from "./index.module.css";
import { useDarkMode } from "./DarkModeToggle";

export const POSDisplay: React.FC<{ posKey: string }> = ({ posKey }) => {
  const { isDarkMode } = useDarkMode();

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
    <Tooltip.Root>
      <Tooltip.Trigger className="inline-block cursor-help">
        <span className="text-purple-600 dark:text-purple-400 font-medium">
          {posKey}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={10}>
          <Tooltip.Popup className={styles.Popup} data-dark-mode={isDarkMode}>
            <div className="font-semibold">{englishName}</div>
            <div className="text-gray-300 dark:text-gray-600">{chineseName}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              e.g. {examples}
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
