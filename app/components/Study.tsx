import { useEffect, useState } from "react";
import anki, { type CardInfo } from "~/apis/anki";
import { LearnLink } from "~/components/Learn";
import { HanziText } from "~/components/HanziText";
import AnkiAudioPlayer from "~/components/AnkiAudioPlayer";
import AnkiContentRenderer from "~/components/AnkiContentRenderer";

export function useStudyData() {
  const [cardInfo, setCardInfo] = useState<CardInfo | undefined>(undefined);
  const [errorCurrent, setErrorCurrent] = useState<Error | undefined>(
    undefined,
  );

  useEffect(() => {
    const load = async () => {
      try {
        const card = await anki.graphical.guiCurrentCard();

        // Only update state if the card has changed
        setCardInfo((prevCard) => {
          if (prevCard?.cardId === card?.cardId) {
            return prevCard; // Return same reference, no re-render
          }
          return card ?? undefined;
        });
        setErrorCurrent(undefined);
      } catch (e) {
        setCardInfo(undefined);
        setErrorCurrent(e as Error);
      }
    };
    const id = setInterval(load, 1000);
    load();
    return () => {
      clearInterval(id);
    };
  }, []);

  return { cardInfo, errorCurrent };
}

export default function Study() {
  const { cardInfo } = useStudyData();
  const current = cardInfo?.fields["Traditional"]?.value;

  return (
    <>
      <h1 className="text-9xl mx-auto">
        <HanziText value={current} />
      </h1>
      <LearnLink char={current || ""} />

      {cardInfo && (
        <div className="mt-8 space-y-6 flex flex-col items-center">
          {cardInfo.fields["Audio"]?.value && (
            <div className="flex justify-center">
              <AnkiAudioPlayer audioField={cardInfo.fields["Audio"]?.value} pitchVisualisation={true} />
            </div>
          )}
          <div className="max-w-2xl w-full">
            <h2 className="text-xl font-semibold mb-2">Front:</h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: cardInfo.question || "" }}
              />
            </div>
          </div>
          <div className="max-w-2xl w-full">
            <h2 className="text-xl font-semibold mb-2">Back:</h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6">
              <AnkiContentRenderer
                htmlContent={cardInfo.answer || ""}
                className="prose prose-sm max-w-none dark:prose-invert prose-img:mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
