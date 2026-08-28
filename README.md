# Love on Tilt — Complete Runtime Package v1

Implementation-ready transparent PNG animation assets for the three distinct NES-style pinball boards:

- **Table for Two** — dinner-date hardware and heart-shaped reservation door
- **Reel Romance** — cinema hardware, popcorn bumper, and marquee jackpot
- **Bad Date: Ghosted** — haunted graveyard hardware and ghost-filled cemetery gate

## Primary gameplay objective

Players earn profile reveals by completing the current board's target word and shooting the open jackpot door. Each session contains no more than three reveals, presented one at a time with **INTERESTED** and **KEEP PLAYING** actions. Score, Chemistry, Ball Save, Double Date multiball, jackpots, and extra balls support that objective; there are no app-level cosmetic rewards in this package.

See `GAMEPLAY-FLOW.md` for the complete readable rules, `gameplay-flow.json` for implementation values, and `integration/profile-reveal-contract.json` for the host-app event boundary.

## UI and reward asset pass

The common transparent UI pack adds 53 runtime frames across 12 collections: Extra Ball, Ball Save, Chemistry Meter, heart collectible, ×2–×5 multipliers, Double Date Multiball, animated and labeled reward banners, exact jackpot numerals, Arcade Ticket, achievement badges, and the end-of-ball bonus panel.

Arcade Tickets and achievement badges are expressly session-only feedback. They do not create currency, unlock cosmetics, change profile ranking, or replace earned profile reveals as the main objective.

See `UI-ASSET-GUIDE.md` and `assets/ui-common/ui-runtime-manifest.json`.

## Physics-ready playfields

Each board now includes distinct collision geometry, normalized coordinates, color-coded masks, debug previews, plunger and drain placement, target and bumper hitboxes, mode sensors, and transparent foreground rail overlays for correct ball occlusion.

See `PHYSICS-PLAYFIELD-GUIDE.md` and `playfields/playfield-catalog.json`.

## Original music and sound package

The audio pass adds five seamless NES-inspired music loops, four outcome/mode stingers, and 32 pinball, reward, Chemistry, profile-reveal, tilt, and UI effects. Every cue includes a mono 44.1 kHz 16-bit WAV master and an OGG runtime version. All 32 SFX are also packed into a mobile-friendly audio sprite.

The score and sound design are original to **Love on Tilt** and do not sample or recreate music from a commercial game. See `AUDIO-GUIDE.md` and `audio/audio-manifest.json`.

## Included runtime components

Each board contains its own themed versions of:

| Component | Frames | Runtime use |
|---|---:|---|
| Ball | 4 | Looping spin |
| Left flipper | 3 | Rest, mid, up |
| Right flipper | 3 | Rest, mid, up |
| Plunger | 3 | Rest, half-pull, full-pull |
| Bumper | 4 | Idle, anticipation, impact, recovery |
| Drop target | 4 | Raised-unlit, raised-lit, halfway-down, down |
| Insert light | 3 | Off, on, pulse |
| Jackpot door | 6 | Closed through jackpot flash |

That is **30 individual transparent frames and eight horizontal atlases per board**, or **90 frames and 24 atlases total**.

## Folder layout

```text
assets/<board-id>/
  runtime-manifest.json
  ball/
  flipper-left/
  flipper-right/
  plunger/
  bumper/
  target/
  light/
  jackpot-door/
boards/                 full approved board renders
previews/               review sheets on a dark background
source/                 uncut generation masters
tools/                  reproducible extraction and validation scripts
audio/                  original music loops, stingers, SFX, and audio sprite
runtime-catalog.json    entry point for all three boards
GAMEPLAY-FLOW.md        readable profile-first rules
gameplay-flow.json      machine-readable balance and state values
integration/            host-app profile-reveal event contract
assets/ui-common/       common transparent HUD, reward, badge, and panel assets
UI-ASSET-GUIDE.md       plain-language UI trigger and animation guide
playfields/             per-board physics manifests, masks, overlays, and debug images
PHYSICS-PLAYFIELD-GUIDE.md portable physics implementation and tuning guide
AUDIO-GUIDE.md          audio loading, event, mix, looping, and accessibility guide
```

Every component folder contains separate frame PNGs plus an `atlas.png`. Atlases are horizontal strips with fixed-size frames; dimensions, playback speed, state names, looping behavior, and suggested normalized pivots are recorded in the board manifest.

## Engine integration

1. Load `runtime-catalog.json`, choose a board, then load its `runtime-manifest.json`.
2. Use `image-rendering: pixelated` in web views, or the nearest-neighbor equivalent in a game engine.
3. Draw atlas frame `n` from source rectangle `n × frameWidth, 0, frameWidth, frameHeight`.
4. Keep artwork and physics separate. Use the manifest pivot as an animation/rotation starting point, then tune the final collider to the actual table geometry in your engine.
5. Drop targets are intentionally blank. Draw the manifest's `targetLabels` array over target instances so the same animated body can spell `CHEERS`, `REEL`, or `GHOSTED` without redundant textures.
6. Instance the themed bumper, target, and light assets wherever the corresponding board requires multiples.

## Animation suggestions

- Flippers: play forward on press and reverse on release.
- Plunger: select a pull state while held, then snap to rest on launch.
- Bumpers: idle → anticipation → impact → recovery on collision.
- Targets: raised-unlit → raised-lit → halfway-down → down on hit.
- Lights: use off/on as state indicators; pulse at 6 fps for active objectives.
- Jackpot door: closed → cracked → half-open → open → open-glow → jackpot-flash. Hold the final frame briefly, then reverse or reset.

## Validation

Run:

```bash
npm run validate
```

The validator checks inventory, canvas dimensions, atlas dimensions, alpha channels, transparent backgrounds, and non-empty foreground pixels.

## Art-generation notes

Built-in image generation was used in reference-guided mode against each approved board. The mechanism prompt requested a 4×4 NES-style transparent sprite atlas for the ball, paired flippers, plunger, and insert lights. The feature prompt requested a second 4×4 atlas for each board's themed bumper, blank drop target, light states, and six-stage jackpot-door animation. The extraction tool removes the preview checker field only where it is connected to the cell edge, preserving enclosed white and metallic sprite details.
