# Setup Options for React Tone Analyzer

The React version of the tone analyzer (`index5.html`) can be set up in different ways:

## Option 1: Client-Side JSX Transformation (Current Setup)

The current `index5.html` uses Babel Standalone to transform JSX files on the client side.

**Pros:**
- No build step required
- Easy to develop and test
- Works directly in the browser

**Cons:**
- Slower initial load (JSX transformation happens in browser)
- Not recommended for production

**Usage:**
Simply open `index5.html` in a web browser. The browser will automatically:
1. Load React from ESM CDN
2. Load Babel Standalone
3. Transform all JSX files to JavaScript
4. Execute the application

## Option 2: Build Tool (Recommended for Production)

Use a build tool like Vite, esbuild, or Webpack to pre-compile JSX to JavaScript.

### Using Vite:

1. Create a `vite.config.js` in the tone_trainer directory:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
  },
});
```

2. Add npm scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0"
  }
}
```

3. Run:
```bash
npm install
npm run dev   # For development
npm run build # For production
```

### Using esbuild (Fast and Simple):

```bash
# Install esbuild
npm install -g esbuild

# Build the application
esbuild main.jsx --bundle --outfile=main.js --loader:.jsx=jsx --jsx-factory=React.createElement --jsx-fragment=React.Fragment

# Update index5.html to load main.js instead of main.jsx
```

## Option 3: Pre-compiled JavaScript

Write vanilla JavaScript (without JSX) and use `React.createElement()` directly.

**Example:**
```javascript
// Instead of JSX:
<div className="container">Hello</div>

// Use:
React.createElement('div', { className: 'container' }, 'Hello')
```

This is verbose but requires no transformation.

## Current File Structure

```
public/tone_trainer/
├── index5.html              # Entry point
├── main.jsx                 # React app entry
├── components/              # React components
│   ├── App.jsx
│   ├── SpectrogramCanvas.jsx
│   ├── YinPitchCanvas.jsx
│   └── ...
├── context/                 # React context
│   └── ToneAnalyzerContext.jsx
├── hooks/                   # Custom React hooks
│   ├── useAudioProcessing.js
│   ├── useAudioRecording.js
│   └── ...
├── utils/                   # Utility functions
│   ├── constants.js
│   ├── yinAlgorithm.js
│   └── ...
├── fftjs.min.js            # FFT library
└── output.css              # Tailwind CSS
```

## Recommendation

For **development/testing**: Use the current client-side transformation setup (Option 1).

For **production**: Use a build tool like Vite (Option 2) to pre-compile everything for better performance.
