import anki, { type CardInfo } from "~/apis/anki";

export interface ProblematicCardAnalysis {
  cardInfo: CardInfo;
  successRate: number;
  lapseRate: number;
  daysSinceLastReview: number;
  isOverdue: boolean;
  problemScore: number;
  primaryField: string; // first field value for display
}

export async function getProblematicCardsComprehensive(
  limit = 50
): Promise<ProblematicCardAnalysis[]> {
  const cardIds1 = await anki.card.findCards({
    query: "deck:* prop:ease<2.2 -is:suspended -is:new",
  });
  const cardIds2 = await anki.card.findCards({
    query: "deck:* rated:15:1 -is:suspended -is:new",
  });

  const cardsInfo: CardInfo[] = await anki.card.cardsInfo({
    cards: [...new Set([...cardIds1, ...cardIds2])],
  });

  const now = Date.now() / 1000; // Anki timestamp is in seconds
  const analysisResults: ProblematicCardAnalysis[] = [];

  for (const card of cardsInfo) {
    // Skip new cards or cards never reviewed
    if (card.type === 0 || card.reps === 0) continue;

    const successRate = (card.reps - card.lapses) / card.reps;
    const lapseRate = card.lapses / card.reps;
    const daysSinceLastReview = (now - card.mod) / 86400; // convert to days
    const isOverdue = card.queue === 1 && card.due < now;

    // Get the first field value for display
    const firstField = Object.values(card.fields)[0]?.value || "";
    const primaryField = firstField.replace(/<[^>]*>/g, "").substring(0, 100); // strip HTML, limit length

    // Calculate composite problem score (higher = more problematic)
    let problemScore = 0;
    problemScore += lapseRate * 1000; // heavy weight on lapse rate
    problemScore += (1 - successRate) * 500; // weight on poor success rate
    problemScore += card.lapses * 100; // absolute lapse count
    problemScore += isOverdue ? 200 : 0; // bonus for overdue cards
    problemScore += Math.max(0, daysSinceLastReview - 1) * 10; // slightly overdue

    analysisResults.push({
      cardInfo: card,
      successRate,
      lapseRate,
      daysSinceLastReview,
      isOverdue,
      problemScore,
      primaryField,
    });
  }

  return analysisResults
    .sort((a, b) => b.problemScore - a.problemScore)
    .slice(0, limit);
}
