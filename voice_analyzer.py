"""
voice_analyzer.py
==================
Analyzes audio files for interview performance.
Used by server.py — do NOT change function signatures.

SETUP:
  pip install openai-whisper pandas numpy matplotlib

Also install openSMILE from:
  https://github.com/audeering/opensmile/releases
Then update OPENSMILE_EXE and OPENSMILE_CONFIG paths below.
"""

import whisper
import subprocess
import pandas as pd
import numpy as np
import os
import sys

OPENSMILE_EXE = r"F:\PRGRAMME\opensmile-3.0.2-windows-x86_64\opensmile-3.0.2-windows-x86_64\bin\SMILExtract.exe"
OPENSMILE_CONFIG = r"F:\PRGRAMME\opensmile-3.0.2-windows-x86_64\opensmile-3.0.2-windows-x86_64\config\gemaps\v01a\GeMAPSv01a.conf"
OUTPUT_FILE = "features.csv"

_whisper_model = None


def _get_model():
    global _whisper_model
    if _whisper_model is None:
        print("  Loading Whisper model (first time only)...")
        _whisper_model = whisper.load_model("base")
    return _whisper_model


def run_whisper(audio_file):
    """Transcribe audio and extract speech metrics."""
    model = _get_model()
    result = model.transcribe(audio_file, language="en")

    text = result["text"].strip()
    segments = result.get("segments", [])

    if not segments:
        raise ValueError("Whisper returned no segments — audio may be silent or too short.")

    fillers = {"um", "uh", "so", "like", "basically", "actually", "literally", "right"}
    words = text.lower().split()
    filler_count = sum(1 for w in words if w.rstrip(".,?!") in fillers)

    duration = segments[-1]["end"]
    if duration < 1:
        raise ValueError("Audio is too short (< 1 second).")

    word_count = len(words)
    wpm = word_count / (duration / 60) if duration > 0 else 0

    return text, filler_count, wpm, duration


def run_opensmile(audio_file):
    """Extract acoustic features using openSMILE."""
    if not os.path.exists(OPENSMILE_EXE):
        raise FileNotFoundError(
            f"openSMILE not found at: {OPENSMILE_EXE}\n"
            "Please update OPENSMILE_EXE in voice_analyzer.py"
        )
    if not os.path.exists(OPENSMILE_CONFIG):
        raise FileNotFoundError(
            f"openSMILE config not found at: {OPENSMILE_CONFIG}\n"
            "Please update OPENSMILE_CONFIG in voice_analyzer.py"
        )

    # Remove stale output file
    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)

    result = subprocess.run(
        [OPENSMILE_EXE, "-C", OPENSMILE_CONFIG, "-I", audio_file, "-csvoutput", OUTPUT_FILE],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=60
    )

    if result.returncode != 0:
        raise RuntimeError(f"openSMILE failed (code {result.returncode}): {result.stderr.decode()[:300]}")

    if not os.path.exists(OUTPUT_FILE):
        raise FileNotFoundError("openSMILE ran but did not create features.csv")


def extract_features():
    """Parse the CSV file created by openSMILE."""
    if not os.path.exists(OUTPUT_FILE):
        raise FileNotFoundError("features.csv not found. Run run_opensmile() first.")

    df = pd.read_csv(OUTPUT_FILE, sep=";")
    cols = df.columns.tolist()

    def find_col(keywords_all, keywords_any):
        """Find a column that has ALL keywords_all and ANY of keywords_any."""
        for c in cols:
            cl = c.lower()
            if all(k.lower() in cl for k in keywords_all):
                if any(k.lower() in cl for k in keywords_any):
                    return c
        return None

    def safe_float(col_name, default=0.0):
        if col_name and col_name in df.columns:
            val = df[col_name].iloc[0]
            return float(val) if pd.notna(val) else default
        return default

    pitch_mean_col = find_col(["F0"], ["mean"])
    pitch_std_col = find_col(["F0"], ["std", "stddev", "sd"])
    jitter_col = find_col(["jitter"], ["mean", ""])
    shimmer_col = find_col(["shimmer"], ["mean", ""])
    energy_col = find_col(["loudness"], ["mean", ""])
    hnr_col = find_col(["hnr"], ["mean", ""])

    # Fallback: search more broadly
    if not jitter_col:
        jitter_col = next((c for c in cols if "jitter" in c.lower()), None)
    if not shimmer_col:
        shimmer_col = next((c for c in cols if "shimmer" in c.lower()), None)
    if not energy_col:
        energy_col = next((c for c in cols if "loudness" in c.lower()), None)
    if not hnr_col:
        hnr_col = next((c for c in cols if "hnr" in c.lower()), None)

    return {
        "pitch_mean": safe_float(pitch_mean_col),
        "pitch_std": safe_float(pitch_std_col),
        "jitter": safe_float(jitter_col),
        "shimmer": safe_float(shimmer_col),
        "energy": safe_float(energy_col),
        "hnr": safe_float(hnr_col),
    }


