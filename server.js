const express = require("express");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(express.json());

// ✅ Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// ✅ ROOT ROUTE (for browser check)
app.get("/", (req, res) => {
  res.send("Proxima AI Backend is LIVE 🚀");
});


// ✅ TEST ROUTE (check AI connection)
app.get("/test", async (req, res) => {
  try {
    const response = await openai.responses.create({
      model: "gpt-5.4-nano",
      input: "Say hello in one short sentence"
    });

    const text =
      response.output?.[0]?.content?.[0]?.text || "No response";

    res.send(text);

  } catch (error) {
    console.error("TEST ERROR:", error.message);
    res.status(500).send("Test failed");
  }
});


// 🚀 MAIN FEATURE: ANALYZE
app.post("/analyze", async (req, res) => {
  try {
    const { resume, jobDescription } = req.body;

    // ✅ Validate input
    if (!resume || !jobDescription) {
      return res.status(400).json({
        success: false,
        message: "Resume and Job Description are required"
      });
    }

    const prompt = `
You are an expert career coach.

Analyze the resume against the job description.

Resume:
${resume}

Job Description:
${jobDescription}

Return STRICTLY in this format:

Match Score: XX/100

Missing Skills:
- skill 1
- skill 2

Strengths:
- point 1
- point 2

Action Plan:
1. step
2. step
3. step

Recommended Resources:
For each missing skill:
- Free resource (YouTube/blog)
- Paid course (Udemy/Coursera)
- Short description
`;

    // ✅ OpenAI call (correct for latest models)
    const response = await openai.responses.create({
      model: "gpt-5.4-nano",
      input: prompt,
      max_output_tokens: 500
    });

    const outputText =
      response.output?.[0]?.content?.[0]?.text || "No response generated";

    res.json({
      success: true,
      data: outputText
    });

  } catch (error) {
    console.error("ANALYZE ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong"
    });
  }
});


// ✅ PORT FIX (RENDER COMPATIBLE)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});