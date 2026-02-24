# PrepEdge – AI Interview Platform


![gif](
https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3Z2d0dXc0eGprdnJreTJvY3ZnanY1YXlwajlzeHB6d3A0dnI4MGFldiZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/wN3YfVc4C16px3yqcw/giphy.gif
)

So here's the thing about interview prep – most platforms just throw questions at you and call it a day. But when you're sitting in that actual interview room, it's not just about *what* you say, it's about *how* you say it. That's where PrepEdge comes in.

This is a full-stack interview preparation platform that simulates real interview environments. You get asked questions by an AI HR avatar that actually speaks to you (yeah, it talks), you record your answers in WAV format, and then the magic happens – our voice analysis engine tears apart your response and gives you brutally honest feedback.

## What's the Big Deal?

Most interview prep tools are basically fancy flashcard apps. PrepEdge is different because it listens to you. Literally.

When you record your answer, we don't just transcribe what you said. We analyze:
- **Your pacing** – Are you rushing through nervous energy or speaking at a natural pace?
- **Filler words** – Every "um", "uh", "like", and "basically" gets counted
- **Confidence metrics** – Pitch variation, energy levels, voice quality
- **Speech clarity** – Words per minute, pauses, articulation

Then we feed all of that into Gemini AI to generate personalized feedback. It's like having a speech coach and an interview expert rolled into one.



### The Voice Analysis Pipeline

Here's what happens after you hit that "Stop Recording" button:

1. Your browser captures audio as WAV (high quality, no compression artifacts)
2. The audio gets sent to our Flask backend server
3. **Whisper AI** transcribes your speech and extracts basic metrics
4. **openSMILE** runs acoustic analysis (this is the same tool used in emotion recognition research)
5. All features get combined and analyzed
6. **Gemini AI** generates feedback based on the transcript + voice metrics
7. You get a detailed report showing exactly where you killed it and where you need work

No other interview prep platform does this level of voice analysis. Most just do basic transcription and call it done.

## Features That Actually Matter

**🎙️ Real Voice-Based Practice**  
Record your answers as audio. The AI HR avatar reads questions aloud, and you respond just like in a real interview. No typing, no multiple choice – actual speaking practice.

**🤖 AI-Powered Feedback**  
Every answer gets scored across multiple dimensions: content quality, communication clarity, relevance, confidence. The feedback is specific, not generic "good job" nonsense.

**🏢 Company-Specific Questions**  
500+ companies in the database. Questions are tailored to the company and role you're targeting. Practicing for Google? You'll get Google-style questions.

**📊 Multi-Domain Coverage**  
- HR questions (tell me about yourself, strengths/weaknesses, etc.)
- Technical questions (data structures, system design, domain knowledge)
- Coding challenges (with IDE interface)
- Aptitude tests (quant, logical, verbal)
- Managerial scenarios (leadership, conflict resolution)

**🎯 Experience-Level Adaptation**  
Fresher? You get foundational questions. Senior professional? Prepare for system design and leadership scenarios. The difficulty scales with your experience.

**📈 Progress Tracking**  
See your preparation progress over time. Track which areas you're strong in and which need more work.

## Tech Stack

**Frontend:**  
Pure HTML/CSS/JavaScript with a modern, gradient-heavy UI. No framework bloat – fast and responsive.

**Backend:**  
- Python Flask server handling voice analysis requests
- Gemini AI (2.0 Flash) for question generation and feedback
- OpenAI Whisper for speech-to-text transcription
- openSMILE for acoustic feature extraction

**Voice Analysis:**  
This is the crown jewel. The `voice_analyzer.py` module combines multiple analysis techniques:
- Whisper transcription with filler word detection
- openSMILE GeMAPS features (62 acoustic parameters)
- Custom scoring algorithms for confidence and clarity
- Real-time processing (most analyses complete in under 5 seconds)

## Future Roadmap

There's so much more we want to build:

**🎥 Video Analysis**  
Right now we analyze your voice. Next up: analyzing your body language, eye contact, and facial expressions during video interviews. Computer vision + voice = complete interview performance analysis.

**🌐 Multi-Language Support**  
English-only for now, but we're planning Hindi, Spanish, and other major languages. The Whisper model already supports 90+ languages.

**👥 Live Mock Interviews**  
AI is great, but sometimes you need practice with real humans. We're building a peer-to-peer system where you can match with other users for live practice sessions.

**📱 Mobile App**  
The web version works on mobile browsers, but a native app would unlock better audio recording and push notifications for practice reminders.

**🎓 Campus Placement Mode**  
Special module for college students with company-specific drives, batch preparation tracking, and college leaderboards.

**🔄 Real Interview Integration**  
Imagine recording your actual interview (with permission) and getting post-interview analysis. We're exploring partnerships with companies for this.

**🧠 Adaptive Learning**  
Track your weak spots and automatically generate more questions in those areas. ML-powered difficulty adjustment based on your performance patterns.

## Screenshots

---

## Quick Start

1. Clone the repo
2. Set up your Gemini API key in `script.js`
3. Install Python dependencies: `pip install flask flask-cors openai-whisper pandas numpy`
4. Download openSMILE and update paths in `voice_analyzer.py`
5. Run the server: `python server.py`
6. Open `index.html` in your browser
7. Start practicing

That's it. No docker-compose orchestration, no kubernetes manifests, no 50-step setup guide. Just code and run.

## Why This Exists

I built this because every interview prep platform I tried felt like studying for an exam, not preparing for an actual conversation. You can read a thousand articles about "STAR method" and "common interview questions", but if you can't articulate your thoughts clearly under pressure, you're still going to bomb the interview.

The voice analysis feature exists because I noticed a pattern – people who got offers weren't necessarily the smartest or most experienced. They were the ones who communicated with confidence and clarity. So I built a tool that trains that skill.

## License

Do whatever you want with it. Build your own startup, use it for your college project, fork it and make it better. Just don't sue me if your interview still goes badly – I gave you the tool, the rest is on you. 🤷‍♂️

---

*Made with caffeine and frustration over existing interview prep tools*
