# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based Chinese learning companion application that integrates with Anki for spaced repetition flashcards. The app provides tools for studying Chinese characters, phrases, pronunciation (pinyin), and includes AI-powered features for generating practice content.

## Core Technologies

- **React Router v7**: Full-stack React framework with server-side rendering disabled (SPA mode)
- **TypeScript**: Full type safety throughout the codebase
- **Vite**: Build tool and development server
- **TailwindCSS**: Utility-first CSS framework
- **Anki Integration**: Uses `yanki-connect` library to interface with Anki desktop app
- **AI Integration**: Google Generative AI and Claude API for content generation

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

## Architecture Overview

### Data Layer (`app/data/`)
- **types.ts**: Core TypeScript interfaces and types
- **characters.ts**: Character data management and Anki integration
- **phrases.ts**: Phrase data and pinyin mapping
- **props.ts**: Character properties/radicals management
- **pinyin_function.ts**: Pinyin processing utilities
- **utils.ts**: Common utility functions

### API Layer (`app/apis/`)
- **anki.ts**: Anki desktop integration using YankiConnect
- **claude.ts**: Claude AI API integration for content generation
- **google_genai.ts**: Google Generative AI integration

### Components (`app/components/`)
Key components include:
- **Practice.tsx**: Main practice interface with multiple practice modes
- **Learn.tsx**: AI-powered learning link generation
- **CharCard.tsx**: Individual character display and interaction
- **PracticeTypes.tsx**: Different practice exercise types
- **Settings.tsx**: Application settings management

### Routing (`app/routes/`)
Uses React Router's file-based routing with comprehensive routes for:
- Characters (`/chars`, `/char/:charHanzi`)
- Phrases (`/phrases`, `/phrase/:phraseHanzi`)
- Practice modes (`/practice`)
- Settings and statistics (`/settings`, `/stats`)
- Various filtered views (actors, places, tones, etc.)
- All routes should be added to @app/routes.ts

### Settings System (`app/settings/`)
- **SettingsContext.tsx**: React Context for global settings
- **schema.ts**: Settings schema and validation
- Settings are persisted to localStorage

## Key Features

### Anki Integration
- Requires AnkiConnect addon installed in Anki desktop
- Fetches cards, notes, and manages Anki data
- Automatic synchronization with Anki database
- API documentation: https://git.sr.ht/~foosoft/anki-connect

### AI-Powered Learning
- Claude API integration for sentence generation
- Google Generative AI for practice content
- Customizable prompts and learning scenarios

### Practice Modes
- English to Chinese translation
- Listening comprehension exercises
- Character recognition and writing practice
- Pinyin tone practice

### Character Analysis
- Pinyin extraction and tone analysis
- Character component/radical breakdown
- Frequency analysis and learning prioritization

## Development Setup Requirements

### Anki Setup
1. Install Anki desktop application
2. Install AnkiConnect addon (code: 2055492159)
3. Configure AnkiConnect with these CORS settings:
```json
{
    "webCorsOriginList": [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173"
    ]
}
```

### API Keys
The application requires API keys for:
- Claude API (stored in settings)
- Google Generative AI (stored in settings)

Keys are managed through the settings interface and stored in localStorage.

## Code Conventions

- **TypeScript**: Strict mode enabled, full type coverage required
- **React**: Uses React 19 with hooks and functional components
- **Styling**: TailwindCSS classes, responsive design patterns
- **Data Fetching**: Custom hooks for async operations with loading/error states
- **State Management**: React Context for global state, useState for local state

## File naming

Files are named using underscores as separators.

## Testing and Quality

- ESLint configuration with TypeScript, React, and accessibility rules
- Type checking with `npm run typecheck`
- No specific test framework currently configured

## Common Development Patterns

### Data Hooks
Custom hooks like `useAnkiCards`, `useAnkiCharacters`, etc. handle:
- Loading states
- Error handling
- Data transformation
- Automatic retries

### Component Structure
- Props interfaces defined with TypeScript
- Context consumption via `useOutletContext<OutletContext>()`
- Settings access via `useSettings()` hook

### API Integration
- Chunked batch processing for large datasets
- Proper error handling and user feedback
- Progress tracking for long-running operations
- For anki queries, use this as a documentation https://docs.ankiweb.net/searching.html
- typecheck and lint after each major task