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

Analyze the resume against the job description and return the output STRICTLY in the format below.

DO NOT change wording, headings, or structure under any condition.

----------------------------------------

Verdict Summary:
Provide a clear and honest evaluation of how well the candidate fits the role. When giving summary mention the candidate as "You".
Clearly mention if they are:
- Strong fit
- Moderate fit
- Weak fit
- Far from the role

Match Score: <number only>

Missing Skills:
- Bullet point - Core Missing Skill
- Bullet point - Core Missing Skill
- Bullet point - Core Missing Skill
- Bullet point - Core Missing Skill
- Bullet point - Can increase chances
- Bullet point - Can increase chances

Strengths:
- Bullet point
- Bullet point
- Bullet point
- Bullet point

Action Plan:
- Step-by-step bullet points to improve 

Recommended Resources:

Free:
- Resource name + short explanation + Link to the Resource which is currently available online
- Resource name + short explanation + Link to the Resource which is currently available online
- Resource name + short explanation + Link to the Resource which is currently available online
- Resource name + short explanation + Link to the Resource which is currently available online

Paid:
- Resource name + short explanation + Link to the Resource which is currently available online
- Resource name + short explanation + Link to the Resource which is currently available online
- Resource name + short explanation + Link to the Resource which is currently available online

Final Note:
Provide a short paragraph stating clearly if the candidate is currently far from the role and what level of effort is required to reach it.

Rules:
- ONLY output in this format
- DO NOT write numbers like 1,2,3 anywhere
- DO NOT write "Match Score (0/100)"
- ONLY write: Match Score: <number>
- DO NOT repeat score anywhere else
- Keep bullets clean with "-"
- Be accurate and realistic (no inflated scores)
- Be honest, not polite
- Think deeply before assigning score
- In free course add youtube links, that particular company preferred courses or course provider.
- Check the provided links are valid and operational 
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