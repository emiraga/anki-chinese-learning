import type { CharactersType } from "~/data/characters";

export const CLAUDE_NEW_QUERY = "https://claude.ai/new?q=";

export function sentencesPrompt(
  characters: CharactersType,
  options: { learn?: string }
) {
  let charsComplete = Object.values(characters).filter(
    (c) => c.withSound && c.withMeaning
  );

  return `
I am learning Traditional Mandarin with focus on Mandarin that is used in Taiwan.
I want to you generate 10 sentences with characters I have learned already.
After you give me all sentences, also provide English translation.

Here are traditional characters I learned so far: ${charsComplete
    .map((c) => c.traditional)
    .join("")}

Do not use any other characters than ones that I have learned!
${
  options.learn
    ? "I want to focus on learning these ones in particular, so include them more: " +
      options.learn +
      "\n"
    : ""
}
  `;
}
