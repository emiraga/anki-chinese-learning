import type { ProblematicCardAnalysis } from "~/data/problematic";
import { LearnLink } from "./Learn";
import { anki_open_browse } from "~/apis/anki";
import { HanziText } from "./HanziText";
import { CARDS_INFO } from "~/data/cards";
import AnkiAudioPlayer from "./AnkiAudioPlayer";

export default function ProblematicTable({
  result,
}: {
  result: ProblematicCardAnalysis[] | undefined;
}) {
  return (
    <table className="w-full">
      <tbody>
        {result?.map((p, i) => {
          const char =
            p.cardInfo.fields["Traditional"]?.value ??
            p.cardInfo.fields["Hanzi"]?.value;
          return (
            <tr key={i}>
              <td className="text-2xl">
                <HanziText value={char} />
              </td>
              <td>rate: {p.successRate.toFixed(4)}</td>
              <td>since: {p.daysSinceLastReview.toFixed(0)} days</td>
              <td>{p.isOverdue ? "overdue" : ""}</td>
              <td className="h-8">
                <LearnLink char={char} />
              </td>
              <td>
                <button
                  className="cursor-pointer bg-blue-100"
                  onClick={async () => {
                    await anki_open_browse(
                      `deck:${p.cardInfo.deckName} note:${p.cardInfo.modelName} ${p.primaryField}`
                    );
                  }}
                >
                  {p.cardInfo.deckName}:{p.cardInfo.modelName}:{p.primaryField}{" "}
                </button>{" "}
                {CARDS_INFO[p.cardInfo.modelName][p.cardInfo.ord].name}
                <AnkiAudioPlayer audioField={p.audio} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
