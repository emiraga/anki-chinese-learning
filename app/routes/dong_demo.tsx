import { useEffect, useState } from "react";
import { DongCharacterDisplay } from "~/components/DongCharacterDisplay";
import MainFrame from "~/toolbar/frame";
import type { DongCharacter } from "~/types/dong_character";

export default function DongDemo() {
  const [character, setCharacter] = useState<DongCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load the character data
    fetch("/data/dong/wang_look_at.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load character data");
        }
        return res.json();
      })
      .then((data) => {
        setCharacter(data);
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

  if (!character) {
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
        <DongCharacterDisplay character={character} />
      </div>
    </MainFrame>
  );
}
