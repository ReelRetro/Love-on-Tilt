#!/usr/bin/env python3
"""Build the original Love on Tilt NES-style music and sound package."""

from __future__ import annotations

import json
import math
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "audio"
SR = 44_100
RNG = np.random.default_rng(1986)
OGG_QUALITY = "5"


def midi(note: float) -> float:
    return 440.0 * 2.0 ** ((note - 69.0) / 12.0)


def osc(kind: str, freq: float | np.ndarray, duration: float, duty: float = 0.5,
        vibrato: float = 0.0, vibrato_rate: float = 5.5) -> np.ndarray:
    count = len(freq) if isinstance(freq, np.ndarray) else max(1, int(round(duration * SR)))
    t = np.arange(count, dtype=np.float64) / SR
    f = np.asarray(freq) if isinstance(freq, np.ndarray) else freq * (1.0 + vibrato * np.sin(2 * np.pi * vibrato_rate * t))
    phase = np.cumsum(np.broadcast_to(f, count)) / SR
    if kind == "pulse":
        return np.where((phase % 1.0) < duty, 1.0, -1.0)
    if kind == "triangle":
        return 2.0 * np.abs(2.0 * (phase % 1.0) - 1.0) - 1.0
    if kind == "saw":
        return 2.0 * (phase % 1.0) - 1.0
    return np.sin(2 * np.pi * phase)


def envelope(count: int, attack: float = 0.005, decay: float = 0.04,
             sustain: float = 0.7, release: float = 0.05) -> np.ndarray:
    a = min(count, int(attack * SR))
    d = min(count - a, int(decay * SR))
    r = min(count - a - d, int(release * SR))
    s = count - a - d - r
    parts = []
    if a:
        parts.append(np.linspace(0.0, 1.0, a, endpoint=False))
    if d:
        parts.append(np.linspace(1.0, sustain, d, endpoint=False))
    if s:
        parts.append(np.full(s, sustain))
    if r:
        parts.append(np.linspace(sustain, 0.0, r, endpoint=True))
    return np.concatenate(parts) if parts else np.zeros(count)


def note(note_number: float, duration: float, kind: str = "pulse", duty: float = 0.5,
         gain: float = 1.0, vibrato: float = 0.0, sustain: float = 0.65) -> np.ndarray:
    tone = osc(kind, midi(note_number), duration, duty=duty, vibrato=vibrato)
    return tone * envelope(len(tone), attack=0.004, decay=0.035, sustain=sustain,
                           release=min(0.06, duration * 0.25)) * gain


def add(buffer: np.ndarray, sound: np.ndarray, start: float) -> None:
    index = max(0, int(round(start * SR)))
    if index >= len(buffer):
        return
    end = min(len(buffer), index + len(sound))
    buffer[index:end] += sound[:end - index]


def kick(duration: float = 0.16, gain: float = 0.75) -> np.ndarray:
    count = int(duration * SR)
    t = np.arange(count) / SR
    freq = 145.0 * np.exp(-t * 25.0) + 43.0
    body = osc("sine", freq, duration)
    click = RNG.normal(0, 1, count) * np.exp(-t * 70.0)
    result = (0.92 * body + 0.08 * click) * np.exp(-t * 19.0) * gain
    result[:max(1, int(0.001 * SR))] *= np.linspace(0.0, 1.0, max(1, int(0.001 * SR)))
    return result


def snare(duration: float = 0.14, gain: float = 0.48) -> np.ndarray:
    count = int(duration * SR)
    t = np.arange(count) / SR
    noise = RNG.choice([-1.0, 1.0], count)
    body = osc("triangle", 175.0, duration)
    return (0.78 * noise + 0.22 * body) * np.exp(-t * 25.0) * gain


def hat(duration: float = 0.045, gain: float = 0.13) -> np.ndarray:
    count = int(duration * SR)
    t = np.arange(count) / SR
    noise = RNG.choice([-1.0, 1.0], count)
    return np.concatenate(([0.0], np.diff(noise))) * np.exp(-t * 72.0) * gain


def normalize(signal: np.ndarray, peak: float) -> np.ndarray:
    maximum = float(np.max(np.abs(signal))) if len(signal) else 0.0
    return signal if maximum == 0 else signal * (peak / maximum)


def soft_clip(signal: np.ndarray) -> np.ndarray:
    return np.tanh(signal * 1.08) / np.tanh(1.08)


