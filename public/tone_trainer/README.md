# Tone Trainer React - Vite Setup

This is the React version of the Mandarin tone trainer application, built with Vite for optimal performance.

## Quick Start

### Development Mode

```bash
# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

This will start a development server at `http://localhost:5174` and automatically open it in your browser.

### Production Build

```bash
# Build for production
npm run build

# Preview the production build
npm run preview
```

The production build will be in the `dist/` directory and includes:
- Optimized and bundled JavaScript
- Minified CSS
- All audio files
- FFT library (fftjs.min.js)
- Tailwind CSS (output.css)

## Project Structure

```
public/tone_trainer/
├── index5.html              # Entry HTML file
├── main.jsx                 # React app entry point
├── package.json             # NPM dependencies and scripts
├── vite.config.js           # Vite configuration
├── .gitignore              # Git ignore rules
│
├── components/              # React UI components (13 components)
│   ├── App.jsx             # Main app orchestrator
│   ├── SpectrogramCanvas.jsx
│   ├── YinPitchCanvas.jsx
│   ├── DropOverlay.jsx
│   ├── StatusMessage.jsx
│   ├── ProgressLine.jsx
│   ├── PlaybackControls.jsx
│   ├── AudioFilesList.jsx
│   ├── DebugTools.jsx
│   ├── CollapsibleSection.jsx
│   ├── DisplayControls.jsx
│   ├── RecordingControls.jsx
│   └── YinControls.jsx
│
├── context/                 # React Context for state management
│   └── ToneAnalyzerContext.jsx
│
├── hooks/                   # Custom React hooks (4 hooks)
│   ├── useAudioProcessing.js
│   ├── useAudioRecording.js
│   ├── useAudioPlayback.js
│   └── useAudioLoader.js
│
├── utils/                   # Utility functions (5 modules)
│   ├── constants.js        # Constants and audio file data
│   ├── colorUtils.js       # Color mapping functions
│   ├── yinAlgorithm.js     # YIN pitch detection algorithm
│   ├── pitchProcessing.js  # Median filtering & octave correction
│   └── audioUtils.js       # WAV conversion utilities
│
├── audio/                   # Sample audio files
├── fftjs.min.js            # FFT library (required for YIN)
├── output.css              # Tailwind CSS styles
│
└── dist/                    # Production build output (git-ignored)
```

## NPM Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Full production build (CSS + React + assets)
- `npm run build:css` - Build Tailwind CSS only
- `npm run preview` - Preview the production build locally

## How It Works

### Development Mode (`npm run dev`)

Vite starts a development server that:
1. Transforms JSX to JavaScript on-the-fly
2. Provides hot module replacement (HMR) for instant updates
3. Serves files directly without bundling for faster startup

### Production Build (`npm run build`)

The build process runs in three stages:

1. **CSS Build** (`build:css`)
   - Compiles Tailwind CSS from `input.css` to `output.css`
   - Minifies the output
   - Removes webkit-text-size-adjust property

2. **React Build** (Vite)
   - Transforms all JSX files to JavaScript
   - Bundles all React components and utilities
   - Minifies JavaScript and CSS
   - Generates optimized `index5.html` with hashed asset names

3. **Post-build** (`postbuild`)
   - Copies audio files to `dist/audio/`
   - Copies `fftjs.min.js` to `dist/`
   - Copies compiled `output.css` to `dist/`

## Features

- ✅ **Zero config** - Works out of the box
- ✅ **Fast HMR** - Instant updates during development
- ✅ **Optimized builds** - Minified and bundled for production
- ✅ **TypeScript support** - Can be added easily if needed
- ✅ **Modern browser support** - Uses ES modules

## Deployment

After running `npm run build`, simply deploy the contents of the `dist/` folder to any static hosting service:

- GitHub Pages
- Netlify
- Vercel
- AWS S3
- Any web server

The build is completely static and requires no server-side processing.

## Troubleshooting

### Port already in use

If port 5174 is already in use, you can change it in `vite.config.js`:

```javascript
export default defineConfig({
  server: {
    port: 3000, // Change to your preferred port
  }
});
```

### Audio files not loading

Make sure the `audio/` directory exists and contains all the sample audio files. The postbuild script copies these to `dist/audio/`.

### FFT library errors

The `fftjs.min.js` file must be present in the root directory. It's loaded as a global script before the React app starts.

## Comparing with Original

This React version (`index5.html`) has the same functionality as `index4.html` but with:

- **Better code organization** - Components, hooks, and utilities separated
- **Easier maintenance** - Each piece of functionality is isolated
- **Better performance** - Production build is optimized and minified
- **Modern development** - Hot reload, React DevTools support
- **Type safety ready** - Easy to add TypeScript if needed

## Technical Details

### Vite Configuration

The `vite.config.js` file configures:
- React plugin for JSX transformation
- Base path as `./` for relative asset loading
- Output directory as `dist/`
- Input file as `index5.html`

### State Management

Uses React Context API (`ToneAnalyzerContext`) to manage:
- Audio context and playback state
- Recording state
- YIN algorithm parameters
- Display settings
- Recording settings

### Custom Hooks

Logic is separated into reusable hooks:
- `useAudioProcessing` - Spectrogram and YIN analysis
- `useAudioRecording` - Microphone recording
- `useAudioPlayback` - Audio playback with progress
- `useAudioLoader` - File and drag-drop loading

## Dependencies

### Production Dependencies
- `react` (^18.3.1) - UI library
- `react-dom` (^18.3.1) - DOM rendering

### Development Dependencies
- `vite` (^5.4.2) - Build tool and dev server
- `@vitejs/plugin-react` (^4.3.1) - React support for Vite
- `tailwindcss` (^4.0.0) - CSS framework for styling

### External Dependencies (CDN/Local)
- `fftjs.min.js` - FFT library for YIN algorithm
- `output.css` - Tailwind CSS styles
