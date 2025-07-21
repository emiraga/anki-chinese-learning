import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import { useSettings } from "../settings/SettingsContext";
import {
  settingsJsonSchema,
  settingsUiSchema,
  type AppSettings,
} from "../settings/schema";
import type { IChangeEvent, WidgetProps } from "@rjsf/core";
import { useState, useEffect, useCallback } from "react";
import { useBeforeUnload, useBlocker } from "react-router";
import { useDarkMode } from "./DarkModeToggle";
import type { FieldTemplateProps } from "@rjsf/utils";

// Helper function to find differing paths
const findDifferingPaths = (obj1: unknown, obj2: unknown): string[] => {
  const diffs = new Set<string>();

  const deepCompare = (val1: unknown, val2: unknown, path: string) => {
    // If values are strictly equal (primitives, same object reference), no difference
    if (val1 === val2) {
      return;
    }

    // If one is null/undefined and the other is not, or types are different (e.g., object vs. string)
    if (
      typeof val1 !== typeof val2 ||
      val1 === null ||
      val2 === null ||
      Array.isArray(val1) !== Array.isArray(val2)
    ) {
      diffs.add(path);
      return;
    }

    // If both are arrays
    if (Array.isArray(val1) && Array.isArray(val2)) {
      const arr1 = val1 as unknown[];
      const arr2 = val2 as unknown[];
      const maxLength = Math.max(arr1.length, arr2.length);
      for (let i = 0; i < maxLength; i++) {
        deepCompare(arr1[i], arr2[i], path ? `${path}.${i}` : `${i}`);
      }
      return;
    }

    // If both are objects (and not arrays)
    if (typeof val1 === "object" && typeof val2 === "object") {
      const o1 = val1 as Record<string, unknown>;
      const o2 = val2 as Record<string, unknown>;

      const keys1 = Object.keys(o1);
      const keys2 = Object.keys(o2);

      // Check for keys present in o1 but not o2, or vice-versa
      const allKeys = new Set([...keys1, ...keys2]);

      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        deepCompare(o1[key], o2[key], newPath);
      }
      return;
    }

    // If we reach here, it means they are primitive types that are not strictly equal
    // (e.g., 1 !== 2, "a" !== "b")
    diffs.add(path);
  };

  deepCompare(obj1, obj2, "");
  return Array.from(diffs);
};

// Custom FieldTemplate to apply styling
const CustomFieldTemplate = (props: FieldTemplateProps) => {
  const { id, children, errors, help, classNames, hidden, formContext } = props;
  const { isDarkMode } = useDarkMode();
  const modifiedFields = formContext?.modifiedFields || [];
  const hasUnsavedChanges = formContext?.hasUnsavedChanges || false;

  const isModified = modifiedFields.some((path: string) => {
    return "root_" + path.replaceAll(".", "_") === id;
  });

  const highlightStyle: React.CSSProperties =
    isModified && hasUnsavedChanges
      ? {
          boxShadow: isDarkMode
            ? "-5px 0px 0px 0px black, -10px 0px 0px 0px red"
            : "-5px 0px 0px 0px white, -10px 0px 0px 0px red",
        }
      : {};

  if (hidden) {
    return <div className="hidden">{children}</div>;
  }

  return (
    <div className={`${classNames} w-full`} style={highlightStyle}>
      {children}
      {errors}
      {help}
    </div>
  );
};

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [modifiedFields, setModifiedFields] = useState<string[]>([]);

  // Update form data when settings change from outside
  useEffect(() => {
    setFormData(settings);
    setHasUnsavedChanges(false);
    setModifiedFields([]);
  }, [settings]);

  // Check if there are unsaved changes and update modified fields
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(settings);
    setHasUnsavedChanges(hasChanges);
    if (hasChanges) {
      const newModifiedFields = findDifferingPaths(formData, settings);
      setModifiedFields(newModifiedFields);
      console.log("Modified Fields:", newModifiedFields);
    } else {
      setModifiedFields([]);
    }
  }, [formData, settings]);

  const handleSubmit = (data: IChangeEvent<AppSettings>) => {
    if (data.formData) {
      updateSettings(data.formData);
      alert("Settings saved!");
    }
  };

  const handleSave = () => {
    updateSettings(formData);
    alert("Settings saved!");
  };

  const handleUndo = () => {
    setFormData(settings);
  };

  const handleOnChange = (data: IChangeEvent<AppSettings>) => {
    if (data.formData) {
      setFormData(data.formData);
    }
  };

  const handleReset = () => {
    if (
      window.confirm(
        "⚠️ WARNING: This will reset all your settings to their default values. This action cannot be undone. Are you sure you want to continue?"
      )
    ) {
      resetSettings();
      // Settings will be updated via useEffect
    }
  };

  // Warn before navigating away if there are unsaved changes
  useBeforeUnload(
    useCallback(
      (event) => {
        if (hasUnsavedChanges) {
          event.preventDefault();
        }
      },
      [hasUnsavedChanges]
    ),
    { capture: true }
  );

  // Block navigation within the app if there are unsaved changes
  useBlocker(({ currentLocation, nextLocation }) => {
    if (
      hasUnsavedChanges &&
      currentLocation.pathname !== nextLocation.pathname
    ) {
      return !confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
    }
    return false;
  });

  return (
    <div className="relative pb-20">
      {/* Settings Form */}
      <div className="settings-form px-4">
        <Form
          schema={settingsJsonSchema}
          uiSchema={settingsUiSchema}
          validator={validator}
          formData={formData}
          onSubmit={handleSubmit}
          onChange={handleOnChange}
          // eslint-disable-next-line @typescript-eslint/naming-convention
          templates={{ FieldTemplate: CustomFieldTemplate }}
          formContext={{ modifiedFields, hasUnsavedChanges }}
          className="w-full"
        >
          {/* Hidden submit button for form functionality */}
          <button type="submit" style={{ display: "none" }}>
            Save
          </button>
        </Form>
      </div>

      {/* Fixed Save Button Bar at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className={`px-4 py-2 rounded font-medium transition-all ${
                hasUnsavedChanges
                  ? "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400"
              }`}
            >
              Save Settings
            </button>
            {hasUnsavedChanges && (
              <>
                <button
                  onClick={handleUndo}
                  className="px-4 py-2 rounded font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Undo changes
                </button>
                <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                  • Unsaved changes
                </span>
              </>
            )}
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors dark:bg-red-600 dark:hover:bg-red-500"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
