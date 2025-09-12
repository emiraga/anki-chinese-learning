const FINGER_MAP: { [key: string]: { hand: string; finger: string } } = {
  'left-pinky': { hand: 'left', finger: 'pinky' },
  'left-ring': { hand: 'left', finger: 'ring' },
  'left-middle': { hand: 'left', finger: 'middle' },
  'left-index': { hand: 'left', finger: 'index' },
  'left-thumb': { hand: 'left', finger: 'thumb' },
  'right-thumb': { hand: 'right', finger: 'thumb' },
  'right-index': { hand: 'right', finger: 'index' },
  'right-middle': { hand: 'right', finger: 'middle' },
  'right-ring': { hand: 'right', finger: 'ring' },
  'right-pinky': { hand: 'right', finger: 'pinky' },
};

// === SVG Hand Component ===
// This component renders a single hand and highlights a specific finger.
const Hand = ({ hand, highlightedFinger }: { hand: string; highlightedFinger: string | null }) => {
  const isLeft = hand === 'left';
  const transform = isLeft ? '' : 'scale(-1, 1)';

  const getFingerClass = (fingerName: string) => {
    return highlightedFinger === fingerName
      ? 'fill-blue-500 stroke-blue-700'
      : 'fill-gray-300 stroke-gray-400 dark:fill-gray-600 dark:stroke-gray-500';
  };

  return (
    <svg viewBox="0 0 200 200" width="250" height="250" className="drop-shadow-lg" transform={transform}>
      <g
        className="stroke-2 transition-all duration-200 ease-in-out"
        style={{ strokeLinejoin: 'round', strokeLinecap: 'round' }}
      >
        {/* Fingers - Adjusted for even more separation */}
        <path d="M75,100 C75,80 70,70 60,60 S40,40 40,20 L40,10 L55,10 L55,50" className={getFingerClass('pinky')} />
        <path d="M90,110 C90,90 85,80 75,70 S55,50 55,30 V5 L70,5 V60" className={getFingerClass('ring')} />
        <path d="M105,120 C105,100 100,90 90,80 S70,60 70,40 V0 L85,0 V70" className={getFingerClass('middle')} />
        <path d="M125,115 C125,95 120,85 110,75 S90,55 90,35 V10 L105,10 V65" className={getFingerClass('index')} />

        {/* Thumb */}
        <path
          d="M115,110 C125,110 135,100 140,90 S150,70 150,60 L140,55 L130,70 C125,80 120,90 115,95"
          className={getFingerClass('thumb')}
        />

        {/* Palm - Adjusted to connect to new finger positions */}
        <path
          d="M75,100 C60,120 70,145 80,165 S120,180 140,170 S155,140 135,120 L125,115"
          className="fill-gray-200 stroke-gray-400 dark:fill-gray-600 dark:stroke-gray-500"
        />
      </g>
    </svg>
  );
};

// === Main FingerHighlighter Component ===
// This component accepts a single prop `highlightedFingerName` and displays two hands.
export const FingerHighlighter = ({ highlightedFingerName }: { highlightedFingerName: string }) => {
  const highlight = FINGER_MAP[highlightedFingerName] || {
    hand: null,
    finger: null,
  };

  return (
    <div className="flex items-center justify-center gap-8 p-4">
      <div className="flex flex-col items-center">
        <Hand hand="left" highlightedFinger={highlight.hand === 'left' ? highlight.finger : null} />
        <span className="mt-2 text-lg font-semibold text-gray-600 dark:text-gray-300">Left Hand</span>
      </div>
      <div className="flex flex-col items-center">
        <Hand hand="right" highlightedFinger={highlight.hand === 'right' ? highlight.finger : null} />
        <span className="mt-2 text-lg font-semibold text-gray-600 dark:text-gray-300">Right Hand</span>
      </div>
    </div>
  );
};