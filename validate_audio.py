#!/usr/bin/env python3
"""Validate the Love on Tilt audio package and event map."""

from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
manifest_path = ROOT / "audio" / "audio-manifest.json"
manifest = json.loads(manifest_path.read_text())
errors = []

expected_music = {"title-theme", "table-for-two", "reel-romance", "bad-date-ghosted", "double-date-multiball"}
expected_stingers = {"mode-start", "profile-reveal", "session-complete", "game-over"}
expected_sfx = {
    "flipper-up", "flipper-down", "plunger-pull", "plunger-release", "ball-launch", "ball-roll-loop",
    "wall-hit", "bumper-hit-1", "bumper-hit-2", "bumper-hit-3", "target-hit", "target-bank-complete",
    "slingshot-hit", "ball-save", "extra-ball", "chemistry-25", "chemistry-50", "chemistry-75",
    "chemistry-100", "multiball-start", "jackpot", "super-jackpot", "heart-collect", "profile-door-open",
    "profile-reveal", "ball-drain", "tally-tick", "achievement", "tilt-warning", "tilt", "ui-select", "ui-back",
}


def validate_entry(entry: dict, expected_loop: bool | None = None) -> None:
    wav_path = ROOT / entry["wav"]
    ogg_path = ROOT / entry["ogg"]
    if not wav_path.exists() or not ogg_path.exists():
        errors.append(f'{entry["id"]}: WAV or OGG is missing.')
        return
    with wave.open(str(wav_path), "rb") as source:
        channels = source.getnchannels(); rate = source.getframerate(); width = source.getsampwidth(); frames = source.getnframes()
        data = np.frombuffer(source.readframes(frames), dtype="<i2")
    if channels != 1 or rate != 44100 or width != 2:
        errors.append(f'{entry["id"]}: expected mono 44.1 kHz 16-bit PCM.')
    if frames != entry["sampleCount"]:
        errors.append(f'{entry["id"]}: sample count does not match manifest.')
    if len(data) == 0 or np.max(np.abs(data.astype(np.int32))) == 0:
        errors.append(f'{entry["id"]}: audio is silent.')
    if np.max(np.abs(data.astype(np.int32))) >= 32767:
        errors.append(f'{entry["id"]}: audio reaches digital clipping.')
    if ogg_path.stat().st_size < 1000:
        errors.append(f'{entry["id"]}: OGG runtime file is unexpectedly small.')
    else:
        probe = subprocess.run([
            "ffprobe", "-v", "error", "-select_streams", "a:0",
            "-show_entries", "stream=sample_rate,channels", "-of", "json", str(ogg_path),
        ], check=True, capture_output=True, text=True)
        stream = json.loads(probe.stdout)["streams"][0]
        if int(stream["sample_rate"]) != 44100 or int(stream["channels"]) != 1:
            errors.append(f'{entry["id"]}: OGG is not mono 44.1 kHz audio.')
    if expected_loop is not None and entry["loop"] != expected_loop:
        errors.append(f'{entry["id"]}: loop flag is incorrect.')
    if entry["loop"]:
        if entry.get("loopStartSamples") != 0 or entry.get("loopEndSamples") != frames:
            errors.append(f'{entry["id"]}: loop sample points are invalid.')
        if abs(int(data[0]) - int(data[-1])) > 700:
            errors.append(f'{entry["id"]}: loop boundary may click.')


if {x["id"] for x in manifest["music"]} != expected_music:
    errors.append("Music inventory is incomplete.")
if {x["id"] for x in manifest["stingers"]} != expected_stingers:
    errors.append("Stinger inventory is incomplete.")
if {x["id"] for x in manifest["sfx"]} != expected_sfx:
    errors.append("SFX inventory is incomplete.")
for entry in manifest["music"]:
    validate_entry(entry, True)
for entry in manifest["stingers"]:
    validate_entry(entry, False)
for entry in manifest["sfx"]:
    validate_entry(entry, entry["id"] == "ball-roll-loop")
events = [x["event"] for group in (manifest["music"], manifest["stingers"], manifest["sfx"]) for x in group]
for required in ["loveOnTilt.profileRevealEarned", "loveOnTilt.profileRevealPresented", "session.gameOver", "ball.drained"]:
    if required not in events:
        errors.append(f"Critical event mapping missing: {required}.")
sprite = json.loads((ROOT / manifest["audioSprite"]["manifest"]).read_text())
if set(sprite["spritemap"]) != expected_sfx:
    errors.append("Audio sprite inventory does not match individual SFX.")
for cue_id, (offset, duration, _) in sprite["spritemap"].items():
    if offset < 0 or duration <= 0 or offset + duration > sprite["durationMs"] + 1:
        errors.append(f"{cue_id}: invalid audio sprite timing.")
subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1",
                str(ROOT / manifest["audioSprite"]["ogg"])], check=True, capture_output=True, text=True)
if manifest["originalComposition"] is not True:
    errors.append("Original-composition declaration is missing.")

if errors:
    raise SystemExit("\n".join(errors))
print(f'PASS: {len(manifest["music"])} music loops, {len(manifest["stingers"])} stingers, '
      f'{len(manifest["sfx"])} SFX, and the {manifest["audioSprite"]["cueCount"]}-cue audio sprite validated.')
