import { useEffect, useState } from "react";
import { DongCharacterDisplay } from "~/components/DongCharacterDisplay";
import MainFrame from "~/toolbar/frame";
import type { DongCharacter } from "~/types/dong_character";

// List of character files to load
const CHARACTER_FILES = [
  "wang_look_at.json",
  "xi_hope.json",
  "ren_endure.json",
  "wei_do.json",
  "tou_head.json",
  "xia_summer.json",
  "zhi_stop.json",
  "mi_cover.json",
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
