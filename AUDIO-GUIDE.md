# Love on Tilt — Music and Sound Implementation Guide

This package contains an original NES-inspired score and sound set composed specifically for **Love on Tilt**. It does not sample or recreate music from a commercial pinball or video game.

## Inventory

| Group | Count | Included cues |
|---|---:|---|
| Music loops | 5 | Title, Table for Two, Reel Romance, Bad Date: Ghosted, Double Date Multiball |
| Stingers | 4 | Mode start, profile reveal, session complete, game over |
| Gameplay SFX | 32 | Flippers, plunger, ball, collisions, targets, rewards, Chemistry, jackpot, profile door, drain, tilt, and UI |

Every cue is supplied as a mono 44.1 kHz 16-bit PCM WAV master and an OGG Vorbis runtime file. `audio/audio-manifest.json` is the canonical event map. `audio/sfx/audio-sprite.json` maps all 32 effects into a single mobile-friendly WAV/OGG audio sprite.

## Loading strategy

1. Preload the selected table loop, common SFX audio sprite, and `mode-start` stinger before play.
2. Stream or lazy-load title music and inactive table themes.
3. Use individual SFX files in native engines. Use the audio sprite for web views where fewer requests improve startup.
4. Stop the title loop when a table starts. Crossfade table themes over 250–400 ms.
5. When Double Date Multiball starts, crossfade to its loop. Resume the table loop at its saved position when multiball ends.

## Mix and priority

- Music bus: **−13 dB** starting point.
- SFX bus: **−6 dB** starting point.
- Stinger bus: **−4 dB** starting point.
- Limit simultaneous effects to 12 voices; preserve flippers, drain, jackpot, and profile-reveal cues first.
- Rotate the three bumper variants so repeated impacts stay lively.
- Duck music by 6 dB for a profile reveal, with an 80 ms attack and 650 ms release.
- The quiet ball-roll loop should stop whenever the ball is captured, drained, or motionless.

## Profile-first behavior

`loveOnTilt.profileRevealEarned` and `loveOnTilt.profileRevealPresented` are the highest-priority sound events. A jackpot may celebrate scoring, but the profile-reveal stinger is the emotional payoff. Arcade Ticket and achievement sounds remain session-only feedback and do not imply app currency or persistent rewards.

## Looping

Music loop points are exact sample positions in `audio-manifest.json`. Loop from `loopStartSamples` through, but not including, `loopEndSamples`. The ball-roll ambience uses the same rule. Do not add encoder padding to the WAV masters; when an engine handles OGG delay imperfectly, prefer the WAV loop or use the provided sample points.

## Mobile and accessibility

- Unlock audio after the user's first Play/tap gesture on iOS and Android web views.
- Keep independent music and SFX toggles. Persist them per user.
- Critical gameplay states also need visual feedback. Sound is reinforcement, not the only signal.
- Haptics may mirror flipper, bumper, jackpot, profile reveal, and drain events.
- Pause loops when the app is backgrounded and resume only after focus returns.

## Validation

Run `npm run validate`. The audio validator confirms the complete cue inventory, 44.1 kHz mono 16-bit WAV format, OGG presence, non-silent data, clipping headroom, exact loop metadata, critical event mappings, and audio-sprite offsets.
