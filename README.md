# CellarBook

A mobile-first wine cellar tracker, drinking diary and statistics dashboard. It runs
entirely in the browser: your cellar, your tasting notes and your label photos stay on
your own device, and the app installs to the home screen like a native app.

Photograph a label and a vision model reads it — producer, appellation, vintage,
classification, grape varieties — and pre-fills the form for you to correct. Or type the
appellation and let the app's own reference list fill in the rest, with no account at all.

## What it does

**Cellar** — every bottle with producer, cuvée, country, region, appellation,
classification, grape varieties, vintage, bottle size, alcohol, quantity, price, purchase
date and merchant, drinking window, storage location, notes and a label photo. Search
across all of it, filter by style or country, sort by producer, vintage or quantity.

**Diary** — what you drank, when, where, with whom, on what occasion, with a rating and a
tasting note. Marking a bottle as drunk writes the diary entry and decrements the cellar
quantity in a single database transaction, so the two can never drift apart. A wine that
runs out stays in the cellar at zero bottles, keeping its history, and can be restocked.
Wines drunk elsewhere can be logged straight into the diary without ever entering the
cellar.

**Statistics** — bottles, distinct wines, countries and cellar value; bottles by vintage,
country, style, grape, region and producer; bottles drunk per month over the last year;
rating distribution and average rating by country and by style; how much you have drunk
and what it was worth.

## Filling in a wine

### The appellation pack (free, offline)

Type an appellation and the app fills the blanks around it: "Barolo" gives Italy,
Piedmont, Nebbiolo and DOCG; "Gevrey-Chambertin 1er Cru" gives France, Burgundy, Pinot
Noir and Premier Cru. Around 230 classic appellations ship inside the app, matched
through their aliases and label wordings, ignoring case and accents. It **only ever fills
empty fields** — anything you typed stays as you typed it.

Everything about it is local: no account, no key, no network, no rate limit. It also runs
after a label scan, to fill whatever the model left blank.

### Label scanning (optional, needs a key)

Scanning sends the photo straight from your device to whichever provider you pick in
**Settings**, and asks for the metadata as structured JSON, which lands in an editable
form — nothing is saved until you press save. The model reads what is printed and fills
the rest from what it knows about the producer and appellation, reports its confidence,
and says what it inferred rather than read. This is the model's own knowledge, not a live
wine database, so confirm the details on obscure bottles.

| Provider | Cost | Notes |
| --- | --- | --- |
| **Gemini** (`gemini-flash-latest`) | Free tier, no card | Rate limited, and free-tier quota varies by model and region — a model with no free allowance answers 429 immediately, so the app reports Google's own wording and steps to another model once. Google's free-tier terms permit using what you send to improve their models, label photos included. Key from aistudio.google.com/apikey. |
| **Claude** (`claude-opus-5`) | Pay per scan, roughly a few cents a label | No training on your data. Key from console.anthropic.com. |

Both are called directly from the browser with plain `fetch`/SDK calls; keys are stored
only in this browser, on this device, and go nowhere but the provider you chose. If the
Gemini model id ever stops existing, the scanner asks your key which models it can reach
and corrects itself.

Without any key, every other part of the app still works and wines are entered by hand.

## Running it

```bash
npm install
npm run dev        # development server
npm run build      # production build into dist/
npm run preview    # serve the production build
npm test           # unit tests for the statistics aggregations
npm run typecheck  # TypeScript
npm run icons      # regenerate the app icons from scripts/make-icons.mjs
```

`dist/` is a static site with relative asset paths and hash-based routing, so it can be
served from any host or subdirectory. Open it on your phone and use "Add to Home Screen";
the service worker keeps it working offline.

## Where the data lives

Everything is in IndexedDB on the device: wines, diary entries, label photos (stored as
downscaled JPEG blobs) and settings. Nothing is uploaded except the label photos you
choose to scan.

That means **clearing site data erases your cellar**. Settings has an export that writes a
single JSON file containing every record and photo, and an import that merges one back in
— use it as a backup and to move between devices.

## Layout

```
src/
  lib/db.ts            IndexedDB schema, repositories, backup import/export
  lib/scan.ts          picks a provider and loads it on demand
  lib/scanClaude.ts    Anthropic SDK + zod structured outputs
  lib/scanGemini.ts    Gemini REST call, model listing and self-correction
  lib/labelFields.ts   the extraction fields, shared by both providers
  lib/appellation.ts   appellation matching and blank-filling
  data/appellations.ts the offline appellation reference
  lib/stats.ts         all aggregations behind the statistics screen
  lib/store.tsx        in-memory store, reloaded from IndexedDB after each mutation
  components/          form fields, charts, photo capture, shared UI
  pages/               one file per screen
scripts/make-icons.mjs generates the PNG app icons and the SVG favicon
```

The Anthropic SDK and its zod helpers are loaded on demand the first time you scan with
Claude, so they stay out of the initial download; the Gemini path is a plain `fetch` and
needs no SDK at all.
