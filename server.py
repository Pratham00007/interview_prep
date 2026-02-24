"""
PrepEdge Voice Analysis Server
================================
Receives WAV files from the browser (HR interview recordings),
runs them through voice_analyzer.py, and returns a JSON report.

SETUP (run once):
  pip install flask flask-cors openai-whisper pandas numpy

HOW TO START:
  python server.py

Then open interview_prep_platform.html in your browser.
The browser will automatically send WAV recordings to this server.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import tempfile
import traceback
import json

# ──────────────────────────────────────────────
# Import your voice_analyzer — same folder assumed
# ──────────────────────────────────────────────
try:
    import voice_analyzer as va
    ANALYZER_AVAILABLE = True
    print("✅ voice_analyzer loaded successfully")
except ImportError as e:
    ANALYZER_AVAILABLE = False
    print(f"⚠️  voice_analyzer not found: {e}")
    print("    Place voice_analyzer.py in the same folder as server.py")

app = Flask(__name__)
CORS(app)   # Allow browser on any port to call this server

# ──────────────────────────────────────────────
# Health check endpoint
# ──────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "running",
        "analyzer_available": ANALYZER_AVAILABLE,
        "opensmile_exe": va.OPENSMILE_EXE if ANALYZER_AVAILABLE else "N/A",
        "opensmile_config": va.OPENSMILE_CONFIG if ANALYZER_AVAILABLE else "N/A",
    })

# ──────────────────────────────────────────────
# Main analysis endpoint
# ──────────────────────────────────────────────
@app.route("/analyze", methods=["POST"])
def analyze():
    # Validate request
    if "audio" not in request.files:
        return jsonify({"error": "No audio file sent. Send as form field 'audio'."}), 400

    audio_file = request.files["audio"]
    question_text = request.form.get("question", "Interview question")
    q_index = request.form.get("q_index", "0")

    print(f"\n📥 Received audio for Q{q_index}: {audio_file.filename} ({audio_file.content_type})")

    # Save WAV to a temp file
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
            audio_file.save(tmp_file.name)
            tmp = tmp_file.name
        
        print(f"   Saved to temp: {tmp} ({os.path.getsize(tmp)} bytes)")

        if not ANALYZER_AVAILABLE:
            # Return mock data so the website still works
            return jsonify(mock_result(question_text, q_index))

        # ── Run Whisper transcription ──────────────────────────
        result = {}
        whisper_ok = False
        try:
            text, filler_count, wpm, duration = va.run_whisper(tmp)
            result.update({
                "transcript": text,
                "filler_count": filler_count,
                "wpm": round(wpm, 1),
                "duration": round(duration, 1),
            })
            whisper_ok = True
            print(f"   ✅ Whisper: {len(text)} chars, {wpm:.1f} WPM")
        except Exception as e:
            print(f"   ⚠️  Whisper failed: {e}")
            result.update({
                "transcript": "[Transcription failed — check Whisper installation]",
                "filler_count": 0,
                "wpm": 0,
                "duration": 0,
                "whisper_error": str(e),
            })

        # ── Run openSMILE acoustic features ───────────────────
        acoustic_ok = False
        features = default_features()
        try:
            va.run_opensmile(tmp)
            features = va.extract_features()
            acoustic_ok = True
            print(f"   ✅ OpenSMILE: pitch={features['pitch_mean']:.1f}, jitter={features['jitter']:.4f}")
        except FileNotFoundError:
            print("   ⚠️  features.csv not created — openSMILE may have failed")
            print("       Check that OPENSMILE_EXE path in voice_analyzer.py is correct")
        except Exception as e:
            print(f"   ⚠️  OpenSMILE/extract failed: {e}")

        result["features"] = features
        result["acoustic_ok"] = acoustic_ok

        # ── Scoring ────────────────────────────────────────────
        filler_count = result.get("filler_count", 0)
        wpm = result.get("wpm", 0)
        score = va.generate_scores(filler_count, wpm, features) if whisper_ok else 50
        result["score"] = score

        # ── Suggestions ────────────────────────────────────────
        suggestions = build_suggestions(filler_count, wpm, features, score)
        result["suggestions"] = suggestions
        result["question"] = question_text
        result["q_index"] = q_index
        result["success"] = True

        print(f"   ✅ Score: {score}/100")
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "success": False,
            "score": 0,
            "transcript": "[Analysis crashed — check server console]",
            "features": default_features(),
            "suggestions": ["Analysis failed. Please try again."],
        }), 500

    finally:
        # Always clean up temp files
        if tmp and os.path.exists(tmp):
            os.remove(tmp)
        csv = va.OUTPUT_FILE if ANALYZER_AVAILABLE else "features.csv"
        if os.path.exists(csv):
            os.remove(csv)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
def default_features():
    return {
        "pitch_mean": 0.0,
        "pitch_std": 0.0,
        "jitter": 0.0,
        "shimmer": 0.0,
        "energy": 0.0,
        "hnr": 0.0,
    }


def build_suggestions(filler_count, wpm, features, score):
    tips = []
    if filler_count > 5:
        tips.append(f"You used {filler_count} filler words (um/uh/so/like). Practice pausing silently instead.")
    if wpm < 100 and wpm > 0:
        tips.append(f"Your pace ({wpm:.0f} WPM) is slow. Aim for 110–150 WPM to sound more confident.")
    if wpm > 170:
        tips.append(f"You spoke too fast ({wpm:.0f} WPM). Slow down to 110–150 WPM for clarity.")
    if features["jitter"] > 0.02:
        tips.append("High jitter detected — your voice wobbled. Try breathing exercises before speaking.")
    if features["shimmer"] > 0.35:
        tips.append("High shimmer — inconsistent volume. Practice speaking with steady breath support.")
    if features["pitch_std"] < 2 and features["pitch_std"] > 0:
        tips.append("Your pitch was very flat (monotone). Add vocal variation to keep listeners engaged.")
    if features["hnr"] < 10 and features["hnr"] != 0:
        tips.append("Low voice clarity (HNR). Speak in a quieter environment with better microphone placement.")
    if score > 85:
        tips.append("Excellent vocal delivery! Keep it up.")
    elif score > 70:
        tips.append("Good delivery overall. Focus on the areas above to polish further.")
    return tips if tips else ["Analysis complete. Keep practicing!"]


def mock_result(question, q_index):
    """Returns realistic-looking mock data when voice_analyzer isn't available"""
    import random
    score = random.randint(55, 92)
    wpm = random.uniform(105, 160)
    fillers = random.randint(0, 8)
    return {
        "success": True,
        "mock": True,
        "score": score,
        "transcript": "[voice_analyzer.py not found — install it to get real transcription]",
        "filler_count": fillers,
        "wpm": round(wpm, 1),
        "duration": round(random.uniform(30, 120), 1),
        "features": {
            "pitch_mean": round(random.uniform(100, 250), 1),
            "pitch_std": round(random.uniform(1, 15), 2),
            "jitter": round(random.uniform(0.005, 0.03), 4),
            "shimmer": round(random.uniform(0.1, 0.5), 4),
            "energy": round(random.uniform(0.5, 2.0), 2),
            "hnr": round(random.uniform(8, 25), 2),
        },
        "suggestions": [
            "Install voice_analyzer.py dependencies to get real analysis.",
            "pip install openai-whisper pandas numpy",
            "Also install openSMILE and set paths in voice_analyzer.py",
        ],
        "question": question,
        "q_index": q_index,
        "acoustic_ok": False,
    }


# ──────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "="*55)
    print("  PrepEdge Voice Analysis Server")
    print("="*55)
    print(f"  Status : {'✅ voice_analyzer ready' if ANALYZER_AVAILABLE else '⚠️  voice_analyzer NOT found'}")
    print(f"  URL    : http://localhost:5000")
    print(f"  Health : http://localhost:5000/health")
    print(f"  Analyze: POST http://localhost:5000/analyze")
    print("="*55)
    print("\n  Keep this window open while using PrepEdge.\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
