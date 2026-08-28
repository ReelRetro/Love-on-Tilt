# Love on Tilt — Profile-First Gameplay Flow

## Primary objective

The goal is not simply to accumulate points. The player completes pinball objectives to earn up to **three dating-profile reveals** during one short game session.

Score remains visible and supports replayability, but the meaningful progress indicator is the three-heart **Profile Reel**:

```text
[♡] [♡] [♡]  →  [♥] [♥] [♥]
```

Each filled heart represents one profile the player earned and viewed. After the third profile decision, the session ends with a concise summary instead of opening an endless stack of profiles.

## Standard session

1. The host app prefetches up to three eligible profiles before play begins.
2. The player begins with three balls and an eight-second Ball Save.
3. Bumpers, lanes, ramps, targets, and combos increase score and charge Chemistry.
4. The player completes the board's target word.
5. The completed word lights and opens the board's jackpot door.
6. Hitting the open door captures the ball and earns a Profile Reveal.
7. Pinball physics pause only after the ball is safely captured.
8. The game presents one eligible profile, led by that person's **The Reel You** video.
9. The player selects **INTERESTED** or **KEEP PLAYING**.
10. The host app records the private decision. The game either ejects the captured ball and resumes or ends after the third reveal.

No horizontal swipe gesture is used. One profile is earned, considered, and acted upon at a time.

## Balls and safety systems

| System | Rule |
|---|---|
| Starting balls | 3 |
| Ball Save | Active for 8 seconds after each launch |
| Extra balls | Maximum of 2 per session |
| Maximum playable balls | 5 |
| Multiball | Two balls; called **Double Date** |
| Reveal during multiball | Queued until only one ball remains, then captured and shown |
| Profile reveals | Maximum of 3 per session |

Extra balls extend the player's opportunity to earn profile reveals. They do not generate a profile automatically.

## Chemistry rewards

Chemistry is an in-game meter charged by successful shots and combos.

| Chemistry | Immediate reward |
|---:|---|
| 25% | 2× scoring for 10 seconds |
| 50% | Reactivate Ball Save |
| 75% | Start Double Date two-ball multiball |
| 100% | Light the Extra Ball shot |

Once the lit Extra Ball shot is made, an extra ball is banked and Chemistry resets. If the two-extra-ball cap has already been reached, the lit shot awards a Super Jackpot instead.

## Board objectives

| Board | Target word | Door | Profile-reveal callout | Special mode |
|---|---|---|---|---|
| Table for Two | `CHEERS` | Heart-shaped reservation door | **YOUR TABLE IS READY!** | Toast Time: alternate left and right shots to raise the multiplier |
| Reel Romance | `REEL` | Heart cinema screen and curtains | **NOW SHOWING: THE REEL YOU!** | Double Feature: ramp loops extend Double Date multiball |
| Bad Date: Ghosted | `GHOSTED` | Haunted cemetery gate | **SOMEONE NEW APPEARS!** | Escape the Graveyard: clear ghost targets before time expires |

After a reveal, the target bank resets and the next cycle is slightly harder. The profile pool never changes based on score, table choice, or player skill.

## First Reel Assist

Dating discovery should not be locked behind expert pinball performance. If the player drains two consecutive balls without earning a reveal, **First Reel Assist** lights the profile door for 20 seconds on the next launch.

The player must still hit the lit door, but the full target word is temporarily waived. This gives a new player a realistic path to at least one profile without turning the entire game into an automatic reveal sequence.

## Profile reveal screen

The reveal pauses gameplay and displays only host-approved profile fields:

- The Reel You video
- First name
- Age
- General location
- Short headline
- Selected interests
- Verification indicator, when applicable

Actions:

- **INTERESTED** — privately records interest and returns to the game unless this completes the session.
- **KEEP PLAYING** — records no interest and returns to the game without showing another profile automatically.

Mutual interest, matching, and chat creation remain controlled by Reel Love: Retro Video Dating. The pinball game must never announce a match based only on one player's choice.

## Candidate eligibility

The host app—not the game—selects candidates. Every revealed profile must already satisfy the current user's discovery settings, location rules, account visibility, blocking rules, safety restrictions, and repeat-suppression policy.

The same profile cannot appear twice in one game. Gameplay performance must not reorder, promote, or suppress people.

## Session endings

The game ends when either:

- The player makes a decision on the third earned profile; or
- The player drains the final available ball.

The final screen shows:

- Profiles revealed: 0–3
- Private interest decisions recorded
- Final score
- Highest multiplier
- Jackpots and extra balls earned

The available actions are **PLAY AGAIN** and **RETURN TO REEL LOVE**. The results screen does not become another profile browser.

## Empty and interrupted states

- **No eligible profile available:** award the normal jackpot, show `NO NEW REELS NEARBY`, and resume play without consuming a reveal heart.
- **Profile fails to load:** keep the earned reveal pending, resume safely, and retry between balls.
- **App interruption:** save balls remaining, score, Chemistry, completed letters, reveal count, and any pending reveal.
- **Player exits the reveal:** treat it as no decision, keep the candidate suppressed for the current session, and resume or end normally.

## Design rule

All secondary systems—score, multipliers, Ball Save, Double Date, extra balls, jackpots, and board modes—exist to make earning a small number of deliberate profile reveals more entertaining than repeatedly swiping through profiles.
