import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import { useSettings } from "../settings/SettingsContext";
import {
  settingsJsonSchema,
  settingsUiSchema,
  type AppSettings,
} from "../settings/schema";
import type { IChangeEvent } from "@rjsf/core";
import { useDebouncedCallback } from "use-debounce";

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();

  const handleSubmit = (data: IChangeEvent<AppSettings>) => {
    if (data.formData) {
      updateSettings(data.formData);
      alert("Settings saved!");
    }
  };

  const debouncedSave = useDebouncedCallback((data: AppSettings) => {
    console.info("Saving data");
    updateSettings(data);
  }, 1000); // Debounce for 1 second

  const handleOnChange = (data: IChangeEvent<AppSettings>) => {
    if (data.formData) {
      debouncedSave(data.formData);
    }
  };

  return (
    <div className="settings-form">
      <Form
        schema={settingsJsonSchema}
        uiSchema={settingsUiSchema}
        validator={validator}
        formData={settings}
        onSubmit={handleSubmit}
        onChange={handleOnChange}
      >
        <button
          type="submit"
          className="my-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          Save Settings
        </button>
        <button
          onClick={resetSettings}
          className="my-4 float-right px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700 transition-colors cursor-pointer dark:bg-red-600 dark:hover:bg-red-500"
        >
          Reset to Defaults
        </button>
      </Form>
    </div>
  );
}
