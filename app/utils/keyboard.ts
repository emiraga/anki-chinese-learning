import anki from "~/apis/anki";

/**
 * Check if the keyboard event should be ignored (e.g., when typing in inputs)
 */
export function shouldIgnoreKeyboardEvent(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return true;
  }

  const target = event.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return true;
  }

  return false;
}

/**
 * Fetch the Traditional field from the currently displayed Anki card
 */
export async function fetchCurrentStudyTraditional(): Promise<string | null> {
  const card = await anki.graphical.guiCurrentCard();
  if (!card) {
    return null;
  }
  const traditional = card.fields["Traditional"]?.value;
  return traditional || null;
}

export type KeyboardShortcut = {
  key: string;
  handler: (event: KeyboardEvent) => void | Promise<void>;
};

/**
 * Create a keyboard event handler from a list of shortcuts
 */
export function createKeyboardHandler(
  shortcuts: KeyboardShortcut[],
): (event: KeyboardEvent) => void {
  const shortcutMap = new Map(shortcuts.map((s) => [s.key, s.handler]));

  return (event: KeyboardEvent) => {
    if (shouldIgnoreKeyboardEvent(event)) {
      return;
    }

    const handler = shortcutMap.get(event.key);
    if (handler) {
      event.preventDefault();
      handler(event);
    }
  };
}
