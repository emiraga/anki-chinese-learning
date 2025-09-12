import "react-router";

declare module "react-router" {
  interface Register {
    params: Params;
  }
}

type Params = {
  "/": {};
  "/actor/:actorName": {
    "actorName": string;
  };
  "/actors": {};
  "/char/:charHanzi": {
    "charHanzi": string;
  };
  "/chars": {};
  "/conflicts": {};
  "/invalid_data": {};
  "/integrity": {};
  "/phrase/:phraseHanzi": {
    "phraseHanzi": string;
  };
  "/phrases": {};
  "/phrases_import": {};
  "/phrases_more": {};
  "/pinyin": {};
  "/place/:placeName": {
    "placeName": string;
  };
  "/places": {};
  "/practice": {};
  "/problematic": {};
  "/prop/:propName": {
    "propName": string;
  };
  "/props": {};
  "/settings": {};
  "/stats": {};
  "/stats_progress": {};
  "/study": {};
  "/study_weak_chars": {};
  "/advance_cards": {};
  "/sylable/:sylable": {
    "sylable": string;
  };
  "/tag/:tagName": {
    "tagName": string;
  };
  "/tags": {};
  "/todo_chars": {};
  "/chars_sentence_input": {};
  "/chars_multiple_pronunciation": {};
  "/exam_level": {};
  "/help": {};
  "/tone/:toneName": {
    "toneName": string;
  };
  "/tones": {};
  "/zhuyin_typing": {};
};