import * as React from "react";
import { useAnkiCards } from "~/apis/anki";
import type { NoteWithCards } from "~/apis/anki";
import type { Route } from "./+types/exam_level";
import MainFrame from "~/toolbar/frame";

type ExamCard = {
  noteId: number;
  tags: string[];
  tocflLevel?: string;
  status: 'pending' | 'in_progress' | 'mature' | 'learning';
};

const ProgressBar: React.FC<{
  level: string;
  pending: number;
  learning: number;
  inProgress: number;
  mature: number;
  total: number;
}> = ({ level, pending, learning, inProgress, mature, total }) => {
  if (total === 0) return null;

  const pendingPercent = (pending / total) * 100;
  const learningPercent = (learning / total) * 100;
  const inProgressPercent = (inProgress / total) * 100;
  const maturePercent = (mature / total) * 100;

  return (
    <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {level || "No Level"}
        </h3>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {total} cards
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-6 mb-3 dark:bg-gray-700">
        <div className="h-6 rounded-full flex">
          {pending > 0 && (
            <div
              className="bg-gray-400 dark:bg-gray-500 rounded-l-full flex items-center justify-center text-xs text-white font-medium"
              style={{ width: `${pendingPercent}%` }}
              title={`Pending: ${pending}`}
            >
              {pendingPercent > 15 && pending}
            </div>
          )}
          {learning > 0 && (
            <div
              className="bg-yellow-400 dark:bg-yellow-500 flex items-center justify-center text-xs text-white font-medium"
              style={{ width: `${learningPercent}%` }}
              title={`Learning: ${learning}`}
            >
              {learningPercent > 15 && learning}
            </div>
          )}
          {inProgress > 0 && (
            <div
              className="bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-xs text-white font-medium"
              style={{ width: `${inProgressPercent}%` }}
              title={`In Progress: ${inProgress}`}
            >
              {inProgressPercent > 15 && inProgress}
            </div>
          )}
          {mature > 0 && (
            <div
              className="bg-green-500 dark:bg-green-600 rounded-r-full flex items-center justify-center text-xs text-white font-medium"
              style={{ width: `${maturePercent}%` }}
              title={`Mature: ${mature}`}
            >
              {maturePercent > 15 && mature}
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded mr-2"></div>
          <span className="text-gray-700 dark:text-gray-300">
            Pending: {pending}
          </span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-400 dark:bg-yellow-500 rounded mr-2"></div>
          <span className="text-gray-700 dark:text-gray-300">
            Learning: {learning}
          </span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 dark:bg-blue-600 rounded mr-2"></div>
          <span className="text-gray-700 dark:text-gray-300">
            In Progress: {inProgress}
          </span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 dark:bg-green-600 rounded mr-2"></div>
          <span className="text-gray-700 dark:text-gray-300">
            Mature: {mature}
          </span>
        </div>
      </div>
    </div>
  );
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Exam Level" },
    { name: "description", content: "TOCFL exam level analysis" },
  ];
}

function ExamLevelContent() {
  const { notesByCards, loading, progressPercentage, stage, error, reload } = useAnkiCards();

  // Process notes to get exam cards (only first card from each note)
  const examCards: ExamCard[] = notesByCards.map((note: NoteWithCards) => {
    // Sort cards by card ID to get the first card consistently
    const sortedCards = note.cardDetails.sort((a, b) => a.cardId - b.cardId);
    const firstCard = sortedCards[0];
    
    // Extract TOCFL level from tags (e.g., "TOCFL::L0" -> "L0")
    const tocflTag = note.tags.find(tag => tag.startsWith("TOCFL::"));
    const tocflLevel = tocflTag?.split("::")[1];
    
    // Determine status based on card properties
    let status: ExamCard['status'] = 'pending';
    if (firstCard.type === 2) { // Suspended
      status = 'pending';
    } else if (firstCard.type === 0) { // New
      status = 'pending';
    } else if (firstCard.type === 1) { // Learning
      status = 'learning';
    } else if (firstCard.type === 3) { // Review
      // Mature cards typically have interval >= 21 days
      status = firstCard.interval >= 21 ? 'mature' : 'in_progress';
    }

    return {
      noteId: note.noteId,
      tags: note.tags,
      tocflLevel,
      status,
    };
  });

  // Group cards by TOCFL level
  const cardsByLevel = examCards.reduce((acc, card) => {
    const level = card.tocflLevel || "No Level";
    if (!acc[level]) {
      acc[level] = [];
    }
    acc[level].push(card);
    return acc;
  }, {} as Record<string, ExamCard[]>);

  // Sort levels (L0, L1, L2, etc., then No Level)
  const sortedLevels = Object.keys(cardsByLevel).sort((a, b) => {
    if (a === "No Level") return 1;
    if (b === "No Level") return -1;
    // Sort by level number (L0, L1, L2, etc.)
    const aNum = parseInt(a.replace('L', ''));
    const bNum = parseInt(b.replace('L', ''));
    return aNum - bNum;
  });

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Exam Level Analysis
        </h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-700 dark:text-gray-300">{stage}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
            {Math.round(progressPercentage)}%
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Exam Level Analysis
        </h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-400 mb-2">
            Error Loading Cards
          </h3>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={reload}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Exam Level Analysis
        </h1>
        <button
          onClick={reload}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-400 mb-2">
          About This Analysis
        </h2>
        <p className="text-blue-800 dark:text-blue-300 text-sm">
          This page analyzes your Anki cards by TOCFL (Test of Chinese as a Foreign Language) level. 
          Only the first card from each note is considered. Cards are categorized as:
        </p>
        <ul className="list-disc list-inside text-blue-800 dark:text-blue-300 text-sm mt-2 ml-4">
          <li><strong>Pending:</strong> New or suspended cards</li>
          <li><strong>Learning:</strong> Cards currently being learned</li>
          <li><strong>In Progress:</strong> Review cards with interval &lt; 21 days</li>
          <li><strong>Mature:</strong> Review cards with interval ≥ 21 days</li>
        </ul>
      </div>

      {sortedLevels.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No cards found. Make sure you have Anki cards with TOCFL tags.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Total: {examCards.length} notes analyzed
          </p>
          
          {sortedLevels.map((level) => {
            const levelCards = cardsByLevel[level];
            const pending = levelCards.filter(c => c.status === 'pending').length;
            const learning = levelCards.filter(c => c.status === 'learning').length;
            const inProgress = levelCards.filter(c => c.status === 'in_progress').length;
            const mature = levelCards.filter(c => c.status === 'mature').length;
            
            return (
              <ProgressBar
                key={level}
                level={level}
                pending={pending}
                learning={learning}
                inProgress={inProgress}
                mature={mature}
                total={levelCards.length}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ExamLevel() {
  return (
    <MainFrame>
      <ExamLevelContent />
    </MainFrame>
  );
}