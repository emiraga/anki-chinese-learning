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
  "/migration": {};
  "/phrase/:phraseHanzi": {
    "phraseHanzi": string;
  };
  "/phrases": {};
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
  "/study": {};
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
  "/tone/:toneName": {
    "toneName": string;
  };
  "/tones": {};
};