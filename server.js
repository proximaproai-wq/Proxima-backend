const express = require("express");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY,
});

// ROOT CHECK
app.get("/", (req, res) => {
 res.send("Proxima Backend Running ");
});

// TEST ROUTE
app.get("/test", async (req, res) => {
 try {
 const response = await openai.responses.create({
 model: "gpt-5.4-nano",
 input: "Say hello in one line"
 });

 const text = response.output?.[0]?.content?.[0]?.text || "No response";
 res.send(text);

 } catch (err) {
 res.status(500).send(err.message);
 }
});

// MAIN ANALYSIS ROUTE
app.post("/analyze", async (req, res) => {
 try {
 const { resume, jobDescription } = req.body;

 // Basic validation
 if (!resume || !jobDescription) {
 return res.status(400).json({
 success: false,
 message: "Resume and Job Description required"
 });
 }

 // Prevent huge inputs (cost control)
 if (resume.length > 4000 || jobDescription.length > 3000) {
 return res.status(400).json({
 success: false,
 message: "Input too long. Please shorten resume or JD."
 });
 }

 const prompt = `
You are a senior career consultant.

Analyze the candidate's resume against the job description.

STRICT RULES:
- Never give 100% match unless PERFECT
- Always include ALL sections
- Be realistic and professional
- Think like a hiring manager

FORMAT:

Match Score: X/100

Verdict:
(2-3 lines explaining readiness and positioning)

Strengths:
- 3 to 5 strong relevant points

Key Gaps:
- list critical missing areas

Career Roadmap:

Phase 1 (0–6 months):
...

Phase 2 (6–18 months):
...

Phase 3 (2–5 years):
...

Learning Plan:
For each major gap:
- Skill:
- Free resources (YouTube/blog/platform)
- Paid courses (Udemy/Coursera/CFI etc.)
- Why this matters

Final Insight:
(1 strong professional closing insight)

---

Resume:
${resume}

---

Job Description:
${jobDescription}
`;

 const response = await openai.responses.create({
 model: "gpt-5.4-nano",
 input: prompt,
 max_output_tokens: 700
 });

 const output =
 response.output?.[0]?.content?.[0]?.text || "No output";

 res.json({
 success: true,
 data: output
 });

 } catch (error) {
 console.error("ERROR:", error);

 res.status(500).json({
 success: false,
 message: error.message || "Server error"
 });
 }
});

// PORT FIX FOR RENDER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
 console.log("Server running on port " + PORT);
});