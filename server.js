const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { google } = require("googleapis");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// 🔒 STARTUP ENV VAR CHECKS
if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
  console.error("❌ Missing GOOGLE_SERVICE_ACCOUNT");
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}

const app = express();

// 🔒 CORS - RESTRICTED TO YOUR DOMAIN ONLY
app.use(cors({
  origin: [
    "https://amazing-sprinkles-c573ab.netlify.app",
    "http://localhost:3000"
  ]
}));

app.use(express.json());

// 🔒 RATE LIMITER - MAX 5 REQUESTS PER IP PER 15 MINUTES
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many requests, please try again after 15 minutes"
  }
});

app.use("/analyze", limiter);

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

    // 🔒 INPUT SIZE VALIDATION
    if (resume.length > 50000) {
      return res.status(400).json({
        success: false,
        message: "Resume text is too large"
      });
    }

    if (jobDescription.length > 20000) {
      return res.status(400).json({
        success: false,
        message: "Job description is too large"
      });
    }

    // 🔒 GOOGLE DRIVE LINK VALIDATION
    const allowedDrivePattern = /^https:\/\/drive\.google\.com\//;
    if (resume.includes("drive.google.com") && !allowedDrivePattern.test(resume)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google Drive link"
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
Provide a short paragraph stating clearly if the candidate is currently far from the role and a very high level of effort is required to reach it. If the candidate is far from the role suggest them industry which can be better suited for them.

Rules:
- Be honest, not polite
- Think deeply before assigning score
- ONLY output in this format
- DO NOT write numbers like 1,2,3 anywhere
- DO NOT write "Match Score (0/100)"
- ONLY write: Match Score: <number>
- If there is any mandatory requirement in the job description and the candidate is missing the same tell them honestly how like they are to achieve that skill, example - if a BBA student or a B.com student wants to become doctor then its not possible as they don't have a basic understanding and cannot bridge that gap easily. 
- DO NOT repeat score anywhere else
- Strong Fit must have score between 80 and 100
- Moderate Fit must have score between 65 and 79
- Weak Fit must have score between 40 and 64
- Far From Role must have score below 40
- Fit Level Strong Fit = candidate meets almost all core requirements
- Fit Level Moderate Fit = candidate meets most but has some core gaps
- Fit Level Weak Fit = candidate is missing several core requirements
- Fit Level Far From Role = candidate is fundamentally misaligned with the role
- Score and Fit Level must always be consistent with each other
- If they contradict each other you have made an error, fix it
- If candidate is Far From Role score cannot exceed 39
- If candidate is Weak Fit score cannot exceed 64
- Clearly estimate how far the candidate is from being job-ready for this role: Use realistic timelines such as: 0–3 months (Nearly ready), 3–6 months (Moderate gap), 6–12 months (Significant gap), Not realistic currently
- Base this on BOTH skills and experience, not just tools
- If candidate is missing the PRIMARY skill of the role (e.g. applying for Python role with no Python), score cannot exceed 45 regardless of other strengths
- Keep bullets clean with "-"
- Be accurate and realistic (no inflated scores)
- In free course add youtube links, that particular company preferred courses or course provider.
- Check the provided links are valid and operational, if not then provide only the course name
- Courses needs to be in Enlish Languag only, this is a non-Negotiable.
- If candidate is overqualified (more years of experience than required), flag it clearly and reduce score accordingly
- If salary range in JD is significantly below candidate's current level, mention it as a concern explicitly
- Basic skills explicitly listed in JD that are missing from resume must be listed as Core Missing Skills, not "Can increase chances"
- Can increase chances" bullets are ONLY for nice-to-have or bonus skills not listed as required in JD
- Do not give above 80 score unless candidate meets ALL core required skills in JD
- Do not give above 90 unless candidate is a near-perfect match with no core skill gaps
- A missing required skill must drop the score by at least 8-10 points each
- If experience years on resume far exceed JD requirement, mention overqualification risk explicitly in Verdict Summary
- Never assume a skill exists if it is not written on the resume
- Do not reward seniority if the role does not require it
- Verdict summary cannot contradict final note
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

// 🔥 HEALTH CHECK ROUTE FOR CRON / RENDER WAKE-UP (ADDED)
app.get("/", (req, res) => {
res.status(200).send("Proxima backend is live 🚀");
});

// 🔥 RENDER PORT FIX
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});