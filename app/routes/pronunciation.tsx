import MainFrame from "~/toolbar/frame";

export default function PronunciationPage() {
  return (
    <MainFrame disablePadding disableKeyboardShortcuts>
      {/* we didn't implement light mode support */}
      <iframe
        width="100%"
        title="tone trainer"
        height="2300px"
        src="tone_trainer/dist/index.html"
      ></iframe>
    </MainFrame>
  );
}
