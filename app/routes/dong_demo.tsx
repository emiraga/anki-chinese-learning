import { useEffect, useState } from "react";
import { DongCharacterDisplay } from "~/components/DongCharacterDisplay";
import MainFrame from "~/toolbar/frame";
import type { DongCharacter } from "~/types/dong_character";

// List of character files to load
const CHARACTER_FILES = [
  "成.json",
  "乞.json",
  "幾.json",
  "臣.json",
  "城.json",
  "帥.json",
  "績.json",
  "鹿.json",
  "鼻.json",
  "人.json",
  "僉.json",
];

export default function DongDemo() {
  const [characters, setCharacters] = useState<DongCharacter[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load all character data files
    Promise.all(
      CHARACTER_FILES.map((filename) =>
        fetch(`/data/dong/${filename}`).then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to load ${filename}`);
          }
          return res.json();
        }),
      ),
    )
      .then((charactersData) => {
        setCharacters(charactersData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : characters.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < characters.length - 1 ? prev + 1 : 0));
  };

  if (loading) {
    return (
      <MainFrame>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl text-gray-600">Loading character data...</div>
        </div>
      </MainFrame>
    );
  }

  if (error) {
    return (
      <MainFrame>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl text-red-600">Error: {error}</div>
        </div>
      </MainFrame>
    );
  }

  if (characters.length === 0) {
    return (
      <MainFrame>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl text-gray-600">No character data found</div>
        </div>
      </MainFrame>
    );
  }

  const currentCharacter = characters[currentIndex];

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
          <div className="text-lg font-semibold">
            Character {currentIndex + 1} of {characters.length}:{" "}
            {currentCharacter.char}
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
          <DongCharacterDisplay character={currentCharacter} />
        </div>
      </div>
    </MainFrame>
  );
}
