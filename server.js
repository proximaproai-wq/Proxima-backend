const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 YOUR ANALYZE API
app.post("/analyze", async (req, res) => {
try {
const { resume, jobDescription } = req.body;

if (!resume || !jobDescription) {
return res.status(400).json({
success: false,
message: "Missing resume or job description"
});
}

// 🔥 CALL OPENAI
const response = await fetch("https://api.openai.com/v1/chat/completions", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
},
body: JSON.stringify({
model: "gpt-4o-mini",
messages: [
{
role: "system",
content: `
You are a professional career analyst.

Analyze the resume against the job description and return:
1. Candidate summary as per their uploaded resume
2. Match Score (0–100)
3. Missing Skills (clear bullet points)
4. Strengths (clear bullet points)
5. Action Plan (step-by-step improvements)
6. Recommended Resources:
- Free (YouTube/blog)
- Paid (Coursera/Udemy)
- Short explanation for each
7. Tell the canidate if they are way off currently for this job interms of skill experience

Rules:
- Be accurate (NO random 100% scores)
- Always give recommendations
- Be professional and structured
- Think twice than again twice before generating any answers  
`
},
{
role: "user",
content: `
RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}
`
}
],
temperature: 0.7
})
});

const data = await response.json();

const output =
data.choices?.[0]?.message?.content || "Analysis failed.";

res.json({
success: true,
data: output
});

} catch (error) {
console.error("ERROR:", error);
res.status(500).json({
success: false,
message: "Server error"
});
}
});

// 🔥 RENDER PORT FIX
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log("Server running on port " + PORT);
});