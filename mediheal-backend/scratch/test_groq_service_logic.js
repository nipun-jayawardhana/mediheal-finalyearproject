require('dotenv').config();
const clinicalCaseService = require('../src/services/clinicalCaseService');

const apiKey = process.env.GROQ_API_KEY;
const PRIMARY_MODEL = process.env.GROQ_MODEL || 'qwen/qwen-2.5-7b-instruct';
const FALLBACK_MODEL = 'qwen/qwen3.8-27b';

async function testGroqService() {
  const symptoms = ['knee pain', 'swelling'];
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({ symptoms });
  const previousQuestions = [];
  const questionCount = 0;
  const language = 'en';

  const systemPrompt = `You are MediHeal's conversational symptom follow-up assistant for elderly patients.
Your sole purpose is to ask 1 short, polite follow-up question (1 sentence max) to clarify missing clinical information.

Strict Clinical Safety Rules:
- Generate FOLLOW-UP QUESTIONS ONLY.
- Do NOT diagnose any disease or medical condition.
- Do NOT provide medical advice, treatments, or prescriptions.
- Do NOT assess or change risk levels.
- Ask about ONLY ONE clinical concept (never combine multiple symptoms or concepts in one question).
- Strictly adhere to the active Clinical Domain.
- NEVER ask about or assume symptoms that appear in Negative Findings.
- Do NOT repeat questions that were already asked.
- Do NOT ask for information that is already known.
- Provide 2 to 4 simple quick answer options (e.g. ["Yes", "No"]).

Respond strictly with a single valid JSON object matching this schema:
{
  "question": "Have you noticed any changes in your ability to walk?",
  "concept": "mobility",
  "quickOptions": ["Yes", "No"]
}`;

  const clinicalProfile = clinicalCaseService.buildClinicalProfile(canonicalCase);
  const userPrompt = `Patient Clinical Profile:
Primary Complaint: ${clinicalProfile.primaryComplaint || symptoms.join(', ')}
Clinical Domain: ${clinicalProfile.clinicalDomain || 'general'}
Body Regions: ${(clinicalProfile.bodyRegions || []).join(', ') || 'unspecified'}

Patient Cumulative Clinical Case:
Positive Symptoms: ${(canonicalCase.positiveSymptoms || symptoms).join(', ')}
Negative Findings: ${(canonicalCase.negativeFindings || []).join(', ') || 'none'}
Context: ${(canonicalCase.context || []).join(', ') || 'none'}
Current Duration: ${canonicalCase.duration || 'unspecified'}
Current Severity: ${canonicalCase.severity || 'unspecified'}

Previous Questions Asked: ${previousQuestions.join(' | ') || 'none'}
Current Question Count: ${questionCount} / 3

Instruction:
Generate 1 relevant, single-concept follow-up question targeting missing clinical information ONLY.
Respond strictly in JSON format.`;

  async function callGroq(model) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  }

  let result = await callGroq(PRIMARY_MODEL);
  console.log(`Primary (${PRIMARY_MODEL}) status:`, result.status);
  if (!result.ok && (result.status === 404 || result.status === 400)) {
    console.log(`Trying fallback (${FALLBACK_MODEL})...`);
    result = await callGroq(FALLBACK_MODEL);
    console.log(`Fallback (${FALLBACK_MODEL}) status:`, result.status);
  }

  if (result.ok && result.data.choices?.[0]?.message?.content) {
    const content = JSON.parse(result.data.choices[0].message.content);
    console.log('Parsed content:', content);
  } else {
    console.error('Failed:', result.data);
  }
}

testGroqService().catch(console.error);
