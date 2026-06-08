# X-Ray for Jellyfin — Design Spec

**Date:** 2026-06-07
**Status:** Approved (design); pending implementation plan

## Goal

Replicate Prime Video's "X-Ray" experience inside Jellyfin. While a video plays, a
user clicks an "X-Ray" button in the player to open a panel overlay showing:

- Title and (for episodes) season/episode context.
- The cast — actors and guest stars — each with their character name and headshot.

Scope is deliberately **full cast on demand**, not scene-aware detection. All data
already exists in Jellyfin's API; no machine learning or per-item preprocessing is
involved.

### Prior art (why this scope)

Two community "X-Ray" attempts exist and neither ships a working feature:

- `jconabree/jellyfin-xray` — an abandoned skeleton; its README is a verbatim copy
  of Jellyfin's plugin tutorial. No releases.
- `DevMindsLab/jellyfin-xray` — an alpha-stage standalone Python/Flask experiment
  (not a real Jellyfin plugin) doing face recognition on trickplay frames. The live
  integration step is explicitly incomplete. No releases.

The simple, genuinely useful "full cast on demand" version has not been built by
anyone, and all the data it needs is already available.

## Decisions

| Decision | Choice |
|---|---|
| Scope | Full cast on demand (no scene detection) |
| Script delivery | Delegate index.html patching to the JavaScript Injector plugin |
| Cast composition | Actors + guest stars (`Type ∈ {Actor, GuestStar}`) |
| Person click | Navigate to that person's Jellyfin page (`#/details?id=`) |
| Panel open behavior | Overlay while playing; no pause |
| Media types | Movies and episodes |
| Distribution | Public plugin release (JPRM + manifest repo) |
| Target | Jellyfin 10.11.x / net9.0 |
| Injector posture | Hard prerequisite; graceful log if absent (no self-inject fallback) |

## Architecture

A minimal **C# server plugin** plus a **client-side JS bundle**, in one repo.

```
                       ┌────────────────────── Jellyfin server ──────────────────────┐
  install 2 plugins →  │  X-Ray plugin (C#)            JavaScript Injector (existing) │
                       │   • XrayController  /XRay/script, /XRay/config               │
                       │   • startup: RegisterScript(loader) ──reflection──▶ Injector │
                       │   • config page (dashboard)                                  │
                       └──────────────────────────────────────────────┬──────────────┘
                                                                       │ injects loader into index.html
  browser ◀────────────────────────────────────────────────────────────┘
   loader → fetches /XRay/script → bundle runs:
     MutationObserver → adds X-Ray button to video OSD
     click → ApiClient.getItem(People) → overlay (cast cards) → click person → #/details
```

### Why a loader + served bundle

We register a small, stable **loader** with the Injector once; the loader pulls the
real bundle from our `/XRay/script` controller endpoint. This is the proven
Jellyfin-Enhanced pattern: JS and config changes take effect on a browser refresh
with no re-registration, and the Injector's stored config stays tiny (just the
loader). Registering the full bundle text directly into the Injector's config was
considered and rejected — it couples script updates to re-registration and bloats
the Injector's persisted XML.

### Integration mechanism (verified)

The JavaScript Injector (`n00bcodr/Jellyfin-JavaScript-Injector`, ≥ v3.1.0.0)
exposes a public static `Jellyfin.Plugin.JavaScriptInjector.PluginInterface` with:

- `bool RegisterScript(JObject payload)`
- `bool UnregisterScript(string scriptId)`
- `int UnregisterAllScriptsFromPlugin(string pluginId)`

Payload (Newtonsoft `JObject`) fields: `id`, `name`, `script`, `enabled`,
`requiresAuthentication`, `pluginId`, `pluginName`, `pluginVersion`. Validation:
non-empty `id`/`name`/`script`/`pluginId`/`pluginName`; `id ≤ 100`, `name ≤ 200`,
`script ≤ 1 MB`.

We call this **by reflection** (no compile-time dependency): scan loaded assemblies
for `Jellyfin.Plugin.JavaScriptInjector`, get the `PluginInterface` type, invoke
`RegisterScript`. Registration persists to the Injector's config XML, so we must
register idempotently (stable `id = "xray-loader"`) and unregister on uninstall.

## Components

### Server (`Jellyfin.Plugin.Xray`)

- **`Plugin.cs`** — `BasePlugin<PluginConfiguration>, IHasWebPages`; sets static
  `Instance`; `GetPages()` returns the embedded config page.
- **`PluginServiceRegistrator.cs`** (`IPluginServiceRegistrator`) — registers the
  startup service in DI.
- **`XrayRegistration`** (`IHostedService`) — on startup, reflect into the Injector
  and `RegisterScript` the loader (idempotent). On uninstall/shutdown,
  `UnregisterAllScriptsFromPlugin(our GUID)`. If the Injector assembly is not found,
  log a clear warning with install guidance and continue (plugin stays healthy).
- **`Controllers/XrayController.cs`** — `[Route("XRay")]`:
  - `[HttpGet("script")] [AllowAnonymous]` → serve embedded `xray.js` as
    `application/javascript` with cache headers.
  - `[HttpGet("config")]` → return effective settings as JSON.
