const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { google } = require("googleapis");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 GOOGLE DRIVE AUTH SETUP (ADDED)
const auth = new google.auth.GoogleAuth({
credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
scopes: ["https://www.googleapis.com/auth/drive.readonly"]
});

const drive = google.drive({ version: "v3", auth });

// 🔥 FUNCTION TO EXTRACT FILE ID FROM DRIVE LINK (ADDED)
function extractFileId(url) {
const match = url.match(/[-\w]{25,}/);
return match ? match[0] : null;
}

// 🔥 FUNCTION TO DOWNLOAD + EXTRACT PDF TEXT (ADDED)
async function getResumeTextFromDrive(fileUrl) {
const fileId = extractFileId(fileUrl);
if (!fileId) throw new Error("Invalid Google Drive link");

const response = await drive.files.get(
{ fileId, alt: "media" },
{ responseType: "arraybuffer" }
);

const buffer = Buffer.from(response.data);
const uint8Array = new Uint8Array(buffer);

const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
const pdf = await loadingTask.promise;

let fullText = "";
for (let i = 1; i <= pdf.numPages; i++) {
const page = await pdf.getPage(i);
const content = await page.getTextContent();
const strings = content.items.map(item => item.str);
fullText += strings.join(" ") + "\n";
}

return fullText;
}

// 🔥 YOUR ANALYZE API
app.post("/analyze", async (req, res) => {
try {
let { resume, jobDescription } = req.body;

if (!resume || !jobDescription) {
return res.status(400).json({
success: false,
message: "Missing resume or job description"
});
}

// 🔥 NEW: HANDLE GOOGLE DRIVE LINK
if (resume.includes("drive.google.com")) {
console.log("📄 Fetching resume from Google Drive...");
resume = await getResumeTextFromDrive(resume);
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

Score Breakdown:
- Base Score: 100
- [Missing skill or issue]: -<number> points
- [Missing skill or issue]: -<number> points
- [Missing skill or issue]: -<number> points
- [Missing skill or issue]: -<number> points
- Final Score: <number>

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
Provide a short paragraph stating clearly if the candidate is currently far from the role and what level of effort is required to reach it. If the candidate is far from the role suggest them industry which can be better suited for them.

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
- In free course add youtube links, that particular company preferred courses or course provider
- Check the provided links are valid and operational
- If candidate is overqualified (more years of experience than required), flag it clearly and reduce score accordingly
- If salary range in JD is significantly below candidate's current level, mention it as a concern explicitly
- Basic skills explicitly listed in JD that are missing from resume must be listed as Core Missing Skills, not "Can increase chances"
- "Can increase chances" bullets are ONLY for nice-to-have or bonus skills not listed as required in JD
- Do not give above 80 score unless candidate meets ALL core required skills in JD
- Do not give above 90 unless candidate is a near-perfect match with no core skill gaps
- A missing required skill must drop the score by at least 5-8 points each
- If experience years on resume far exceed JD requirement, mention overqualification risk explicitly in Verdict Summary
- Never assume a skill exists if it is not written on the resume
- Do not reward seniority if the role does not require it
- Score Breakdown must always start at Base Score: 100 and deduct points for every gap found
- Every deduction in Score Breakdown must have a clear reason written next to it
- Final Score in Score Breakdown must exactly match the Match Score above
- Deductions must be honest and mathematical - if 4 core skills are missing at 5-8 points each, the math must reflect that
- Score Breakdown must appear immediately after Match Score and before Missing Skills
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