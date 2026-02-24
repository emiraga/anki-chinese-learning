import { useState, useRef, useEffect } from "react";
import type { KnownPropsType, PropType } from "~/data/props";
import anki from "~/apis/anki";

type PropAutocompleteProps = {
  knownProps: KnownPropsType;
  existingPropTags: string[];
  ankiId: number;
  onPropAdded: () => void;
};

export const PropAutocomplete: React.FC<PropAutocompleteProps> = ({
  knownProps,
  existingPropTags,
  ankiId,
  onPropAdded,
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter available props (exclude already added ones)
  const existingPropTagsSet = new Set(existingPropTags);
  const availableProps = Object.values(knownProps).filter(
    (prop) => !existingPropTagsSet.has(prop.mainTagname),
  );

  // Filter by query
  const filteredProps = query.trim()
    ? availableProps.filter(
        (prop) =>
          prop.prop.toLowerCase().includes(query.toLowerCase()) ||
          prop.hanzi.includes(query) ||
          prop.description.toLowerCase().includes(query.toLowerCase()),
      )
    : availableProps;

  // Sort by relevance: exact matches first, then starts with, then contains
  const sortedProps = filteredProps.sort((a, b) => {
    const queryLower = query.toLowerCase();
    const aLower = a.prop.toLowerCase();
    const bLower = b.prop.toLowerCase();

    // Exact match
    if (aLower === queryLower && bLower !== queryLower) return -1;
    if (bLower === queryLower && aLower !== queryLower) return 1;

    // Starts with
    if (aLower.startsWith(queryLower) && !bLower.startsWith(queryLower))
      return -1;
    if (bLower.startsWith(queryLower) && !aLower.startsWith(queryLower))
      return 1;

    // Alphabetical
    return aLower.localeCompare(bLower);
  });

  // Limit displayed results
  const displayedProps = sortedProps.slice(0, 10);

  const handleAddProp = async (prop: PropType) => {
    setIsAdding(true);
    try {
      await anki.note.addTags({ notes: [ankiId], tags: prop.mainTagname });
      setQuery("");
      setIsOpen(false);
      onPropAdded();
    } catch (error) {
      throw new Error(`Failed to add prop tag: ${error}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, displayedProps.length - 1),
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (displayedProps[selectedIndex]) {
          handleAddProp(displayedProps[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(0);
        break;
    }
  };

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const inputId = `prop-autocomplete-${ankiId}`;

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Add prop:
        </label>
        <div className="relative flex-1 max-w-xs">
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Type prop name..."
            disabled={isAdding}
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls={`${inputId}-listbox`}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:opacity-50"
          />
          {isAdding && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
              ...
            </span>
          )}
        </div>
      </div>

      {isOpen && displayedProps.length > 0 && (
        <ul
          id={`${inputId}-listbox`}
          ref={listRef}
          role="listbox"
          className="absolute z-10 mt-1 w-full max-w-md max-h-60 overflow-auto
                     bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
                     rounded-md shadow-lg"
        >
          {displayedProps.map((prop, index) => (
            <li
              key={prop.mainTagname}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleAddProp(prop)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleAddProp(prop);
                }
              }}
              tabIndex={-1}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2
                         ${
                           index === selectedIndex
                             ? "bg-blue-100 dark:bg-blue-900"
                             : "hover:bg-gray-100 dark:hover:bg-gray-700"
                         }`}
            >
              <span className="text-2xl">{prop.hanzi}</span>
              <span className="font-medium">{prop.prop}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {prop.description}
              </span>
            </li>
          ))}
        </ul>
      )}

      {isOpen && query && displayedProps.length === 0 && (
        <div className="absolute z-10 mt-1 w-full max-w-md px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg text-gray-500 dark:text-gray-400 text-sm">
          No matching props found
        </div>
      )}
    </div>
  );
};
