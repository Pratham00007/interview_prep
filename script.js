const GEMINI_API_KEY = "Insert_Your_key";
// Model fallback chain: try newest first, fallback to stable
const GEMINI_MODELS = [
"gemini-2.0-flash",
"gemini-1.5-flash",
"gemini-1.5-flash-latest",
"gemini-pro"
];

async function callGemini(prompt, maxTokens) {
for (const model of GEMINI_MODELS) {
    try {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
            maxOutputTokens: maxTokens || 800,
            temperature: 0.7,
            responseMimeType: "text/plain",
            },
        }),
        }
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn(`Model ${model} failed:`, err?.error?.message || res.status);
        continue; // try next model
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
    if (data.error) { console.warn(`Gemini ${model}:`, data.error.message); continue; }
    } catch (e) {
    console.warn(`Gemini ${model} fetch error:`, e.message);
    }
}
console.error("All Gemini models failed — using fallback data");
return null;
}

// LEVEL DESCRIPTOR HELPERS
function getLevelProfile(level) {
const profiles = {
    fresher: {
    label: "fresher (0–1 year, college graduate)",
    aptitudeDiff: "easy to medium",
    technicalDiff: "basic fundamentals, definitions, simple examples",
    codingDiff: "easy (arrays, loops, basic sorting, simple recursion)",
    managerialDiff: "college projects, internship situations, academic teamwork",
    hrDiff: "college background, career goals, self-introduction",
    count: { aptitude: 8, technical: 6, coding: 5, managerial: 6, hr: 6 },
    timePerQ: { aptitude: 90, technical: 300, coding: 600, managerial: 180, hr: 240 }
    },
    junior: {
    label: "junior professional (1–3 years experience)",
    aptitudeDiff: "medium",
    technicalDiff: "intermediate — applied concepts, real scenarios, debugging",
    codingDiff: "easy-medium (data structures, two-pointer, basic DP)",
    managerialDiff: "early career situations, peer collaboration, small team challenges",
    hrDiff: "early work experience, first job learnings, career transitions",
    count: { aptitude: 8, technical: 6, coding: 5, managerial: 6, hr: 6 },
    timePerQ: { aptitude: 75, technical: 360, coding: 720, managerial: 210, hr: 240 }
    },
    mid: {
    label: "mid-level professional (3–6 years experience)",
    aptitudeDiff: "medium to hard",
    technicalDiff: "advanced — system internals, architecture, performance trade-offs",
    codingDiff: "medium-hard (graph algorithms, dynamic programming, system design)",
    managerialDiff: "cross-team projects, mentoring juniors, conflict resolution",
    hrDiff: "career growth, leadership, major project achievements",
    count: { aptitude: 8, technical: 7, coding: 5, managerial: 6, hr: 6 },
    timePerQ: { aptitude: 60, technical: 420, coding: 900, managerial: 240, hr: 300 }
    },
    experienced: {
    label: "senior/experienced professional (6+ years)",
    aptitudeDiff: "hard — complex logical and analytical reasoning",
    technicalDiff: "expert — design patterns, distributed systems, scalability, architecture decisions",
    codingDiff: "hard (complex algorithms, system design, optimization)",
    managerialDiff: "strategic decisions, stakeholder management, team building, P&L ownership",
    hrDiff: "leadership philosophy, organizational impact, vision, compensation negotiation",
    count: { aptitude: 8, technical: 7, coding: 5, managerial: 7, hr: 6 },
    timePerQ: { aptitude: 60, technical: 480, coding: 1200, managerial: 300, hr: 300 }
    }
};
return profiles[level] || profiles.fresher;
}

// Generate aptitude MCQs — level-specific
async function genAptitudeQs(company, level, count) {
const lp = getLevelProfile(level);
const n = count || lp.count.aptitude;
const prompt = `Generate ${n} multiple choice aptitude questions for a ${lp.label} candidate applying at ${company}.

Difficulty: ${lp.aptitudeDiff}
Mix of topics: quantitative reasoning (40%), logical reasoning (35%), verbal ability (25%)

IMPORTANT level rules:
- Fresher: basic arithmetic, simple series, easy analogies
- Junior: moderate percentages, data interpretation, medium puzzles
- Mid: advanced data sufficiency, complex reasoning chains
- Experienced: hard analytical reasoning, business case math

Return ONLY a valid JSON array, NO markdown, NO explanation:
[{"question":"...","options":["A: text","B: text","C: text","D: text"],"correct":"A","explanation":"step-by-step solution","difficulty":"Easy|Medium|Hard","topic":"Quantitative|Logical|Verbal"}]`;
const res = await callGemini(prompt, 2000);
if (!res) return null;
try {
    const clean = res.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(clean);
    return Array.isArray(arr) && arr.length ? arr : null;
} catch { return null; }
}

// Generate technical questions — level + round-type specific
async function genTechnicalQs(company, roundName, topics, level, count) {
const lp = getLevelProfile(level);
const n = count || lp.count.technical;
const prompt = `Generate ${n} technical interview questions for a ${lp.label} candidate.

Company: ${company}
Round: ${roundName}
Topics: ${topics.join(", ")}
Difficulty: ${lp.technicalDiff}

IMPORTANT level rules:
- Fresher: basic definitions, simple examples, "what is X", "explain Y"
- Junior: "how does X work internally", "compare X vs Y", "when would you use X"
- Mid: "design X", "what are trade-offs of Y", "debug this scenario"
- Experienced: "architect a system for X", "how would you scale Y", "what decisions would you make for Z"

Questions must be open-ended conceptual (NO code writing required).

Return ONLY valid JSON array, NO markdown:
[{"question":"...","expectedPoints":["point 1","point 2","point 3"],"difficulty":"Easy|Medium|Hard","topic":"topic name","levelHint":"what a ${level} answer should include"}]`;
const res = await callGemini(prompt, 2000);
if (!res) return null;
try {
    const clean = res.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(clean);
    return Array.isArray(arr) && arr.length ? arr : null;
} catch { return null; }
}

// Generate managerial/behavioral questions — level-specific
async function genManagerialQs(company, roundName, topics, level, count) {
const lp = getLevelProfile(level);
const n = count || lp.count.managerial;
const prompt = `Generate ${n} managerial/behavioral interview questions for a ${lp.label} candidate.

Company: ${company}
Round: ${roundName}
Topics: ${topics.join(", ")}
Context: ${lp.managerialDiff}

IMPORTANT level rules:
- Fresher: focus on college projects, internships, academic teamwork, hypothetical scenarios
- Junior: focus on early work situations, learning from mistakes, working with peers
- Mid: focus on leading small teams, cross-functional work, influencing without authority
- Experienced: focus on strategic decisions, building teams, organizational change, P&L impact

Use STAR method prompts. Mix situational ("tell me about a time...") and hypothetical ("how would you handle...") questions.

Return ONLY valid JSON array, NO markdown:
[{"question":"...","expectedPoints":["STAR element 1","STAR element 2","key behavioral indicator"],"difficulty":"Easy|Medium|Hard","topic":"topic name","type":"situational|behavioral|hypothetical"}]`;
const res = await callGemini(prompt, 2000);
if (!res) return null;
try {
    const clean = res.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(clean);
    return Array.isArray(arr) && arr.length ? arr : null;
} catch { return null; }
}

// Generate coding/debugging questions — level-specific
async function genDebugQs(lang, level, count) {
const lp = getLevelProfile(level);
const n = count || lp.count.coding || 5;
const prompt = `Generate ${n} ${lang} code debugging/fix questions for a ${lp.label} developer.

Difficulty: ${lp.codingDiff}

IMPORTANT level rules:
- Fresher: basic syntax errors, off-by-one errors, simple null checks, basic loop bugs
- Junior: logic errors in standard algorithms, incorrect data structure usage, edge case bugs
- Mid: concurrency issues, memory leaks, performance anti-patterns, race conditions
- Experienced: architectural bugs, security vulnerabilities, distributed system issues, optimization problems

Each question has a SHORT buggy code snippet (max 20 lines) with 1-2 clear bugs.

Return ONLY valid JSON array, NO markdown:
[{"question":"Find and fix the bug(s) in this ${lang} code:","code":"buggy code here (max 15 lines)","bug":"clear description of what is wrong","fix":"corrected code","explanation":"why this is a bug and how fix works","difficulty":"Easy|Medium|Hard"}]`;
const res = await callGemini(prompt, 2500);
if (!res) return null;
try {
    const clean = res.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(clean);
    return Array.isArray(arr) && arr.length ? arr : null;
} catch { return null; }
}

// Generate HR questions — level-specific
async function genHRQuestions(company, role, level) {
const lp = getLevelProfile(level);
const n = lp.count.hr;
const prompt = `Generate ${n} HR interview questions for a ${lp.label} ${role} candidate at ${company}.

Context: ${lp.hrDiff}

IMPORTANT level rules:
- Fresher: "tell me about yourself", campus projects, career aspirations, learning attitude
- Junior: first job experience, skill growth, team dynamics, short-term goals
- Mid: key achievements, leadership moments, career pivots, medium-term vision
- Experienced: leadership philosophy, company-level impact, compensation, long-term strategy

Mix: 30% self-introduction/background, 30% ${company}-specific culture fit, 40% behavioral/situational.
Make questions specific to ${company}'s known culture and values.

Return ONLY a JSON array of question strings, NO markdown:
["Q1","Q2","Q3","Q4","Q5","Q6"]`;
const res = await callGemini(prompt, 800);
if (!res) return defaultHRQs(company);
try {
    const clean = res.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultHRQs(company);
} catch { return defaultHRQs(company); }
}

