# Vice Cover Studio — GTA 6-style cover art maker

Turn your photo into a Vice City poster: multi-panel GTA-style cover art
with bold caption lettering and a Vice City sunset or neon grade, exported
as a PNG to share. Fully offline static app — no network requests, photos
never leave your machine.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## What it does

- **5 layouts** — Diagonal Vice (slanted hero + stacked side panels),
  Hero Split, Triptych, Magazine, Duo Portrait. Each layout is its own
  geometry, not a recolour.
- **5 style presets** — Sunset Strip, Neon Nights, Golden Hour,
  Midnight Vice, Postcard Vice.
- **3 photo slots** — each panel can hold a different photo (samples:
  Boulevard, Pier — or upload your own). Per-panel crop: zoom, pan
  (drag the cover, or sliders), flip.
- **Editable caption** — title with auto-fit + pink glow, tagline pill
  measured to its text (never clips), subtitle, footer, title scale.
- **Effects** — retro sun carrying the VI mark, skyline, palm silhouettes
  clipped to the photo zone, halftone dots, grain, vignette, sunset grade —
  each toggleable, plus hold-to-compare.
- **Randomize** — one click, a fresh layout + preset + photo mix.
- **Export PNG** — 1080×1080, 1080×1350, 1920×1080, 1080×1920.

## Screenshots

1. `1-cover.jpg` — Diagonal Vice / Sunset Strip cover (1080×1080)
2. `2-editor.jpg` — the editor in a browser (1280×720)
3. `3-cover-tall.jpg` — Triptych / Golden Hour cover (1024×1280)
4. `4-cover-wide.jpg` — Magazine / Neon Nights cover (1280×720)

## Hand-in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored `vendor/makefun-app.ts` library.

## Notes

- Original design: no Rockstar logo, wordmark, artwork, character, or
  font. System fonts only; all decoration is drawn in code.
- Sample photos (`app/samples/`) were made for make.fun with an image
  model and are free to use. They are not photos of any real person.
- The `VI` mark is a plain numeral in a drawn sun/badge — not a logo.
