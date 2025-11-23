# Pleco/Outlier Dictionary Tools

## outlier_copy_paste.py

Script to extract and parse rich text content from Pleco's Outlier dictionary (via iPhone Mirroring).

### Usage

#### Extract from Clipboard

1. Open Pleco on iPhone (via iPhone Mirroring)
2. Navigate to an Outlier dictionary entry
3. Select all text (the "System level info" page)
4. Copy to clipboard
5. Run the script:

```bash
./utils/pleco/outlier_copy_paste.py
```

#### Rebuild from HTML

To rebuild all JSON files from saved HTML files:

```bash
./utils/pleco/outlier_copy_paste.py --rebuild
```

This is useful when you've updated the parsing logic and want to regenerate all JSON files without re-copying from Pleco.

### What it does

- Extracts clipboard content in multiple formats (plain text, HTML, RTF)
- Parses HTML structure to extract:
  - Main character (traditional)
  - Sound series information (characters, pinyin, meanings, explanations)
  - Semantic series information (characters, pinyin, meanings, explanations)
  - Empty component notes
  - Radical information
- Outputs structured JSON
- **Automatically saves files:**
  - JSON: `public/data/pleco/outlier_series/{character}.json`
  - HTML: `data/pleco/outlier_series/{character}.html`

### Output Structure

```json
{
  "traditional": "神",
  "sound_series": {
    "explanation": "This is the sound series for 神.",
    "characters": [{
      "traditional": "榊",
      "pinyin": ["shén"],
      "meaning": "a sacred Shinto tree",
      "explanation": "Optional detailed explanation"
    }]
  },
  "semantic_series": {
    "explanation": "This is the semantic series for 神. Meaning: (orig.) god",
    "characters": [{
      "traditional": "榊",
      "pinyin": ["shén"],
      "meaning": "a sacred Shinto tree",
      "explanation": "A small evergreen tree..."
    }]
  },
  "empty_component": {
    "explanation": "大 appears as an empty component in the following characters:",
    "characters": [{
      "traditional": "莫",
      "pinyin": ["mò"],
      "meaning": "do not, is not, can not; negative"
    }]
  },
  "radical": {
    "explanation": "This is KangXi radical 37. Radical list (21 members):",
    "characters": [{
      "traditional": "天",
      "pinyin": ["tiān"],
      "meaning": "sky, heaven; god, celestial"
    }]
  }
}
```

**Note**: `empty_component` and `radical` can be either an object with `explanation` and `characters` (when there are members), or omitted entirely (when no data available).

### TypeScript Types

```typescript
interface Character {
  traditional: string;
  simplified?: string;
  pinyin?: string[];
  meaning?: string;
  explanation?: string;
}

interface Series {
  explanation?: string;
  characters?: Character[];
}

interface OutlierData {
  traditional?: string;
  simplified?: string;
  sound_series?: Series;
  semantic_series?: Series;
  empty_component?: Series;  // Same structure as Series
  radical?: Series;           // Same structure as Series
}
```

### Dependencies

The script uses `uv` inline script format with the following dependencies:
- `beautifulsoup4>=4.12.0`
- `lxml>=5.0.0`

These are automatically installed when running via `uv`.

### Requirements

- macOS (uses `pbpaste` and `osascript`)
- `uv` for running the script
- iPhone Mirroring app (for accessing Pleco on iPhone)
- Pleco with Outlier Dictionary add-on