// Evaluate technical answer — level-aware
async function evalTechnicalAnswer(question, answer, expectedPoints, company, level) {
const lp = getLevelProfile(level || (currentUser ? currentUser.lv : "fresher"));
if (!answer || answer.trim().length < 15) {
    return { score: 15, feedback: "Answer too short. Please explain in detail.", correct: false };
}
const prompt = `Evaluate this technical answer for a ${lp.label} candidate at ${company}.

Question: ${question}
Expected Key Points: ${expectedPoints ? expectedPoints.join(", ") : "general correctness"}
Candidate's Answer: ${answer}

Scoring for ${lp.label}:
- Judge by what's APPROPRIATE for this experience level
- Fresher: reward correct basic understanding, penalise if advanced concepts totally missed
- Junior: reward applied understanding with examples
- Mid: reward depth, trade-off awareness, real-world scenarios
- Experienced: reward architectural thinking, scalability, leadership context

Return ONLY JSON (no markdown):
{
"score": <0-100>,
"correct": <true if score >= 60>,
"feedback": "<2-3 sentences: strengths, gaps, and what a better answer would include for this level>"
}`;
const res = await callGemini(prompt, 500);
if (!res) return { score: 50, correct: false, feedback: "Unable to evaluate. Review the expected key points." };
try {
    const clean = res.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
} catch {
    const scoreM = res.match(/score["\s:]+(\d+)/i);
    return { score: scoreM ? parseInt(scoreM[1]) : 50, correct: false, feedback: res.substring(0, 250) };
}
}

// Evaluate HR answer — level-aware
async function evalHRAnswer(question, answer, company, level) {
const lp = getLevelProfile(level || (currentUser ? currentUser.lv : "fresher"));
if (!answer || answer.trim().length < 10) {
    return { score: 20, assessment: "Insufficient", strengths: [], improvements: ["Please provide a detailed answer"], betterAnswer: "Give a structured response using the STAR method." };
}
const prompt = `You are a senior HR interviewer at ${company}. Evaluate this answer from a ${lp.label}.

Question: ${question}
Answer: ${answer}

Score by what's appropriate for ${lp.label}:
- Fresher: reward genuine enthusiasm, clear communication, relevant college/internship examples
- Junior: reward specific work examples, self-awareness, growth mindset
- Mid: reward leadership situations, measurable outcomes, STAR structure
- Experienced: reward strategic thinking, business impact, executive presence

Return ONLY valid JSON (no markdown):
{
"score": <0-100>,
"assessment": "<Excellent|Good|Average|Needs Improvement>",
"strengths": ["strength 1", "strength 2"],
"improvements": ["improvement 1", "improvement 2"],
"betterAnswer": "<2-3 sentences: ideal answer for a ${lp.label} at ${company}>"
}`;
const res = await callGemini(prompt, 700);
if (!res) return { score: 60, assessment: "Average", strengths: ["Answered the question"], improvements: ["Add specific examples", "Use STAR method"], betterAnswer: "Structure your answer with a clear situation, task, action, and result." };
try {
    const clean = res.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
} catch {
    const scoreM = res.match(/score["\s:]+(\d+)/i);
    return { score: scoreM ? parseInt(scoreM[1]) : 60, assessment: "Average", strengths: [], improvements: [], betterAnswer: res.substring(0, 200) };
}
}

function defaultHRQs(company) {
return [
    `Tell me about yourself and what drew you to apply at ${company}.`,
    `What are your greatest strengths, and how have you demonstrated them in real situations?`,
    `Describe a time you faced a significant challenge. How did you overcome it?`,
    `Where do you see yourself in 5 years, specifically within ${company}?`,
    `Why do you want to join ${company} over its competitors?`,
    `What makes you the ideal candidate for this position at ${company}?`,
];
}

// ══════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════
var COMPANIES = [
{
    id: "tcs",
    name: "Tata Consultancy Services",
    short: "TCS",
    type: "service",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Tata_Consultancy_Services_Logo.svg",
    roles: ["System Engineer", "Software Developer", "Data Analyst"],
    tags: ["Service", "Mass Hiring", "Fresher Friendly"],
    tc: ["", "g", "o"],
    url: "https://ibegin.tcs.com/iBegin/",
    pkg: "3.5 – 7 LPA",
    opens: "5,000+",
    drive: "Rolling",
    about:
    "TCS is one of India's largest IT services companies operating in 46 countries. Campus hiring through TCS NQT (National Qualifier Test) held at engineering colleges.",
    culture:
    "TCS has structured onboarding with 3-6 months training before project deployment. Work-life balance is good in most service lines. Strong learning culture via TCS iEvolve platform. Appraisals follow a bell curve.",
    rounds: [
    {
        name: "TCS NQT — Aptitude",
        type: "aptitude",
        level: "Easy-Medium",
        desc: "Numerical ability, verbal ability, reasoning and coding section. 110 minutes total.",
        topics: [
        "Number Series",
        "Percentages & Profit/Loss",
        "Time, Speed & Work",
        "Verbal Analogy",
        "Logical Puzzles",
        ],
        links: [
        {
            name: "TCS NQT Practice",
            url: "https://www.geeksforgeeks.org/tcs-nqt-previous-year-papers/",
            icon: "🟢",
        },
        {
            name: "IndiaBix Aptitude",
            url: "https://www.indiabix.com/aptitude/questions-and-answers/",
            icon: "📘",
        },
        {
            name: "PrepInsta TCS",
            url: "https://prepinsta.com/tcs-nqt/",
            icon: "🎯",
        },
        ],
        ytLinks: [
        {
            name: "TCS NQT Complete Prep",
            url: "https://www.youtube.com/results?search_query=TCS+NQT+aptitude+preparation",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "Aptitude Shortcuts",
            url: "https://www.youtube.com/results?search_query=aptitude+shortcuts+for+placement",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Technical Interview",
        type: "technical",
        level: "Easy-Medium",
        desc: "Core CS subjects — DBMS, OS, Networking, OOPs and project discussion.",
        topics: [
        "DBMS & SQL Queries",
        "Operating Systems",
        "Computer Networks",
        "OOP Concepts",
        "Data Structures",
        ],
        links: [
        {
            name: "TCS Interview Questions",
            url: "https://www.geeksforgeeks.org/tcs-interview-experience/",
            icon: "🟢",
        },
        {
            name: "SQL Practice",
            url: "https://www.hackerrank.com/domains/sql",
            icon: "🎯",
        },
        {
            name: "OS Concepts",
            url: "https://www.geeksforgeeks.org/operating-systems/",
            icon: "📘",
        },
        ],
        ytLinks: [
        {
            name: "DBMS Complete Course",
            url: "https://www.youtube.com/results?search_query=DBMS+complete+course+for+interview",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "OOP Interview Questions",
            url: "https://www.youtube.com/results?search_query=OOP+concepts+interview+preparation",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Managerial Interview",
        type: "managerial",
        level: "Medium",
        desc: "Problem-solving ability, communication and situational assessment.",
        topics: [
        "Leadership Scenarios",
        "Teamwork Examples",
        "Decision Making",
        "Situation Handling",
        ],
        links: [
        {
            name: "HR & Managerial Q&A",
            url: "https://www.indiabix.com/hr-interview/questions-and-answers/",
            icon: "🤝",
        },
        ],
        ytLinks: [
        {
            name: "Managerial Round Prep",
            url: "https://www.youtube.com/results?search_query=managerial+round+interview+questions",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "HR Interview",
        type: "hr",
        level: "Easy",
        desc: "Cultural fit, career goals, strengths & weaknesses and offer discussion.",
        topics: [
        "Tell Me About Yourself",
        "Strengths & Weaknesses",
        "Why TCS?",
        "5-Year Career Goals",
        ],
        links: [
        {
            name: "HR Questions Bank",
            url: "https://www.indiabix.com/hr-interview/questions-and-answers/",
            icon: "🤝",
        },
        ],
        ytLinks: [
        {
            name: "HR Interview Tips",
            url: "https://www.youtube.com/results?search_query=HR+interview+questions+and+answers+for+freshers",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    ],
    prep: {
    a: [
        {
        name: "R.S. Agarwal Quantitative Aptitude",
        url: "https://www.amazon.in/s?k=rs+aggarwal+quantitative+aptitude",
        yt: "https://www.youtube.com/results?search_query=RS+Aggarwal+aptitude+solutions",
        },
        {
        name: "IndiaBix Mock Tests",
        url: "https://www.indiabix.com/",
        yt: "https://www.youtube.com/results?search_query=TCS+NQT+mock+test+solutions",
        },
        {
        name: "TCS NQT Previous Papers",
        url: "https://prepinsta.com/tcs-nqt/",
        yt: "https://www.youtube.com/results?search_query=TCS+NQT+2024+previous+year+paper",
        },
    ],
    t: [
        {
        name: "GeeksforGeeks DSA Sheet",
        url: "https://www.geeksforgeeks.org/dsa-sheet-by-love-babbar/",
        yt: "https://www.youtube.com/results?search_query=DSA+complete+course+for+placements",
        },
        {
        name: "SQL Practice HackerRank",
        url: "https://www.hackerrank.com/domains/sql",
        yt: "https://www.youtube.com/results?search_query=SQL+interview+questions+for+placements",
        },
        {
        name: "CS Core Subjects",
        url: "https://www.geeksforgeeks.org/last-minute-notes-computer-network/",
        yt: "https://www.youtube.com/results?search_query=CS+fundamentals+interview+preparation",
        },
    ],
    h: [
        {
        name: "STAR Method Answer Guide",
        url: "https://www.indeed.com/career-advice/interviewing/how-to-use-the-star-interview-response-technique",
        yt: "https://www.youtube.com/results?search_query=STAR+method+interview+answers",
        },
        {
        name: "TCS Company Culture Guide",
        url: "https://www.ambitionbox.com/info/tcs-reviews",
        yt: "https://www.youtube.com/results?search_query=TCS+company+culture+experience",
        },
    ],
    },
},
{
    id: "infosys",
    name: "Infosys",
    short: "Infosys",
    type: "service",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg",
    roles: ["Systems Engineer", "Digital Specialist", "Power Programmer"],
    tags: ["Service", "InfyTQ", "Fresher"],
    tc: ["", "g", "o"],
    url: "https://www.infosys.com/careers/apply.html",
    pkg: "3.6 – 9 LPA",
    opens: "3,000+",
    drive: "Rolling",
    about:
    "Infosys is a global leader in digital services. Campus recruitment through the InfyTQ platform and online certification exam.",
    culture:
    "Infosys Mysuru training is 3 months — excellent campus with good facilities. Strong learning culture via iEvolve. Work-life balance varies by project. Internal certifications matter for project allocation.",
    rounds: [
    {
        name: "InfyTQ Online Assessment",
        type: "aptitude",
        level: "Easy-Medium",
        desc: "Aptitude, Logical Reasoning and Pseudocode tracing. 95 minutes.",
        topics: [
        "Arithmetic Ability",
        "Logical Reasoning",
        "Verbal Ability",
        "Pseudocode Tracing",
        ],
        links: [
        {
            name: "InfyTQ Platform",
            url: "https://www.infytq.com/",
            icon: "🎯",
        },
        {
            name: "Infosys Previous Papers",
            url: "https://www.geeksforgeeks.org/infosys-interview-questions/",
            icon: "🟢",
        },
        {
            name: "Logical Reasoning Practice",
            url: "https://www.indiabix.com/logical-reasoning/questions-and-answers/",
            icon: "📘",
        },
        ],
        ytLinks: [
        {
            name: "InfyTQ Prep Guide",
            url: "https://www.youtube.com/results?search_query=InfyTQ+preparation+2024",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "Pseudocode Questions",
            url: "https://www.youtube.com/results?search_query=pseudocode+tracing+placement",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Coding Round",
        type: "technical",
        level: "Easy-Medium",
        desc: "Two programming problems in any language. Easy to Medium level.",
        topics: [
        "Array Manipulation",
        "String Problems",
        "Dynamic Programming Basics",
        "Recursion",
        ],
        links: [
        {
            name: "LeetCode Easy Problems",
            url: "https://leetcode.com/problemset/?difficulty=EASY&page=1",
            icon: "🔗",
            badge: "Easy",
        },
        {
            name: "LeetCode Medium Array",
            url: "https://leetcode.com/tag/array/",
            icon: "🔗",
            badge: "Medium",
        },
        {
            name: "HackerRank Practice",
            url: "https://www.hackerrank.com/domains/algorithms",
            icon: "🎯",
        },
        {
            name: "GFG Array Problems",
            url: "https://www.geeksforgeeks.org/array-data-structure/",
            icon: "🟢",
        },
        ],
        ytLinks: [
        {
            name: "DSA for Infosys",
            url: "https://www.youtube.com/results?search_query=Infosys+coding+round+preparation",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "Dynamic Programming Basics",
            url: "https://www.youtube.com/results?search_query=dynamic+programming+beginners",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Technical Interview",
        type: "technical",
        level: "Medium",
        desc: "Projects, core CS and hands-on coding discussion.",
        topics: [
        "OOP Concepts",
        "DBMS Normalization",
        "Data Structures",
        "Project Discussion",
        ],
        links: [
        {
            name: "Infosys Tech Interview Q&A",
            url: "https://www.geeksforgeeks.org/infosys-interview-preparation/",
            icon: "🟢",
        },
        {
            name: "OOP Interview Guide",
            url: "https://www.geeksforgeeks.org/object-oriented-programming-oops-concept-in-java/",
            icon: "📘",
        },
        ],
        ytLinks: [
        {
            name: "Infosys Technical Interview",
            url: "https://www.youtube.com/results?search_query=Infosys+technical+interview+experience",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "HR Interview",
        type: "hr",
        level: "Easy",
        desc: "Background check, values alignment, and offer formalities.",
        topics: [
        "Self Introduction",
        "Career Goals",
        "Relocation Flexibility",
        "Why Infosys?",
        ],
        links: [
        {
            name: "HR Q&A Bank",
            url: "https://www.indiabix.com/hr-interview/questions-and-answers/",
            icon: "🤝",
        },
        ],
        ytLinks: [
        {
            name: "Infosys HR Interview",
            url: "https://www.youtube.com/results?search_query=Infosys+HR+interview+questions",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    ],
    prep: {
    a: [
        {
        name: "PrepInsta Infosys Package",
        url: "https://prepinsta.com/infosys/",
        yt: "https://www.youtube.com/results?search_query=Infosys+aptitude+preparation",
        },
        {
        name: "IndiaBix Reasoning Practice",
        url: "https://www.indiabix.com/logical-reasoning/questions-and-answers/",
        yt: "https://www.youtube.com/results?search_query=logical+reasoning+tricks+placement",
        },
    ],
    t: [
        {
        name: "LeetCode Easy Problems",
        url: "https://leetcode.com/problemset/?difficulty=EASY",
        yt: "https://www.youtube.com/results?search_query=LeetCode+easy+problems+explained",
        },
        {
        name: "InterviewBit Infosys Roadmap",
        url: "https://www.interviewbit.com/infosys-interview-questions/",
        yt: "https://www.youtube.com/results?search_query=Infosys+coding+interview+preparation",
        },
    ],
    h: [
        {
        name: "HR Answer Strategies",
        url: "https://www.indiabix.com/hr-interview/questions-and-answers/",
        yt: "https://www.youtube.com/results?search_query=HR+interview+preparation+freshers",
        },
        {
        name: "Infosys Values Guide",
        url: "https://www.infosys.com/about/culture.html",
        yt: "https://www.youtube.com/results?search_query=Infosys+HR+round+tips",
        },
    ],
    },
},
{
    id: "google",
    name: "Google",
    short: "Google",
    type: "product",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
    roles: ["Software Engineer", "SRE", "Data Scientist"],
    tags: ["Product", "Dream Company", "Top Tier"],
    tc: ["", "g", "o"],
    url: "https://careers.google.com",
    pkg: "30 – 80 LPA",
    opens: "200+",
    drive: "Oct – Jan",
    about:
    "Google hires through rigorous DSA and system design interviews. Focuses on algorithmic thinking, code quality, and collaborative problem-solving.",
    culture:
    "Flat hierarchy within teams, strong code review culture. 20% time for personal projects is real. Free food and perks normalize quickly. L-levels (L3-L8) drive everything. Internal mobility is excellent.",
    rounds: [
    {
        name: "Online Assessment",
        type: "aptitude",
        level: "Medium-Hard",
        desc: "2-3 algorithmic problems on HackerRank or Google's own platform.",
        topics: [
        "Dynamic Programming",
        "Graph Algorithms",
        "Binary Search",
        "Bit Manipulation",
        ],
        links: [
        {
            name: "Google LeetCode Tag",
            url: "https://leetcode.com/company/google/",
            icon: "🔗",
            badge: "Medium-Hard",
        },
        {
            name: "Google Interview Prep",
            url: "https://www.geeksforgeeks.org/google-interview-preparation/",
            icon: "🟢",
        },
        {
            name: "HackerRank Algorithms",
            url: "https://www.hackerrank.com/domains/algorithms",
            icon: "🎯",
        },
        ],
        ytLinks: [
        {
            name: "Google OA Preparation",
            url: "https://www.youtube.com/results?search_query=Google+online+assessment+preparation",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "DP for Competitive Programming",
            url: "https://www.youtube.com/results?search_query=dynamic+programming+competitive+programming",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Phone Screen (Technical)",
        type: "technical",
        level: "Medium",
        desc: "30-45 min coding interview with a Google engineer. Data structures focus.",
        topics: [
        "Arrays & Strings",
        "Trees & Graphs",
        "Hash Maps",
        "Two Pointers",
        ],
        links: [
        {
            name: "LeetCode Medium Problems",
            url: "https://leetcode.com/problemset/?difficulty=MEDIUM",
            icon: "🔗",
            badge: "Medium",
        },
        {
            name: "Google Phone Screen Q&A",
            url: "https://leetcode.com/discuss/interview-experience?query=google",
            icon: "🔗",
        },
        ],
        ytLinks: [
        {
            name: "Google Phone Screen",
            url: "https://www.youtube.com/results?search_query=Google+phone+screen+interview",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Onsite Coding Rounds (2)",
        type: "technical",
        level: "Hard",
        desc: "Hard DSA problems. Clean code, edge cases, and complexity analysis expected.",
        topics: [
        "Hard DP",
        "Advanced Graph",
        "Segment Trees",
        "Trie & Advanced DS",
        ],
        links: [
        {
            name: "LeetCode Hard Problems",
            url: "https://leetcode.com/problemset/?difficulty=HARD",
            icon: "🔗",
            badge: "Hard",
        },
        {
            name: "Google Hard Questions",
            url: "https://leetcode.com/company/google/?difficulty=HARD",
            icon: "🔗",
            badge: "Hard",
        },
        {
            name: "CLRS Algorithms Book",
            url: "https://www.amazon.in/Introduction-Algorithms-Thomas-H-Cormen/dp/0262033844",
            icon: "📘",
        },
        ],
        ytLinks: [
        {
            name: "Hard LeetCode Problems",
            url: "https://www.youtube.com/results?search_query=hard+leetcode+problems+explained",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "Google Onsite Interview",
            url: "https://www.youtube.com/results?search_query=Google+onsite+interview+experience",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "System Design Round",
        type: "technical",
        level: "Hard",
        desc: "Design YouTube, Google Maps, or search at scale. Distributed systems.",
        topics: [
        "Distributed Systems",
        "Caching (Redis, CDN)",
        "Database Sharding",
        "Load Balancing",
        "CAP Theorem",
        ],
        links: [
        {
            name: "Grokking System Design",
            url: "https://www.educative.io/courses/grokking-the-system-design-interview",
            icon: "📘",
        },
        {
            name: "System Design Primer",
            url: "https://github.com/donnemartin/system-design-primer",
            icon: "🟢",
        },
        {
            name: "ByteByteGo",
            url: "https://bytebytego.com/",
            icon: "🎯",
        },
        ],
        ytLinks: [
        {
            name: "System Design Complete",
            url: "https://www.youtube.com/results?search_query=system+design+interview+complete+course",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "Gaurav Sen System Design",
            url: "https://www.youtube.com/@gkcs",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Googleyness + Leadership",
        type: "hr",
        level: "Medium",
        desc: "Cultural values, collaboration stories and behavioral assessment.",
        topics: [
        "Leadership Examples",
        "Ambiguity Handling",
        "Cross-team Collaboration",
        "Data-Driven Decisions",
        ],
        links: [
        {
            name: "Google Leadership Principles",
            url: "https://about.google/",
            icon: "🌐",
        },
        ],
        ytLinks: [
        {
            name: "Google HR Round Tips",
            url: "https://www.youtube.com/results?search_query=Google+HR+behavioral+interview",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    ],
    prep: {
    a: [
        {
        name: "LeetCode Google Tag (All)",
        url: "https://leetcode.com/company/google/",
        yt: "https://www.youtube.com/results?search_query=Google+LeetCode+problems+explained",
        },
        {
        name: "Codeforces Contests",
        url: "https://codeforces.com/",
        yt: "https://www.youtube.com/results?search_query=Codeforces+tutorial+for+beginners",
        },
    ],
    t: [
        {
        name: "Grokking System Design",
        url: "https://www.educative.io/courses/grokking-the-system-design-interview",
        yt: "https://www.youtube.com/results?search_query=system+design+interview+2024",
        },
        {
        name: "DDIA — Designing Data-Intensive Apps",
        url: "https://www.amazon.in/Designing-Data-Intensive-Applications-Reliable-Maintainable/dp/1449373321",
        yt: "https://www.youtube.com/results?search_query=designing+data+intensive+applications+summary",
        },
    ],
    h: [
        {
        name: "Google Values & Culture",
        url: "https://about.google/",
        yt: "https://www.youtube.com/results?search_query=Google+behavioral+interview+tips",
        },
        {
        name: "STAR Stories Template",
        url: "https://www.indeed.com/career-advice/interviewing/star-interview-questions",
        yt: "https://www.youtube.com/results?search_query=STAR+method+behavioral+interview",
        },
    ],
    },
},
{
    id: "microsoft",
    name: "Microsoft",
    short: "MSFT",
    type: "product",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg",
    roles: ["SDE I", "SDE II", "Program Manager"],
    tags: ["Product", "MAANG", "High Package"],
    tc: ["", "g", "o"],
    url: "https://careers.microsoft.com",
    pkg: "20 – 60 LPA",
    opens: "300+",
    drive: "Aug – Nov",
    about:
    "Microsoft emphasizes growth mindset, clean code and collaborative problem solving. Strong focus on behavioral interviews and DSA.",
    culture:
    "Improved work-life balance since Satya Nadella. Growth mindset culture is genuine. Azure, Teams, and Office divisions are most active. Strong mentorship and L&D programs.",
    rounds: [
    {
        name: "Coding Assessment",
        type: "aptitude",
        level: "Medium",
        desc: "2-3 medium to hard coding problems on HackerRank.",
        topics: [
        "Linked Lists",
        "Dynamic Programming",
        "Trees & Graphs",
        "Greedy Algorithms",
        ],
        links: [
        {
            name: "Microsoft LeetCode Tag",
            url: "https://leetcode.com/company/microsoft/",
            icon: "🔗",
            badge: "Medium-Hard",
        },
        {
            name: "GFG Microsoft Sheet",
            url: "https://www.geeksforgeeks.org/microsoft-interview-preparation/",
            icon: "🟢",
        },
        {
            name: "HackerRank Algorithms",
            url: "https://www.hackerrank.com/domains/algorithms",
            icon: "🎯",
        },
        ],
        ytLinks: [
        {
            name: "Microsoft OA Prep",
            url: "https://www.youtube.com/results?search_query=Microsoft+online+assessment+preparation",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "LeetCode Medium Explained",
            url: "https://www.youtube.com/results?search_query=leetcode+medium+problems+explained",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Technical Interview 1",
        type: "technical",
        level: "Medium",
        desc: "DSA + project discussion. Clean code and design decisions.",
        topics: [
        "Arrays & Linked Lists",
        "Binary Trees",
        "Hash Maps",
        "Project Deep Dive",
        ],
        links: [
        {
            name: "LeetCode Medium List",
            url: "https://leetcode.com/problemset/?difficulty=MEDIUM",
            icon: "🔗",
            badge: "Medium",
        },
        {
            name: "Microsoft Interview Experience",
            url: "https://www.geeksforgeeks.org/microsoft-interview-experience/",
            icon: "🟢",
        },
        ],
        ytLinks: [
        {
            name: "Microsoft Technical Interview",
            url: "https://www.youtube.com/results?search_query=Microsoft+technical+interview+experience+2024",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Technical Interview 2 + System Design",
        type: "technical",
        level: "Hard",
        desc: "Advanced DSA and low-level system design.",
        topics: [
        "Design Patterns",
        "OOP System Design",
        "Scalability",
        "Architecture Decisions",
        ],
        links: [
        {
            name: "LeetCode Hard",
            url: "https://leetcode.com/problemset/?difficulty=HARD",
            icon: "🔗",
            badge: "Hard",
        },
        {
            name: "LLD Resources",
            url: "https://github.com/prasadgujar/low-level-design-primer",
            icon: "🟢",
        },
        {
            name: "Clean Code Book",
            url: "https://www.amazon.in/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882",
            icon: "📘",
        },
        ],
        ytLinks: [
        {
            name: "LLD Interview Preparation",
            url: "https://www.youtube.com/results?search_query=low+level+design+interview+preparation",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "System Design Microsoft",
            url: "https://www.youtube.com/results?search_query=Microsoft+system+design+interview",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "HR + Managerial Round",
        type: "hr",
        level: "Medium",
        desc: "Culture fit, growth mindset stories, and compensation discussion.",
        topics: [
        "Growth Mindset Stories",
        "Collaboration Examples",
        "Failure & Learning",
        "Career Vision",
        ],
        links: [
        {
            name: "Microsoft Core Values",
            url: "https://www.microsoft.com/en-us/about/values",
            icon: "🌐",
        },
        ],
        ytLinks: [
        {
            name: "Microsoft HR Round",
            url: "https://www.youtube.com/results?search_query=Microsoft+HR+managerial+interview",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    ],
    prep: {
    a: [
        {
        name: "Microsoft LeetCode Tag",
        url: "https://leetcode.com/company/microsoft/",
        yt: "https://www.youtube.com/results?search_query=Microsoft+LeetCode+questions",
        },
        {
        name: "HackerRank Mock Tests",
        url: "https://www.hackerrank.com/domains/algorithms",
        yt: "https://www.youtube.com/results?search_query=HackerRank+interview+preparation+kit",
        },
    ],
    t: [
        {
        name: "Clean Code — Robert C. Martin",
        url: "https://www.amazon.in/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882",
        yt: "https://www.youtube.com/results?search_query=clean+code+summary",
        },
        {
        name: "Design Patterns",
        url: "https://refactoring.guru/design-patterns",
        yt: "https://www.youtube.com/results?search_query=design+patterns+for+interviews",
        },
        {
        name: "Azure Fundamentals AZ-900",
        url: "https://learn.microsoft.com/en-us/certifications/exams/az-900/",
        yt: "https://www.youtube.com/results?search_query=Azure+AZ-900+free+course",
        },
    ],
    h: [
        {
        name: "Growth Mindset — Carol Dweck",
        url: "https://www.amazon.in/Mindset-Carol-Dweck/dp/1472139976",
        yt: "https://www.youtube.com/results?search_query=growth+mindset+carol+dweck+summary",
        },
        {
        name: "STAR Stories Template",
        url: "https://www.indeed.com/career-advice/interviewing/star-interview-questions",
        yt: "https://www.youtube.com/results?search_query=STAR+method+microsoft+interview",
        },
    ],
    },
},
{
    id: "flipkart",
    name: "Flipkart",
    short: "Flipkart",
    type: "startup",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/20/Flipkart_logo.svg",
    roles: ["SDE-1", "Data Scientist", "Product Analyst"],
    tags: ["Startup", "Walmart Backed", "Fast Growth"],
    tc: ["", "g", "o"],
    url: "https://www.flipkartcareers.com",
    pkg: "20 – 42 LPA",
    opens: "200+",
    drive: "Sep – Nov",
    about:
    "Flipkart is India's leading e-commerce company. Strong DSA, machine coding, and product thinking required for all tech roles.",
    culture:
    "Startup energy at scale. Quarterly targets are intense. Hackathons and Big Billion Days engineering is genuinely exciting. Good L&D programs. On-site work common.",
    rounds: [
    {
        name: "Online Coding Round",
        type: "aptitude",
        level: "Medium-Hard",
        desc: "DSA problems on HackerRank. Medium to Hard. Strict time limits.",
        topics: [
        "Binary Search",
        "Dynamic Programming",
        "Graph Algorithms",
        "Tries & Heaps",
        ],
        links: [
        {
            name: "Flipkart LeetCode Tag",
            url: "https://leetcode.com/company/flipkart/",
            icon: "🔗",
            badge: "Medium-Hard",
        },
        {
            name: "LeetCode Top 100",
            url: "https://leetcode.com/problem-list/top-100-liked-questions/",
            icon: "🔗",
            badge: "Medium",
        },
        {
            name: "HackerRank Hard",
            url: "https://www.hackerrank.com/domains/algorithms?filters%5Bdifficulty%5D%5B%5D=hard",
            icon: "🎯",
            badge: "Hard",
        },
        ],
        ytLinks: [
        {
            name: "Flipkart Coding Round",
            url: "https://www.youtube.com/results?search_query=Flipkart+coding+round+preparation",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "Graph Algorithms Complete",
            url: "https://www.youtube.com/results?search_query=graph+algorithms+complete+course",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Machine Coding Round",
        type: "technical",
        level: "Medium-Hard",
        desc: "Implement a real-world system from scratch in 90 minutes.",
        topics: [
        "OOP Design Principles",
        "Clean Code",
        "Extensibility",
        "Test Cases",
        ],
        links: [
        {
            name: "LLD for Flipkart",
            url: "https://github.com/prasadgujar/low-level-design-primer",
            icon: "🟢",
        },
        {
            name: "InterviewBit Machine Coding",
            url: "https://www.interviewbit.com/machine-coding/",
            icon: "🎯",
        },
        ],
        ytLinks: [
        {
            name: "Machine Coding Round",
            url: "https://www.youtube.com/results?search_query=machine+coding+round+interview",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "LLD Complete Course",
            url: "https://www.youtube.com/results?search_query=low+level+design+complete+course",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Technical + System Design",
        type: "technical",
        level: "Hard",
        desc: "System design for e-commerce scenarios at massive scale.",
        topics: [
        "Inventory System Design",
        "Recommendation Engine",
        "Payment Gateway",
        "Scalability Patterns",
        ],
        links: [
        {
            name: "System Design Primer",
            url: "https://github.com/donnemartin/system-design-primer",
            icon: "🟢",
        },
        {
            name: "Grokking System Design",
            url: "https://www.educative.io/courses/grokking-the-system-design-interview",
            icon: "📘",
        },
        {
            name: "ByteByteGo Newsletter",
            url: "https://bytebytego.com/",
            icon: "🎯",
        },
        ],
        ytLinks: [
        {
            name: "E-commerce System Design",
            url: "https://www.youtube.com/results?search_query=e-commerce+system+design+interview",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        {
            name: "Flipkart System Design",
            url: "https://www.youtube.com/results?search_query=Flipkart+system+design+interview",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    {
        name: "Culture + Leadership",
        type: "hr",
        level: "Medium",
        desc: "Values assessment, result orientation, and growth stories.",
        topics: [
        "Result Orientation",
        "Customer Focus",
        "Boldness",
        "Collaboration",
        ],
        links: [
        {
            name: "Flipkart Leadership Principles",
            url: "https://www.flipkartcareers.com/",
            icon: "🌐",
        },
        ],
        ytLinks: [
        {
            name: "Flipkart HR Round",
            url: "https://www.youtube.com/results?search_query=Flipkart+HR+interview+experience",
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg>`,
        },
        ],
    },
    ],
    prep: {
    a: [
        {
        name: "Flipkart LeetCode Tag",
        url: "https://leetcode.com/company/flipkart/",
        yt: "https://www.youtube.com/results?search_query=Flipkart+LeetCode+problems",
        },
        {
        name: "InterviewBit Machine Coding",
        url: "https://www.interviewbit.com/machine-coding/",
        yt: "https://www.youtube.com/results?search_query=machine+coding+round+preparation",
        },
    ],
    t: [
        {
        name: "DDIA Book",
        url: "https://www.amazon.in/Designing-Data-Intensive-Applications-Reliable-Maintainable/dp/1449373321",
        yt: "https://www.youtube.com/results?search_query=system+design+2024+complete",
        },
        {
        name: "LLD GitHub Primer",
        url: "https://github.com/prasadgujar/low-level-design-primer",
        yt: "https://www.youtube.com/results?search_query=low+level+design+interview+2024",
        },
    ],
    h: [
        {
        name: "Flipkart Values & Culture",
        url: "https://www.ambitionbox.com/reviews/flipkart-reviews",
        yt: "https://www.youtube.com/results?search_query=Flipkart+culture+work+experience",
        },
        {
        name: "Product Management Basics",
        url: "https://www.interviewbit.com/product-manager-interview-questions/",
        yt: "https://www.youtube.com/results?search_query=product+manager+interview+preparation",
        },
    ],
    },
},
];

var BLOG_POSTS = [
{
    id: 1,
    company: "Google",
    coId: "google",
    cat: "culture",
    emoji: "🌟",
    title: "My First 6 Months at Google Bangalore — The Real Truth",
    author: "Priya Mehta",
    role: "SDE II, Google",
    date: "Feb 2025",
    excerpt:
    "Everyone imagines Google as nap pods and free food all day. Here's the reality: it's intense, collaborative, and the best professional experience of my life.",
    tags: ["culture", "growth"],
    body: `When I joined Google's Bangalore office after 3 years at a startup, I expected chaos — or total utopia. The truth was somewhere in between.

**The First Week — Noogler Onboarding**
You get your colorful propeller hat, access to 1000+ internal tools, and introductions to your team. The buddy system is real and actually useful. Week one is mostly orientation and setting up your dev environment (which, with Piper/CitC, takes a solid 3 days).

**The Code Review Culture**
This shocked me most. Every line of code gets reviewed by at least 2 senior engineers before merging. At first it felt painfully slow. By month 3, I realized this is why Google's codebase is remarkably maintainable at billion-line scale. Engineers here genuinely care about readability.

**Free Food & Perks**
Yes, it's real. The cafeteria at Bengaluru's GHE office is genuinely excellent — multiple cuisines, chef stations, healthy options. But you stop noticing after a month. It just becomes normal. The real perks are 20% time projects and the ability to work on problems affecting billions of people.

**What's Actually Hard**
The impact bar is brutally high. If you're used to shipping features alone at a startup, adjusting to massive modular team structures takes time. Also — navigating the internal codebase (Piper) when you're new is legitimately overwhelming.

**Compensation Transparency**
At Google India, L3 starts around ₹25-35 LPA all-in. L4 is ₹40-60 LPA. Stock refreshes make a significant difference after year 2.

**Bottom Line**
If you're targeting Google — prepare DSA seriously (at least 300 LeetCode problems, 50% medium, 25% hard), study system design from Grokking or ByteByteGo, and practice articulating your thought process aloud. Every minute of prep is worth it.`,
},
{
    id: 2,
    company: "Microsoft",
    coId: "microsoft",
    cat: "growth",
    emoji: "💙",
    title:
    "From TCS to Microsoft: The 5-Year Journey Nobody Tells You About",
    author: "Arjun Singh",
    role: "SDE II, Microsoft Hyderabad",
    date: "Jan 2025",
    excerpt:
    "After 4 years in TCS at 7 LPA, making the switch to Microsoft felt like jumping off a cliff. Here's the real comparison of cultures.",
    tags: ["growth", "culture"],
    body: `I spent 4 years at TCS before cracking Microsoft's lateral hiring process. The culture difference was everything people said — and more.

**Code Quality Standards**
At Microsoft, code quality is non-negotiable. Every PR goes through automated tests, Roslyn static analysis, and mandatory peer review. My first 5 PRs were returned with 15-25 review comments each. Embarrassing in the moment, but I learned more in 3 months than in 4 years at TCS.

**Growth Mindset is Not Just Marketing**
Satya Nadella's "Growth Mindset" culture is genuinely practiced. My manager explicitly told me: "I expect you to fail fast on experiments. Don't optimize for looking good, optimize for learning." This is actually liberating if you come from a blame-heavy environment.

**The Scale**
I work on Microsoft Teams' messaging backend. 300 million daily active users. Every optimization has real, measurable impact. When your cache fix saves 50ms for 300M users, it's deeply satisfying.

**Work-Life Balance**
Honestly better than I expected after stories of big tech crunch culture. Generally 45-50 hour weeks in Hyderabad. Crunch happens during major Windows or Teams release cycles. WFH policies are quite flexible.

**Salary Reality Check**
From ₹7 LPA at TCS (year 4) to ₹28 LPA at Microsoft (SDE1). With performance bonuses and stock, it was ₹32 LPA effective. That's the real reason to work hard on the interview prep.

**Advice**
Focus on Clean Code principles, do at least 200 LeetCode problems, and read "Designing Data-Intensive Applications" for system design. The investment pays back in months.`,
},
{
    id: 3,
    company: "Flipkart",
    coId: "flipkart",
    cat: "work",
    emoji: "🛒",
    title:
    "Inside Flipkart's Big Billion Days — 5 Days of Controlled Chaos",
    author: "Sneha Patel",
    role: "Senior SDE, Flipkart",
    date: "Dec 2024",
    excerpt:
    "Big Billion Days is Flipkart's biggest event. Here's what engineering teams experience during those insane 5 days — from the inside.",
    tags: ["work", "culture"],
    body: `People experience Big Billion Days from the outside — incredible deals, fast deliveries, massive discounts. Engineering teams live something entirely different.

**6 Months of Preparation**
BBD prep starts in April for the October event. Chaos engineering runs, load testing at 10x expected traffic, capacity planning, dark launches. Every service gets stress-tested. Engineers call it the "BBD season" — it's a mindset.

**The Night Before**
All hands on deck. Engineers assigned to monitoring dashboards. On-call rotations clearly defined. Incident commanders named. Slack channels multiplied. Everyone's phone is on max volume.

**First 5 Minutes Live**
We handle more traffic in the opening 5 minutes than the entire previous month. Watching dashboards turn green as systems hold under peak load is genuinely exhilarating. There's a real rush when the system performs as designed.

**When Things Break**
Because things do break. One year, a downstream recommendation service had a cascade failure. The team rolled back in 4 minutes flat. Post-mortems are blameless — "What failed, why, and what's the fix" — never "who failed."

**After BBD**
Sleep. Then celebration. Then a detailed retrospective that literally makes next year's systems better. The engineering lessons from each BBD are documented company-wide.

**Is Flipkart Right for You?**
Fast-paced is an understatement. Quarterly OKRs are intense. If you love solving hard distributed systems problems at real Indian internet scale — Flipkart is incredible. If you want slow, predictable work — look elsewhere.`,
},
{
    id: 4,
    company: "Infosys",
    coId: "infosys",
    cat: "culture",
    emoji: "🎓",
    title: "Infosys Mysuru Training: The Unfiltered Experience",
    author: "Rahul Kumar",
    role: "Systems Engineer, Infosys",
    date: "Nov 2024",
    excerpt:
    "Every Infosys fresher spends 3 months at Mysuru campus training. Here's the honest, unfiltered experience from someone who just finished it.",
    tags: ["culture", "work"],
    body: `Infosys Mysuru is legendary among engineering freshers. The campus is genuinely beautiful — like a resort. Here's the real experience.

**The Campus**
Mysuru Development Centre spans 337 acres. Multiple restaurants, gym, swimming pool, cricket grounds, medical center. For someone from a tier-2 city, it genuinely feels surreal the first week.

**Training Structure**
Weeks 1-2: Orientation, Java/Unix fundamentals. Weeks 3-8: Deep stream training (Java EE, .NET, SAP, Python). Weeks 9-12: Project simulation and client scenario assessments.

**The Reality of Assessments**
Every 2 weeks there's an assessment. Score below 60% means a remedial module. Three failures = you're asked to leave. People do get let go. Study groups form naturally because the stakes are real.

**What Scores Determine**
This is the part nobody tells you clearly: your training assessment scores and performance in internal manager interviews directly determine which client project you get assigned to, and which city. Top scorers get better projects and location preferences.

**Social Life**
500+ freshers from across India. You make genuinely close friends. Cultural nights, sports events, regional food nights. It's a unique experience you'll never quite replicate.

**After Training**
Project deployment. Ideally your preferred city, but relocation is common. The technical skills from Mysuru genuinely translate to project work — more than I expected.`,
},
{
    id: 5,
    company: "TCS",
    coId: "tcs",
    cat: "growth",
    emoji: "🚀",
    title: "Growing from Fresher to Senior at TCS — 5 Years, Honestly",
    author: "Akash Verma",
    role: "Senior Engineer, TCS",
    date: "Oct 2024",
    excerpt:
    "I joined TCS at 3.5 LPA straight from college. Five years later, the journey taught me what TCS actually gives you — and what it doesn't.",
    tags: ["growth"],
    body: `TCS is the first job for tens of thousands of Indian engineers every year. Here's the real 5-year career trajectory from the inside.

**Year 1: Training & First Project**
ILP (Initial Learning Program) is 3-6 months. Your first project almost certainly involves maintenance of existing client systems. Don't expect greenfield development or modern tech stacks. You're supporting enterprise Java applications from 2005. Accept this and learn from it.

**Year 2-3: Ownership Begins**
You start owning modules. Client calls begin — especially if you're in a US time zone project (6PM-3AM IST shifts are real). Salary increments run 5-8% annually, which is well below market. This is when the decision point starts brewing.

**Year 4: The Fork in the Road**
This is the critical moment. Most TCS engineers face a choice: stay comfortable and plateau, or prepare seriously for product companies. I started LeetCode aggressively in year 4 while still employed. It's doable if you commit 1.5-2 hours daily.

**What TCS Actually Gives You**
Enterprise system scale, client communication skills, process discipline, SQL and production debugging experience. These are underrated. Product companies value engineers who've seen production incidents.

**What TCS Doesn't Give**
Cutting-edge technology, market-rate salary growth, or fast-track progression unless you're proactive about internal transfers (which do exist via iKonnect).

**The Switch**
After 5 years, I moved to a product startup at 18 LPA. The TCS foundation — debugging skills, client mindset, documentation habits — was actually valued. But the prep happened on my own time, every evening for 8 months.`,
},
];

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
var currentUser = null;
var currentCo = null;
var currentRoundIdx = -1;
var activeFilter = "all";
var activeBlogFilter = "all";
var toastTimer = null;
var feedbackRating = 0;
var videoStream = null;

var hrState = {
questions: [],
idx: 0,
answers: [],
recordings: [],
timings: [],
feedback: [],
scores: [],
qStartTime: null,
mediaRecorder: null,
audioChunks: [],
isRecording: false,
recInterval: null,
recSecs: 0,
company: "",
companyId: "",
level: "fresher",
};

var mockState = {
type: "",
questions: [],
idx: 0,
answers: [],
timings: [],
qStartTime: null,
selectedOpt: "",
evalResults: [],
};

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function goPage(id) {
clearQuestionTimer();
if(activeSpeechRecognition) { activeSpeechRecognition.stop(); activeSpeechRecognition = null; }
document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
const el = document.getElementById("pg-" + id);
if (el) {
    el.classList.add("active");
    window.scrollTo(0, 0);
}
// Stop camera when leaving HR page
if (id !== "hr" && videoStream) {
    stopAllCamera();
}
// Fullscreen + tab guard for interview pages
const interviewPages = ["mock", "hr", "round"];
if (interviewPages.includes(id)) {
    enterFullscreenMode();
} else {
    exitFullscreenMode();
}
}

// ── FULLSCREEN + TAB SWITCH GUARD ──────────────
let tabSwitchWarnings = 0;
let fullscreenActive = false;

// ── MEDIA GUARD ─────────────────────────────────
// Mic/camera permission prompts and SpeechSynthesis
// briefly steal browser focus and fire visibilitychange
// and fullscreenchange — we must suppress those false triggers.
let _mediaBusy = false;
function _setMediaBusy(val) {
_mediaBusy = val;
if (!val) {
    // keep guard on for a short grace period after media resolves
    setTimeout(() => { _mediaBusy = false; }, 1200);
}
}

function enterFullscreenMode() {
fullscreenActive = true;
tabSwitchWarnings = 0;
document.getElementById("anticheat-banner").style.display = "flex";
const el = document.documentElement;
const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
if (req) req.call(el).catch(() => {});
}
function exitFullscreenMode() {
fullscreenActive = false;
tabSwitchWarnings = 0;
document.getElementById("anticheat-banner").style.display = "none";
try {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
} catch(e) {}
}

// ── Tab visibility: only warn on REAL tab switches (hidden > 800 ms) ──
let _hiddenSince = 0;
document.addEventListener("visibilitychange", function() {
if (!fullscreenActive) return;
if (_mediaBusy) return;           // mic/camera prompt caused this — ignore
if (document.hidden) {
    _hiddenSince = Date.now();
} else {
    if (_hiddenSince && (Date.now() - _hiddenSince) > 800) {
    tabSwitchWarnings++;
    document.getElementById("tab-warning-modal").style.display = "flex";
    document.getElementById("tab-warning-count").textContent = tabSwitchWarnings;
    }
    _hiddenSince = 0;
}
});

// ── Fullscreen exit: debounced + guarded to avoid mic-prompt false positives ──
let _fsWarnTimer = null;
function _onFsChange() {
if (!fullscreenActive) return;
if (_mediaBusy) return;
clearTimeout(_fsWarnTimer);
_fsWarnTimer = setTimeout(() => {
    // Re-check: if still in fullscreen by now, it was a transient event — ignore
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    if (!fullscreenActive || _mediaBusy) return;
    document.getElementById("fullscreen-warning").style.display = "flex";
}, 800);
}
document.addEventListener("fullscreenchange", _onFsChange);
document.addEventListener("webkitfullscreenchange", _onFsChange);

function resumeFullscreen() {
document.getElementById("fullscreen-warning").style.display = "none";
document.getElementById("tab-warning-modal").style.display = "none";
if (fullscreenActive) {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) req.call(el).catch(() => {});
}
}
document.addEventListener("keydown", function(e) {
if (!fullscreenActive) return;
if (e.key === "F11") e.preventDefault();
});

// ── Helper: wrap any getUserMedia call so it suppresses false warnings ──
async function safeGetUserMedia(constraints) {
_mediaBusy = true;
try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    setTimeout(() => { _mediaBusy = false; }, 1200);
    return stream;
} catch(e) {
    setTimeout(() => { _mediaBusy = false; }, 1200);
    throw e;
}
}

function stopAllCamera() {
if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
    videoStream = null;
}
window.speechSynthesis.cancel();
if (hrState.isRecording) {
    stopRec();
}
}
function exitInterview() {
document.getElementById("fullscreen-warning").style.display = "none";
document.getElementById("tab-warning-modal").style.display = "none";
clearQuestionTimer();
stopAllCamera();
exitFullscreenMode();
goPage("dashboard");
}
async function requestMicPermission() {
try {
    const stream = await safeGetUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    document.getElementById("mic-permission-modal").style.display = "none";
    showToast("✅ Microphone access granted!");
} catch(e) {
    showToast("❌ Microphone access denied. Please allow in browser settings.", true);
}
}

function requireLogin(cb) {
if (!currentUser) {
    currentUser = {
    fn: "Demo",
    ln: "User",
    em: "demo@prepedge.com",
    co: "B.Tech / B.E.",
    ro: "Software Developer",
    lv: "fresher",
    };
    renderNav();
    renderDashboard();
}
cb();
}
function showCompanies() {
renderCompanies();
goPage("companies");
}
function openModal(id) {
const el = document.getElementById("modal-" + id);
if (el) el.classList.add("open");
}
function closeModal(id) {
const el = document.getElementById("modal-" + id);
if (el) el.classList.remove("open");
}
function showToast(msg, isErr) {
const t = document.getElementById("toast");
t.textContent = msg;
t.style.background = isErr ? "var(--red)" : "var(--green)";
t.classList.add("show");
clearTimeout(toastTimer);
toastTimer = setTimeout(() => t.classList.remove("show"), 3500);
}
function logoFallback(el, l) {
el.parentElement.innerHTML =
    '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:#444;font-family:Syne,sans-serif">' +
    l +
    "</div>";
}
function cap(s) {
return s ? s[0].toUpperCase() + s.slice(1) : "";
}
function fmt(s) {
return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
}
function lvlBadge(lvl) {
if (!lvl) return "";
if (lvl.includes("Hard"))
    return '<span class="lvl-badge lvl-hard">' + lvl + "</span>";
if (lvl.includes("Medium"))
    return '<span class="lvl-badge lvl-med">' + lvl + "</span>";
return '<span class="lvl-badge lvl-easy">' + lvl + "</span>";
}
function scoreColor(s) {
if (s >= 80) return "var(--green)";
if (s >= 60) return "var(--gold)";
return "var(--red)";
}

// ══════════════════════════════════════════════
// REGISTRATION
// ══════════════════════════════════════════════
function doRegister() {
const fn = document.getElementById("r-fn").value.trim();
const em = document.getElementById("r-em").value.trim();
if (!fn || !em) {
    showToast("Please fill required fields", true);
    return;
}
currentUser = {
    fn,
    ln: document.getElementById("r-ln").value.trim(),
    em,
    co: document.getElementById("r-co").value,
    ro: document.getElementById("r-ro").value,
    lv: document.getElementById("r-lv").value,
};
closeModal("register");
renderNav();
renderDashboard();
goPage("dashboard");
showToast("🎉 Welcome to PrepEdge, " + fn + "!");
}

// ══════════════════════════════════════════════
// NAV
// ══════════════════════════════════════════════
function renderNav() {
const nl = document.getElementById("nav-links");
if (!currentUser) {
    nl.innerHTML =
    '<span onclick="showCompanies()">Companies</span>' +
    '<button class="btn btn-primary btn-sm" onclick="openModal(\'register\')">Register Free →</button>';
} else {
    nl.innerHTML =
    '<span onclick="showCompanies()">Companies</span>' +
    "<span onclick=\"goPage('dashboard')\">Dashboard</span>" +
    '<div class="profile-btn" onclick="toggleProfileMenu()" title="My Profile">' +
    '<div class="profile-avatar">' + (currentUser.fn ? currentUser.fn[0].toUpperCase() : 'U') + '</div>' +
    '<div class="profile-menu" id="profile-menu">' +
    '<div class="pm-name">' + currentUser.fn + ' ' + currentUser.ln + '</div>' +
    '<div class="pm-role">' + currentUser.ro + '</div>' +
    '<div class="pm-divider"></div>' +
    '<div class="pm-item" onclick="event.stopPropagation();goPage(\'dashboard\');closeProfileMenu()">📊 Dashboard</div>' +
    '<div class="pm-item" onclick="event.stopPropagation();goPage(\'dashboard\');setTimeout(showAnalytics,100);closeProfileMenu()">📈 Analytics</div>' +
    '<div class="pm-item" onclick="event.stopPropagation();goPage(\'blog\');renderBlog();closeProfileMenu()">📝 Company Blogs</div>' +
    '<div class="pm-item" onclick="event.stopPropagation();openModal(\'feedback\');closeProfileMenu()">💬 Feedback</div>' +
    '<div class="pm-divider"></div>' +
    '<div class="pm-item pm-logout" onclick="event.stopPropagation();currentUser=null;renderNav();goPage(\'home\')">Sign Out</div>' +
    '</div></div>';
}
}
function toggleProfileMenu() {
const m = document.getElementById("profile-menu");
if(m) m.classList.toggle("open");
}
function closeProfileMenu() {
const m = document.getElementById("profile-menu");
if(m) m.classList.remove("open");
}
document.addEventListener("click", function(e) {
const pb = e.target.closest(".profile-btn");
if(!pb) closeProfileMenu();
});

// ══════════════════════════════════════════════
// COMPANIES
// ══════════════════════════════════════════════
function setFilter(btn) {
document
    .querySelectorAll(".fbtn")
    .forEach((b) => b.classList.remove("on"));
btn.classList.add("on");
activeFilter = btn.getAttribute("data-f");
renderCompanies();
}
function renderCompanies() {
const q = (
    document.getElementById("co-search").value || ""
).toLowerCase();
const list = COMPANIES.filter(
    (c) =>
    (activeFilter === "all" || c.type === activeFilter) &&
    (!q ||
        c.name.toLowerCase().includes(q) ||
        c.roles.join(" ").toLowerCase().includes(q)),
);
const g = document.getElementById("co-grid");
if (!g) return;
if (!list.length) {
    g.innerHTML =
    '<div class="empty"><div class="big">🔍</div>No results found</div>';
    return;
}
g.innerHTML = list
    .map(
    (c) => `
<div class="co-card" onclick="openCo('${c.id}')">
<div class="co-logo"><img src="${c.logo}" alt="${c.name}" onerror="logoFallback(this,'${c.short[0]}')"></div>
<div class="co-name">${c.name}</div>
<div class="co-roles">${c.roles.slice(0, 2).join(" · ")}</div>
<div class="co-tags">${c.tags.map((t, i) => '<span class="tag ' + c.tc[i] + '">' + t + "</span>").join("")}</div>
<div class="co-btns"><button class="btn btn-primary btn-sm">Prepare Now →</button></div>
</div>`,
    )
    .join("");
}

function openCo(id) {
const c = COMPANIES.find((x) => x.id === id);
if (!c) return;
if (!currentUser) {
    openModal("register");
    return;
}
currentCo = c;
// Header
document.getElementById("co-hdr-in").innerHTML = `
<div class="co-logo-xl"><img src="${c.logo}" alt="${c.name}" onerror="logoFallback(this,'${c.short[0]}')"></div>
<div class="co-hdr-info">
<h1>${c.name}</h1>
<p>${c.about}</p>
<div class="co-meta">
<div class="cm"><div class="cm-l">Package</div><div class="cm-v">${c.pkg}</div></div>
<div class="cm"><div class="cm-l">Openings</div><div class="cm-v">${c.opens}</div></div>
<div class="cm"><div class="cm-l">Drive</div><div class="cm-v">${c.drive}</div></div>
</div>
<div class="co-act">
<button class="btn btn-primary" onclick="startHRInterview('${c.id}')">🎙️ HR Mock Interview</button>
<button class="btn btn-gold" onclick="window.open('${c.url}','_blank')">Apply Now ↗</button>
</div>
</div>`;
// Rounds
document.getElementById("rg-body").innerHTML = c.rounds
    .map(
    (r, i) => `
<div class="rc">
<div class="rn">${i + 1}</div>
<div class="rt">${r.name} ${lvlBadge(r.level)}</div>
<div class="rd">${r.desc}</div>
<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.85rem">${r.topics.map((t) => '<span style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:.2rem .5rem;font-size:.7rem">' + t + "</span>").join("")}</div>
${r.links && r.links.length ? '<div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.75rem">' + r.links.map((l) => `<a href="${l.url}" target="_blank" class="rs-link">${l.icon} ${l.name}${l.badge ? '<span class="lvl-badge ' + getLvlClass(l.badge) + '">' + l.badge + "</span>" : ""}</a>`).join("") + "</div>" : ""}
<div class="rbtns">
<button class="btn btn-primary btn-sm" onclick="openMock(${i},'${c.id}')">🎯 Mock Interview</button>
<button class="btn btn-outline btn-sm" onclick="openRound(${i})">Study Guide</button>
</div>
</div>`,
    )
    .join("");
// Roadmap
buildRoadmap(c);
// Prep
buildPrep(c);
// Apply
document.getElementById("ap-body").innerHTML = `
<div class="sec-title">Apply to ${c.name}</div>
<div class="sec-sub" style="margin-bottom:1.5rem">Official portal and PrepEdge quick apply</div>
<div class="ac">
<div class="ac-icon">🌐</div>
<div class="ac-info"><strong>${c.name} Official Careers</strong><small>${c.url}</small></div>
<button class="btn btn-primary" onclick="window.open('${c.url}','_blank')">Open Portal ↗</button>
</div>
<div class="ac" style="border-color:rgba(59,130,246,.35)">
<div class="ac-icon">⚡</div>
<div class="ac-info"><strong>Quick Apply via PrepEdge</strong><small>${currentUser ? currentUser.fn + " " + currentUser.ln + " | " + currentUser.ro : ""}</small></div>
<button class="btn btn-gold" onclick="showToast('✅ Application submitted! You will receive confirmation.')">Apply via PrepEdge ✓</button>
</div>`;
// Overview
document.getElementById("ov-body").innerHTML = `
<div class="pb"><h3>About ${c.name}</h3><p style="color:var(--muted);line-height:1.75">${c.about}</p></div>
<div class="pb">
<h3>🏢 Company Culture</h3>
<p style="color:var(--muted);line-height:1.75">${c.culture}</p>
<button class="btn btn-outline btn-sm" style="margin-top:.75rem" onclick="goPage('blog');renderBlog('${c.id}')">📝 Read Employee Stories →</button>
</div>
<div class="pb"><h3>📊 Quick Stats</h3>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.75rem">
<div style="background:var(--surface2);border-radius:10px;padding:1rem;text-align:center"><div style="font-family:Syne,sans-serif;font-size:1.4rem;font-weight:800;color:var(--accent)">${c.rounds.length}</div><div style="font-size:.75rem;color:var(--muted)">Interview Rounds</div></div>
<div style="background:var(--surface2);border-radius:10px;padding:1rem;text-align:center"><div style="font-family:Syne,sans-serif;font-size:1.2rem;font-weight:800;color:var(--green)">${c.pkg}</div><div style="font-size:.75rem;color:var(--muted)">Package Range</div></div>
<div style="background:var(--surface2);border-radius:10px;padding:1rem;text-align:center"><div style="font-family:Syne,sans-serif;font-size:1.4rem;font-weight:800;color:var(--gold)">${c.opens}</div><div style="font-size:.75rem;color:var(--muted)">Openings</div></div>
</div>
</div>`;
resetTabs();
goPage("company");
}

function getLvlClass(badge) {
if (!badge) return "";
if (badge.includes("Hard")) return "lvl-hard";
if (badge.includes("Medium")) return "lvl-med";
return "lvl-easy";
}

function buildRoadmap(c) {
const steps = c.rounds.map((r, i) => {
    const practiceLinks = r.links
    ? r.links
        .map(
            (l) =>
            `<a class="rs-link" href="${l.url}" target="_blank">${l.icon} ${l.name}${l.badge ? '<span class="lvl-badge ' + getLvlClass(l.badge) + '">' + l.badge + "</span>" : ""}</a>`,
        )
        .join("")
    : "";
    const ytLinksHTML = r.ytLinks
    ? r.ytLinks
        .map(
            (l) =>
            `<a class="rs-link yt" href="${l.url}" target="_blank">${l.icon} ${l.name}</a>`,
        )
        .join("")
    : "";
    return `
<div class="roadmap-step">
<div class="rs-num">${i + 1}</div>
<div class="rs-body">
    <div class="rs-title">${r.name} ${lvlBadge(r.level)}</div>
    <div class="rs-desc">${r.desc}</div>
    <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.6rem">${r.topics.map((t) => '<span style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:4px;padding:.15rem .5rem;font-size:.7rem;color:var(--accent)">' + t + "</span>").join("")}</div>
    ${practiceLinks ? `<div class="rs-links">${practiceLinks}</div>` : ""}
    ${ytLinksHTML ? `<div class="rs-links" style="margin-top:.4rem">${ytLinksHTML}</div>` : ""}
    <div style="margin-top:.65rem;display:flex;gap:.5rem;flex-wrap:wrap">
    <button class="btn btn-primary btn-sm" onclick="openMock(${i},'${c.id}')">🎯 Mock This Round</button>
    ${r.type === "hr" ? `<button class="btn btn-gold btn-sm" onclick="startHRInterview('${c.id}')">🎙️ Voice HR Mock</button>` : ""}
    </div>
</div>
</div>`;
});
document.getElementById("rm-body").innerHTML = `
<div class="sec-title">📍 Full Preparation Roadmap</div>
<div class="sec-sub">Step-by-step guide to crack ${c.name} with direct level-wise resource links</div>
<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:1rem;margin-bottom:1.5rem;font-size:.85rem;color:var(--gold)">
💡 <strong>Coding Note:</strong> We don't make you solve code here. The LeetCode/GFG links below open the exact problems curated for ${c.name} at the right difficulty level for your round.
</div>
${steps.join("")}`;
}

function buildPrep(c) {
function mkBlock(title, items, icon) {
    return `<div class="pb"><h3>${title}</h3><div class="rl">${items
    .map(
        (item) => `
<div style="display:flex;align-items:center;gap:.6rem">
<a class="ri" style="flex:1" href="${item.url}" target="_blank"><div class="ri-icon">${icon}</div>${item.name}</a>
<a href="${item.yt}" target="_blank" class="btn btn-sm" style="background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.25);flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/>
    </svg> YT</a>
</div>`,
    )
    .join("")}</div></div>`;
}
const debugHTML = `<div class="pb"><h3>🤖 AI-Generated Practice</h3>
<p style="color:var(--muted);font-size:.85rem;margin-bottom:1rem">Gemini AI generates fresh questions every session — no repeats.</p>
<div style="display:flex;gap:.75rem;flex-wrap:wrap">
<button class="btn btn-primary" onclick="openMock(0,'${c.id}')">📝 AI Aptitude Test</button>
<button class="btn btn-outline" onclick="openDebugMock('Python')">🐛 Python Debugging</button>
<button class="btn btn-outline" onclick="openDebugMock('Java')">☕ Java Debugging</button>
<button class="btn btn-gold" onclick="startHRInterview('${c.id}')">🎙️ Voice HR Interview</button>
</div></div>`;
document.getElementById("pr-body").innerHTML =
    mkBlock("📐 Aptitude & Reasoning", c.prep.a, "📘") +
    mkBlock("💻 Technical Preparation", c.prep.t, "⚙️") +
    mkBlock("🤝 HR & Soft Skills", c.prep.h, "🎯") +
    debugHTML;
}

function doTab(id, btn) {
document
    .querySelectorAll("#co-tabs .tb")
    .forEach((b) => b.classList.remove("on"));
document
    .querySelectorAll("#pg-company .tp")
    .forEach((p) => p.classList.remove("on"));
btn.classList.add("on");
document.getElementById("tp-" + id).classList.add("on");
window.scrollTo(0, 0);
}
function resetTabs() {
document
    .querySelectorAll("#co-tabs .tb")
    .forEach((b) => b.classList.remove("on"));
document
    .querySelectorAll("#pg-company .tp")
    .forEach((p) => p.classList.remove("on"));
document.querySelector("#co-tabs .tb").classList.add("on");
document.getElementById("tp-overview").classList.add("on");
}

function openRound(idx) {
const c = currentCo;
const r = c.rounds[idx];
currentRoundIdx = idx;
const allLinks = [...(r.links || []), ...(r.ytLinks || [])];
document.getElementById("rd-body").innerHTML = `
<div style="display:flex;gap:.6rem;align-items:center;margin-bottom:1.3rem;flex-wrap:wrap">
<button class="btn btn-outline btn-sm" onclick="goPage('company')">← Back</button>
<span style="font-size:.8rem;color:var(--muted)">${c.name} / Round ${idx + 1}</span>
</div>
<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-family:Syne,sans-serif;font-weight:800;font-size:.95rem;flex-shrink:0">R${idx + 1}</div>
<div><div class="sec-title" style="margin-bottom:0;font-size:1.5rem">${r.name} ${lvlBadge(r.level)}</div><div style="color:var(--muted);font-size:.84rem">${c.name}</div></div>
</div>
<p style="color:var(--muted);line-height:1.72;margin-bottom:1.5rem;font-size:.9rem">${r.desc}</p>
<div class="pb"><h3>📋 Topics Covered</h3><div class="tg">${r.topics.map((t) => '<div class="tc">✦ ' + t + "</div>").join("")}</div></div>
${r.links && r.links.length ? `<div class="pb"><h3>🔗 Practice Resources (LeetCode / GFG / HackerRank)</h3><div class="rs-links" style="flex-wrap:wrap">${r.links.map((l) => `<a class="rs-link" href="${l.url}" target="_blank">${l.icon || "🔗"} ${l.name}${l.badge ? '<span class="lvl-badge ' + getLvlClass(l.badge) + '">' + l.badge + "</span>" : ""}</a>`).join("")}</div></div>` : ""}
${r.ytLinks && r.ytLinks.length ? `<div class="pb"><h3>▶️ YouTube Video Guides</h3><div style="display:flex;flex-direction:column;gap:.5rem">${r.ytLinks.map((l) => `<a href="${l.url}" target="_blank" style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:9px;text-decoration:none;color:var(--text);transition:all .2s" onmouseover="this.style.borderColor='#ef4444'" onmouseout="this.style.borderColor='rgba(239,68,68,0.2)'"><svg width="22" height="22" viewBox="0 0 24 24" fill="red"><path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/></svg><span style="font-weight:600;font-size:.88rem">${l.name}</span><span style="margin-left:auto;font-size:.75rem;color:var(--red);font-weight:600">Watch →</span></a>`).join("")}</div></div>` : ""}
<div class="pb"><h3>💡 Study Strategy</h3><div class="sl">
<div class="si"><span class="sn">01</span><span>Understand this round's format and time limits thoroughly before starting prep.</span></div>
<div class="si"><span class="sn">02</span><span>Watch the YouTube guides above. Start from Easy, move to Medium, then Hard.</span></div>
<div class="si"><span class="sn">03</span><span>Practice problems on LeetCode/GFG using the links above.</span></div>
<div class="si"><span class="sn">04</span><span>Take the mock interview below to simulate real pressure and timing.</span></div>
</div></div>
<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.5rem">
<button class="btn btn-gold btn-lg" onclick="openMock(${idx},'${c.id}')">🎯 Take Mock Interview</button>
</div>`;
goPage("round");
}

// ══════════════════════════════════════════════
// MOCK INTERVIEW (Aptitude + Technical + Debug)
// ══════════════════════════════════════════════
async function openMock(idx, coId) {
const co = coId ? COMPANIES.find((c) => c.id === coId) : currentCo;
if (!co) return;
currentCo = co;
currentRoundIdx = idx;
const round = co.rounds[idx];
if (round.type === "hr") {
    startHRInterview(co.id);
    return;
}
mockState.type = round.type;
mockState.idx = 0;
mockState.answers = [];
mockState.timings = [];
mockState.selectedOpt = "";
mockState.evalResults = [];
mockState.pendingEvals = [];
goPage("mock");
const lv = currentUser ? currentUser.lv : "fresher";
const lp = getLevelProfile(lv);
const body = document.getElementById("mock-body");
const levelLabel = { fresher: "Fresher", junior: "Junior (1–3 yrs)", mid: "Mid-Level (3–6 yrs)", experienced: "Senior (6+ yrs)" }[lv] || lv;

body.innerHTML = `
    <div style="text-align:center;padding:4rem 2rem">
    <div class="spinner-wrap" style="justify-content:center;flex-direction:column;gap:1.2rem">
        <div class="spinner" style="width:32px;height:32px;border-width:3px"></div>
        <div><strong>Generating ${round.name} questions</strong></div>
        <div style="display:inline-flex;align-items:center;gap:.5rem;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);border-radius:100px;padding:.35rem 1rem;font-size:.82rem;color:var(--accent)">
        👤 Level: ${levelLabel}
        </div>
        <div style="color:var(--muted);font-size:.82rem">Questions are tailored to your experience level</div>
    </div>
    </div>`;

let questions = null;

if (round.type === "aptitude") {
    questions = await genAptitudeQs(co.name, lv);

} else if (round.type === "managerial") {
    questions = await genManagerialQs(co.name, round.name, round.topics, lv);

} else if (round.type === "technical") {
    questions = await genTechnicalQs(co.name, round.name, round.topics, lv);

} else if (round.type === "coding" || round.type === "debug") {
    // Detect language hint from round topics
    const lang = round.topics.find(t => /java|python|c\+\+|javascript|kotlin/i.test(t)) || "Java";
    questions = await genDebugQs(lang, lv);

} else {
    // fallback: use technical generator
    questions = await genTechnicalQs(co.name, round.name, round.topics, lv);
}

mockState.questions = questions ? shuffle(questions) : getFallback(round, lv);
mockState.qStartTime = Date.now();
renderMockQ();
}

async function openDebugMock(lang) {
mockState.type = "debug";
mockState.idx = 0;
mockState.answers = [];
mockState.timings = [];
mockState.evalResults = [];
mockState.pendingEvals = [];
goPage("mock");
const lv = currentUser ? currentUser.lv : "fresher";
const lp = getLevelProfile(lv);
const body = document.getElementById("mock-body");
body.innerHTML = `<div style="text-align:center;padding:4rem"><div class="spinner-wrap" style="justify-content:center;flex-direction:column;gap:1rem"><div class="spinner" style="width:24px;height:24px"></div><span>Generating <strong>${lang}</strong> debugging questions for your level...</span><div style="font-size:.8rem;color:var(--muted)">Difficulty: ${lp.codingDiff}</div></div></div>`;
const qs = await genDebugQs(lang, lv);
if (!qs) {
    body.innerHTML = '<div class="pw"><p style="color:var(--muted)">Failed to generate questions. Please try again.</p><button class="btn btn-outline" onclick="goPage(\'company\')">← Back</button></div>';
    return;
}
mockState.questions = qs;
mockState.qStartTime = Date.now();
renderMockQ();
}

// ── SHUFFLE utility ─────────────────────────────
function shuffle(arr) {
const a = [...arr];
for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
}
return a;
}

function getFallback(round, level) {
const lv = level || (currentUser ? currentUser.lv : "fresher");
if (round.type === "aptitude") return shuffle(getFallbackAptitude(lv)).slice(0, 8);
if (round.type === "managerial") return shuffle(getFallbackManagerial(lv)).slice(0, 6);
if (round.type === "coding" || round.type === "debug") return shuffle(getFallbackDebug(lv)).slice(0, 5);
return shuffle(getFallbackTechnical(round, lv));
}

function getFallbackAptitude(level) {
const banks = {
    fresher: [
    { question: "If 6 workers complete a task in 10 days, how many workers are needed to finish in 5 days?", options: ["A: 8", "B: 10", "C: 12", "D: 15"], correct: "C", explanation: "Workers × Days = constant. 6×10 = W×5 → W = 12.", difficulty: "Easy", topic: "Quantitative" },
    { question: "Next number in series: 2, 4, 8, 16, ?", options: ["A: 24", "B: 32", "C: 30", "D: 28"], correct: "B", explanation: "Each term doubles. 16×2 = 32.", difficulty: "Easy", topic: "Logical" },
    { question: "Shopkeeper gains 20% profit. Cost ₹500. Selling price?", options: ["A: ₹550", "B: ₹580", "C: ₹600", "D: ₹520"], correct: "C", explanation: "SP = 500 × 1.2 = ₹600.", difficulty: "Easy", topic: "Quantitative" },
    { question: "Antonym of VERBOSE:", options: ["A: Wordy", "B: Concise", "C: Elaborate", "D: Lengthy"], correct: "B", explanation: "Verbose means using too many words. Antonym = Concise.", difficulty: "Easy", topic: "Verbal" },
    { question: "A > B and B > C. Which must be true?", options: ["A: C > A", "B: A > C", "C: B > A", "D: Cannot determine"], correct: "B", explanation: "Transitive: A > B > C → A > C.", difficulty: "Easy", topic: "Logical" },
    { question: "A can do a job in 12 days, B in 18 days. Together?", options: ["A: 6 days", "B: 7 days", "C: 7.2 days", "D: 8 days"], correct: "C", explanation: "1/12+1/18 = 5/36 per day → 36/5 = 7.2 days.", difficulty: "Easy", topic: "Quantitative" },
    { question: "Simple interest on ₹1000 at 5% p.a. for 2 years?", options: ["A: ₹50", "B: ₹100", "C: ₹150", "D: ₹200"], correct: "B", explanation: "SI = 1000×5×2/100 = ₹100.", difficulty: "Easy", topic: "Quantitative" },
    { question: "Fibonacci: 1, 1, 2, 3, 5, 8, ?", options: ["A: 11", "B: 12", "C: 13", "D: 14"], correct: "C", explanation: "5+8 = 13.", difficulty: "Easy", topic: "Logical" },
    { question: "Rectangle: length 12cm, width 8cm. Area?", options: ["A: 40cm²", "B: 96cm²", "C: 80cm²", "D: 48cm²"], correct: "B", explanation: "12 × 8 = 96cm².", difficulty: "Easy", topic: "Quantitative" },
    { question: "If today is Monday, what day is 100 days from now?", options: ["A: Monday", "B: Tuesday", "C: Wednesday", "D: Saturday"], correct: "C", explanation: "100 ÷ 7 = 14 weeks + 2 days. Monday + 2 = Wednesday.", difficulty: "Easy", topic: "Logical" },
    { question: "25% of 200 + 50% of 60 = ?", options: ["A: 70", "B: 75", "C: 80", "D: 85"], correct: "C", explanation: "50 + 30 = 80.", difficulty: "Easy", topic: "Quantitative" },
    { question: "Find the odd one: Apple, Mango, Carrot, Banana", options: ["A: Apple", "B: Mango", "C: Carrot", "D: Banana"], correct: "C", explanation: "Carrot is a vegetable; others are fruits.", difficulty: "Easy", topic: "Logical" },
    { question: "Water:Thirst :: Food:?", options: ["A: Cook", "B: Hunger", "C: Eat", "D: Taste"], correct: "B", explanation: "Water quenches thirst; Food satisfies hunger.", difficulty: "Easy", topic: "Verbal" },
    { question: "Angle between clock hands at 3:00?", options: ["A: 60°", "B: 75°", "C: 90°", "D: 120°"], correct: "C", explanation: "Hour hand at 90° from 12. Angle = 90°.", difficulty: "Easy", topic: "Quantitative" },
    { question: "Class of 40, 60% passed. How many failed?", options: ["A: 12", "B: 14", "C: 16", "D: 18"], correct: "C", explanation: "Failed = 40 - 24 = 16.", difficulty: "Easy", topic: "Quantitative" },
    { question: "Train travels 300km in 5 hours. Speed in km/h?", options: ["A: 50", "B: 55", "C: 60", "D: 65"], correct: "C", explanation: "300/5 = 60 km/h.", difficulty: "Easy", topic: "Quantitative" },
    { question: "Synonym of EPHEMERAL:", options: ["A: Permanent", "B: Transient", "C: Ancient", "D: Reliable"], correct: "B", explanation: "Ephemeral = short-lived. Synonym = Transient.", difficulty: "Easy", topic: "Verbal" },
    { question: "40% of what number is 80?", options: ["A: 150", "B: 175", "C: 200", "D: 225"], correct: "C", explanation: "0.4 × x = 80 → x = 200.", difficulty: "Easy", topic: "Quantitative" },
    { question: "In a class, 15 like cricket, 10 like football, 5 like both. Total students?", options: ["A: 15", "B: 20", "C: 25", "D: 30"], correct: "B", explanation: "15 + 10 - 5 = 20.", difficulty: "Easy", topic: "Logical" },
    { question: "All dogs are animals. Some animals are wild. Therefore?", options: ["A: All dogs are wild", "B: Some dogs are wild", "C: No dog is wild", "D: Some dogs may be wild"], correct: "D", explanation: "We cannot conclude definitively. Some dogs may or may not be wild.", difficulty: "Easy", topic: "Logical" }
    ],
    junior: [
    { question: "Train 120m long passes a pole in 6s. Speed in km/h?", options: ["A: 60", "B: 72", "C: 80", "D: 90"], correct: "B", explanation: "20 m/s × 3.6 = 72 km/h.", difficulty: "Medium", topic: "Quantitative" },
    { question: "15% of 360 + 25% of 240 = ?", options: ["A: 108", "B: 114", "C: 120", "D: 126"], correct: "B", explanation: "54 + 60 = 114.", difficulty: "Medium", topic: "Quantitative" },
    { question: "Logical order: 1-Planet 2-Sun 3-Galaxy 4-Solar System", options: ["A: 2,1,4,3", "B: 1,2,4,3", "C: 2,4,1,3", "D: 1,4,2,3"], correct: "A", explanation: "Sun → Planet → Solar System → Galaxy.", difficulty: "Medium", topic: "Logical" },
    { question: "ELBOW:ARM :: KNEE:?", options: ["A: Foot", "B: Leg", "C: Hip", "D: Joint"], correct: "B", explanation: "Elbow is joint of arm; knee is joint of leg.", difficulty: "Medium", topic: "Verbal" },
    { question: "Milk:water = 3:2. Add 10L water → ratio 3:4. Original quantity?", options: ["A: 20L", "B: 25L", "C: 30L", "D: 35L"], correct: "B", explanation: "Milk = 15L, Water = 10L → +10 → 15:20 = 3:4. Total = 25L.", difficulty: "Medium", topic: "Quantitative" },
    { question: "P(sum=7) when two dice are rolled?", options: ["A: 1/6", "B: 5/36", "C: 7/36", "D: 1/9"], correct: "A", explanation: "6 pairs sum to 7. P = 6/36 = 1/6.", difficulty: "Medium", topic: "Quantitative" },
    { question: "If 2x + 3y = 12 and x - y = 1, find x:", options: ["A: 2", "B: 3", "C: 4", "D: 5"], correct: "B", explanation: "x=y+1; 2(y+1)+3y=12 → y=2, x=3.", difficulty: "Medium", topic: "Quantitative" },
    { question: "Average of 5 numbers is 10. 6th added, new avg = 11. 6th number?", options: ["A: 14", "B: 15", "C: 16", "D: 17"], correct: "C", explanation: "Sum of 5 = 50. New sum = 66. 6th = 16.", difficulty: "Medium", topic: "Quantitative" },
    { question: "Doctor:Hospital :: Teacher:?", options: ["A: Student", "B: School", "C: Book", "D: Classroom"], correct: "B", explanation: "A doctor works in hospital; teacher works in school.", difficulty: "Medium", topic: "Verbal" },
    { question: "LCM of 12, 15, 20?", options: ["A: 30", "B: 45", "C: 60", "D: 120"], correct: "C", explanation: "LCM(12,15,20) = 60.", difficulty: "Medium", topic: "Quantitative" },
    { question: "Odd one out: Triangle, Square, Cube, Rectangle", options: ["A: Triangle", "B: Square", "C: Cube", "D: Rectangle"], correct: "C", explanation: "Cube is 3D; others are 2D shapes.", difficulty: "Medium", topic: "Logical" },
    { question: "Next: 3, 6, 11, 18, 27, ?", options: ["A: 36", "B: 38", "C: 40", "D: 42"], correct: "B", explanation: "Differences: 3,5,7,9,11 → next = 27+11 = 38.", difficulty: "Medium", topic: "Logical" },
    { question: "X is 20% more than Y. Y is what % less than X?", options: ["A: 16.67%", "B: 20%", "C: 25%", "D: 18%"], correct: "A", explanation: "(20/120)×100 = 16.67%.", difficulty: "Medium", topic: "Quantitative" },
    { question: "A bag: 5 red, 3 blue balls. P(blue)?", options: ["A: 3/8", "B: 5/8", "C: 1/2", "D: 3/5"], correct: "A", explanation: "P = 3/8.", difficulty: "Medium", topic: "Quantitative" },
    { question: "Statement: 'Some cats are dogs. All dogs are animals.' Then?", options: ["A: Some cats are animals", "B: All cats are animals", "C: No cats are animals", "D: All animals are cats"], correct: "A", explanation: "Some cats (the ones that are dogs) are animals.", difficulty: "Medium", topic: "Logical" },
    { question: "Man walks 5km N, turns right, walks 3km. Distance from start?", options: ["A: 5.8km", "B: 6km", "C: 4km", "D: 8km"], correct: "A", explanation: "√(25+9) = √34 ≈ 5.83km.", difficulty: "Medium", topic: "Logical" },
    { question: "Prime numbers between 1 and 30?", options: ["A: 8", "B: 9", "C: 10", "D: 11"], correct: "C", explanation: "2,3,5,7,11,13,17,19,23,29 = 10 primes.", difficulty: "Medium", topic: "Quantitative" },
    { question: "Speed ratio of trains = 4:5. Time ratio to cover same distance?", options: ["A: 4:5", "B: 5:4", "C: 16:25", "D: 25:16"], correct: "B", explanation: "Time inversely proportional to speed → 5:4.", difficulty: "Medium", topic: "Quantitative" },
    { question: "A trader buys 20 oranges for ₹1, sells 15 for ₹1. Gain/loss %?", options: ["A: 25% gain", "B: 33.33% gain", "C: 25% loss", "D: 33.33% loss"], correct: "B", explanation: "CP per orange = 1/20. SP per orange = 1/15. Gain = (1/15-1/20)/(1/20) = 1/3 = 33.33%.", difficulty: "Medium", topic: "Quantitative" },
    { question: "Series: 4, 9, 25, 49, 121, ?", options: ["A: 144", "B: 169", "C: 196", "D: 225"], correct: "B", explanation: "Squares of primes: 2²,3²,5²,7²,11²,13² = 169.", difficulty: "Medium", topic: "Logical" }
    ],
    mid: [
    { question: "Data Sufficiency: Is x > 0? (1) x²>0 (2) x³>0", options: ["A: Only 1", "B: Only 2", "C: Both needed", "D: Either alone"], correct: "B", explanation: "x²>0 only tells x≠0. x³>0 definitively means x>0.", difficulty: "Hard", topic: "Logical" },
    { question: "₹10,000 at 10% CI for 2 years. Amount?", options: ["A: ₹12,000", "B: ₹12,100", "C: ₹11,000", "D: ₹12,200"], correct: "B", explanation: "10000×(1.1)² = ₹12,100.", difficulty: "Hard", topic: "Quantitative" },
    { question: "5 people in a circle. Distinct arrangements?", options: ["A: 120", "B: 60", "C: 24", "D: 20"], correct: "C", explanation: "(n-1)! = 4! = 24.", difficulty: "Hard", topic: "Quantitative" },
    { question: "All Bloops=Razzles, All Razzles=Lazzles. Then:", options: ["A: All Lazzles are Bloops", "B: All Bloops are Lazzles", "C: No Bloops are Lazzles", "D: Some Razzles not Lazzles"], correct: "B", explanation: "Bloops⊆Razzles⊆Lazzles.", difficulty: "Hard", topic: "Logical" },
    { question: "Stock price rose 10% then fell 10%. Net?", options: ["A: 0%", "B: -1%", "C: +1%", "D: -2%"], correct: "B", explanation: "100→110→99. Net = -1%.", difficulty: "Hard", topic: "Quantitative" },
    { question: "4 boys + 3 girls in a row, no two girls adjacent. Ways?", options: ["A: 144", "B: 288", "C: 576", "D: 1440"], correct: "B", explanation: "4! × P(5,3) = 24 × 60 / 5 = 288.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Three cubes: edge 3,4,5 cm melted into one. Edge?", options: ["A: 5cm", "B: 6cm", "C: 7cm", "D: 4cm"], correct: "B", explanation: "27+64+125=216=6³.", difficulty: "Hard", topic: "Quantitative" },
    { question: "P works twice as fast as Q. Together: 12 days. P alone?", options: ["A: 15", "B: 18", "C: 20", "D: 24"], correct: "B", explanation: "P=2Q per day. 3Q=1/12 → Q=1/36. P alone=18 days.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Compound ratio of 2:3, 4:5 and 6:7?", options: ["A: 16:35", "B: 48:105", "C: 48:35", "D: 16:105"], correct: "B", explanation: "(2×4×6):(3×5×7) = 48:105.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Two dice rolled. P(sum=7)?", options: ["A: 1/6", "B: 5/36", "C: 7/36", "D: 1/9"], correct: "A", explanation: "6 pairs → 6/36 = 1/6.", difficulty: "Hard", topic: "Quantitative" },
    { question: "A trader sells 20 at cost of 25. Gain %?", options: ["A: 20%", "B: 25%", "C: 30%", "D: 5%"], correct: "B", explanation: "Profit = 5/20×100 = 25%.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Odd one: 8, 27, 64, 100, 125", options: ["A: 8", "B: 27", "C: 100", "D: 125"], correct: "C", explanation: "100 is not a perfect cube.", difficulty: "Hard", topic: "Logical" },
    { question: "A says 'B is lying'. B says 'C is lying'. C says 'A and B both lie'. Who's honest?", options: ["A: A only", "B: B only", "C: A and B", "D: C only"], correct: "A", explanation: "If A is honest: B lies → C's claim is false → C lies. Consistent.", difficulty: "Hard", topic: "Logical" },
    { question: "IRR: invest ₹100, get ₹60 year 1, ₹60 year 2. Approx IRR?", options: ["A: 12%", "B: 13.1%", "C: 15%", "D: 20%"], correct: "B", explanation: "NPV=0 at r≈13.1%.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Data: Is n divisible by 6? (1) n÷2 (2) n÷3", options: ["A: Only 1", "B: Only 2", "C: Both together", "D: Either alone"], correct: "C", explanation: "6=2×3, need both conditions.", difficulty: "Hard", topic: "Logical" },
    { question: "Input: 72 96 45 24 68 → Step1: 96 72 45 24 68 → Step2: 96 72 68 24 45. Pattern?", options: ["A: Descending sort by steps", "B: Random swap", "C: Largest moved first", "D: Odd/even sort"], correct: "A", explanation: "Each step moves the next largest to its sorted position.", difficulty: "Hard", topic: "Logical" },
    { question: "HCF of 84, 112, 140?", options: ["A: 14", "B: 28", "C: 42", "D: 56"], correct: "B", explanation: "84=4×21, 112=4×28, 140=4×35. HCF=28.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Series: 2, 3, 5, 9, 17, 33, ?", options: ["A: 55", "B: 63", "C: 65", "D: 67"], correct: "C", explanation: "Each = 2×previous - 1: 2×33-1=65.", difficulty: "Hard", topic: "Logical" },
    { question: "Sphere radius 3 inscribed in cube. Cube's volume?", options: ["A: 27", "B: 54", "C: 108", "D: 216"], correct: "D", explanation: "Diameter=6=edge. V=6³=216.", difficulty: "Hard", topic: "Quantitative" },
    { question: "ROAD=URDG, SWAN=?", options: ["A: VZDQ", "B: VXDQ", "C: VZDP", "D: VZEQ"], correct: "A", explanation: "Each letter +3: S→V, W→Z, A→D, N→Q.", difficulty: "Hard", topic: "Verbal" }
    ],
    experienced: [
    { question: "Revenue grew 20% then fell 20%. Net?", options: ["A: 0%", "B: -4%", "C: +4%", "D: -2%"], correct: "B", explanation: "100→120→96. Net=-4%.", difficulty: "Hard", topic: "Quantitative" },
    { question: "70% drink tea, 80% drink coffee. Min % drinking both?", options: ["A: 40%", "B: 50%", "C: 60%", "D: 70%"], correct: "B", explanation: "Min overlap = 70+80-100 = 50%.", difficulty: "Hard", topic: "Logical" },
    { question: "Cube painted, cut into 27 pieces. Exactly 2 painted faces?", options: ["A: 8", "B: 12", "C: 6", "D: 1"], correct: "B", explanation: "12 edge pieces (non-corner) have 2 painted faces.", difficulty: "Hard", topic: "Logical" },
    { question: "MONEY=54321, MOTHER=546738. MONKEY=?", options: ["A: 546321", "B: 545321", "C: 546213", "D: 543621"], correct: "A", explanation: "546321.", difficulty: "Hard", topic: "Verbal" },
    { question: "PV of ₹10,000 in 2 years at 8%?", options: ["A: ₹8,573", "B: ₹8,000", "C: ₹9,259", "D: ₹8,264"], correct: "A", explanation: "10000/(1.08)² ≈ ₹8,573.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Company profit +25% then -20%. Net?", options: ["A: 0%", "B: +5%", "C: +2%", "D: -2%"], correct: "A", explanation: "100→125→100. Net=0%.", difficulty: "Hard", topic: "Quantitative" },
    { question: "10 people shake hands once with each other. Total?", options: ["A: 40", "B: 45", "C: 50", "D: 90"], correct: "B", explanation: "C(10,2)=45.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Water flows at 10L/min into 500L tank. Leak empties 2L/min. Fill time?", options: ["A: 50 min", "B: 62.5 min", "C: 60 min", "D: 45 min"], correct: "B", explanation: "Net = 8L/min. Time = 500/8 = 62.5 min.", difficulty: "Hard", topic: "Quantitative" },
    { question: "A clock gains 5 min/hour. Set correct at 8AM. Shows at 8PM real time?", options: ["A: 8:50PM", "B: 9:00PM", "C: 9:10PM", "D: 8:40PM"], correct: "B", explanation: "12h × 5min = 60min gained. Shows 9PM.", difficulty: "Hard", topic: "Quantitative" },
    { question: "A invests ₹1200, B ₹1800 equally for 6 months. Profit ₹900 split?", options: ["A: 1:1", "B: 2:3", "C: 3:2", "D: 1:2"], correct: "B", explanation: "Ratio = 1200:1800 = 2:3.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Series: 1, 8, 27, 64, 125, ?", options: ["A: 196", "B: 216", "C: 225", "D: 256"], correct: "B", explanation: "Cubes: 1³,2³,3³,4³,5³,6³=216.", difficulty: "Hard", topic: "Logical" },
    { question: "In a sequence odd-position=square, even-position=double. 7th term of 1,2,3,4,5,6,7?", options: ["A: 14", "B: 49", "C: 42", "D: 7"], correct: "B", explanation: "7th is odd position → 7²=49.", difficulty: "Hard", topic: "Logical" },
    { question: "5 executives meet. Each calls all others once. Total calls?", options: ["A: 10", "B: 20", "C: 25", "D: 5"], correct: "A", explanation: "C(5,2)=10.", difficulty: "Hard", topic: "Logical" },
    { question: "Area of rhombus with diagonals 10 and 24?", options: ["A: 240", "B: 120", "C: 60", "D: 100"], correct: "B", explanation: "d1×d2/2 = 240/2 = 120.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Statement: X needed for Y, Y sufficient for Z. Must be true?", options: ["A: X sufficient for Z", "B: Z requires X", "C: X alone gives Z", "D: Z needed for Y"], correct: "B", explanation: "Y→Z and Y needs X → Z indirectly requires X.", difficulty: "Hard", topic: "Logical" },
    { question: "P(2 sharing birthday in group of 3)?", options: ["A: 1/365", "B: ≈0.82%", "C: ≈0.28%", "D: ≈1.2%"], correct: "B", explanation: "1-(365×364×363/365³) ≈ 0.82%.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Two trains 200km apart moving toward each other at 60 and 40 km/h. Meet in?", options: ["A: 1h", "B: 1.5h", "C: 2h", "D: 2.5h"], correct: "C", explanation: "Closing speed = 100km/h. Time = 200/100 = 2h.", difficulty: "Hard", topic: "Quantitative" },
    { question: "If log(2)=0.301, log(3)=0.477, find log(12)?", options: ["A: 1.079", "B: 1.099", "C: 1.049", "D: 0.778"], correct: "A", explanation: "log(12)=log(4×3)=2log2+log3=0.602+0.477=1.079.", difficulty: "Hard", topic: "Quantitative" },
    { question: "Select the statement that weakens: 'Exercise improves memory'. Study shows couch potatoes score higher on memory tests.", options: ["A: Strengthens", "B: Weakens significantly", "C: Irrelevant", "D: Partially weakens"], correct: "B", explanation: "The study directly contradicts the claim with data.", difficulty: "Hard", topic: "Verbal" },
    { question: "Bag: 4 white, 6 black. Draw 2. P(both same color)?", options: ["A: 7/15", "B: 8/15", "C: 1/3", "D: 2/3"], correct: "A", explanation: "P(WW)+P(BB) = C(4,2)/C(10,2) + C(6,2)/C(10,2) = 6/45+15/45=21/45=7/15.", difficulty: "Hard", topic: "Quantitative" }
    ]
};
return banks[level] || banks.fresher;
}

function getFallbackManagerial(level) {
const banks = {
    fresher: [
    { question: "Tell me about a college group project where you had conflict with a team member. How did you resolve it?", expectedPoints: ["Specific situation described", "Steps taken to resolve", "Outcome", "Lesson learned"], difficulty: "Easy", topic: "Conflict Resolution", type: "situational" },
    { question: "How would you handle being assigned a task you've never done with a tight deadline?", expectedPoints: ["Ask for guidance proactively", "Break task into steps", "Time management", "Communicate progress"], difficulty: "Easy", topic: "Problem Solving", type: "hypothetical" },
    { question: "Describe a time you failed at something important. What did you learn?", expectedPoints: ["Honest specific failure", "Self-reflection", "Concrete lesson", "Changed behavior after"], difficulty: "Easy", topic: "Self-Awareness", type: "behavioral" },
    { question: "How do you organize your work when multiple deadlines conflict?", expectedPoints: ["Priority setting method", "Tools used", "Communication with others", "Outcome"], difficulty: "Easy", topic: "Time Management", type: "behavioral" },
    { question: "Give an example where you convinced a group to accept your idea.", expectedPoints: ["Context given", "How you presented", "Objections handled", "Result"], difficulty: "Easy", topic: "Influence", type: "situational" },
    { question: "Describe successfully working with someone very different from you.", expectedPoints: ["How differences identified", "Adaptation approach", "Collaboration outcome", "What you gained"], difficulty: "Easy", topic: "Teamwork", type: "behavioral" },
    { question: "If you joined a team and found the culture negative, what would you do?", expectedPoints: ["Observe first", "Lead by example", "Raise concerns appropriately", "Seek guidance"], difficulty: "Easy", topic: "Culture Fit", type: "hypothetical" },
    { question: "Tell me about a time you took initiative without being asked.", expectedPoints: ["Specific example", "Why you stepped up", "What you did", "Impact"], difficulty: "Easy", topic: "Initiative", type: "behavioral" },
    { question: "How would you handle very critical feedback from a senior?", expectedPoints: ["Stay calm", "Seek to understand", "Take action", "Follow up"], difficulty: "Easy", topic: "Feedback Reception", type: "hypothetical" },
    { question: "Describe your biggest academic achievement and what made it possible.", expectedPoints: ["Specific achievement", "Effort behind it", "Skills demonstrated", "Application to work"], difficulty: "Easy", topic: "Achievement", type: "behavioral" },
    { question: "Have you changed your opinion based on new information? What happened?", expectedPoints: ["Openness to change", "Reasoning process", "Action taken", "Outcome"], difficulty: "Easy", topic: "Adaptability", type: "behavioral" },
    { question: "How would you approach learning a completely new skill in your first month at work?", expectedPoints: ["Structured learning plan", "Resources to use", "Seeking mentorship", "Setting milestones"], difficulty: "Easy", topic: "Learning Agility", type: "hypothetical" }
    ],
    junior: [
    { question: "Tell me about pushing back on a manager's request you believed was wrong.", expectedPoints: ["Respectful approach", "Evidence/data used", "Outcome", "Relationship preserved"], difficulty: "Medium", topic: "Assertiveness", type: "situational" },
    { question: "Describe learning a new technology quickly to deliver a project.", expectedPoints: ["Speed of learning", "Resources utilized", "What was delivered", "Team impact"], difficulty: "Medium", topic: "Adaptability", type: "behavioral" },
    { question: "How do you handle two equally urgent projects simultaneously?", expectedPoints: ["Stakeholder communication", "Prioritization framework", "Delegation", "Outcome"], difficulty: "Medium", topic: "Time Management", type: "hypothetical" },
    { question: "Tell me about disagreeing with a technical decision your team made.", expectedPoints: ["Raised concerns appropriately", "Data used", "Team dynamics handled", "Final decision respected"], difficulty: "Medium", topic: "Disagreement", type: "situational" },
    { question: "Describe mentoring a colleague or intern. What was the result?", expectedPoints: ["How you identified their need", "Approach taken", "Progress made", "Outcome"], difficulty: "Medium", topic: "Mentoring", type: "behavioral" },
    { question: "Tell me about a production issue you faced and resolved under pressure.", expectedPoints: ["Root cause analysis", "Action under pressure", "Communication with team", "Prevention measures"], difficulty: "Medium", topic: "Crisis Handling", type: "situational" },
    { question: "How have you handled a difficult or unreasonable stakeholder?", expectedPoints: ["Understanding their perspective", "Communication approach", "Finding common ground", "Outcome"], difficulty: "Medium", topic: "Stakeholder Management", type: "situational" },
    { question: "Tell me about delivering a project with incomplete requirements.", expectedPoints: ["How ambiguity managed", "Clarification sought", "Assumptions documented", "Delivery"], difficulty: "Medium", topic: "Ambiguity", type: "behavioral" },
    { question: "Describe a process or workflow you improved. What was the impact?", expectedPoints: ["Problem identified", "Solution designed", "Implementation", "Measurable impact"], difficulty: "Medium", topic: "Process Improvement", type: "behavioral" },
    { question: "How have you delivered bad news to a client or stakeholder?", expectedPoints: ["Proactive communication", "Honest and factual", "Alternative offered", "Relationship maintained"], difficulty: "Medium", topic: "Difficult Conversations", type: "situational" },
    { question: "Tell me about a time your estimate was wrong and how you handled it.", expectedPoints: ["What caused the miss", "Early escalation", "Recovery plan", "Lesson for future"], difficulty: "Medium", topic: "Accountability", type: "behavioral" },
    { question: "How do you ensure code/work quality when under time pressure?", expectedPoints: ["Non-negotiables defined", "Pragmatic trade-offs", "Team communication", "Post-delivery actions"], difficulty: "Medium", topic: "Quality Under Pressure", type: "hypothetical" }
    ],
    mid: [
    { question: "Tell me about leading a project that failed. How did you manage team and stakeholders?", expectedPoints: ["Own the failure", "Team morale managed", "Stakeholder communication", "What changed after"], difficulty: "Hard", topic: "Leadership Under Failure", type: "situational" },
    { question: "Describe influencing a cross-functional team without formal authority.", expectedPoints: ["Relationship built", "Data-driven influence", "Alignment strategy", "Measurable outcome"], difficulty: "Hard", topic: "Influence", type: "behavioral" },
    { question: "How would you handle a high-performer who consistently violates team norms?", expectedPoints: ["Private conversation first", "Root cause analysis", "Performance vs behavior", "Escalation path"], difficulty: "Hard", topic: "People Management", type: "hypothetical" },
    { question: "Tell me about making a decision with insufficient data.", expectedPoints: ["Framework used", "Risks identified", "Stakeholder alignment", "Outcome and learning"], difficulty: "Hard", topic: "Decision Under Ambiguity", type: "situational" },
    { question: "How have you driven organizational change that was resisted by your team?", expectedPoints: ["Resistance root cause understood", "Communication strategy", "Early wins demonstrated", "Sustainable adoption"], difficulty: "Hard", topic: "Change Management", type: "behavioral" },
    { question: "Describe building a new team from scratch. What was your approach?", expectedPoints: ["Hiring bar set", "Onboarding strategy", "Culture established", "First wins achieved"], difficulty: "Hard", topic: "Team Building", type: "behavioral" },
    { question: "Tell me about significantly improving team velocity or quality.", expectedPoints: ["Baseline established", "Bottleneck identified", "Intervention designed", "Measurable improvement"], difficulty: "Hard", topic: "Performance", type: "behavioral" },
    { question: "How do you balance technical debt vs feature delivery?", expectedPoints: ["Prioritization framework", "Stakeholder education", "Incremental reduction plan", "Communication"], difficulty: "Hard", topic: "Technical Leadership", type: "hypothetical" },
    { question: "Tell me about navigating a conflict between two senior team members.", expectedPoints: ["Mediator approach", "Interests vs positions", "Resolution reached", "Team health post-conflict"], difficulty: "Hard", topic: "Conflict Resolution", type: "situational" },
    { question: "Describe your approach to difficult performance reviews.", expectedPoints: ["Preparation done", "Data/examples used", "Empathy shown", "Development plan created"], difficulty: "Hard", topic: "Feedback Delivery", type: "behavioral" },
    { question: "How have you managed a project where scope kept expanding?", expectedPoints: ["Scope creep identified early", "Stakeholder alignment", "Trade-offs negotiated", "Delivery outcome"], difficulty: "Hard", topic: "Scope Management", type: "situational" },
    { question: "Tell me about a vendor or partnership negotiation you led.", expectedPoints: ["BATNA defined", "Negotiation approach", "Key terms secured", "Relationship maintained"], difficulty: "Hard", topic: "Negotiation", type: "behavioral" }
    ],
    experienced: [
    { question: "Tell me about a strategic decision with company-wide impact.", expectedPoints: ["Business context", "Decision framework", "Stakeholder buy-in", "Business impact measured"], difficulty: "Hard", topic: "Strategic Leadership", type: "situational" },
    { question: "How have you built and scaled a high-performing team? Hiring and retention philosophy?", expectedPoints: ["Hiring bar articulated", "Onboarding structured", "Culture built", "Retention outcomes"], difficulty: "Hard", topic: "Team Scaling", type: "behavioral" },
    { question: "Describe delivering difficult news (layoffs, failures, missed targets) to your organization.", expectedPoints: ["Transparency exercised", "Empathy shown", "Forward plan communicated", "Medium chosen wisely"], difficulty: "Hard", topic: "Executive Communication", type: "situational" },
    { question: "How have you influenced your company's strategic direction from your role?", expectedPoints: ["Problem identified", "Research and framing", "Executive alignment", "Strategic change made"], difficulty: "Hard", topic: "Strategic Influence", type: "behavioral" },
    { question: "Tell me about shutting down a project or product. How did you handle it?", expectedPoints: ["Decision criteria", "Team communication", "Stakeholder management", "Resource redeployment"], difficulty: "Hard", topic: "Hard Decisions", type: "situational" },
    { question: "How do you build culture across distributed or remote teams?", expectedPoints: ["Rituals established", "Tools and cadence", "Trust built", "Culture metrics tracked"], difficulty: "Hard", topic: "Remote Culture", type: "behavioral" },
    { question: "Describe a crisis that threatened your organization's reputation.", expectedPoints: ["Early detection", "Response coordinated", "All stakeholders communicated", "Long-term fix"], difficulty: "Hard", topic: "Crisis Management", type: "situational" },
    { question: "How do you develop next-generation leaders in your organization?", expectedPoints: ["Identification approach", "Sponsorship vs mentorship", "Stretch assignments", "Outcomes"], difficulty: "Hard", topic: "Leadership Development", type: "behavioral" },
    { question: "Tell me about your biggest leadership-level professional failure.", expectedPoints: ["Ownership taken", "Impact acknowledged", "Systemic cause identified", "What fundamentally changed"], difficulty: "Hard", topic: "Leadership Failure", type: "situational" },
    { question: "How do you balance innovation and operational stability?", expectedPoints: ["Portfolio approach", "Risk framework", "Team structure", "Outcomes"], difficulty: "Hard", topic: "Innovation vs Stability", type: "behavioral" },
    { question: "How do you make resource allocation decisions when priorities compete?", expectedPoints: ["Strategic alignment", "Data used", "Trade-offs communicated", "Stakeholder buy-in"], difficulty: "Hard", topic: "Resource Allocation", type: "hypothetical" },
    { question: "Tell me about acquiring or integrating a team or company.", expectedPoints: ["Due diligence", "People strategy", "Culture integration", "Business outcome"], difficulty: "Hard", topic: "M&A Integration", type: "situational" }
    ]
};
return banks[level] || banks.fresher;
}

function getFallbackDebug(level) {
const banks = {
    fresher: [
    { question: "Find and fix the bug:", code: "def add_numbers(a, b):\n    return a - b\n\nprint(add_numbers(5, 3))  # Expected: 8", bug: "Subtraction used instead of addition", fix: "return a + b", explanation: "The function subtracts instead of adding.", difficulty: "Easy" },
    { question: "Find the bug in this loop:", code: "def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n)  # bug here", bug: "Recursive call uses factorial(n) — infinite recursion", fix: "return n * factorial(n-1)", explanation: "Must decrement n to reach base case.", difficulty: "Easy" },
    { question: "Spot the bug:", code: "arr = [1, 2, 3, 4, 5]\nfor i in range(len(arr)):\n    print(arr[i+1])", bug: "arr[i+1] out of range when i = len(arr)-1", fix: "range(len(arr)-1) or print(arr[i])", explanation: "Last index + 1 is out of bounds.", difficulty: "Easy" },
    { question: "Find the bug:", code: "if (name = 'Alice') {\n  console.log('Hello Alice!')\n}", bug: "Assignment = used instead of comparison ===", fix: "if (name === 'Alice')", explanation: "= assigns, === compares in JavaScript.", difficulty: "Easy" },
    { question: "Find the bug:", code: "total = 0\nfor i in range(1, 11):\n    total = total + i\n    i = i + 1  # bug", bug: "Manually incrementing i has no effect in a for loop", fix: "Remove i = i + 1", explanation: "Python's for loop controls i via range().", difficulty: "Easy" },
    { question: "Find the bug:", code: "def is_even(n):\n    if n % 2 = 0:\n        return True\n    return False", bug: "Syntax: = instead of == in condition", fix: "if n % 2 == 0:", explanation: "= is assignment, == is comparison.", difficulty: "Easy" },
    { question: "Find the bug:", code: "x = input('Enter number: ')\nresult = x + 10\nprint(result)", bug: "input() returns a string, can't add integer 10", fix: "x = int(input('Enter number: '))", explanation: "Must convert string to int before arithmetic.", difficulty: "Easy" }
    ],
    junior: [
    { question: "Find the bug in this linked list reversal:", code: "def reverse_list(head):\n    prev = None\n    current = head\n    while current:\n        current.next = prev\n        prev = current\n        current = current.next  # bug\n    return prev", bug: "current.next is overwritten before saving it", fix: "Save: next_node = current.next; current.next = prev; prev = current; current = next_node", explanation: "After overwriting current.next = prev, current.next is now prev, losing the rest of the list.", difficulty: "Medium" },
    { question: "Find the bug in this binary search:", code: "def binary_search(arr, target):\n    low, high = 0, len(arr)\n    while low < high:\n        mid = (low + high) // 2\n        if arr[mid] == target: return mid\n        elif arr[mid] < target: low = mid   # bug\n        else: high = mid                    # bug\n    return -1", bug: "low=mid and high=mid can cause infinite loop", fix: "low = mid + 1 and high = mid - 1", explanation: "Pointers must move past mid to avoid infinite loop.", difficulty: "Medium" },
    { question: "Find the SQL injection vulnerability:", code: "def get_user(username):\n    query = \"SELECT * FROM users WHERE name = '\" + username + \"'\"\n    return db.execute(query)", bug: "String concatenation allows SQL injection attack", fix: "db.execute('SELECT * FROM users WHERE name = ?', (username,))", explanation: "Never concatenate user input into SQL. Use parameterized queries.", difficulty: "Medium" },
    { question: "Find the off-by-one error:", code: "def get_middle(arr):\n    n = len(arr)\n    if n % 2 == 0:\n        return (arr[n//2] + arr[n//2 + 1]) / 2  # bug\n    return arr[n//2]", bug: "Should average arr[n//2-1] and arr[n//2], not arr[n//2] and arr[n//2+1]", fix: "return (arr[n//2 - 1] + arr[n//2]) / 2", explanation: "For [1,2,3,4], middle = avg(2,3). Code uses avg(3,4).", difficulty: "Medium" },
    { question: "Find the bug:", code: "try:\n    result = int(input())\n    print(10 / result)\nexcept:\n    pass", bug: "Bare except silently swallows all errors including KeyboardInterrupt", fix: "except (ValueError, ZeroDivisionError) as e: print(f'Error: {e}')", explanation: "Always catch specific exceptions.", difficulty: "Medium" },
    { question: "Find the race condition:", code: "counter = 0\ndef increment():\n    global counter\n    temp = counter\n    time.sleep(0.001)\n    counter = temp + 1\n# Two threads call this simultaneously", bug: "Both read counter=0, both write 1. Final value is 1 not 2.", fix: "Use threading.Lock() around read-modify-write", explanation: "Non-atomic read-modify-write causes lost update in concurrent execution.", difficulty: "Medium" },
    { question: "Find the memory issue:", code: "def process():\n    cache = {}\n    while True:\n        key = get_request_key()\n        result = compute(key)\n        cache[key] = result  # grows forever\n        return cache[key]", bug: "cache dict grows unboundedly, never cleared", fix: "Use LRU cache (functools.lru_cache) or limit cache size", explanation: "Unbounded cache growth causes memory leak in long-running processes.", difficulty: "Medium" }
    ],
    mid: [
    { question: "Find the distributed system bug:", code: "def transfer_money(from_acc, to_acc, amount):\n    debit(from_acc, amount)   # succeeds\n    credit(to_acc, amount)    # network failure!", bug: "No atomicity: debit succeeds but credit fails — money disappears", fix: "Use saga pattern with compensating transaction or 2-phase commit", explanation: "Distributed operations are not atomic. Partial failures cause data inconsistency.", difficulty: "Hard" },
    { question: "Find the N+1 query problem:", code: "users = User.objects.all()\nfor user in users:\n    print(user.profile.bio)  # new DB query per user!", bug: "1 query for users + N queries for profiles = N+1 total", fix: "users = User.objects.select_related('profile').all()", explanation: "select_related JOINs the table in one query.", difficulty: "Hard" },
    { question: "Find the cache stampede:", code: "def get_data(key):\n    data = cache.get(key)\n    if data is None:\n        data = db.expensive_query(key)\n        cache.set(key, data, ttl=60)\n    return data", bug: "On cache expiry, all concurrent requests miss and flood the DB", fix: "Use mutex/lock or cache warming or probabilistic early expiry", explanation: "Thundering herd problem. Singleflight pattern or distributed lock prevents stampede.", difficulty: "Hard" },
    { question: "Find the SQL bug:", code: "SELECT u.name, COUNT(o.id)\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id\nWHERE o.status = 'completed'\nGROUP BY u.name", bug: "WHERE on LEFT JOIN column converts it to INNER JOIN, excluding users with no orders", fix: "Move filter: LEFT JOIN orders o ON u.id=o.user_id AND o.status='completed'", explanation: "WHERE o.status filters out NULLs (users without orders), defeating LEFT JOIN.", difficulty: "Hard" },
    { question: "Find the integer overflow:", code: "public long calculateSum(int[] values) {\n    int sum = 0;  // bug\n    for (int v : values) sum += v;\n    return sum;\n}", bug: "int sum overflows for large arrays, silent data corruption", fix: "long sum = 0;", explanation: "Accumulator must match return type to prevent overflow.", difficulty: "Hard" },
    { question: "Find the thread safety bug:", code: "class Counter {\n    private int count = 0;\n    public int increment() { return ++count; }  // bug\n}", bug: "++ is not atomic: read-increment-write can interleave", fix: "Use AtomicInteger or synchronized", explanation: "Non-atomic compound operation on shared state in Java.", difficulty: "Hard" },
    { question: "Find the deadlock:", code: "Thread 1: lock(A) then lock(B)\nThread 2: lock(B) then lock(A)\n# Both running concurrently", bug: "T1 holds A waiting for B; T2 holds B waiting for A — circular wait", fix: "Always acquire locks in the same global order: both use lock(A) then lock(B)", explanation: "Consistent lock ordering eliminates circular wait condition.", difficulty: "Hard" }
    ],
    experienced: [
    { question: "Find the cascading failure:", code: "ServiceA.timeout = 30s\nServiceB.timeout = 29s\nServiceC.timeout = 28s\n# During C outage, threads pile up in A and B", bug: "Without circuit breakers, slow C exhausts thread pools in B then A", fix: "Circuit breaker + bulkhead isolation + exponential backoff", explanation: "Circuit breakers fail fast and prevent cascading thread pool exhaustion.", difficulty: "Hard" },
    { question: "Find the JWT security vulnerability:", code: "def verify_jwt(token):\n    header = jwt.decode(token, options={'verify_signature': False})\n    algo = header.get('alg')  # trusting the token!\n    return jwt.decode(token, secret, algorithms=[algo])", bug: "Attacker sets alg='none' in header, bypassing signature verification", fix: "Hardcode algorithm: jwt.decode(token, secret, algorithms=['HS256'])", explanation: "Never trust alg from the token itself. The alg:none attack forges valid tokens.", difficulty: "Hard" },
    { question: "Find the eventual consistency bug:", code: "db_primary.write(user_id, new_balance)\nbalance = db_replica.read(user_id)  # stale read!\nif balance < 0: trigger_fraud_alert()", bug: "Replica may return stale pre-write data due to replication lag", fix: "Read-your-own-writes: route post-write reads to primary, or use monotonic reads", explanation: "Replication lag means replicas return stale data right after a write.", difficulty: "Hard" },
    { question: "Find the hot partition problem:", code: "# DynamoDB design\ntable.put_item(Key={\n    'pk': str(datetime.now()),  # monotonic!\n    'data': payload\n})", bug: "Monotonically increasing key sends all writes to same partition — hot shard", fix: "Add randomized prefix: pk = f'{random.randint(0,9)}_{datetime.now()}'", explanation: "Monotonic keys (timestamps, auto-IDs) create hot partitions in distributed databases.", difficulty: "Hard" },
    { question: "Find the data race in Go:", code: "var wg sync.WaitGroup\nresults := []int{}\nfor i := 0; i < 10; i++ {\n    wg.Add(1)\n    go func(n int) {\n        defer wg.Done()\n        results = append(results, n*n)  // race\n    }(i)\n}\nwg.Wait()", bug: "Concurrent appends to slice from multiple goroutines — data race", fix: "Use sync.Mutex around append, or use a channel to collect results", explanation: "Go slices are not goroutine-safe. Concurrent appends corrupt internal state.", difficulty: "Hard" },
    { question: "Find the Byzantine fault:", code: "# 3-node vote: need majority\n# Node3 (Byzantine) sends True to Node1, False to Node2\nnode1.sees = [True, True, True]  # votes for True\nnode2.sees = [True, False, False]  # votes for False", bug: "Byzantine node breaks majority consensus by sending conflicting values", fix: "Use PBFT or similar BFT consensus requiring 3f+1 nodes for f faults", explanation: "Simple majority voting is vulnerable to Byzantine failures.", difficulty: "Hard" },
    { question: "Find the scaling anti-pattern:", code: "class SessionManager:\n    sessions = {}  # in-memory\n    def create_session(self, user_id):\n        token = generate_token()\n        self.sessions[token] = user_id\n        return token", bug: "In-memory sessions don't work with horizontal scaling — different servers lose sessions", fix: "Use Redis/Memcached for distributed session store, or switch to stateless JWT", explanation: "Sticky sessions prevent true horizontal scaling. External session stores or stateless auth solve this.", difficulty: "Hard" }
    ]
};
return banks[level] || banks.fresher;
}

function getFallbackTechnical(round, level) {
const qByLevel = {
    fresher: (t) => `What is ${t}? Explain with a simple real-world example.`,
    junior: (t) => `How does ${t} work internally? When would you use it over alternatives?`,
    mid: (t) => `What are the trade-offs of ${t} in production? How do you handle edge cases?`,
    experienced: (t) => `How would you architect a system using ${t} at scale? What are the failure modes and mitigations?`
};
const ptsByLevel = {
    fresher: ["Clear definition", "Simple real-world example", "Common use case"],
    junior: ["Internal mechanism", "Comparison with alternatives", "Practical example from work"],
    mid: ["Performance trade-offs", "Edge cases and error handling", "Production considerations"],
    experienced: ["Architectural decisions", "Scalability and failure modes", "Operational concerns at scale"]
};
const qFn = qByLevel[level] || qByLevel.fresher;
const pts = ptsByLevel[level] || ptsByLevel.fresher;
return shuffle(round.topics).map(t => ({
    question: qFn(t),
    expectedPoints: pts,
    difficulty: level === "fresher" ? "Easy" : level === "junior" ? "Medium" : "Hard",
    topic: t,
    levelHint: `${level} depth — ${pts[0].toLowerCase()}, ${pts[1].toLowerCase()}`
}));
}


function renderMockQ() {
const idx = mockState.idx;
const total = mockState.questions.length;
if (idx >= total) {
    showMockCompletion();
    return;
}
const q = mockState.questions[idx];
const pct = Math.round((idx / total) * 100);
const isLast = idx === total - 1;
const co = currentCo;
const roundName =
    co && co.rounds[currentRoundIdx]
    ? co.rounds[currentRoundIdx].name
    : "Mock Interview";
mockState.qStartTime = Date.now();
const body = document.getElementById("mock-body");
const levelBadge = q.difficulty ? lvlBadge(q.difficulty) : "";
const lv = currentUser ? currentUser.lv : "fresher";
const lvColors = { fresher: "#22c55e", junior: "#3b82f6", mid: "#f59e0b", experienced: "#ef4444" };
const lvLabels = { fresher: "🟢 Fresher", junior: "🔵 Junior", mid: "🟡 Mid-Level", experienced: "🔴 Senior" };
const lvBadgeHtml = `<span style="font-size:.72rem;font-weight:700;color:${lvColors[lv]||"#3b82f6"};background:${lvColors[lv]||"#3b82f6"}18;border:1px solid ${lvColors[lv]||"#3b82f6"}44;padding:.2rem .6rem;border-radius:100px">${lvLabels[lv]||lv}</span>`;
if (q.options) {
    // MCQ (aptitude)
    const timeLimit = getQuestionTimeLimit(co, currentRoundIdx, 'mcq');
    body.innerHTML = `
<div style="display:flex;gap:.6rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">
<button class="btn btn-outline btn-sm" onclick="goPage('company')">← Back</button>
<span style="font-size:.8rem;color:var(--muted)">${co ? co.name : ""} — ${roundName}</span>
${lvBadgeHtml}
<span style="margin-left:auto;font-size:.8rem;color:var(--muted);background:var(--surface2);padding:.25rem .75rem;border-radius:100px">Q${idx + 1}/${total}</span>
<div class="q-timer" id="q-timer">⏱ ${fmt(timeLimit)}</div>
</div>
<div class="mock-prog"><div class="mock-prog-fill" style="width:${pct}%"></div></div>
<div class="mock-qcard">
<div class="mock-qlbl">Question ${idx + 1} of ${total} — Aptitude ${levelBadge}</div>
<div class="mock-qtext">${q.question}</div>
<div class="mcq-options">${(q.options || [])
    .map((opt, oi) => {
    const letter = "ABCD"[oi];
    return `<div class="mcq-option" onclick="selectOpt('${letter}',this)"><div class="option-label">${letter}</div><div>${typeof opt === "string" && opt.includes(":") ? opt.split(":").slice(1).join(":").trim() : opt}</div></div>`;
    })
    .join("")}</div>
<div class="mock-nav">
    <div class="mock-tip">💡 Select your answer</div>
    <button class="btn btn-primary" id="next-btn" onclick="submitMockQ()" disabled>${isLast ? "Finish →" : "Next →"}</button>
</div>
</div>`;
    startQuestionTimer(timeLimit, () => { if(document.getElementById('next-btn')) submitMockQ(); });
} else {
    // Open / debug / technical
    const isDebug = !!q.code;
    const timeLimit = getQuestionTimeLimit(co, currentRoundIdx, 'open');
    body.innerHTML = `
<div style="display:flex;gap:.6rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">
<button class="btn btn-outline btn-sm" onclick="goPage('company')">← Back</button>
<span style="font-size:.8rem;color:var(--muted)">${co ? co.name : ""} — ${roundName}</span>
${lvBadgeHtml}
<span style="margin-left:auto;font-size:.8rem;color:var(--muted);background:var(--surface2);padding:.25rem .75rem;border-radius:100px">Q${idx + 1}/${total}</span>
<div class="q-timer" id="q-timer">⏱ ${fmt(timeLimit)}</div>
</div>
<div class="mock-prog"><div class="mock-prog-fill" style="width:${pct}%"></div></div>
<div class="mock-qcard">
<div class="mock-qlbl">Question ${idx + 1} of ${total} ${levelBadge} ${q.topic ? '<span style="color:var(--muted)">· ' + q.topic + "</span>" : ""}</div>
<div class="mock-qtext">${q.question}</div>
${isDebug ? `<pre class="code-block">${q.code}</pre>` : ""}
${q.levelHint ? `<div style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:.65rem .85rem;margin-bottom:.75rem;font-size:.8rem;color:var(--accent)">🎯 Expected depth for your level: ${q.levelHint}</div>` : ""}
${q.expectedPoints ? `<div style="background:var(--surface2);border-radius:8px;padding:.75rem;margin-bottom:.75rem;font-size:.8rem;color:var(--muted)">💡 Cover — ${q.expectedPoints.slice(0, 2).join(", ")}${q.expectedPoints.length > 2 ? "..." : ""}</div>` : ""}
<div class="ta-wrap">
    <textarea class="mock-ta" id="mock-ta" placeholder="Type your answer here. Be specific and thorough..."></textarea>
    <button class="mic-btn ta-mic" id="mock-mic-btn" onclick="toggleMic('mock-ta','mock-mic-btn')" title="Click to speak">🎙️</button>
</div>
<div id="q-feedback" style="display:none"></div>
<div class="mock-nav">
    <div class="mock-tip">⏱️ Quality matters — explain your reasoning</div>
    <button class="btn btn-primary" id="next-btn" onclick="submitMockQ()">${isLast ? "Finish →" : "Submit & Next →"}</button>
</div>
</div>`;
    startQuestionTimer(timeLimit, () => { if(document.getElementById('next-btn')) submitMockQ(); });
}
}

function selectOpt(letter, el) {
document
    .querySelectorAll(".mcq-option")
    .forEach((o) => o.classList.remove("selected"));
el.classList.add("selected");
mockState.selectedOpt = letter;
const btn = document.getElementById("next-btn");
if (btn) btn.disabled = false;
}

async function submitMockQ() {
const idx = mockState.idx;
const q = mockState.questions[idx];
const elapsed = Math.round((Date.now() - mockState.qStartTime) / 1000);
mockState.timings.push(elapsed);
const btn = document.getElementById("next-btn");
if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Saving...';
}
if (q.options) {
    // MCQ — store answer, NO instant highlighting, show correct at end
    if (!mockState.selectedOpt) {
    showToast("Please select an answer!");
    if (btn) { btn.disabled = false; btn.innerHTML = "Next →"; }
    return;
    }
    const isCorrect = mockState.selectedOpt === (q.correct || "").replace(/[^A-D]/g, "").trim();
    // Just store — no visual reveal
    mockState.answers.push({
    selected: mockState.selectedOpt,
    correct: q.correct,
    isCorrect,
    question: q.question,
    options: q.options,
    explanation: q.explanation,
    });
    mockState.evalResults.push({ score: isCorrect ? 100 : 0, isCorrect });
    mockState.selectedOpt = "";
    // Brief feedback toast only (no correct reveal)
    showToast(isCorrect ? "✅ Answer recorded" : "⚪ Answer recorded");
    await sleep(400);
    mockState.idx++;
    renderMockQ();
} else {
    // Open — AI eval queued for end
    const ta = document.getElementById("mock-ta");
    const answer = ta ? ta.value.trim() : "";
    mockState.answers.push({
    answer,
    question: q.question,
    expectedPoints: q.expectedPoints,
    topic: q.topic,
    });
    mockState.pendingEvals = mockState.pendingEvals || [];
    mockState.pendingEvals.push({ question: q.question, answer, expectedPoints: q.expectedPoints, topic: q.topic, coName: currentCo ? currentCo.name : "the company", level: currentUser ? currentUser.lv : "fresher" });
    mockState.evalResults.push({ score: null, feedback: null });
    if (btn) {
    btn.disabled = false;
    btn.innerHTML = idx === mockState.questions.length - 1 ? "Finish & See Results →" : "Next →";
    btn.onclick = () => {
        mockState.idx++;
        renderMockQ();
        window.scrollTo(0, 0);
    };
    }
}
}

function sleep(ms) {
return new Promise((r) => setTimeout(r, ms));
}

async function showMockCompletion() {
// Batch evaluate all pending open answers first
if (mockState.pendingEvals && mockState.pendingEvals.length) {
    const body = document.getElementById("mock-body");
    body.innerHTML = `<div style="text-align:center;padding:4rem"><div class="spinner-wrap" style="justify-content:center;flex-direction:column;gap:1rem"><div class="spinner" style="width:32px;height:32px;border-width:3px"></div><div><strong>Analysing all your answers...</strong></div><div style="color:var(--muted);font-size:.85rem">Our AI is evaluating your complete test responses</div></div></div>`;
    const evalPromises = mockState.pendingEvals.map(p => evalTechnicalAnswer(p.question, p.answer, p.expectedPoints, p.coName, p.level));
    const results = await Promise.all(evalPromises);
    // Fill in the eval results
    let pendingIdx = 0;
    for (let i = 0; i < mockState.evalResults.length; i++) {
    if (mockState.evalResults[i].score === null) {
        mockState.evalResults[i] = results[pendingIdx++] || { score: 50, feedback: "N/A" };
    }
    }
    mockState.pendingEvals = [];
}
_renderMockCompletion();
}
function _renderMockCompletion() {
const mcqAns = mockState.answers.filter(
    (a) => a.isCorrect !== undefined,
);
const correct = mcqAns.filter((a) => a.isCorrect).length;
const openEvals = mockState.evalResults.filter(
    (r) =>
    r.score !== undefined &&
    ((r.score !== 100 && r.score !== 0) || r.isCorrect === undefined),
);
// Compute real score
let score = 0;
if (mockState.evalResults.length) {
    score = Math.round(
    mockState.evalResults.reduce((s, r) => s + (r.score || 0), 0) /
        mockState.evalResults.length,
    );
} else if (mcqAns.length) {
    score = Math.round((correct / mcqAns.length) * 100);
}
const maxTime = Math.max(...mockState.timings, 1);
const maxIdx = mockState.timings.indexOf(maxTime);
const body = document.getElementById("mock-body");
body.innerHTML = `
<div style="max-width:800px;margin:0 auto">
<div class="score-wrap" style="margin-bottom:1.5rem">
<div class="score-circle" style="background:linear-gradient(135deg,${scoreColor(score)},var(--accent2))">
    <div class="score-num">${score}%</div><div class="score-lbl">AI SCORE</div>
</div>
<div class="sec-title">Mock Complete! 🎉</div>
<p style="color:var(--muted)">${mockState.answers.length} questions answered · ${mcqAns.length ? correct + "/" + mcqAns.length + " correct" : ""}</p>
</div>
<div class="time-bar-wrap">
<div class="time-bar-title">⏱️ Time Per Question${maxTime > 60 ? " — Q" + (maxIdx + 1) + " took longest (" + fmt(maxTime) + ")" : ""}
</div>
${mockState.timings
    .map((t, i) => {
    const pct = Math.round((t / maxTime) * 100);
    const slow = t === maxTime && mockState.timings.length > 1;
    return `<div class="time-bar-row"><div class="time-bar-label">Q${i + 1}: ${mockState.answers[i] ? mockState.answers[i].question?.substring(0, 35) + "..." : "Question " + (i + 1)}</div><div class="time-bar-track"><div class="time-bar-fill" style="width:${pct}%;background:${slow ? "linear-gradient(90deg,var(--gold),var(--red))" : "linear-gradient(90deg,var(--accent),var(--accent2))"}"></div></div><div class="time-bar-val" style="color:${slow ? "var(--red)" : "var(--accent)"}">${fmt(t)}</div></div>`;
    })
    .join("")}
${maxTime > 90 ? `<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:.75rem;font-size:.82rem;color:var(--gold);margin-top:.75rem">⚠️ You spent the most time on Q${maxIdx + 1}. Focus more on: <strong>${mockState.answers[maxIdx]?.topic || "this topic"}</strong></div>` : ""}
</div>
${
mcqAns.length > 0
    ? `
<div class="pb" style="margin-top:1.5rem">
    <h3>📝 MCQ Answer Review — ${correct}/${mcqAns.length} correct</h3>
    <p style="color:var(--muted);font-size:.82rem;margin-bottom:1rem">Correct answers are highlighted in green. Your wrong selections shown in red.</p>
    ${mockState.answers
    .filter((a) => a.isCorrect !== undefined)
    .map((a, i) => {
        const opts = a.options || ["A","B","C","D"].map(l => l + ": Option " + l);
        return `
    <div style="background:var(--surface2);border-radius:10px;padding:1rem;margin-bottom:1rem;border-left:4px solid ${a.isCorrect ? "var(--green)" : "var(--red)"}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
        <span style="font-size:.75rem;color:var(--muted);font-weight:600">Q${i + 1} · ${a.isCorrect ? "✓ CORRECT" : "✗ WRONG"}</span>
        <span style="font-weight:800;font-family:Syne,sans-serif;font-size:.9rem;color:${a.isCorrect ? "var(--green)" : "var(--red)"}">${a.isCorrect ? "100" : "0"}/100</span>
        </div>
        <div style="font-weight:600;margin-bottom:.75rem;font-size:.9rem">${a.question}</div>
        <div style="display:flex;flex-direction:column;gap:.35rem;margin-bottom:.75rem">
        ${opts.map((opt, oi) => {
            const letter = "ABCD"[oi];
            const optText = typeof opt === "string" && opt.includes(":") ? opt.split(":").slice(1).join(":").trim() : opt;
            const isCorrectOpt = letter === (a.correct || "").replace(/[^A-D]/g,"").trim();
            const isSelectedWrong = letter === a.selected && !a.isCorrect;
            const bg = isCorrectOpt ? "rgba(16,185,129,0.15)" : isSelectedWrong ? "rgba(239,68,68,0.12)" : "var(--bg)";
            const border = isCorrectOpt ? "var(--green)" : isSelectedWrong ? "var(--red)" : "var(--border)";
            const icon = isCorrectOpt ? "✅" : isSelectedWrong ? "❌" : "";
            return `<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-radius:7px;border:1px solid ${border};background:${bg};font-size:.83rem">
            <span style="font-weight:700;min-width:20px;color:${isCorrectOpt ? "var(--green)" : isSelectedWrong ? "var(--red)" : "var(--muted)"}">${letter}</span>
            <span style="flex:1">${optText}</span>
            <span>${icon}</span>
            </div>`;
        }).join("")}
        </div>
        <div style="font-size:.78rem;color:var(--muted)">Your answer: <strong style="color:${a.isCorrect ? "var(--green)" : "var(--red)"}">${a.selected}</strong> · Correct: <strong style="color:var(--green)">${(a.correct || "").replace(/[^A-D]/g,"")}</strong></div>
        ${a.explanation ? `<div style="font-size:.78rem;color:var(--accent);margin-top:.5rem;padding:.5rem .75rem;background:rgba(59,130,246,0.06);border-radius:6px">💡 ${a.explanation}</div>` : ""}
    </div>`;
    })
    .join("")}
</div>`
    : ""
}
${
openEvals.length > 0
    ? `
<div class="pb" style="margin-top:1.5rem"><h3>🤖 AI Evaluation Summary</h3>
    ${mockState.answers
    .filter((a) => a.answer !== undefined)
    .map((a, i) => {
        const ev = mockState.evalResults[mcqAns.length + i] || {
        score: 50,
        feedback: "N/A",
        };
        return `<div style="background:var(--surface2);border-radius:8px;padding:.9rem;margin-bottom:.6rem;border-left:3px solid ${scoreColor(ev.score)}">
        <div style="display:flex;justify-content:space-between;margin-bottom:.3rem"><span style="font-size:.78rem;color:var(--muted)">Q${mcqAns.length + i + 1} · ${a.topic || ""}</span><span style="font-weight:700;color:${scoreColor(ev.score)}">${ev.score}/100</span></div>
        <div style="font-size:.85rem;margin-bottom:.3rem">${a.question}</div>
        ${ev.feedback ? `<div class="ai-feedback" style="margin-top:.4rem"><div class="ai-fb-body">${ev.feedback}</div></div>` : ""}
    </div>`;
    })
    .join("")}
</div>`
    : ""
}
<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.5rem">
<button class="btn btn-primary btn-lg" onclick="exitInterview();goPage('dashboard')">← Dashboard</button>
<button class="btn btn-outline btn-lg" onclick="openMock(${currentRoundIdx},'${currentCo ? currentCo.id : ""}')">🔄 Retry (New Questions)</button>
</div>
${currentCo && currentCo.rounds[currentRoundIdx] ? (() => {
const r = currentCo.rounds[currentRoundIdx];
const ytLinks = r.ytLinks || [];
const links = r.links || [];
const techLinks = links.filter(l => l.url.includes("leetcode") || l.url.includes("geeksforgeeks") || l.url.includes("hackerrank"));
return `<div class="pb" style="margin-top:1.5rem">
    <h3>📚 Study Resources for This Round</h3>
    ${techLinks.length ? `<div style="margin-bottom:1rem"><div style="font-size:.75rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Practice Problems</div><div style="display:flex;flex-wrap:wrap;gap:.5rem">${techLinks.map(l => `<a href="${l.url}" target="_blank" class="rs-link">${l.icon || "🔗"} ${l.name}</a>`).join("")}</div></div>` : ""}
    ${ytLinks.length ? `<div><div style="font-size:.75rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">YouTube Video Guides</div><div style="display:flex;flex-direction:column;gap:.5rem">${ytLinks.map(l => `<a href="${l.url}" target="_blank" class="rs-link yt" style="align-items:center;gap:.5rem"><svg width="18" height="18" viewBox="0 0 24 24" fill="red"><path d="M19.615 3.184C21.403 3.63 22 5.146 22 7.001v9.998c0 1.855-.597 3.371-2.385 3.817C17.842 21 12 21 12 21s-5.842 0-7.615-.184C2.597 20.37 2 18.854 2 16.999V7.001c0-1.855.597-3.371 2.385-3.817C6.158 3 12 3 12 3s5.842 0 7.615.184zM10 15l5.19-3L10 9v6z"/></svg> ${l.name}</a>`).join("")}</div></div>` : ""}
</div>`;
})() : ""}
</div>`;
}

// ══════════════════════════════════════════════
// HR VOICE INTERVIEW
// ══════════════════════════════════════════════
async function startHRInterview(coId) {
const co = coId
    ? COMPANIES.find((c) => c.id === coId)
    : currentCo || COMPANIES[0];
hrState.company = co ? co.name : "a top company";
hrState.companyId = co ? co.id : "";
hrState.level = currentUser ? currentUser.lv : "fresher";
hrState.idx = 0;
hrState.answers = [];
hrState.recordings = [];
hrState.timings = [];
hrState.feedback = [];
hrState.scores = [];
goPage("hr");
const body = document.getElementById("hr-body");
body.innerHTML = `<div style="text-align:center;padding:4rem 2rem"><div class="spinner-wrap" style="justify-content:center;font-size:1rem"><div class="spinner" style="width:24px;height:24px;border-width:3px"></div><span>Generating personalized HR questions for <strong>${hrState.company}</strong>...</span></div></div>`;
const role = currentUser ? currentUser.ro : "Software Developer";
hrState.questions = await genHRQuestions(
    hrState.company,
    role,
    hrState.level,
);
hrState.qStartTime = Date.now();
renderHRQ();
}

function renderHRQ() {
const idx = hrState.idx;
const total = hrState.questions.length;
if (idx >= total) {
    finishHRInterview();
    return;
}
const q = hrState.questions[idx];
const pct = Math.round((idx / total) * 100);
const isLast = idx === total - 1;
const body = document.getElementById("hr-body");
body.innerHTML = `
<div style="display:flex;gap:.6rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">
<button class="btn btn-outline btn-sm" onclick="stopAllCamera();goPage('dashboard')">✕ Exit</button>
<span style="font-size:.8rem;color:var(--muted)">HR Interview — ${hrState.company}</span>
<span style="margin-left:auto;font-size:.8rem;color:var(--muted);background:var(--surface2);padding:.25rem .75rem;border-radius:100px">Q${idx + 1}/${total}</span>
<div class="q-timer" id="q-timer">⏱ 4:00</div>
</div>
<div class="mock-prog"><div class="mock-prog-fill" style="width:${pct}%"></div></div>
<div class="hr-stage">
<div class="video-box">
<img src="hr.jpg" alt="HR Avatar" onerror="this.parentElement.innerHTML='<div style=&quot;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a3a5c,#0d2a3a)&quot;><div style=&quot;font-size:5rem&quot;>👩‍💼</div><div style=&quot;color:#fff;font-weight:600;margin-top:.5rem;font-family:Syne,sans-serif&quot;>HR Manager</div></div>'">
<div class="speaking-ring" id="speaking-ring"></div>
<div class="video-label">HR Manager — ${hrState.company}</div>
</div>
<div class="video-box" id="user-video-box">
<video id="user-cam" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover"></video>
<div class="video-label">You</div>
<div class="rec-dot" id="rec-dot" style="display:none"></div>
</div>
</div>
<div class="mock-qcard">
<div class="mock-qlbl">Question ${idx + 1} of ${total}</div>
<div class="mock-qtext" id="hr-q-text">${q}</div>
<div class="hr-controls">
<button class="rec-btn idle" id="rec-btn" onclick="startRec()">🎙️ Record Answer</button>
<span class="rec-timer" id="rec-timer" style="display:none">0:00</span>
<div class="audio-wave" id="audio-wave" style="display:none"><span></span><span></span><span></span><span></span><span></span></div>
<button class="btn btn-outline btn-sm" onclick="speakQ(document.getElementById('hr-q-text').textContent)">🔊 Replay</button>
${hrState.recordings[idx] ? `<button class="btn btn-outline btn-sm" onclick="dlWav(${idx})">⬇️ WAV</button>` : ""}
<span class="voice-server-status" style="font-size:.72rem;margin-left:auto"></span>
</div>
<div id="transcript-area" style="display:none;margin-bottom:.75rem;padding:.75rem;background:var(--surface2);border-radius:8px;font-size:.85rem;color:var(--muted)">✅ Recording saved as WAV</div>
<!-- Voice analysis card appears here after recording stops -->
<div id="voice-card-${idx}" style="margin-bottom:.75rem"></div>
<div class="ta-wrap">
<textarea class="mock-ta" id="hr-ta" placeholder="Type your answer or key points here for AI evaluation (use STAR method: Situation → Task → Action → Result)..."></textarea>
<button class="mic-btn ta-mic" id="hr-mic-btn" onclick="toggleMic('hr-ta','hr-mic-btn')" title="Click to dictate your answer">🎙️</button>
</div>
${idx > 0 ? `<div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);border-radius:8px;padding:.65rem 1rem;margin-bottom:.75rem;font-size:.8rem;color:var(--green)">✅ Previous answer submitted — complete feedback will be shown at the end</div>` : ''}
<div id="hr-fb-area"></div>
<div class="mock-nav">
<div class="mock-tip">💡 STAR Method: Situation → Task → Action → Result</div>
<button class="btn btn-primary" id="hr-next-btn" onclick="submitHRQ()">${isLast ? "Finish Interview →" : "Submit & Next →"}</button>
</div>
</div>`;
// Start camera only once — reuse stream across all questions
if (!videoStream) {
    safeGetUserMedia({ video: true, audio: false })
    .then((stream) => {
        videoStream = stream;
        const v = document.getElementById("user-cam");
        if (v) v.srcObject = stream;
    })
    .catch(() => {});
} else {
    const v = document.getElementById("user-cam");
    if (v) v.srcObject = videoStream;
}
// Speak question
hrState.qStartTime = Date.now();
setTimeout(() => speakQ(q), 600);
// Start question timer (4 minutes for HR)
startQuestionTimer(240, () => { showToast("⏰ Time up! Submitting answer..."); setTimeout(() => { if(document.getElementById('hr-next-btn')) submitHRQ(); }, 1200); });
}

function speakQ(text) {
window.speechSynthesis.cancel();
const ring = document.getElementById("speaking-ring");
if (ring) ring.classList.add("active");
const u = new SpeechSynthesisUtterance(text);
u.rate = 0.88;
u.pitch = 1.05;
const voices = window.speechSynthesis.getVoices();
const female = voices.find(
    (v) =>
    v.name.includes("Samantha") ||
    v.name.includes("Google UK English Female") ||
    v.name.toLowerCase().includes("female"),
);
if (female) u.voice = female;
u.onend = u.onerror = () => {
    if (ring) ring.classList.remove("active");
};
window.speechSynthesis.speak(u);
}

async function startRec() {
let stream;
try {
    stream = await safeGetUserMedia({ audio: true });
} catch (e) {
    showToast("Microphone access denied. Please allow microphone.", true);
    return;
}
hrState.audioChunks = [];
hrState.mediaRecorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported("audio/webm")
    ? "audio/webm"
    : "audio/ogg",
});
hrState.mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) hrState.audioChunks.push(e.data);
};
hrState.mediaRecorder.start(100);
hrState.isRecording = true;
hrState.recSecs = 0;
const btn = document.getElementById("rec-btn"),
    timer = document.getElementById("rec-timer"),
    wave = document.getElementById("audio-wave"),
    dot = document.getElementById("rec-dot");
if (btn) {
    btn.className = "rec-btn recording";
    btn.innerHTML = "⏹ Stop Recording";
    btn.onclick = stopRec;
}
if (timer) {
    timer.style.display = "inline";
    timer.textContent = "0:00";
}
if (wave) wave.style.display = "flex";
if (dot) dot.style.display = "block";
hrState.recInterval = setInterval(() => {
    hrState.recSecs++;
    if (timer) timer.textContent = fmt(hrState.recSecs);
}, 1000);
}

// ══════════════════════════════════════════════
// VOICE ANALYSIS SERVER INTEGRATION
// ══════════════════════════════════════════════
const VOICE_SERVER = "http://localhost:5000";
let serverAvailable = null; // null=unknown, true/false

// Check if server is running (called once on page load)
async function checkVoiceServer() {
try {
    const res = await fetch(VOICE_SERVER + "/health", { signal: AbortSignal.timeout(2000) });
    serverAvailable = res.ok;
} catch {
    serverAvailable = false;
}
// Update any visible mic status indicators
document.querySelectorAll(".voice-server-status").forEach(el => {
    el.textContent = serverAvailable
    ? "🟢 Voice analysis active"
    : "🔴 Voice analysis offline (run server.py)";
    el.style.color = serverAvailable ? "var(--green)" : "var(--muted)";
});
}

// Send a WAV blob to the server and return the analysis result
async function analyzeVoice(wavBlob, question, qIndex) {
if (!wavBlob) return null;
// Show loading in the card
const cardId = "voice-card-" + qIndex;
const card = document.getElementById(cardId);
if (card) {
    card.innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;padding:1rem;background:rgba(59,130,246,0.06);border-radius:10px;border:1px solid rgba(59,130,246,0.2)">
        <div class="spinner" style="width:20px;height:20px;border-width:2px;flex-shrink:0"></div>
        <div>
        <div style="font-weight:600;font-size:.85rem">🎙️ Analyzing your voice...</div>
        <div style="font-size:.76rem;color:var(--muted)">Whisper transcription + acoustic features</div>
        </div>
    </div>`;
}

try {
    const form = new FormData();
    form.append("audio", wavBlob, "answer_q" + qIndex + ".wav");
    form.append("question", question || "Interview question");
    form.append("q_index", String(qIndex));

    const res = await fetch(VOICE_SERVER + "/analyze", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120000) // 2 min for Whisper
    });

    if (!res.ok) throw new Error("Server returned " + res.status);
    const data = await res.json();
    serverAvailable = true;
    renderVoiceCard(data, qIndex);
    return data;
} catch (err) {
    serverAvailable = false;
    console.warn("Voice server error:", err.message);
    if (card) {
    card.innerHTML = `
        <div style="padding:.65rem .9rem;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;font-size:.78rem;color:var(--gold)">
        ⚠️ Voice analysis unavailable — <strong>run server.py</strong> to enable.
        <span style="color:var(--muted);display:block;margin-top:.2rem">All other scoring still works normally.</span>
        </div>`;
    }
    return null;
}
}

// Render the voice analysis result card inside the HR question
function renderVoiceCard(data, qIndex) {
const cardId = "voice-card-" + qIndex;
const card = document.getElementById(cardId);
if (!card) return;

const score = data.score || 0;
const scoreColor = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
const wpm = data.wpm || 0;
const fillers = data.filler_count || 0;
const duration = data.duration || 0;
const f = data.features || {};
const suggestions = data.suggestions || [];
const isMock = data.mock === true;

card.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1.1rem;margin-top:.75rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.85rem;flex-wrap:wrap;gap:.5rem">
        <div style="font-weight:700;font-size:.88rem;display:flex;align-items:center;gap:.5rem">
        🎙️ Voice Analysis Report
        ${isMock ? '<span style="font-size:.7rem;background:rgba(245,158,11,0.15);color:var(--gold);border-radius:4px;padding:.1rem .4rem">DEMO</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:.4rem">
        <div style="font-size:1.3rem;font-weight:900;font-family:Syne,sans-serif;color:${scoreColor}">${score}</div>
        <div style="font-size:.7rem;color:var(--muted);line-height:1.2">/100<br>Voice</div>
        </div>
    </div>

    ${data.transcript && data.transcript !== "[Transcription failed — check Whisper installation]" ? `
    <div style="background:var(--bg);border-radius:8px;padding:.6rem .8rem;margin-bottom:.75rem;font-size:.78rem;line-height:1.6;color:var(--muted);border-left:3px solid var(--accent)">
        <span style="font-size:.68rem;text-transform:uppercase;font-weight:700;color:var(--accent);display:block;margin-bottom:.25rem">Transcript</span>
        ${data.transcript}
    </div>` : ""}

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:.5rem;margin-bottom:.75rem">
        ${metricPill("🗣️ WPM", wpm > 0 ? wpm.toFixed(0) : "—", wpm >= 100 && wpm <= 170 ? "green" : wpm > 0 ? "red" : "muted")}
        ${metricPill("⚡ Fillers", fillers, fillers <= 3 ? "green" : fillers <= 7 ? "gold" : "red")}
        ${metricPill("⏱️ Duration", duration > 0 ? duration.toFixed(0) + "s" : "—", "muted")}
        ${f.jitter > 0 ? metricPill("Jitter", f.jitter.toFixed(3), f.jitter < 0.01 ? "green" : f.jitter < 0.02 ? "gold" : "red") : ""}
        ${f.shimmer > 0 ? metricPill("Shimmer", f.shimmer.toFixed(3), f.shimmer < 0.2 ? "green" : f.shimmer < 0.35 ? "gold" : "red") : ""}
        ${f.pitch_std > 0 ? metricPill("Pitch Var", f.pitch_std.toFixed(1), f.pitch_std >= 3 ? "green" : f.pitch_std >= 2 ? "gold" : "red") : ""}
        ${f.hnr > 0 ? metricPill("HNR", f.hnr.toFixed(1), f.hnr >= 15 ? "green" : f.hnr >= 10 ? "gold" : "red") : ""}
    </div>

    ${suggestions.length ? `
    <div style="font-size:.76rem">
        <div style="font-weight:700;color:var(--accent);margin-bottom:.3rem">💡 Voice Coaching Tips</div>
        ${suggestions.map(s => `<div style="padding:.25rem 0;border-bottom:1px solid var(--border);color:var(--muted)">${s}</div>`).join("")}
    </div>` : ""}
    </div>`;

// Store voice score in hrState for the final report
hrState.voiceScores = hrState.voiceScores || {};
hrState.voiceScores[qIndex] = { score, wpm, fillers, transcript: data.transcript, suggestions };
}

function metricPill(label, value, color) {
const colors = {
    green: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", text: "#10b981" },
    gold:  { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", text: "#f59e0b" },
    red:   { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)",  text: "#ef4444" },
    muted: { bg: "var(--surface2)", border: "var(--border)", text: "var(--muted)" },
};
const c = colors[color] || colors.muted;
return `
    <div style="background:${c.bg};border:1px solid ${c.border};border-radius:8px;padding:.4rem .5rem;text-align:center">
    <div style="font-size:.62rem;color:var(--muted);margin-bottom:.15rem">${label}</div>
    <div style="font-size:.88rem;font-weight:800;color:${c.text}">${value}</div>
    </div>`;
}

function stopRec() {
if (!hrState.mediaRecorder || !hrState.isRecording) return;
clearInterval(hrState.recInterval);
hrState.isRecording = false;
const currentIdx = hrState.idx; // capture before async
const currentQuestion = hrState.questions[currentIdx] || "Interview question";
hrState.mediaRecorder.onstop = async () => {
    const blob = new Blob(hrState.audioChunks, { type: "audio/webm" });
    const wav = await toWav(blob);
    hrState.recordings[currentIdx] = wav;

    const ta = document.getElementById("transcript-area");
    if (ta) {
    ta.style.display = "block";
    ta.textContent = "✅ Recording saved. Type key points above if needed.";
    }

    // Send to voice analysis server (non-blocking — doesn't crash if server is offline)
    analyzeVoice(wav, currentQuestion, currentIdx);
};
hrState.mediaRecorder.stop();
hrState.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
const btn = document.getElementById("rec-btn"),
    timer = document.getElementById("rec-timer"),
    wave = document.getElementById("audio-wave"),
    dot = document.getElementById("rec-dot");
if (btn) {
    btn.className = "rec-btn idle";
    btn.innerHTML = "🎙️ Record Again";
    btn.onclick = startRec;
}
if (timer) timer.style.display = "none";
if (wave) wave.style.display = "none";
if (dot) dot.style.display = "none";
}

// Single shared AudioContext — Chrome hard-limits 6 per tab.
// Creating a new one per recording crashes after Q2-Q3.
let _audioCtx = null;
function _getAudioCtx() {
if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
if (_audioCtx.state === "suspended") _audioCtx.resume().catch(() => {});
return _audioCtx;
}

async function toWav(blob) {
try {
    const ab = await blob.arrayBuffer();
    const ctx = _getAudioCtx();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    return encodeWAV(buf);
} catch (e) {
    console.warn("toWav fallback:", e);
    return blob;
}
}

function encodeWAV(buf) {
const ch = 1,
    sr = buf.sampleRate,
    samples = buf.getChannelData(0);
const ab = new ArrayBuffer(44 + samples.length * 2);
const v = new DataView(ab);
function ws(o, s) {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
}
function f2pcm(out, off, inp) {
    for (let i = 0; i < inp.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, inp[i]));
    out.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
}
ws(0, "RIFF");
v.setUint32(4, 36 + samples.length * 2, true);
ws(8, "WAVE");
ws(12, "fmt ");
v.setUint32(16, 16, true);
v.setUint16(20, 1, true);
v.setUint16(22, ch, true);
v.setUint32(24, sr, true);
v.setUint32(28, sr * ch * 2, true);
v.setUint16(32, ch * 2, true);
v.setUint16(34, 16, true);
ws(36, "data");
v.setUint32(40, samples.length * 2, true);
f2pcm(v, 44, samples);
return new Blob([ab], { type: "audio/wav" });
}

function dlWav(idx) {
const b = hrState.recordings[idx];
if (!b) return;
const url = URL.createObjectURL(b);
const a = document.createElement("a");
a.href = url;
a.download = "answer_q" + (idx + 1) + "_" + Date.now() + ".wav";
a.click();
URL.revokeObjectURL(url);
showToast("✅ WAV downloaded!");
}

async function submitHRQ() {
const ta = document.getElementById("hr-ta");
const answer = ta ? ta.value.trim() : "";
if (!answer && !hrState.recordings[hrState.idx]) {
    showToast("Please record or type your answer!", true);
    return;
}
const elapsed = Math.round((Date.now() - hrState.qStartTime) / 1000);
const capturedIdx = hrState.idx;           // ← capture BEFORE any push/increment
const capturedQ   = hrState.questions[capturedIdx];

hrState.timings.push(elapsed);
hrState.answers.push(answer || "[Voice answer only]");
hrState.feedback.push(null);               // placeholder at capturedIdx slot
hrState.scores.push(60);                   // placeholder at capturedIdx slot

const btn = document.getElementById("hr-next-btn");
if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Saving...'; }
const fbArea = document.getElementById("hr-fb-area");
if (fbArea) fbArea.innerHTML = '<div style="font-size:.8rem;color:var(--muted);padding:.5rem 0">Answer saved ✓ — AI feedback will appear in complete report after interview.</div>';

// Evaluate in background — use capturedIdx so async result lands in the right slot
evalHRAnswer(capturedQ, answer || "Candidate answered via voice.", hrState.company, hrState.level)
    .then(evalResult => {
    hrState.feedback[capturedIdx] = evalResult;
    hrState.scores[capturedIdx]   = evalResult.score || 60;
    saveAnalytics();
    })
    .catch(() => {});   // ← never crash the session on Gemini failure

hrState.idx++;
setTimeout(() => renderHRQ(), 600);
}

function formatHRFeedback(fb) {
if (!fb || typeof fb !== "object") return String(fb);
const scoreCol = scoreColor(fb.score || 60);
let html = `<span class="score-badge" style="background:${scoreCol}22;color:${scoreCol}">${fb.assessment || "Average"}</span><br>`;
if (fb.strengths && fb.strengths.length)
    html += `<strong>✅ Strengths:</strong><br>${fb.strengths.map((s) => "• " + s).join("<br>")}<br><br>`;
if (fb.improvements && fb.improvements.length)
    html += `<strong>🎯 Improvements:</strong><br>${fb.improvements.map((s) => "• " + s).join("<br>")}<br><br>`;
if (fb.betterAnswer)
    html += `<strong>💡 Better Approach:</strong> ${fb.betterAnswer}`;
return html;
}

function finishHRInterview() {
// Stop camera when assessment is done
stopAllCamera();
const body = document.getElementById("hr-body");
body.innerHTML = `<div style="text-align:center;padding:4rem"><div class="spinner-wrap" style="justify-content:center;flex-direction:column;gap:1rem"><div class="spinner" style="width:32px;height:32px;border-width:3px"></div><div><strong>Generating complete feedback report...</strong></div><div style="color:var(--muted);font-size:.85rem">AI is analysing all your answers — please wait</div></div></div>`;
// Wait for all background evals to complete, then re-run full eval
const evalAllAndRender = async () => {
    const promises = hrState.questions.map((q, i) =>
    evalHRAnswer(q, hrState.answers[i] || "No answer provided.", hrState.company, hrState.level)
        .catch(() => ({ score: 60, assessment: "Average", strengths: [], improvements: ["Could not evaluate — review manually."], betterAnswer: "Use the STAR method for structured answers." }))
    );
    const results = await Promise.all(promises);
    hrState.feedback = results;
    hrState.scores = results.map(r => r.score || 60);
    saveAnalytics();
    _renderHRCompletion();
};
evalAllAndRender();
}
function _renderHRCompletion() {
const avgScore = hrState.scores.length
    ? Math.round(
        hrState.scores.reduce((a, b) => a + b, 0) / hrState.scores.length,
    )
    : 0;
const maxTime = Math.max(...hrState.timings, 1);
const maxIdx = hrState.timings.indexOf(maxTime);
const body = document.getElementById("hr-body");
body.innerHTML = `
<div style="max-width:800px;margin:0 auto">
<div class="score-wrap" style="margin-bottom:1.5rem">
<div class="score-circle" style="background:linear-gradient(135deg,${scoreColor(avgScore)},var(--accent2))">
    <div class="score-num">${avgScore}</div><div class="score-lbl">AI SCORE</div>
</div>
<div class="sec-title">HR Interview Complete! 🎉</div>
<p style="color:var(--muted)">${hrState.company} · ${hrState.questions.length} questions · Camera off</p>
</div>
<div class="analytics-grid">
<div class="analytics-card"><div class="analytics-val" style="color:var(--accent)">${avgScore}%</div><div class="analytics-lbl">Avg AI Score</div></div>
<div class="analytics-card"><div class="analytics-val" style="color:var(--green)">${hrState.questions.length}</div><div class="analytics-lbl">Questions Done</div></div>
<div class="analytics-card"><div class="analytics-val" style="color:var(--gold)">${fmt(hrState.timings.reduce((a, b) => a + b, 0))}</div><div class="analytics-lbl">Total Time</div></div>
<div class="analytics-card"><div class="analytics-val" style="color:${maxTime > 120 ? "var(--red)" : "var(--green)"}">${fmt(maxTime)}</div><div class="analytics-lbl">Max Time Q${maxIdx + 1}</div></div>
</div>
<div class="time-bar-wrap">
<div class="time-bar-title">⏱️ Time Analysis — Longer bar = took more time</div>
${hrState.timings
    .map((t, i) => {
    const pct = Math.round((t / maxTime) * 100);
    const slow = t === maxTime && hrState.timings.length > 1;
    return `<div class="time-bar-row"><div class="time-bar-label">Q${i + 1}: ${hrState.questions[i]?.substring(0, 42)}...</div><div class="time-bar-track"><div class="time-bar-fill" style="width:${pct}%;background:${slow ? "linear-gradient(90deg,var(--gold),var(--red))" : "linear-gradient(90deg,var(--accent),var(--accent2))"}"></div></div><div class="time-bar-val" style="color:${slow ? "var(--red)" : "var(--accent)"}">${fmt(t)}</div></div>`;
    })
    .join("")}
${maxTime > 120 ? `<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:.75rem;font-size:.82rem;color:var(--gold);margin-top:.75rem">⚠️ You took the longest on Q${maxIdx + 1}. Practice answering this type of question faster with structure.</div>` : ""}
</div>
<div style="margin-top:1.5rem">
<div class="sec-title" style="font-size:1.2rem;margin-bottom:1rem">📝 Full Q&A with AI Feedback</div>
${hrState.questions
    .map((q, i) => {
    const fb = hrState.feedback[i];
    const sc = hrState.scores[i] || 0;
    return `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.25rem;margin-bottom:1rem">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
        <span style="font-size:.75rem;color:var(--accent);font-weight:700">Q${i + 1} · ${fmt(hrState.timings[i])} spent</span>
        <span style="font-family:Syne,sans-serif;font-weight:700;color:${scoreColor(sc)}">${sc}/100</span>
    </div>
    <div style="font-weight:600;margin-bottom:.6rem">${q}</div>
    <div style="background:var(--surface2);border-radius:8px;padding:.85rem;margin-bottom:.75rem;font-size:.85rem;color:var(--muted)">${hrState.answers[i]}</div>
    ${fb ? `<div class="ai-feedback"><div class="ai-fb-hdr">🤖 AI Evaluation</div><div class="ai-fb-body">${formatHRFeedback(fb)}</div></div>` : ""}
    ${hrState.voiceScores && hrState.voiceScores[i] ? (() => {
        const vs = hrState.voiceScores[i];
        const vc = vs.score >= 80 ? "#22c55e" : vs.score >= 60 ? "#f59e0b" : "#ef4444";
        return `<div style="margin-top:.75rem;padding:.65rem .85rem;background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.15);border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
            <span style="font-size:.78rem;font-weight:700;color:var(--accent)">🎙️ Voice Analysis</span>
            <span style="font-weight:800;color:${vc}">${vs.score}/100</span>
        </div>
        <div style="font-size:.74rem;color:var(--muted);display:flex;gap:1rem;flex-wrap:wrap">
            <span>🗣️ ${vs.wpm ? vs.wpm.toFixed(0) + ' WPM' : 'N/A'}</span>
            <span>⚡ ${vs.fillers} fillers</span>
        </div>
        ${vs.transcript ? `<div style="font-size:.72rem;color:var(--muted);margin-top:.35rem;font-style:italic;border-top:1px solid var(--border);padding-top:.35rem">"${vs.transcript.substring(0, 150)}${vs.transcript.length > 150 ? '…' : ''}"</div>` : ''}
        </div>`;
    })() : ""}
    ${hrState.recordings[i] ? `<button class="btn btn-outline btn-sm" style="margin-top:.5rem" onclick="dlWav(${i})">⬇️ Download WAV Answer</button>` : ""}
    </div>`;
    })
    .join("")}
</div>
<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.5rem">
<button class="btn btn-primary btn-lg" onclick="goPage('dashboard')">← Dashboard</button>
<button class="btn btn-outline btn-lg" onclick="dlHRReport()">📥 Download Report</button>
<button class="btn btn-gold btn-lg" onclick="startHRInterview()">🔄 Try Again</button>
</div>
</div>`;
}

function dlHRReport() {
const avg = hrState.scores.length
    ? Math.round(
        hrState.scores.reduce((a, b) => a + b, 0) / hrState.scores.length,
    )
    : 0;
let r =
    "=== PREPEDGE HR INTERVIEW REPORT ===\n\nCompany: " +
    hrState.company +
    "\nDate: " +
    new Date().toLocaleDateString() +
    "\nAvg Score: " +
    avg +
    "/100\n\n" +
    "=".repeat(50) +
    "\n\n";
hrState.questions.forEach((q, i) => {
    const fb = hrState.feedback[i] || {};
    r +=
    "Q" +
    (i + 1) +
    ": " +
    q +
    "\nTime: " +
    fmt(hrState.timings[i] || 0) +
    "\nScore: " +
    (hrState.scores[i] || 0) +
    "/100\n\nYour Answer:\n" +
    hrState.answers[i] +
    "\n\n";
    if (fb.strengths)
    r +=
        "Strengths:\n" +
        fb.strengths.map((s) => "  • " + s).join("\n") +
        "\n";
    if (fb.improvements)
    r +=
        "Improvements:\n" +
        fb.improvements.map((s) => "  • " + s).join("\n") +
        "\n";
    if (fb.betterAnswer)
    r += "Better Approach: " + fb.betterAnswer + "\n";
    r += "\n" + "-".repeat(40) + "\n\n";
});
const blob = new Blob([r], { type: "text/plain" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "hr_report_" + Date.now() + ".txt";
a.click();
URL.revokeObjectURL(url);
showToast("✅ Report downloaded!");
}

// ══════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════
function saveAnalytics() {
try {
    const d = JSON.parse(localStorage.getItem("pe_analytics") || "[]");
    d.push({
    date: new Date().toISOString(),
    company: hrState.company,
    scores: [...hrState.scores],
    timings: [...hrState.timings],
    });
    localStorage.setItem("pe_analytics", JSON.stringify(d.slice(-20)));
} catch (e) {}
}

function showAnalytics() {
const sec = document.getElementById("analytics-section");
if (!sec) return;
sec.style.display = "block";
let d = [];
try {
    d = JSON.parse(localStorage.getItem("pe_analytics") || "[]");
} catch (e) {}
if (!d.length) {
    sec.innerHTML =
    '<div class="pb"><h3>📊 My Analytics</h3><p style="color:var(--muted)">No sessions yet. Complete an HR interview to see your analytics here.</p></div>';
    return;
}
const allScores = d.flatMap((s) => s.scores || []);
const avg = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;
const allTimes = d.flatMap((s) => s.timings || []);
const avgTime = allTimes.length
    ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
    : 0;
sec.innerHTML = `
<div class="sec-title" style="font-size:1.2rem;margin-bottom:1rem">📊 My Preparation Analytics</div>
<div class="analytics-grid">
<div class="analytics-card"><div class="analytics-val" style="color:var(--accent)">${d.length}</div><div class="analytics-lbl">Total Sessions</div></div>
<div class="analytics-card"><div class="analytics-val" style="color:${scoreColor(avg)}">${avg}%</div><div class="analytics-lbl">Avg AI Score</div></div>
<div class="analytics-card"><div class="analytics-val" style="color:var(--gold)">${fmt(avgTime)}</div><div class="analytics-lbl">Avg Time/Question</div></div>
<div class="analytics-card"><div class="analytics-val" style="color:var(--accent2)">${allScores.length}</div><div class="analytics-lbl">Questions Answered</div></div>
</div>
<div class="time-bar-wrap">
<div class="time-bar-title">📈 Recent Session Scores</div>
${d
.slice(-6)
.map((s) => {
    const a =
    s.scores && s.scores.length
        ? Math.round(
            s.scores.reduce((x, y) => x + y, 0) / s.scores.length,
        )
        : 0;
    return `<div class="time-bar-row"><div class="time-bar-label">${s.company} · ${new Date(s.date).toLocaleDateString()}</div><div class="time-bar-track"><div class="time-bar-fill" style="width:${a}%;background:linear-gradient(90deg,${scoreColor(a)},var(--accent))"></div></div><div class="time-bar-val" style="color:${scoreColor(a)}">${a}%</div></div>`;
})
.join("")}
</div>`;
}

// ══════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════
function renderDashboard() {
if (!currentUser) return;
document.getElementById("dash-name").textContent =
    "Welcome back, " + currentUser.fn + "! 👋";
let readiness = 15;
try {
    const d = JSON.parse(localStorage.getItem("pe_analytics") || "[]");
    const scores = d.flatMap((s) => s.scores || []);
    if (scores.length) {
    const a = scores.reduce((x, y) => x + y, 0) / scores.length;
    readiness = Math.min(95, 15 + d.length * 8 + Math.round(a * 0.35));
    }
} catch (e) {}
document.getElementById("rpct").textContent = readiness + "%";
document.getElementById("rfill").style.width = readiness + "%";
document.getElementById("info-strip").innerHTML =
    '<div class="ic"><div class="ic-l">Name</div><div class="ic-v">' +
    currentUser.fn +
    " " +
    currentUser.ln +
    "</div></div>" +
    '<div class="ic"><div class="ic-l">Role</div><div class="ic-v">' +
    currentUser.ro +
    "</div></div>" +
    '<div class="ic"><div class="ic-l">Level</div><div class="ic-v">' +
    cap(currentUser.lv) +
    "</div></div>" +
    '<div class="ic"><div class="ic-l">Course</div><div class="ic-v">' +
    currentUser.co +
    "</div></div>";
const recs =
    currentUser.lv === "experienced"
    ? COMPANIES.filter((c) => c.type === "product")
    : COMPANIES.filter((c) => c.type === "service");
const all = [
    ...recs,
    ...COMPANIES.filter((c) => !recs.includes(c)),
].slice(0, 6);
document.getElementById("dash-grid").innerHTML = all
    .map(
    (c) => `
<div class="co-card" onclick="openCo('${c.id}')">
<div class="co-logo"><img src="${c.logo}" alt="${c.name}" onerror="logoFallback(this,'${c.short[0]}')"></div>
<div class="co-name">${c.name}</div>
<div class="co-roles">${c.roles.slice(0, 2).join(" · ")}</div>
<div class="co-tags">${c.tags.map((t, i) => '<span class="tag ' + c.tc[i] + '">' + t + "</span>").join("")}</div>
<div class="co-btns">
<button class="btn btn-primary btn-sm">Prepare Now</button>
<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();startHRInterview('${c.id}')">🎙️ HR Mock</button>
</div>
</div>`,
    )
    .join("");
}

// ══════════════════════════════════════════════
// BLOG
// ══════════════════════════════════════════════
function setBlogFilter(btn) {
document
    .querySelectorAll("#pg-blog .fbtn")
    .forEach((b) => b.classList.remove("on"));
btn.classList.add("on");
activeBlogFilter = btn.getAttribute("data-bf");
renderBlog();
}
function renderBlog(coId) {
const q = (
    document.getElementById("blog-search")?.value || ""
).toLowerCase();
const posts = BLOG_POSTS.filter((p) => {
    const mf =
    activeBlogFilter === "all" || p.tags.includes(activeBlogFilter);
    const mq =
    !q ||
    p.title.toLowerCase().includes(q) ||
    p.company.toLowerCase().includes(q) ||
    p.excerpt.toLowerCase().includes(q);
    const mc = !coId || p.coId === coId;
    return mf && mq && mc;
});
const grid = document.getElementById("blog-grid");
if (!grid) return;
const gradients = {
    google: "linear-gradient(135deg,#1a3a5c,#0d2a47)",
    microsoft: "linear-gradient(135deg,#1a2a3a,#0d1a2e)",
    flipkart: "linear-gradient(135deg,#2a1a3a,#1a0d2e)",
    infosys: "linear-gradient(135deg,#1a3a2a,#0d2a1a)",
    tcs: "linear-gradient(135deg,#3a2a1a,#2a1a0d)",
};
const coLogos = {
    google: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/320px-Google_2015_logo.svg.png",
    microsoft: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/320px-Microsoft_logo.svg.png",
    flipkart: "https://upload.wikimedia.org/wikipedia/en/1/1b/Online_shopping_in_India.jpg",
    infosys: "https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg",
    tcs: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Tata_Consultancy_Services_Logo.svg",
};
const bg = (p) => gradients[p.coId] || "linear-gradient(135deg,#1a2a3a,#0d1a2e)";
const coLogo = (p) => coLogos[p.coId] || null;
grid.innerHTML =
    posts
    .map(
        (p) => `
<div class="blog-card" onclick="openBlogPost(${p.id})">
<div class="blog-cover blog-cover-new" style="background:${bg(p)}">
${coLogo(p) ? `<img src="${coLogo(p)}" class="blog-co-logo" alt="${p.company}" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><div style="display:none;align-items:center;justify-content:center;font-size:3rem">${p.emoji}</div>` : `<div style="font-size:3.5rem">${p.emoji}</div>`}
<div class="blog-cover-co-name">${p.company}</div>
</div>
<div class="blog-body">
<div class="blog-company">${p.company}</div>
<div class="blog-title">${p.title}</div>
<div class="blog-excerpt">${p.excerpt}</div>
<div class="blog-meta"><div class="blog-avatar">${p.author[0]}</div><span>${p.author}</span><span>·</span><span>${p.date}</span></div>
</div>
</div>`,
    )
    .join("") ||
    '<div class="empty"><div class="big">📝</div>No posts found</div>';
}
function openBlogPost(id) {
const p = BLOG_POSTS.find((x) => x.id === id);
if (!p) return;
const body = p.body
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(
    /\n\n/g,
    "</p><p style='color:var(--muted);line-height:1.75;margin-bottom:1rem'>",
    )
    .replace(/\n/g, "<br>");
const gradients = {
    google: "linear-gradient(135deg,#1a3a5c,#0d2a47)",
    microsoft: "linear-gradient(135deg,#1a2a3a,#0d1a2e)",
    flipkart: "linear-gradient(135deg,#2a1a3a,#1a0d2e)",
    infosys: "linear-gradient(135deg,#1a3a2a,#0d2a1a)",
    tcs: "linear-gradient(135deg,#3a2a1a,#2a1a0d)",
};
const coLogos2 = {
    google: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/320px-Google_2015_logo.svg.png",
    microsoft: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/320px-Microsoft_logo.svg.png",
    infosys: "https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg",
    tcs: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Tata_Consultancy_Services_Logo.svg",
};
const bg = gradients[p.coId] || "linear-gradient(135deg,#1a2a3a,#0d1a2e)";
const pLogo = coLogos2[p.coId];
document.getElementById("blogpost-body").innerHTML = `
<button class="btn btn-outline btn-sm" onclick="goPage('blog')" style="margin-bottom:1.5rem">← Back</button>
<div style="max-width:700px">
<div style="background:${bg};border-radius:14px;padding:3rem;text-align:center;margin-bottom:2rem">${pLogo ? `<img src="${pLogo}" style="max-height:60px;max-width:200px;object-fit:contain;filter:brightness(1.1)" alt="${p.company}" onerror="this.style.display='none'"><br>` : `<span style="font-size:5rem">${p.emoji}</span><br>`}<span style="font-size:.75rem;color:rgba(255,255,255,.6);font-weight:700;text-transform:uppercase;letter-spacing:.1em">${p.company}</span></div>
<div class="sec-title" style="font-size:1.6rem;margin-bottom:.5rem">${p.title}</div>
<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:2rem">
<div class="blog-avatar">${p.author[0]}</div>
<div><div style="font-weight:600">${p.author}</div><div style="font-size:.78rem;color:var(--muted)">${p.role} · ${p.date}</div></div>
</div>
<div><p style="color:var(--muted);line-height:1.75;margin-bottom:1rem">${body}</p></div>
<div style="margin-top:1.5rem"><button class="btn btn-primary" onclick="openCo('${p.coId}')">Prepare for ${p.company} →</button></div>
</div>`;
goPage("blogpost");
}

// ══════════════════════════════════════════════
// FEEDBACK
// ══════════════════════════════════════════════
function setRating(n) {
feedbackRating = n;
const stars = document.querySelectorAll("#fb-stars span");
stars.forEach((s, i) => {
    s.textContent = i < n ? "⭐" : "☆";
});
}
function submitFeedback() {
closeModal("feedback");
showToast("💙 Thank you! Rating: " + feedbackRating + "/5");
}

// ══════════════════════════════════════════════
// QUESTION TIMER
// ══════════════════════════════════════════════
let questionTimerInterval = null;
function clearQuestionTimer() {
if (questionTimerInterval) { clearInterval(questionTimerInterval); questionTimerInterval = null; }
}
function getQuestionTimeLimit(co, roundIdx, type) {
// Round-based time limits
if (!co || !co.rounds[roundIdx]) return type === 'mcq' ? 120 : 300;
const rt = co.rounds[roundIdx].type;
if (rt === 'aptitude') return type === 'mcq' ? 90 : 120;
if (rt === 'technical') return 600;  // 10 min for technical
if (rt === 'managerial') return 300;
if (rt === 'hr') return 240;
return type === 'mcq' ? 120 : 300;
}
function startQuestionTimer(seconds, onExpire) {
clearQuestionTimer();
let remaining = seconds;
const update = () => {
    const el = document.getElementById('q-timer');
    if (!el) { clearQuestionTimer(); return; }
    el.textContent = '⏱ ' + fmt(remaining);
    el.className = 'q-timer';
    if (remaining <= 30) el.classList.add('warn');
    if (remaining <= 10) { el.classList.remove('warn'); el.classList.add('danger'); }
    if (remaining <= 0) { clearQuestionTimer(); if(onExpire) onExpire(); }
    remaining--;
};
update();
questionTimerInterval = setInterval(update, 1000);
}

// ══════════════════════════════════════════════
// MIC / SPEECH-TO-TEXT
// ══════════════════════════════════════════════
let activeSpeechRecognition = null;
function toggleMic(taId, btnId) {
const ta = document.getElementById(taId);
const btn = document.getElementById(btnId);
if (!ta || !btn) return;
if (activeSpeechRecognition) {
    activeSpeechRecognition.stop();
    activeSpeechRecognition = null;
    btn.classList.remove('listening');
    btn.textContent = '🎙️';
    return;
}
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) { showToast('Speech recognition not supported in this browser', true); return; }
const rec = new SR();
rec.continuous = true;
rec.interimResults = true;
rec.lang = 'en-IN';
let finalText = ta.value;
rec.onstart = () => { btn.classList.add('listening'); btn.textContent = '⏹️'; };
rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
    if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
    else interim += e.results[i][0].transcript;
    }
    ta.value = finalText + interim;
};
rec.onerror = (e) => { showToast('Mic error: ' + e.error, true); activeSpeechRecognition = null; btn.classList.remove('listening'); btn.textContent = '🎙️'; };
rec.onend = () => { activeSpeechRecognition = null; btn.classList.remove('listening'); btn.textContent = '🎙️'; ta.value = finalText; };
activeSpeechRecognition = rec;
rec.start();
}


window.addEventListener("unhandledrejection", function(e) {
console.warn("PrepEdge caught unhandled rejection (session kept alive):", e.reason);
e.preventDefault();
});

// INIT
(function () {
currentUser = {
    fn: "Demo",
    ln: "User",
    em: "demo@prepedge.com",
    co: "B.Tech / B.E.",
    ro: "Software Developer",
    lv: "fresher",
};
window.speechSynthesis.getVoices();
window.speechSynthesis.onvoiceschanged = () =>
    window.speechSynthesis.getVoices();
renderNav();
renderCompanies();
renderDashboard();
renderBlog();
// Check if voice analysis server is running
checkVoiceServer();
setTimeout(() => {
    const l = document.getElementById("loader");
    if (l) l.classList.add("hidden");
    // Request mic permission early (at page load, not during interview)
    // Uses safeGetUserMedia to set the media-busy flag and avoid false
    // fullscreen/tab warnings if the interview starts shortly after.
    setTimeout(async () => {
    try {
        const stream = await safeGetUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        console.log("Mic access granted");
    } catch(e) {
        document.getElementById("mic-permission-modal").style.display = "flex";
    }
    }, 2000);
}, 1800);
})();
