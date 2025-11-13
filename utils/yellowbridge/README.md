# YellowBridge Data Converter

This utility extracts structured data from YellowBridge raw JSON files.

## Overview

The `convert.py` script processes raw HTML data from YellowBridge character etymology pages and extracts useful information into a clean JSON format.

## Extracted Information

For each character, the script extracts:

1. **Character Information**
   - Character itself
   - Pinyin reading(s)
   - English definition
   - Kangxi radical number (if the character is a radical itself)

2. **Functional Components** (NEW!)
   - **Phonetic components**: Characters that suggest pronunciation (sound)
   - **Semantic components**: Characters that suggest meaning (radicals)
   - **Primitive components**: Basic building blocks without explicit functional markers
   - Each component includes character, pinyin, and description

3. **Radical Information**
   - Key radical component
   - Radical's pinyin and description
   - Kangxi radical number (if available)

4. **Formation Methods**
   - Chinese name (e.g., 形声, 会意, 象形, 假借)
   - English name (e.g., Pictophonetic, Associative Compound)
   - Description of how the character was formed
   - Referenced component characters

5. **All Components**
   - Complete breakdown of character components
   - Each component's pinyin and description

6. **Simplification Information** (if applicable)
   - Simplified form of traditional characters
   - Full method description
   - Method type (e.g., "generic radical simplification #10", "unique simplification #259")

## Usage

### Process All Files

```bash
./utils/yellowbridge/convert.py
```

Or using Python directly:

```bash
python3 utils/yellowbridge/convert.py
```

This will:
- Read all JSON files from `public/data/yellowbridge/raw/`
- Process each file and extract information
- Write results to `public/data/yellowbridge/processed.json`
- Write individual character files to `public/data/yellowbridge/info/`
- Display progress and summary

### Process Single File

```bash
./utils/yellowbridge/convert.py --single public/data/yellowbridge/raw/支.json
```

### Custom Input/Output Paths

```bash
./utils/yellowbridge/convert.py \
  --input path/to/raw/files \
  --output path/to/output.json \
  --individual-dir path/to/individual/files
```

### Skip Individual Files

If you only want the combined JSON and don't need individual files:

```bash
./utils/yellowbridge/convert.py --no-individual
```

## Output Format

The output is a JSON object where keys are characters and values contain extracted data:

```json
{
  "做": {
    "character": "做",
    "pinyin": "zuò",
    "definition": "work, make; act",
    "functional_components": {
      "phonetic": [
        {
          "character": "故",
          "pinyin": "gù",
          "description": "ancient, old; reason, because"
        }
      ],
      "semantic": [
        {
          "character": "人",
          "pinyin": "rén, ren",
          "description": "man; people; mankind; someone else"
        }
      ],
      "primitive": [
        {
          "character": "十",
          "pinyin": "shí",
          "description": "ten, tenth; complete; perfect"
        }
      ]
    },
    "phonetic_components": [...],
    "radical": {
      "character": "人",
      "pinyin": "rén, ren",
      "description": "man; people; mankind; someone else"
    },
    "formation_methods": [
      {
        "type_chinese": "形声",
        "type_english": "Pictophonetic.",
        "description": "亻 (person) suggests the meaning while 故 suggests the sound.",
        "referenced_characters": ["亻", "故"]
      }
    ],
    "all_components": [...],
    "simplification": null,
    "source_file": "做.json"
  }
}
```

## Validation

The script validates that the character in the filename matches the character in the file content. If there's a mismatch, it will raise an error.

## Requirements

- Python 3.11+
- No external dependencies (uses only standard library)
- The script uses `uv` for execution (see shebang)

## Error Handling

- Invalid JSON files will be reported
- Character mismatches between filename and content will be flagged
- Processing continues even if individual files fail
- Summary shows both successes and errors
