import { useState } from "react";
import { DongCharacterLoader } from "~/components/DongCharacterLoader";
import MainFrame from "~/toolbar/frame";

// List of characters to display
const CHARACTERS = [
  "成", "乞", "幾", "臣", "城", "帥", "績", "鹿", "鼻", "人", "僉",
  "把", "憂", "冉", "郎", "波", "侯", "曾", "會", "己", "討",
  "臭", "搬", "化", "軍", "妹", "奴", "古", "采", "調", "視",
  "曼", "待", "術", "明", "旱", "抹", "孩", "彡", "狂", "務",
  "益", "植", "片", "局", "綠", "景", "象", "寬", "切", "套",
  "問", "千", "整", "雪", "支", "擔", "末", "惜"
];

export default function DongDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : CHARACTERS.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < CHARACTERS.length - 1 ? prev + 1 : 0));
  };

  const currentChar = CHARACTERS[currentIndex];

  return (
    <MainFrame>
      <div className="min-h-screen">
        {/* Navigation */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-md p-4 flex items-center justify-between">
          <button
            onClick={handlePrevious}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            ← Previous
          </button>
          <div className="text-lg font-semibold dark:text-gray-200">
            Character {currentIndex + 1} of {CHARACTERS.length}: {currentChar}
          </div>
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Next →
          </button>
        </div>

        {/* Character display */}
        <div className="py-8">
          <DongCharacterLoader char={currentChar} />
        </div>
      </div>
    </MainFrame>
  );
}
