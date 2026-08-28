# Love on Tilt — Physics Playfield Guide

This package converts the three finished table illustrations into engine-neutral physics references. Each board has its own geometry; the files are not shared-layout reskins.

## Files per board

```text
playfields/<board-id>/
  physics-manifest.json   authoritative collider and sensor geometry
  collision-mask.png     color-coded raster reference
  collision-debug.png    geometry drawn over the finished board
  foreground-mask.png    white pixels that must render over the ball
  foreground-overlay.png transparent rail artwork for ball occlusion
```

The combined previews are `previews/physics-playfields-debug.png` and `previews/foreground-occlusion-debug.png`.

The original board remains in `boards/`. Draw the original board first, then the ball and dynamic mechanisms, then `foreground-overlay.png`, and finally the HUD.

## Coordinate system

- Source canvas: 1024 × 1536
- Origin: top-left
- Positive X: right
- Positive Y: down
- Pixel coordinates are authoritative.
- Every manifest also contains normalized 0–1 coordinates for responsive implementations.

If the displayed board is scaled uniformly, multiply pixel geometry by the same scale. If letterboxing is used, apply the letterbox offset after scaling. Do not stretch X and Y independently.

## Collision-mask colors

| Color | Meaning |
|---|---|
| Pink/red | Solid walls and rails |
| Cyan | Pop bumpers |
| Yellow | Drop targets |
| Green | Non-solid scoring and mode sensors |
| Orange | Drain sensors |
| White | Flippers at their resting angles |
| Purple | Slingshots |

The JSON manifest is the source of truth. The mask is provided for app builders that can import raster collision references and for visual verification.

## Required engine objects

1. Create one dynamic circular body for the ball using `tuning.ball`.
2. Convert each `walls` polyline into connected static edge segments.
3. Convert `circularWalls` into static circular rail segments when present.
4. Create active bumper circles from `bumpers`.
5. Create target rectangles, slingshot polygons, and drain sensors.
6. Create flippers around the listed pivots using their rest and active angles.
7. Create the launch lane and plunger at `launcher.spawn`.
8. Register every non-solid `sensors` entry with its named gameplay event.

## Board-specific geometry

- **Table for Two:** left spiral loop, diagonal crossover ramp, five plate bumpers, six `CHEERS` targets, and an upper-right flipper.
- **Reel Romance:** film-reel circular track, diagonal conveyor ramp, three popcorn bumpers, and four `REEL` targets.
- **Bad Date: Ghosted:** coffin ramp, winding ghost tube, three skull-pumpkin bumpers, seven `GHOSTED` targets, and a skeleton kicker sensor.

## Profile door

Every manifest contains exactly one sensor whose event is `profileRevealDoor`. Enable that sensor only after the board's target word is complete or First Reel Assist is active. When the ball enters it:

1. Capture the ball.
2. Wait for multiball to end if another ball remains active.
3. Pause physics.
4. Run the earned profile-reveal flow.
5. Eject the captured ball and resume, unless the third profile decision ended the session.

## Tuning process

The included values are safe starting values, not a replacement for device playtesting. Tune in this order:

1. Ball radius and maximum speed
2. Outer walls and drain widths
3. Flipper pivots, length, rest angle, and active angle
4. Plunger impulse
5. Bumper and slingshot impulse
6. Ramp entrance sensors
7. Foreground occlusion alignment

Use `collision-debug.png` during tuning. The final shipped game should not display the debug overlay.

## Acceptance criteria

- The ball cannot leave the visible playfield except through a drain sensor.
- The ball never crosses a rail represented by a wall collider.
- Flippers rotate around their visible hinge pixels.
- Bumper collision circles align with the visible mechanism bases.
- Target hits cannot register through neighboring targets.
- The profile door cannot trigger while closed.
- Foreground rails render over the ball only where the mask is white.
- All three boards remain playable at 60 fps on target mobile devices.
