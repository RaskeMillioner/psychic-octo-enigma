# CellarBook

A mobile-first wine cellar tracker, drinking diary and statistics dashboard. It runs
entirely in the browser: your cellar, your tasting notes and your label photos stay on
your own device, and the app installs to the home screen like a native app.

Photograph a label and Claude reads it — producer, appellation, vintage, classification,
grape varieties — and pre-fills the form for you to correct.

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

## Label scanning

Scanning sends the photo to the Anthropic API from your device and asks Claude
(`claude-opus-5`) to return the metadata as structured JSON, which lands in an editable
form — nothing is saved until you press save. The model reads what is printed and fills
the rest from what it knows about the producer and appellation (a Chablis is Chardonnay,
a Barolo is Nebbiolo from Piedmont), reports its confidence, and says what it inferred
rather than read. This is the model's own knowledge, not a live wine database, so
confirm the details on obscure bottles.

Add your API key under **Settings**. It is stored only in this browser and used only for
requests to Anthropic; without it every other part of the app still works and wines are
entered by hand.

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
  lib/scan.ts          label photo → structured metadata via the Anthropic API
  lib/labelSchema.ts   the extraction schema (lazy-loaded with the SDK)
  lib/stats.ts         all aggregations behind the statistics screen
  lib/store.tsx        in-memory store, reloaded from IndexedDB after each mutation
  components/          form fields, charts, photo capture, shared UI
  pages/               one file per screen
scripts/make-icons.mjs generates the PNG app icons and the SVG favicon
```

The Anthropic SDK, its zod helpers and the extraction schema are loaded on demand the
first time you scan a label, so they stay out of the initial download.
