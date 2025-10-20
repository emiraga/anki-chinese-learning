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

  return (
    <MainFrame>
      <div className="min-h-screen bg-gray-50 py-8">
        {characters.map((character, index) => (
          <div key={character.char}>
            <DongCharacterDisplay character={character} />
            {index < characters.length - 1 && <div className="my-16" />}
          </div>
        ))}
      </div>
    </MainFrame>
  );
}
