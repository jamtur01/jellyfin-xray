# Jellyfin X-Ray

Adds an **X-Ray** button to the Jellyfin web video player. Clicking it opens an
overlay that lists the cast — actors and guest stars — with character names and
headshots, plus the title and (for episodes) season/episode context. Clicking a
cast member opens their page in Jellyfin.

## Requirements

- Jellyfin **10.11.x**.
- The **JavaScript Injector** plugin
  (`n00bcodr/Jellyfin-JavaScript-Injector`, v3.1.0.0 or later). X-Ray uses it to
  load its client script. Without it, the button will not appear.

## Install

1. In Jellyfin: **Dashboard → Plugins → Repositories → Add**, and add the X-Ray
   repository manifest URL.
2. Install **JavaScript Injector** and **X-Ray** from the catalog.
3. Restart Jellyfin and refresh the web client.

## Configuration

**Dashboard → Plugins → X-Ray:**

- **Include guest stars** — show guest stars alongside the main cast.
- **Maximum cast shown** — cap the number of people in the overlay.
- **Button icon** — the Material Icons glyph used for the player button.

## How it works

X-Ray is a small server plugin that serves a JavaScript bundle and registers a
loader with the JavaScript Injector. The bundle adds the player button and uses
the browser's authenticated API client to fetch the playing item's cast and
images — no machine learning and no per-item preprocessing.

## Development

```bash
# Client bundle + JS tests
cd Jellyfin.Plugin.Xray && npm ci && npm run build && npm test

# .NET build + tests
dotnet test
```
