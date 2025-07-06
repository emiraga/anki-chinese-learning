import "react-router";

declare module "react-router" {
  interface Register {
    params: Params;
  }
}

type Params = {
  "/": {};
  "/stats": {};
  "/props": {};
  "/prop/:propName": {
    "propName": string;
  };
  "/chars": {};
  "/char/:charHanzi": {
    "charHanzi": string;
  };
  "/todo_chars": {};
  "/conflicts": {};
  "/migration": {};
  "/actors": {};
  "/actor/:actorName": {
    "actorName": string;
  };
  "/places": {};
  "/place/:placeName": {
    "placeName": string;
  };
  "/tones": {};
  "/tone/:toneName": {
    "toneName": string;
  };
  "/phrases": {};
  "/phrase/:phraseHanzi": {
    "phraseHanzi": string;
  };
  "/study": {};
  "/test1": {};
  "/tags": {};
  "/practice": {};
  "/sylable/:sylable": {
    "sylable": string;
  };
  "/tag/:tagName": {
    "tagName": string;
  };
  "/problematic": {};
};