- **`Configuration/PluginConfiguration.cs`** — small real settings:
  `IncludeGuestStars` (default true), `MaxCast` (default 50), `ButtonIcon`
  (default `people`).
- **`Configuration/configPage.html`** — dashboard page: shows Injector
  detected/not-detected status and the settings toggles.

### Client (embedded under `Web/`)

- **`loader.js`** — the script registered with the Injector. Appends
  `<script src=ApiClient.getUrl('XRay/script')+'?v='+timestamp>` (resolves BaseURL
  and auth, mirroring the Injector's own loader).
- **`xray.js`** — four small concerns:
  - **observer** — a `MutationObserver` on `document.body`; on structural changes,
    find `.videoOsdBottom .buttons.focuscontainer-x` and insert the X-Ray button
    next to `.btnVideoOsdSettings`, guarded against duplicates. (The SPA mounts and
    destroys the player view many times; never inject on load alone.)
  - **data** — read item id from the `#/video?id=` hash;
    `ApiClient.getItem(ApiClient.getCurrentUserId(), itemId)`; filter `People` to
    `Type ∈ {Actor, GuestStar}` (capped at `MaxCast`); build headshot URLs with
    `ApiClient.getImageUrl(person.Id, { type: 'Primary', tag: person.PrimaryImageTag })`
    using a **fresh options object per call** (getImageUrl mutates it).
  - **panel** — build/teardown the overlay; render the context header and cast
    cards; person click → `#/details?id={person.Id}`; close via close button, Esc,
    or click-outside.
  - **init** — bootstrap once; start the observer.
- **`xray.css`** — translucent dark surface using the app's theme CSS variables;
  responsive down to mobile widths; overlay lifetime independent of the OSD
  auto-hide timer; buttons focusable for D-pad/TV navigation.

### Button markup

Match native OSD buttons so styling and focus behavior are inherited:

```html
<button is="paper-icon-button-light" class="btnXray autoSize" title="X-Ray">
  <span class="xlargePaperIconButton material-icons people" aria-hidden="true"></span>
</button>
```

Insert with `settingsBtn.parentElement.insertBefore(xrayBtn, settingsBtn)`.

## Data flow (open → close)

1. Click X-Ray → read `itemId` from `window.location.hash` (`#/video?id=…`).
2. `ApiClient.getItem(getCurrentUserId(), itemId)` (the single-item endpoint
   includes `People` by default).
3. Header:
   - Episode → `SeriesName · S{ParentIndexNumber} E{IndexNumber} '{Name}'`.
   - Movie → `{Name} ({ProductionYear})`.
4. Cards: `People.filter(p => p.Type === 'Actor' || p.Type === 'GuestStar')`, each
   = headshot + `Name` + `→ {Role}`; missing `PrimaryImageTag` → initials avatar.
5. Person click → navigate to `#/details?id={person.Id}`; overlay closes.
6. Close → remove overlay; video keeps playing underneath.

## Error handling

- Injector missing → startup warning + config-page notice; the button never appears
  but the plugin stays healthy.
- `getItem` fails or `People` empty → panel shows "No cast information available."
- No headshot → initials placeholder; never a broken image.
- Observer never double-injects; tolerates repeated player mount/unmount.

## Testing

- **C# (xUnit):** payload builder and idempotent register/unregister against a fake
  `PluginInterface` type; controller returns the correct content-type; config JSON
  serialization; uninstall unregisters.
- **JS (vitest + jsdom):** pure helpers — `People` filtering, context-header strings
  (episode vs movie), `getImageUrl` URL building, the dedupe guard.
- **Manual checklist:** bare-metal + Docker; movie + episode; zero-cast item; custom
  theme; mobile width; TV/D-pad focus.

## Build & release

- net9.0; `Jellyfin.Controller` / `Jellyfin.Model` 10.11.x with
  `<ExcludeAssets>runtime</ExcludeAssets>`; `targetAbi 10.11.0.0`.
- JPRM `build.yaml` + GitHub Actions using the
  `jellyfin/jellyfin-meta-plugins` reusable workflow → versioned release zip.
- Hosted `manifest.json` (array form) that users add as a custom plugin repo;
  includes icon, changelog, and the release `sourceUrl` + MD5 `checksum`.
- README documents installing both X-Ray and the JavaScript Injector.

## Repo layout

```
Jellyfin.Plugin.Xray/
  Plugin.cs
  PluginServiceRegistrator.cs
  XrayRegistration.cs
  Controllers/XrayController.cs
  Configuration/PluginConfiguration.cs
  Configuration/configPage.html
  Web/loader.js
  Web/xray.js
  Web/xray.css
  Jellyfin.Plugin.Xray.csproj
tests/
  Jellyfin.Plugin.Xray.Tests/   (C# / xUnit)
  web/                          (vitest)
build.yaml
manifest.json
.github/workflows/build.yaml
README.md
icon.png
```

## Out of scope

- Scene-aware "who is on screen now" detection (face recognition / trickplay
  analysis) — a separate, much larger ML project.
- A self-injection fallback via the File Transformation plugin — the Injector is a
  hard prerequisite for v1.
- Native (non-web) Jellyfin client support — the overlay is web-client only.
```

