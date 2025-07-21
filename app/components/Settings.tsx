import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import { useSettings } from "../settings/SettingsContext";
import {
  settingsJsonSchema,
  settingsUiSchema,
  type AppSettings,
} from "../settings/schema";
import type { IChangeEvent } from "@rjsf/core";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Update form data when settings change from outside
  useEffect(() => {
    setFormData(settings);
    setHasUnsavedChanges(false);
  }, [settings]);

  // Check if there are unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(settings);
    setHasUnsavedChanges(hasChanges);
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

  const handleOnChange = (data: IChangeEvent<AppSettings>) => {
    if (data.formData) {
      setFormData(data.formData);
    }
  };

  const handleReset = () => {
    resetSettings();
    // Settings will be updated via useEffect
  };

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
        >
          {/* Hidden submit button for form functionality */}
          <button type="submit" style={{ display: 'none' }}>
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
              <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                • Unsaved changes
              </span>
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
