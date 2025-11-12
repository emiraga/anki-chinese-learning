# React Tone Analyzer

This is a React implementation of the tone analyzer application for Mandarin Chinese pronunciation practice.

## Structure

### Entry Point
- `index5.html` - Minimal HTML entry point that loads React
- `main.jsx` - React application entry point

### Context
- `context/ToneAnalyzerContext.jsx` - Global state management using React Context

### Components
- `components/App.jsx` - Main application component
- `components/SpectrogramCanvas.jsx` - Spectrogram visualization
- `components/YinPitchCanvas.jsx` - YIN pitch overlay visualization
- `components/DropOverlay.jsx` - Drag-and-drop overlay UI
- `components/StatusMessage.jsx` - Status message display
- `components/ProgressLine.jsx` - Audio playback progress indicator
- `components/PlaybackControls.jsx` - Play/stop button and instructions
- `components/AudioFilesList.jsx` - Sample audio files list
- `components/DebugTools.jsx` - Debug utilities (save audio)
- `components/CollapsibleSection.jsx` - Reusable collapsible section
- `components/DisplayControls.jsx` - Display settings (brightness, contrast, color scheme)
- `components/RecordingControls.jsx` - Recording settings
- `components/YinControls.jsx` - YIN algorithm parameters

### Hooks
- `hooks/useAudioProcessing.js` - Audio processing logic (spectrogram, YIN analysis)
- `hooks/useAudioRecording.js` - Microphone recording functionality
- `hooks/useAudioPlayback.js` - Audio playback and progress tracking
- `hooks/useAudioLoader.js` - Loading audio from files or drag-and-drop

### Utilities
- `utils/constants.js` - Application constants and sample audio files
- `utils/colorUtils.js` - Color mapping functions
- `utils/yinAlgorithm.js` - YIN pitch detection algorithm
- `utils/pitchProcessing.js` - Median filtering and octave jump correction
- `utils/audioUtils.js` - Audio buffer to WAV conversion

## Key Features

1. **Modular Component Architecture**: Each UI element is a separate, reusable React component
2. **Custom Hooks**: Logic is separated into custom hooks for better reusability
3. **Context API**: Global state management using React Context
4. **No Logic in HTML**: All business logic is in JavaScript/React components
5. **Separation of Concerns**: Utilities, components, hooks, and context are clearly separated

## Usage

To use this version:

1. Open `index5.html` in a browser
2. Make sure you have React and ReactDOM available (can be loaded via CDN if needed)
3. All functionality from the original implementation is preserved

## Dependencies

- React 18+
- ReactDOM 18+
- FFTJS library (for YIN algorithm)
- TailwindCSS (for styling)

## Notes

- The YIN algorithm implementation is preserved exactly as in the original
- All audio processing logic remains the same
- The UI structure and styling match the original implementation
- State management is now handled by React hooks and context instead of global variables