def write_wav(path: Path, signal: np.ndarray, peak: float = 0.78) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    final = normalize(soft_clip(signal), peak)
    pcm = np.round(np.clip(final, -1, 1) * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SR)
        output.writeframes(pcm.tobytes())
    return {
        "durationMs": round(len(pcm) * 1000 / SR, 3),
        "sampleCount": len(pcm),
        "peakDbfs": round(20 * math.log10(max(np.max(np.abs(pcm)) / 32767.0, 1e-9)), 2),
    }


def encode_ogg(wav_path: Path, ogg_path: Path) -> None:
    ogg_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(wav_path), "-ac", "1", "-ar", str(SR),
        "-c:a", "libvorbis", "-q:a", OGG_QUALITY, str(ogg_path),
    ], check=True)


SONGS = [
    {
        "id": "title-theme", "title": "Ready for Love", "bpm": 128, "bars": 16,
        "root": 52, "mode": [0, 2, 3, 5, 7, 8, 10],
        "progression": [0, 5, 3, 6],
        "lead": [0, 2, 4, 2, 5, 4, 2, None, 0, 2, 4, 6, 5, 4, 2, 1],
        "duty": 0.25, "event": "shell.title", "gainDb": -13,
    },
    {
        "id": "table-for-two", "title": "Reservation for Two", "bpm": 132, "bars": 16,
        "root": 53, "mode": [0, 2, 4, 5, 7, 9, 11],
        "progression": [0, 3, 5, 4],
        "lead": [0, 2, 4, 5, 4, 2, 1, None, 2, 4, 6, 4, 5, 4, 2, 0],
        "duty": 0.5, "event": "table.table-for-two.active", "gainDb": -14,
    },
    {
        "id": "reel-romance", "title": "Meet Cute Matinee", "bpm": 136, "bars": 16,
        "root": 57, "mode": [0, 2, 3, 5, 7, 8, 10],
        "progression": [0, 3, 6, 4],
        "lead": [0, 4, 2, 5, 4, 2, 6, None, 0, 2, 3, 5, 7, 5, 3, 2],
        "duty": 0.375, "event": "table.reel-romance.active", "gainDb": -14,
    },
    {
        "id": "bad-date-ghosted", "title": "Ghosted After Midnight", "bpm": 120, "bars": 16,
        "root": 50, "mode": [0, 2, 3, 5, 7, 8, 11],
        "progression": [0, 5, 1, 6],
        "lead": [0, 2, 1, 5, 4, 2, 6, None, 0, 1, 2, 5, 6, 5, 2, 1],
        "duty": 0.125, "event": "table.bad-date-ghosted.active", "gainDb": -14,
    },
    {
        "id": "double-date-multiball", "title": "Four Hearts Frenzy", "bpm": 150, "bars": 8,
        "root": 52, "mode": [0, 2, 3, 5, 7, 8, 10],
        "progression": [0, 5, 3, 6],
        "lead": [0, 2, 4, 6, 5, 4, 2, 1, 0, 4, 2, 6, 5, 2, 4, 1],
        "duty": 0.25, "event": "mode.double-date-multiball.active", "gainDb": -12,
    },
]


