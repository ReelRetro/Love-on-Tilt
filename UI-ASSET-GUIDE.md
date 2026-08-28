# Love on Tilt — UI and Reward Asset Guide

All assets in `assets/ui-common/` are transparent PNGs. Every collection includes individual frames and a horizontal `atlas.png`. Exact frame sizes, state names, playback speeds, and file paths are recorded in `assets/ui-common/ui-runtime-manifest.json`.

## Runtime triggers

| Asset | When to show it | Playback |
|---|---|---|
| Extra Ball | Chemistry reaches 100% and the lit Extra Ball shot is completed | `idle → glow → pulse → award-burst`, then show the `EXTRA BALL` banner |
| Ball Save | Ball Save is available, triggered, or consumed | Hold `active`; play `impact → break` when a drained ball is returned |
| Chemistry Meter | Successful shots charge Chemistry | Select the nearest discrete state: 0%, 25%, 50%, 75%, or 100% |
| Multiplier | A scoring multiplier becomes active | Show the exact ×2, ×3, ×4, or ×5 medallion; do not animate between values |
| Double Date Multiball | Two-ball multiball begins | Play four frames once at 10 fps and hold the final frame briefly |
| Arcade Ticket | A short-lived in-game bonus is tallied | Loop the four-frame ticket spin at 8 fps while the bonus is counted |
| Heart collectible | A Profile Reel heart is available or earned | Loop `idle ↔ pulse`; play `collect-burst` when the heart is added |
| Jackpot numeral | A jackpot is collected | Select 5,000, 10,000, 25,000, or 50,000 and display for 900–1,200 ms |
| Reward banner | A named reward triggers | Use the exact labeled static banner; optionally precede it with the four-frame blank banner animation |
| Achievement badge | A table/session achievement occurs | Display the corresponding badge for 1.5 seconds without pausing physics |
| End-of-ball panel | A ball drains with no Ball Save | Play `closed → unfolding → open`; draw live values into the manifest text slots; finish on `complete` |

## Exact reward banners

- `EXTRA BALL`
- `BALL SAVE`
- `DOUBLE DATE`
- `PROFILE REVEAL`
- `SUPER JACKPOT`

## Achievement badges

- `FIRST REEL` — first earned profile reveal
- `DOUBLE DATE` — first multiball
- `JACKPOT` — first jackpot-door score
- `100% CHEM` — Chemistry reaches 100%
- `TABLE READY` — Table for Two profile door opens
- `NOW SHOWING` — Reel Romance profile door opens
- `UN-GHOSTED` — Bad Date: Ghosted profile door opens
- `HIGH SCORE` — session high score is exceeded

These are brief in-game callouts. They are not persistent app-level awards and never affect candidate eligibility, visibility, or ranking.

## End-of-ball values

The panel artwork contains exact headings but leaves the numbers dynamic. Draw the current values into these normalized slots from the manifest:

- Score: `x 0.28`, `y 0.70`
- Bonus: `x 0.50`, `y 0.70`
- Total: `x 0.72`, `y 0.70`

Use the same pixel font as the HUD, right-pad score values consistently, and render with nearest-neighbor scaling.
