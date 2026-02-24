# PrepEdge Voice Analysis — Setup Guide
# ==========================================
# Follow these steps ONE TIME to connect your Python
# voice analyzer to the PrepEdge interview platform.

## WHAT YOU'LL HAVE AFTER SETUP
  Browser (interview_prep_platform.html)
       ↓  sends WAV recording
  server.py  (runs locally on port 5000)
       ↓  calls voice_analyzer.py
  voice_analyzer.py  (Whisper + openSMILE)
       ↓  returns JSON report
  Browser shows voice score card inside the HR interview


## FILES IN THIS FOLDER
  interview_prep_platform.html   ← open this in browser
  server.py                      ← the bridge (run this first)
  voice_analyzer.py              ← your analyzer (already modified)
  README_SETUP.md                ← this file


## STEP 1 — Install Python packages
Open Command Prompt / Terminal and run:

  pip install flask flask-cors openai-whisper pandas numpy torch

  Note: torch (PyTorch) is required by Whisper.
  If you have a GPU, install the CUDA version instead:
    pip install torch --index-url https://download.pytorch.org/whl/cu118


## STEP 2 — Check your openSMILE paths
Open voice_analyzer.py in Notepad/VS Code.
Find lines 16-17 and confirm the paths match your installation:

  OPENSMILE_EXE = r"F:\PRGRAMME\opensmile-3.0.2-windows-x86_64\...\SMILExtract.exe"
  OPENSMILE_CONFIG = r"F:\PRGRAMME\opensmile-3.0.2-windows-x86_64\...\GeMAPSv01a.conf"

  If openSMILE is not installed, download it from:
    https://github.com/audeering/opensmile/releases
  Then update the paths.

  If you skip openSMILE — that's fine! You'll still get:
    ✅ Whisper transcription
    ✅ WPM (words per minute)
    ✅ Filler word count
    ✅ Score (partial — without acoustic features)
  You'll just miss: Jitter, Shimmer, Pitch variation, HNR


## STEP 3 — Start the server
In Command Prompt / Terminal, navigate to this folder:

  cd C:\Users\YourName\Downloads\PrepEdge
  python server.py

You should see:
  ===================================================
    PrepEdge Voice Analysis Server
  ===================================================
    Status : ✅ voice_analyzer ready
    URL    : http://localhost:5000
  ===================================================
  * Running on http://0.0.0.0:5000

KEEP THIS WINDOW OPEN while using PrepEdge.


## STEP 4 — Open the website
Double-click   interview_prep_platform.html
(or drag it into Chrome / Edge / Firefox)

Go to any company → HR Interview → Record your answer.
After stopping recording, you'll see:
  🎙️ "Analyzing your voice..." loading state
  Then a Voice Analysis Card appears with:
    - Your transcript
    - Words per minute
    - Filler word count
    - Pitch, Jitter, Shimmer, HNR
    - Voice score out of 100
    - Personalized improvement tips


## WHAT HAPPENS IF SERVER IS NOT RUNNING?
The website works 100% normally.
Voice analysis card will show:
  "Voice analysis requires the local server.
   Run server.py to enable this feature."
All other features (AI questions, scoring, feedback) work fine.


## TROUBLESHOOTING

Problem: "flask not found"
  Fix: pip install flask flask-cors

Problem: "whisper not found"
  Fix: pip install openai-whisper

Problem: "openSMILE failed"
  Fix 1: Check the EXE path in voice_analyzer.py
  Fix 2: Right-click SMILExtract.exe → Properties → Unblock
  Fix 3: Voice analysis still works (just without acoustic features)

Problem: "CORS error in browser console"
  Fix: Make sure server.py is running (not just voice_analyzer.py)
  The server.py handles the CORS headers for browser access.

Problem: Whisper is slow on first run
  This is normal — Whisper downloads the model (~140MB) once.
  Subsequent runs are fast because the model is cached in memory.

Problem: "torch not found"
  Fix: pip install torch
  Or for GPU: pip install torch --index-url https://download.pytorch.org/whl/cu118


## CHECKING IF EVERYTHING WORKS
Open this URL in your browser while server.py is running:
  http://localhost:5000/health

You should see JSON like:
  {"status": "running", "analyzer_available": true, ...}


## FOLDER STRUCTURE (REQUIRED)
  PrepEdge/
    interview_prep_platform.html
    server.py
    voice_analyzer.py
    README_SETUP.md
