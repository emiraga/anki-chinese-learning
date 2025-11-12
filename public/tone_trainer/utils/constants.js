// Analysis Constants
export const FFT_SIZE = 4096 * 2;
export const MAX_FREQ_HZ = 1300;
export const BUFFER_SIZE = 256;

// UI Constants
export const YIN_MAX_JUMP_THRESHOLD_PERCENT = 0.1;
export const YIN_PITCH_POINT_RADIUS = 3;
export const YIN_PITCH_LINE_WIDTH = 3;

// Audio Recording
export const RECORDING_SAMPLE_RATE = 48000;

// Color Maps
export const COLOR_MAPS = {
  viridis: [
    [68, 1, 84],
    [72, 40, 120],
    [62, 74, 137],
    [49, 104, 142],
    [38, 130, 142],
    [31, 158, 137],
    [53, 183, 121],
    [109, 205, 89],
    [180, 222, 44],
    [253, 231, 37],
  ],
  plasma: [
    [13, 8, 135],
    [72, 1, 163],
    [120, 1, 168],
    [163, 29, 151],
    [201, 62, 122],
    [230, 99, 90],
    [249, 139, 64],
    [254, 183, 43],
    [240, 226, 33],
  ],
  hot: [
    [0, 0, 0],
    [255, 0, 0],
    [255, 255, 0],
    [255, 255, 255],
  ],
  grayscale: [
    [0, 0, 0],
    [255, 255, 255],
  ],
};

// Sample Audio Files
export const SAMPLE_AUDIO_FILES = [
  {
    path: "audio/ai_讀書寫字.mp3",
    maxFreq: null,
    description: 'AI voice: "dú shū xiě zì" (read books, write characters)',
  },
  {
    path: "audio/ai_高富帥_gao1_fu4_shuai4.mp3",
    maxFreq: null,
    description: 'AI voice: "gāo fù shuài" (tall, rich, handsome)',
  },
  {
    path: "audio/ai_今天不用上班.mp3",
    maxFreq: null,
    description:
      'AI voice: "jīn tiān bù yòng shàng bān" (don\'t have to work today)',
  },
  {
    path: "audio/human_我喜歡吃東西.m4a",
    maxFreq: null,
    description:
      'Human voice: "wǒ xǐ huān chī dōng xī" (I like to eat things)',
  },
  {
    path: "audio/human_我一歲了.m4a",
    maxFreq: null,
    description: 'Human voice: "wǒ yī suì le" (I am one year old)',
  },
  // Tone combination practice files
  {
    path: "audio/Tone11loop.mp3",
    maxFreq: null,
    description: "Tone practice: 1st tone → 1st tone (flat → flat)",
  },
  {
    path: "audio/Tone12loop.mp3",
    maxFreq: null,
    description: "Tone practice: 1st tone → 2nd tone (flat → rising)",
  },
  {
    path: "audio/Tone13loop.mp3",
    maxFreq: null,
    description: "Tone practice: 1st tone → 3rd tone (flat → dipping)",
  },
  {
    path: "audio/Tone14loop.mp3",
    maxFreq: null,
    description: "Tone practice: 1st tone → 4th tone (flat → falling)",
  },
  {
    path: "audio/Tone21loop.mp3",
    maxFreq: null,
    description: "Tone practice: 2nd tone → 1st tone (rising → flat)",
  },
  {
    path: "audio/Tone22loop.mp3",
    maxFreq: null,
    description: "Tone practice: 2nd tone → 2nd tone (rising → rising)",
  },
  {
    path: "audio/Tone23loop.mp3",
    maxFreq: null,
    description: "Tone practice: 2nd tone → 3rd tone (rising → dipping)",
  },
  {
    path: "audio/Tone24loop.mp3",
    maxFreq: null,
    description: "Tone practice: 2nd tone → 4th tone (rising → falling)",
  },
  {
    path: "audio/Tone31loop.mp3",
    maxFreq: null,
    description: "Tone practice: 3rd tone → 1st tone (dipping → flat)",
  },
  {
    path: "audio/Tone32loop.mp3",
    maxFreq: null,
    description: "Tone practice: 3rd tone → 2nd tone (dipping → rising)",
  },
  {
    path: "audio/Tone33loop.mp3",
    maxFreq: null,
    description: "Tone practice: 3rd tone → 3rd tone (dipping → dipping)",
  },
  {
    path: "audio/Tone34loop.mp3",
    maxFreq: null,
    description: "Tone practice: 3rd tone → 4th tone (dipping → falling)",
  },
  {
    path: "audio/Tone41loop.mp3",
    maxFreq: null,
    description: "Tone practice: 4th tone → 1st tone (falling → flat)",
  },
  {
    path: "audio/Tone42loop.mp3",
    maxFreq: null,
    description: "Tone practice: 4th tone → 2nd tone (falling → rising)",
  },
  {
    path: "audio/Tone43loop.mp3",
    maxFreq: null,
    description: "Tone practice: 4th tone → 3rd tone (falling → dipping)",
  },
  {
    path: "audio/Tone44loop.mp3",
    maxFreq: null,
    description: "Tone practice: 4th tone → 4th tone (falling → falling)",
  },
  // Human voices and music
  {
    path: "audio/367215_1847127-lq.mp3",
    maxFreq: null,
    description: "Music: Male voice La la la la la la",
  },
  {
    path: "audio/427200_8176931-lq.mp3",
    maxFreq: 500,
    description:
      'Music: Beatiful female melody. Warning! Increase Max Freq to 500Hz, also warning! since voice is soft, you may need to reduce "Min Power Threshold"',
  },
  {
    path: "audio/417938_8176931-lq.mp3",
    maxFreq: 500,
    description:
      'Music: Female singing "Do you want to be beautiful?" Warning! Increase Max Freq to 500Hz',
  },
  {
    path: "audio/30084_129090-lq.mp3",
    maxFreq: 800,
    description:
      "Music: Very high female tone, Warning! Increase Max Freq to 800Hz",
  },
  // Test files for discontinuities
  {
    path: "audio/tone_recording_1760610667332.wav",
    maxFreq: null,
    description: "Test for discontinuities",
  },
  {
    path: "audio/tone_recording_1760616895897.wav",
    maxFreq: null,
    description: "Test for discontinuities",
  },
  {
    path: "audio/tone_recording_1760620947969.wav",
    maxFreq: null,
    description: "Test for discontinuities",
  },
  {
    path: "audio/tone_recording_1760621775872.wav",
    maxFreq: null,
    description: "Test for discontinuities",
  },
];
