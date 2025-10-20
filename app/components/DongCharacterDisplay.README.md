# DongCharacterDisplay Component

A comprehensive React component for displaying detailed Chinese character information from Dong Chinese data.

## Features

- **Character Display**: Large, clear display of the main character
- **Audio Pronunciation**: Button to play audio (requires audio implementation)
- **Pinyin & Translation**: Shows primary pronunciation and English meaning
- **HSK Level Badge**: Displays HSK level (1-9)
- **Etymology**: Character origin and compositional explanation
- **Component Breakdown**: Interactive display of character components with:
  - Sound components (blue)
  - Iconic components (green)
  - Component meanings and pronunciations
- **Historical Evolution**: Visual timeline showing character development through:
  - Oracle script (~1250-1000 BC)
  - Bronze script (~1100-250 BC)
  - Seal script (~221 BC-100 AD)
  - Modern forms
- **Common Words**: Top words containing the character
- **Pronunciation Variants**: Multiple pronunciations if applicable

## Usage

```tsx
import { DongCharacterDisplay } from "~/components/DongCharacterDisplay";
import type { DongCharacter } from "~/types/dong_character";

function MyPage() {
  const characterData: DongCharacter = {
    // ... load your character data
  };

  return <DongCharacterDisplay character={characterData} />;
}
```

## Demo

View the demo at `/dong_demo` which loads the 望 (wàng - "to look at") character from `public/data/dong/wang_look_at.json`.

## Data Structure

The component expects a `DongCharacter` object with the following key properties:

- `char`: The Chinese character
- `pinyinFrequencies`: Array of pronunciation variants
- `gloss`: English translation
- `hint`: Etymology/composition explanation
- `components`: Array of component characters with types (sound/iconic)
- `images`: Historical character forms with era information
- `statistics`: Usage statistics including HSK level and common words
- `chars`: Detailed info about component characters

See `app/types/dong_character.ts` for the complete type definition.

## Styling

The component uses TailwindCSS with a card-based layout:
- Responsive grid layouts for components and evolution timeline
- Hover effects for interactive elements
- Color-coded component types
- Clean, accessible design

## Future Enhancements

- [ ] Audio playback implementation
- [ ] Animated stroke order display
- [ ] Interactive component highlighting on character
- [ ] Click-through navigation to component characters
- [ ] Traditional/Simplified toggle
- [ ] Export/Share functionality
- [ ] Print-friendly view