def scale_note(root: int, degree: int, scale: list[int], octave: int = 0) -> int:
    return root + scale[degree % 7] + 12 * (degree // 7 + octave)


def render_song(spec: dict) -> np.ndarray:
    beat = 60.0 / spec["bpm"]
    duration = spec["bars"] * 4 * beat
    mix = np.zeros(int(round(duration * SR)))
    scale = spec["mode"]
    for bar in range(spec["bars"]):
        start = bar * 4 * beat
        degree = spec["progression"][bar % len(spec["progression"])]
        chord = [degree, degree + 2, degree + 4]
        # Triangle bass with a small walking pickup.
        for b, offset in [(0.0, 0), (1.5, 0), (2.0, 4), (3.0, 2)]:
            n = scale_note(spec["root"] - 24, degree + offset, scale)
            add(mix, note(n, beat * 0.72, "triangle", gain=0.27, sustain=0.8), start + b * beat)
        # Pulse arpeggio keeps the texture unmistakably 8-bit.
        for eighth in range(8):
            n = scale_note(spec["root"] - 12, chord[(eighth + bar) % 3], scale)
            add(mix, note(n, beat * 0.37, "pulse", duty=0.125, gain=0.12, sustain=0.55), start + eighth * beat / 2)
        # Two-bar lead phrase, varied by octave and cadence in the second half.
        phrase_offset = (bar % 2) * 8
        for eighth in range(8):
            value = spec["lead"][(phrase_offset + eighth) % len(spec["lead"])]
            if value is None:
                continue
            octave = 1 if bar >= spec["bars"] // 2 and eighth in (2, 6) else 0
            n = scale_note(spec["root"] + 12, value, scale, octave)
            add(mix, note(n, beat * 0.41, "pulse", duty=spec["duty"], gain=0.24,
                          vibrato=0.002 if spec["id"] != "bad-date-ghosted" else 0.006),
                start + eighth * beat / 2)
        # Original percussion pattern, busier for multiball.
        for b in (0.0, 2.0) + ((3.5,) if spec["id"] == "double-date-multiball" else ()):
            add(mix, kick(gain=0.55), start + b * beat)
        for b in (1.0, 3.0):
            add(mix, snare(gain=0.38), start + b * beat)
        for eighth in range(8):
            add(mix, hat(gain=0.09 if eighth % 2 else 0.07), start + eighth * beat / 2)
    # A quiet one-eighth echo adds size while retaining a dry NES presentation.
    delay = int(round(beat * 0.5 * SR))
    echoed = mix.copy()
    echoed[delay:] += mix[:-delay] * 0.11
    return echoed


def tone_sweep(start_hz: float, end_hz: float, duration: float, kind: str = "pulse",
               gain: float = 1.0, duty: float = 0.5, curve: float = 1.0) -> np.ndarray:
    count = int(duration * SR)
    x = np.linspace(0.0, 1.0, count)
    freq = start_hz + (end_hz - start_hz) * x ** curve
    sound = osc(kind, freq, duration, duty=duty)
    return sound * envelope(count, attack=0.002, decay=duration * 0.2, sustain=0.62,
                            release=duration * 0.35) * gain


def noise_burst(duration: float, decay: float = 20.0, gain: float = 1.0) -> np.ndarray:
    count = int(duration * SR)
    t = np.arange(count) / SR
    return RNG.choice([-1.0, 1.0], count) * np.exp(-t * decay) * gain


def sequence(notes: list[int | tuple[int, float] | None], step: float = 0.11,
             kind: str = "pulse", duty: float = 0.25, gain: float = 0.65) -> np.ndarray:
    total = step * len(notes) + 0.12
    result = np.zeros(int(total * SR))
    for i, item in enumerate(notes):
        if item is None:
            continue
        pitch, length = item if isinstance(item, tuple) else (item, step * 0.88)
        add(result, note(pitch, length, kind, duty=duty, gain=gain), i * step)
    return result


def chord(notes: list[int], duration: float = 0.5, duty: float = 0.25, gain: float = 0.35) -> np.ndarray:
    result = np.zeros(int(duration * SR))
    for n in notes:
        result[:len(result)] += note(n, duration, "pulse", duty=duty, gain=gain)[:len(result)]
    return result


def make_stingers() -> dict[str, np.ndarray]:
    mode = sequence([64, 67, 71, 76], 0.105, gain=0.55)
    reveal = np.zeros(int(2.05 * SR))
    add(reveal, sequence([64, 68, 71, 76, 80], 0.14, duty=0.25, gain=0.62), 0)
    add(reveal, chord([64, 68, 71, 76], 1.0, gain=0.17), 0.72)
    add(reveal, tone_sweep(900, 1700, 0.35, "triangle", 0.18), 0.42)
    complete = np.zeros(int(2.4 * SR))
    add(complete, sequence([60, 64, 67, 72, 76, 79, 84], 0.12, gain=0.55), 0)
    add(complete, chord([72, 76, 79, 84], 1.2, gain=0.16), 0.9)
    over = np.zeros(int(2.2 * SR))
    add(over, sequence([62, 61, 58, 55, 50], 0.22, duty=0.125, gain=0.45), 0)
    add(over, tone_sweep(140, 52, 0.85, "triangle", 0.35), 0.75)
    return {"mode-start": mode, "profile-reveal": reveal,
            "session-complete": complete, "game-over": over}


def make_sfx() -> dict[str, np.ndarray]:
    sounds: dict[str, np.ndarray] = {}
    sounds["flipper-up"] = tone_sweep(125, 310, 0.105, "triangle", 0.75) + noise_burst(0.105, 35, 0.22)
    sounds["flipper-down"] = tone_sweep(260, 105, 0.12, "triangle", 0.66) + noise_burst(0.12, 30, 0.18)
    sounds["plunger-pull"] = tone_sweep(165, 72, 0.48, "saw", 0.35, curve=0.7) + noise_burst(0.48, 6, 0.10)
    sounds["plunger-release"] = tone_sweep(110, 510, 0.18, "triangle", 0.72) + noise_burst(0.18, 24, 0.18)
    launch = np.zeros(int(0.48 * SR)); add(launch, noise_burst(0.16, 18, 0.42), 0); add(launch, tone_sweep(130, 920, 0.42, "triangle", 0.62), 0.03)
    sounds["ball-launch"] = launch
    roll_count = int(1.2 * SR)
    base = RNG.normal(0, 1, roll_count // 4)
    roll = np.tile(base, 4)
    roll = sum(np.roll(roll, shift) for shift in range(-17, 18)) / 35
    roll *= 0.28 * (0.78 + 0.22 * np.sin(2 * np.pi * 10 * np.arange(len(roll)) / SR))
    roll[-1] = roll[0]
    sounds["ball-roll-loop"] = roll
    sounds["wall-hit"] = tone_sweep(720, 330, 0.11, "triangle", 0.65) + noise_burst(0.11, 38, 0.16)
    for i, (a, b) in enumerate([(500, 1050), (620, 1320), (760, 1580)], 1):
        sounds[f"bumper-hit-{i}"] = tone_sweep(a, b, 0.16, "pulse", 0.66, duty=0.25) + tone_sweep(a/2, b/2, 0.16, "triangle", 0.22)
    sounds["target-hit"] = tone_sweep(930, 620, 0.095, "pulse", 0.7, duty=0.125) + noise_burst(0.095, 45, 0.2)
    sounds["target-bank-complete"] = sequence([67, 71, 74, 79], 0.085, gain=0.62)
    sounds["slingshot-hit"] = tone_sweep(310, 1260, 0.13, "pulse", 0.68, duty=0.125, curve=0.45)
    sounds["ball-save"] = sequence([60, 64, 67, 72], 0.09, duty=0.25, gain=0.58)
    sounds["extra-ball"] = sequence([64, 67, 71, 76, 83], 0.10, duty=0.5, gain=0.58)
    for pct, pitches in [(25, [60, 64]), (50, [60, 64, 67]), (75, [60, 65, 69, 72]), (100, [60, 64, 67, 72, 76])]:
        sounds[f"chemistry-{pct}"] = sequence(pitches, 0.075 if pct < 100 else 0.09, gain=0.52)
    multi = np.zeros(int(1.1 * SR)); add(multi, sequence([52, 59, 64, 67, 71, 76], 0.075, gain=0.62), 0); add(multi, noise_burst(0.6, 4, 0.16), 0.22); sounds["multiball-start"] = multi
    jackpot = np.zeros(int(1.25 * SR)); add(jackpot, sequence([60, 64, 67, 72, 79], 0.09, gain=0.62), 0); add(jackpot, chord([72, 76, 79], 0.68, gain=0.22), 0.5); sounds["jackpot"] = jackpot
    super_j = np.zeros(int(1.7 * SR)); add(super_j, sequence([60, 64, 67, 72, 76, 79, 84], 0.085, gain=0.64), 0); add(super_j, chord([72, 76, 79, 84], 0.9, gain=0.18), 0.7); sounds["super-jackpot"] = super_j
    sounds["heart-collect"] = sequence([69, 73, 76], 0.075, duty=0.25, gain=0.58)
    door = np.zeros(int(0.85 * SR)); add(door, tone_sweep(82, 155, 0.72, "saw", 0.32), 0); add(door, noise_burst(0.72, 3.8, 0.13), 0); add(door, sequence([52, 59, 64], 0.08, gain=0.38), 0.58); sounds["profile-door-open"] = door
    sounds["profile-reveal"] = sequence([64, 68, 71, 76, 80], 0.09, gain=0.6)
    drain = np.zeros(int(0.82 * SR)); add(drain, tone_sweep(310, 58, 0.72, "triangle", 0.6, curve=1.7), 0); add(drain, noise_burst(0.22, 16, 0.18), 0); sounds["ball-drain"] = drain
    sounds["tally-tick"] = tone_sweep(980, 1250, 0.045, "pulse", 0.6, duty=0.125)
    sounds["achievement"] = sequence([67, 72, 76, 79], 0.085, gain=0.55)
    warning = np.zeros(int(0.55 * SR)); add(warning, tone_sweep(180, 240, 0.22, "pulse", 0.55, duty=0.5), 0); add(warning, tone_sweep(180, 240, 0.22, "pulse", 0.55, duty=0.5), 0.3); sounds["tilt-warning"] = warning
    tilt = np.zeros(int(0.9 * SR)); add(tilt, tone_sweep(150, 47, 0.82, "saw", 0.56), 0); add(tilt, noise_burst(0.5, 4, 0.28), 0); sounds["tilt"] = tilt
    sounds["ui-select"] = sequence([72, 79], 0.055, duty=0.25, gain=0.48)
    sounds["ui-back"] = sequence([67, 60], 0.07, duty=0.125, gain=0.45)
    return sounds


SFX_EVENTS = {
    "flipper-up": "input.flipper.press", "flipper-down": "input.flipper.release",
    "plunger-pull": "input.plunger.hold", "plunger-release": "input.plunger.release",
    "ball-launch": "ball.launch", "ball-roll-loop": "ball.rolling",
    "wall-hit": "ball.wallHit", "bumper-hit-1": "bumper.hit.variant1",
    "bumper-hit-2": "bumper.hit.variant2", "bumper-hit-3": "bumper.hit.variant3",
    "target-hit": "target.hit", "target-bank-complete": "target.bankComplete",
    "slingshot-hit": "slingshot.hit", "ball-save": "ballSave.triggered",
    "extra-ball": "extraBall.awarded", "chemistry-25": "chemistry.threshold25",
    "chemistry-50": "chemistry.threshold50", "chemistry-75": "chemistry.threshold75",
    "chemistry-100": "chemistry.threshold100", "multiball-start": "multiball.started",
    "jackpot": "jackpot.awarded", "super-jackpot": "superJackpot.awarded",
    "heart-collect": "heart.collected", "profile-door-open": "profileDoor.opened",
    "profile-reveal": "loveOnTilt.profileRevealEarned", "ball-drain": "ball.drained",
    "tally-tick": "bonus.tallyTick", "achievement": "sessionAchievement.shown",
    "tilt-warning": "tilt.warning", "tilt": "tilt.triggered",
    "ui-select": "ui.select", "ui-back": "ui.back",
}


def preview_waveforms(waves: list[tuple[str, np.ndarray]], output: Path) -> None:
    width, row_h = 1600, 120
    height = 100 + row_h * len(waves)
    image = Image.new("RGB", (width, height), "#070616")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    draw.text((40, 28), "LOVE ON TILT — ORIGINAL AUDIO CUE SHEET", fill="#ff3dac", font=font)
    for row, (label, signal) in enumerate(waves):
        top = 82 + row * row_h
        draw.rounded_rectangle((32, top, width - 32, top + row_h - 18), 10, fill="#0d1835", outline="#15e5ff", width=2)
        draw.text((50, top + 12), label.upper(), fill="#fff16b", font=font)
        center = top + 67
        usable = width - 300
        chunk = max(1, len(signal) // usable)
        reduced = np.max(np.abs(signal[:usable * chunk].reshape(-1, chunk)), axis=1) if len(signal) >= usable else np.abs(signal)
        for x, amp in enumerate(reduced[:usable]):
            span = int(float(amp) * 30)
            draw.line((250 + x, center - span, 250 + x, center + span), fill="#ff3dac")
        draw.line((250, center, width - 50, center), fill="#344a78")
        draw.text((50, top + 58), f"{len(signal)/SR:.2f}s", fill="#d7e7ff", font=font)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)


def main() -> None:
    if AUDIO.exists():
        shutil.rmtree(AUDIO)
    manifest = {
        "schema": "love-on-tilt/audio-manifest@1",
        "version": "1.0.0",
        "originalComposition": True,
        "licenseNote": "Original procedural compositions and sound designs made for Love on Tilt; no sampled or imitated commercial game music.",
        "format": {"sampleRate": SR, "channels": 1, "bitDepth": 16, "master": "wav-pcm", "runtime": "ogg-vorbis"},
        "music": [], "stingers": [], "sfx": [],
        "mix": {
            "musicBusGainDb": -13, "sfxBusGainDb": -6, "stingerBusGainDb": -4,
            "maxSfxVoices": 12, "bumperVariantMode": "round-robin",
            "profileRevealMusicDuckDb": -6, "duckAttackMs": 80, "duckReleaseMs": 650,
            "masterLimiterCeilingDbfs": -1,
        },
        "priority": {"profileReveal": 100, "sessionOutcome": 90, "jackpot": 80, "gameplay": 50, "rollingLoop": 10},
        "accessibility": {"musicMuteIndependent": True, "sfxMuteIndependent": True, "hapticsCanMirrorCriticalSfx": True},
    }
    preview_items = []
    for spec in SONGS:
        signal = render_song(spec)
        wav = AUDIO / "music" / "wav" / f'{spec["id"]}.wav'
        ogg = AUDIO / "music" / "ogg" / f'{spec["id"]}.ogg'
        info = write_wav(wav, signal, peak=0.70)
        encode_ogg(wav, ogg)
        manifest["music"].append({
            "id": spec["id"], "title": spec["title"], "event": spec["event"], "bpm": spec["bpm"],
            "wav": wav.relative_to(ROOT).as_posix(), "ogg": ogg.relative_to(ROOT).as_posix(),
            **info, "loop": True, "loopStartSamples": 0, "loopEndSamples": info["sampleCount"],
            "defaultGainDb": spec["gainDb"],
        })
        preview_items.append((spec["id"], signal))
    stingers = make_stingers()
    stinger_events = {"mode-start": "mode.started", "profile-reveal": "loveOnTilt.profileRevealPresented",
                      "session-complete": "session.completed", "game-over": "session.gameOver"}
    for cue_id, signal in stingers.items():
        wav = AUDIO / "stingers" / "wav" / f"{cue_id}.wav"
        ogg = AUDIO / "stingers" / "ogg" / f"{cue_id}.ogg"
        info = write_wav(wav, signal, peak=0.82); encode_ogg(wav, ogg)
        manifest["stingers"].append({"id": cue_id, "event": stinger_events[cue_id],
            "wav": wav.relative_to(ROOT).as_posix(), "ogg": ogg.relative_to(ROOT).as_posix(),
            **info, "loop": False, "defaultGainDb": -4})
    sfx = make_sfx()
    for cue_id, signal in sfx.items():
        wav = AUDIO / "sfx" / "wav" / f"{cue_id}.wav"
        ogg = AUDIO / "sfx" / "ogg" / f"{cue_id}.ogg"
        info = write_wav(wav, signal, peak=0.88); encode_ogg(wav, ogg)
        is_loop = cue_id == "ball-roll-loop"
        manifest["sfx"].append({"id": cue_id, "event": SFX_EVENTS[cue_id],
            "wav": wav.relative_to(ROOT).as_posix(), "ogg": ogg.relative_to(ROOT).as_posix(),
            **info, "loop": is_loop, "loopStartSamples": 0 if is_loop else None,
            "loopEndSamples": info["sampleCount"] if is_loop else None,
            "defaultGainDb": -12 if is_loop else -6})
    # Runtime audio sprite: every SFX cue with a deterministic 100 ms safety gap.
    gap = np.zeros(int(0.1 * SR))
    sprite_parts = []
    sprite_map = {}
    cursor = 0
    for cue_id, signal in sfx.items():
        rendered = normalize(soft_clip(signal), 0.88)
        start_ms = cursor * 1000 / SR
        sprite_parts.extend([rendered, gap])
        cursor += len(rendered) + len(gap)
        sprite_map[cue_id] = [round(start_ms, 3), round(len(rendered) * 1000 / SR, 3), cue_id == "ball-roll-loop"]
    sprite = np.concatenate(sprite_parts)
    sprite_wav = AUDIO / "sfx" / "audio-sprite.wav"
    sprite_ogg = AUDIO / "sfx" / "audio-sprite.ogg"
    sprite_info = write_wav(sprite_wav, sprite, peak=0.88); encode_ogg(sprite_wav, sprite_ogg)
    sprite_json = AUDIO / "sfx" / "audio-sprite.json"
    sprite_json.write_text(json.dumps({"schema": "love-on-tilt/audio-sprite@1", "spritemap": sprite_map,
                                       "durationMs": sprite_info["durationMs"], "gapMs": 100,
                                       "urls": ["audio-sprite.ogg", "audio-sprite.wav"]}, indent=2) + "\n")
    manifest["audioSprite"] = {"wav": sprite_wav.relative_to(ROOT).as_posix(),
        "ogg": sprite_ogg.relative_to(ROOT).as_posix(), "manifest": sprite_json.relative_to(ROOT).as_posix(),
        "cueCount": len(sfx), **sprite_info}
    (AUDIO / "audio-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    preview_waveforms(preview_items, ROOT / "previews" / "audio-cue-sheet.png")
    print(f'Built {len(SONGS)} music loops, {len(stingers)} stingers, and {len(sfx)} SFX in WAV and OGG.')


if __name__ == "__main__":
    main()
