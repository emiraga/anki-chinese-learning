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
  "/test1": {};
  "/todo_chars": {};
  "/tone/:toneName": {
    "toneName": string;
  };
  "/tones": {};
};