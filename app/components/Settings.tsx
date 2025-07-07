import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import { useSettings } from "../settings/SettingsContext";
import {
  settingsJsonSchema,
  settingsUiSchema,
  type AppSettings,
} from "../settings/schema";
import type { IChangeEvent } from "@rjsf/core";

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();

  const handleSubmit = (data: IChangeEvent<AppSettings>) => {
    if (data.formData) {
      updateSettings(data.formData);
      alert("Settings saved!");
    }
  };

  return (
    <>
      <Form
        schema={settingsJsonSchema}
        uiSchema={settingsUiSchema}
        validator={validator}
        formData={settings}
        onSubmit={handleSubmit}
      >
        <button
          type="submit"
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Save Settings
        </button>
        <button
          onClick={resetSettings}
          className="mt-4 float-right px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700 transition-colors cursor-pointer"
        >
          Reset to Defaults
        </button>
      </Form>
    </>
  );
}