def generate_scores(filler_count, wpm, features):
    """Calculate interview voice score out of 100."""
    score = 100

    # Speech pace
    if wpm > 0:
        if wpm < 100:
            score -= 10    # too slow
        elif wpm > 170:
            score -= 5     # too fast

    # Filler words
    if filler_count > 10:
        score -= 15
    elif filler_count > 5:
        score -= 8
    elif filler_count > 2:
        score -= 3

    # Voice quality (only penalize if acoustic analysis ran)
    if features.get("jitter", 0) > 0:
        if features["jitter"] > 0.02:
            score -= 15    # very unstable voice
        elif features["jitter"] > 0.01:
            score -= 7

    if features.get("shimmer", 0) > 0:
        if features["shimmer"] > 0.35:
            score -= 10
        elif features["shimmer"] > 0.2:
            score -= 5

    if features.get("pitch_std", 0) > 0 and features["pitch_std"] < 2:
        score -= 10        # monotone delivery

    if features.get("hnr", 0) > 0 and features["hnr"] < 10:
        score -= 5         # noisy/unclear voice

    return max(0, min(score, 100))


# ── CLI mode (original usage preserved) ─────────────────────
def main(audio_file):
    import matplotlib.pyplot as plt

    print("Transcribing with Whisper...")
    text, filler_count, wpm, duration = run_whisper(audio_file)

    print("Extracting acoustic features with openSMILE...")
    try:
        run_opensmile(audio_file)
        features = extract_features()
    except Exception as e:
        print(f"Warning: acoustic analysis failed ({e}). Using defaults.")
        features = {"pitch_mean":0, "pitch_std":0, "jitter":0, "shimmer":0, "energy":0, "hnr":0}

    score = generate_scores(filler_count, wpm, features)

    # Print report
    print("\n" + "="*60)
    print("  INTERVIEW PERFORMANCE REPORT")
    print("="*60)
    print(f"\nTranscript:\n{text}")
    print(f"\nSpeech Metrics")
    print(f"  Duration   : {duration:.2f} sec")
    print(f"  WPM        : {wpm:.1f}")
    print(f"  Filler words: {filler_count}")
    print(f"\nAcoustic Metrics")
    print(f"  Pitch Mean  : {features['pitch_mean']:.2f}")
    print(f"  Pitch StdDev: {features['pitch_std']:.2f}")
    print(f"  Jitter      : {features['jitter']:.4f}")
    print(f"  Shimmer     : {features['shimmer']:.4f}")
    print(f"  Energy      : {features['energy']:.2f}")
    print(f"  HNR         : {features['hnr']:.2f}")
    print(f"\n🏆 Overall Score: {score}/100")

    print("\n💡 Suggestions:")
    if filler_count > 5:   print("  - Reduce filler words (um, uh, so, like)")
    if wpm < 100:          print("  - Speak slightly faster (aim 110–150 WPM)")
    if wpm > 170:          print("  - Slow down for clarity")
    if features["jitter"] > 0.02: print("  - Work on vocal stability (breathing exercises)")
    if features["pitch_std"] < 2: print("  - Add more vocal variation to avoid sounding monotone")
    if score > 80:         print("  - Excellent performance overall!")
    print("="*60)

    # Graphs
    labels = ["Pitch Var", "Jitter", "Shimmer", "Energy", "HNR"]
    values = [features["pitch_std"], features["jitter"], features["shimmer"],
              features["energy"], features["hnr"]]
    plt.figure(figsize=(10, 5))
    plt.bar(labels, values)
    plt.title("Voice Feature Overview")
    plt.tight_layout()
    plt.show()

    plt.figure(figsize=(6, 6))
    plt.pie([score, 100-score], labels=["Score", "Lost"], autopct="%1.1f%%",
            colors=["#22c55e", "#ef4444"])
    plt.title("Overall Interview Score")
    plt.tight_layout()
    plt.show()

    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python voice_analyzer.py answer.wav")
    else:
        main(sys.argv[1])
