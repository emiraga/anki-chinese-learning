# anki-chinese-learning

Set of useful tools as a companion for learning Mandarin Chinese 中文 with Anki

# Setup of Anki

Install AnkiConnect extension to anki by following instructions here:
https://ankiweb.net/shared/info/2055492159
or here https://git.sr.ht/~foosoft/anki-connect

On the main screen, it's under "Tools -> Addons"

Then you can configure this addon and use the following settings:
("Config" button on the Add-ons screen.)

```
{
    "apiKey": null,
    "apiLogPath": null,
    "ignoreOriginList": [],
    "webBindAddress": "127.0.0.1",
    "webBindPort": 8765,
    "webCorsOriginList": [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173"
    ]
}
```


## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`
