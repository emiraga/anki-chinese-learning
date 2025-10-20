import { useEffect, useState } from "react";
import { DongCharacterDisplay } from "~/components/DongCharacterDisplay";
import MainFrame from "~/toolbar/frame";
import type { DongCharacter } from "~/types/dong_character";

export default function DongDemo() {
  const [wangCharacter, setWangCharacter] = useState<DongCharacter | null>(null);
  const [xiCharacter, setXiCharacter] = useState<DongCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load both character data files
    Promise.all([
      fetch("/data/dong/wang_look_at.json").then((res) => {
        if (!res.ok) throw new Error("Failed to load wang character");
        return res.json();
      }),
      fetch("/data/dong/xi_hope.json").then((res) => {
        if (!res.ok) throw new Error("Failed to load xi character");
        return res.json();
      }),
    ])
      .then(([wangData, xiData]) => {
        setWangCharacter(wangData);
        setXiCharacter(xiData);
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

  if (!wangCharacter || !xiCharacter) {
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
        <DongCharacterDisplay character={wangCharacter} />
        <div className="my-16" />
        <DongCharacterDisplay character={xiCharacter} />
      </div>
    </MainFrame>
  );
}
