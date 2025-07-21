import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import { useSettings } from "../settings/SettingsContext";
import {
  settingsJsonSchema,
  settingsUiSchema,
  type AppSettings,
} from "../settings/schema";
import type { IChangeEvent } from "@rjsf/core";
import { useState, useEffect, useCallback } from "react";
import { useBeforeUnload, useBlocker } from "react-router";
import { get, set, cloneDeep } from "lodash";
import { useDarkMode } from "./DarkModeToggle";

// Helper function to find differing paths
const findDifferingPaths = (
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>
): string[] => {
  const diffs = new Set<string>();
  const check = (
    o1: Record<string, unknown>,
    o2: Record<string, unknown> | undefined,
    path: string
  ) => {
    for (const key in o1) {
      if (o1.hasOwnProperty(key)) {
        const newPath = path ? `${path}.${key}` : key;
        const o1Value = o1[key];
        const o2Value = o2 ? o2[key] : undefined;
        if (
          typeof o1Value === "object" &&
          o1Value !== null &&
          !Array.isArray(o1Value)
        ) {
          if (
            typeof o2Value === "object" &&
            o2Value !== null &&
            !Array.isArray(o2Value)
          ) {
            check(
              o1Value as Record<string, unknown>,
              o2Value as Record<string, unknown>,
              newPath
            );
          } else {
            diffs.add(newPath);
          }
        } else if (JSON.stringify(o1Value) !== JSON.stringify(o2Value)) {
          diffs.add(newPath);
        }
      }
    }
  };
  check(obj1, obj2, "");
  return Array.from(diffs);
};

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { isDarkMode } = useDarkMode();
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
      setModifiedFields(
        findDifferingPaths(
          formData as unknown as Record<string, unknown>,
          settings as unknown as Record<string, unknown>
        )
      );
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

  // Generate dynamic UI schema to highlight modified fields
  const getDynamicUiSchema = () => {
    const dynamicUiSchema = cloneDeep(settingsUiSchema);
    modifiedFields.forEach((path) => {
      const existingUiOptions: { style?: React.CSSProperties } = get(
        dynamicUiSchema,
        `${path}.ui:options`,
        {}
      );
      set(dynamicUiSchema, `${path}.ui:options`, {
        ...existingUiOptions,
        style: {
          ...existingUiOptions.style,
          boxShadow: isDarkMode
            ? "-5px 0px 0px 0px black,-10px 0px 0px 0px red"
            : "-5px 0px 0px 0px white,-10px 0px 0px 0px red",
        },
      });
    });
    return dynamicUiSchema;
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
          uiSchema={getDynamicUiSchema()}
          validator={validator}
          formData={formData}
          onSubmit={handleSubmit}
          onChange={handleOnChange}
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
