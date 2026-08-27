/**
 * Gemini Conversation Service
 * Specialized conversational orchestration for MediHeal Symptom Checker.
 * Responsibilities:
 * - Generate ONE short, elderly-friendly follow-up question to clarify symptoms
 * - Determine when sufficient context exists or max questions (3) reached
 * - Extract structured symptom context (symptoms, duration, severity, additionalContext)
 * - Enforce privacy (NO user PII sent to Gemini)
 * - Provide deterministic fallback if Gemini service is unavailable
 * 
 * Note: Gemini NEVER provides medical diagnosis, prescription, or final specialist recommendations.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Helper to parse and extract JSON object from raw response text
 */
const parseJSONFromText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Direct JSON parse
  try {
    return JSON.parse(rawText.trim());
  } catch (e) {
    // Continue
  }

  // 2. Markdown code block
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      // Continue
    }
  }

  // 3. First '{' to last '}'
  const startIdx = rawText.indexOf('{');
  const endIdx = rawText.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    try {
      return JSON.parse(rawText.substring(startIdx, endIdx + 1));
    } catch (e) {
      // Continue
    }
  }

  return null;
};

/**
 * Helper to parse duration from conversation Q&A answers
 */
const parseDurationFromAnswers = (conversation = []) => {
  const text = conversation.map((c) => (c.answer || '').toLowerCase().trim()).join(' ');
  if (!text) return 'unspecified';

  if (text.includes('today')) return 'today';
  if (text.includes('yesterday') || text.includes('since yesterday')) return '1 day';

  const daysMatch = text.match(/(\d+|one|two|three|four|five|six|seven)\s*days?/i);
  if (daysMatch) {
    const wordToNum = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7' };
    const num = wordToNum[daysMatch[1].toLowerCase()] || daysMatch[1];
    return `${num} ${Number(num) === 1 ? 'day' : 'days'}`;
  }

  const weeksMatch = text.match(/(\d+|one|two|three|four|a)\s*weeks?/i);
  if (weeksMatch) {
    const wordToNum = { a: '1', one: '1', two: '2', three: '3', four: '4' };
    const num = wordToNum[weeksMatch[1].toLowerCase()] || weeksMatch[1];
    return `${num} ${Number(num) === 1 ? 'week' : 'weeks'}`;
  }

  const monthsMatch = text.match(/(\d+|one|two|three|a)\s*months?/i);
  if (monthsMatch) {
    const wordToNum = { a: '1', one: '1', two: '2', three: '3' };
    const num = wordToNum[monthsMatch[1].toLowerCase()] || monthsMatch[1];
    return `${num} ${Number(num) === 1 ? 'month' : 'months'}`;
  }

  if (text.includes('1-3 days')) return '1-3 days';
  if (text.includes('more than 3 days')) return '>3 days';

  return 'unspecified';
};

/**
 * Helper to parse severity from conversation Q&A answers
 */
const parseSeverityFromAnswers = (conversation = []) => {
  const text = conversation.map((c) => (c.answer || '').toLowerCase().trim()).join(' ');
  if (text.includes('severe')) return 'severe';
  if (text.includes('moderate')) return 'moderate';
  if (text.includes('mild')) return 'mild';
  return 'moderate';
};

const BARE_BODY_PARTS = new Set([
  'knee', 'knees', 'ankle', 'ankles', 'hip', 'hips', 'right hip', 'left hip',
  'leg', 'legs', 'foot', 'feet', 'both feet', 'arm', 'arms', 'hand', 'hands',
  'back', 'lower back', 'upper back', 'shoulder', 'shoulders', 'elbow', 'elbows',
  'wrist', 'wrists', 'neck', 'chest', 'stomach', 'abdomen', 'thigh', 'thighs',
  'toe', 'toes', 'finger', 'fingers', 'head', 'body'
]);

const SYMPTOM_MODIFIERS = [
  'pain', 'ache', 'aching', 'stiffness', 'stiff', 'swelling', 'swollen',
  'instability', 'unstable', 'loose', 'numbness', 'numb', 'tingling',
  'tightness', 'tight', 'weakness', 'weak', 'soreness', 'sore', 'cramps',
  'cramping', 'rash', 'burning', 'spasm', 'spasms'
];

/**
 * Checks if a concept string is a bare body part lacking any symptom context
 */
const isBareBodyPart = (str) => {
  if (!str || typeof str !== 'string') return false;
  const clean = str.toLowerCase().trim().replace(/^(?:a|an|the|my|both|left|right)\s+/i, '').trim();
  if (BARE_BODY_PARTS.has(clean) || BARE_BODY_PARTS.has(str.toLowerCase().trim())) {
    const lower = str.toLowerCase();
    return !SYMPTOM_MODIFIERS.some((mod) => lower.includes(mod));
  }
  return false;
};

/**
 * Helper to decompose natural-language symptom text into concise, semantically preserved symptom concepts
 */
const extractSymptomConcepts = (symptoms = [], conversation = []) => {
  const concepts = [];

  const addConcept = (str) => {
    if (!str || typeof str !== 'string') return;
    let clean = str
      .toLowerCase()
      .trim()
      .replace(/^[•\-\*\s]+/, '')
      .replace(/^(?:a|an|the|my|and)\s+/i, '')
      .trim();

    if (
      clean.length >= 3 &&
      clean.length <= 100 &&
      !['and', 'the', 'a', 'my', 'with', 'like'].includes(clean) &&
      !isBareBodyPart(clean) &&
      !concepts.some((c) => c.toLowerCase() === clean)
    ) {
      concepts.push(clean);
    }
  };

  const parseSentenceText = (text) => {
    if (!text || typeof text !== 'string') return;
    // Strip duration phrases like "for 3 days", "for three days"
    let cleanText = text.replace(/\bfor\s+(?:\d+|one|two|three|four|five|six|seven|a|several)\s+(?:days?|weeks?|months?)\b/gi, '').trim();

    // Clause 1: Handle Radiation / Spreading Relationships
    const radiationMatch = cleanText.match(/(.*?\bpain\b.*?)\s+(?:spreading|radiating|extending|spreads)\s+(?:from\s+.*?\s+)?(?:to|into)\s+(.*)/i);
    if (radiationMatch) {
      const primaryPart = radiationMatch[1].trim();
      const targetPart = radiationMatch[2].split(/[,;]|\s+and\s+/i)[0].trim();
      
      const cleanPrimary = primaryPart.replace(/^(?:sharp\s+)?pain\s+in\s+the\s+/i, '').replace(/^(?:a\s+)?/i, '').trim();
      const cleanTarget = targetPart.replace(/^(?:the|my|a)\s+/i, '').trim();

      if (primaryPart.toLowerCase().includes('sharp')) {
        addConcept(`sharp ${cleanPrimary} pain`);
      } else {
        addConcept(`${cleanPrimary} pain`);
      }
      addConcept(`pain radiating to ${cleanTarget}`);

      const remaining = cleanText.substring(cleanText.indexOf(targetPart) + targetPart.length);
      cleanText = remaining.replace(/^[,;\s\.\-]+/, '').trim();
    }

    // Clause 2: Handle Shared Predicate across multiple body parts (e.g. "knee and ankle feel unstable")
    const sharedPredicateMatch = cleanText.match(/(?:my\s+)?([a-z\s]+?)\s+and\s+([a-z\s]+?)\s+(?:are|feel|feeling)\s+(?:loose\s+or\s+)?(unstable|weak|stiff|painful|numb|sore)/i);
    if (sharedPredicateMatch) {
      const part1 = sharedPredicateMatch[1].replace(/^(?:a|an|the|my)\s+/i, '').trim();
      const part2 = sharedPredicateMatch[2].replace(/^(?:a|an|the|my)\s+/i, '').trim();
      const pred = sharedPredicateMatch[3].trim();
      const predNoun = pred === 'unstable' ? 'instability' : pred === 'stiff' ? 'stiffness' : pred === 'weak' ? 'weakness' : pred;

      addConcept(`${part1} ${predNoun}`);
      addConcept(`${part2} ${predNoun}`);

      cleanText = cleanText.replace(sharedPredicateMatch[0], '').trim();
    }

    // Clause 3: Handle Shared Symptom in multiple body parts (e.g. "pain in my knee and ankle")
    const sharedSymptomMatch = cleanText.match(/(pain|numbness|tingling|stiffness|swelling|ache|cramps)\s+in\s+(?:my\s+|both\s+)?([a-z\s]+?)\s+and\s+([a-z\s]+)/i);
    if (sharedSymptomMatch) {
      const sym = sharedSymptomMatch[1].trim();
      const part1 = sharedSymptomMatch[2].replace(/^(?:my|both|the)\s+/i, '').trim();
      const part2 = sharedSymptomMatch[3].replace(/^(?:my|both|the)\s+/i, '').trim();

      addConcept(`${part1} ${sym}`);
      addConcept(`${part2} ${sym}`);

      cleanText = cleanText.replace(sharedSymptomMatch[0], '').trim();
    }

    // Clause 4: Handle Multiple Symptoms in a single body location (e.g. "numbness and tingling in both feet")
    const multiSymptomMatch = cleanText.match(/(numbness|tingling|pain|stiffness|swelling|burning)\s+and\s+(numbness|tingling|pain|stiffness|swelling|burning)\s+in\s+(?:both\s+|my\s+|the\s+)?([a-z\s]+)/i);
    if (multiSymptomMatch) {
      const sym1 = multiSymptomMatch[1].trim();
      const sym2 = multiSymptomMatch[2].trim();
      const loc = multiSymptomMatch[3].trim();

      addConcept(`${sym1} in ${loc}`);
      addConcept(`${sym2} in ${loc}`);

      cleanText = cleanText.replace(multiSymptomMatch[0], '').trim();
    }

    // Clause 5: General Clause Split for remaining independent phrases
    if (cleanText) {
      const clauses = cleanText
        .split(/[,;\.]|\s+(?:and|with|as well as)\s+/i)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      for (const clause of clauses) {
        if (isBareBodyPart(clause)) {
          if (cleanText.toLowerCase().includes('pain')) addConcept(`${clause} pain`);
          else if (cleanText.toLowerCase().includes('unstable') || cleanText.toLowerCase().includes('loose')) addConcept(`${clause} instability`);
          else if (cleanText.toLowerCase().includes('numb')) addConcept(`${clause} numbness`);
        } else {
          addConcept(clause);
        }
      }
    }
  };

  const rawInputs = Array.isArray(symptoms) ? symptoms : [String(symptoms)];
  for (const item of rawInputs) {
    parseSentenceText(item);
  }

  // Inspect associated symptoms from conversation Q&A
  conversation.forEach((turn) => {
    if (turn.field === 'associated_symptoms' && turn.answer && !['no', 'none', 'nothing'].includes(turn.answer.toLowerCase().trim())) {
      const parts = turn.answer.split(/[,;]/).map((p) => p.trim());
      parts.forEach(addConcept);
    }
  });

  const filtered = concepts.filter((c) => !isBareBodyPart(c));
  return filtered.slice(0, 10);
};

const clinicalCaseService = require('./clinicalCaseService');

/**
 * Deterministic fallback strategy when Gemini API is unavailable or returns invalid data
 */
const getDeterministicFallback = (symptoms, conversation = [], questionCount = 0) => {
  const currentCount = Number(questionCount) || conversation.length || 0;
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms,
    conversation,
  });

  // Only complete if max follow-ups (3) reached
  if (currentCount >= 3) {
    return {
      status: 'complete',
      summary: {
        symptoms: canonicalCase.positiveSymptoms,
        positiveSymptoms: canonicalCase.positiveSymptoms,
        negativeFindings: canonicalCase.negativeFindings,
        context: canonicalCase.context,
        duration: canonicalCase.duration || 'unspecified',
        severity: canonicalCase.severity,
        additionalDetails: canonicalCase.additionalDetails || [],
        additionalContext: conversation.map((c) => `${c.question}: ${c.answer}`),
      },
    };
  }

  const hasSeverity = canonicalCase.severity !== null || conversation.some((c) => ['mild', 'moderate', 'severe'].includes((c.answer || '').toLowerCase().trim()));
  const hasDuration = canonicalCase.duration && canonicalCase.duration !== 'unspecified';

  if (!hasDuration && currentCount === 0) {
    return {
      status: 'ask',
      question: 'How long have you been experiencing these symptoms?',
      field: 'duration',
      quickOptions: ['Today', '1-3 days', 'More than 3 days'],
    };
  }

  if (!hasSeverity && currentCount < 2) {
    return {
      status: 'ask',
      question: 'How severe is your overall discomfort: mild, moderate, or severe?',
      field: 'severity',
      quickOptions: ['Mild', 'Moderate', 'Severe'],
    };
  }

  const hasUrinary = canonicalCase.positiveSymptoms.some((s) =>
    ['urinate', 'urinating', 'discharge', 'penis', 'tip'].some((term) => s.toLowerCase().includes(term))
  );

  if (hasUrinary && currentCount < 3) {
    return {
      status: 'ask',
      question: 'Have you noticed any urinary frequency, urgency, blood in your urine, or testicular pain?',
      field: 'associated_urinary_symptoms',
      quickOptions: ['Yes', 'No'],
    };
  }

  if (currentCount < 3) {
    return {
      status: 'ask',
      question: 'Are you experiencing any other associated symptoms or changes in your condition?',
      field: 'associated_symptoms',
      quickOptions: ['Yes', 'No'],
    };
  }

  return {
    status: 'complete',
    summary: {
      symptoms: canonicalCase.positiveSymptoms,
      positiveSymptoms: canonicalCase.positiveSymptoms,
      negativeFindings: canonicalCase.negativeFindings,
      context: canonicalCase.context,
      duration: canonicalCase.duration || 'unspecified',
      severity: canonicalCase.severity,
      additionalDetails: canonicalCase.additionalDetails || [],
      additionalContext: conversation.map((c) => `${c.question}: ${c.answer}`),
    },
  };
};

/**
 * Question Quality & Clinical Relevance Validator
 * Validates candidate follow-up questions against active complaint domains, known findings, and previous turns.
 */
const validateFollowUpQuestion = ({ question, canonicalCase, previousQuestions = [], previousAnswers = [] }) => {
  if (!question || typeof question !== 'string') {
    return { accepted: false, reason: 'invalid' };
  }

  const cleanQ = question.trim();
  const lowerQ = cleanQ.toLowerCase();

  // 1. Length & Basic Structure Validation
  if (cleanQ.length < 10 || cleanQ.length > 220) {
    return { accepted: false, reason: 'invalid' };
  }

  // 2. Duplicate / Previous Question Topic Check (Concept-Level)
  const isDuplicate = previousQuestions.some((prev) => {
    const lowerP = String(prev).toLowerCase();
    if (lowerP === lowerQ) return true;
    if (lowerP.includes('how long') && lowerQ.includes('how long')) return true;
    if (lowerP.includes('when did') && lowerQ.includes('when did')) return true;
    if (lowerP.includes('how severe') && lowerQ.includes('how severe')) return true;
    if (lowerP.includes('swelling') && lowerQ.includes('swelling')) return true;
    if (lowerP.includes('urination') && lowerQ.includes('urination')) return true;
    if (lowerP.includes('discharge') && lowerQ.includes('discharge')) return true;
    if (lowerP.includes('redness') && lowerQ.includes('redness')) return true;
    return false;
  });
  if (isDuplicate) {
    return { accepted: false, reason: 'duplicate' };
  }

  // 3. Known Information & Negation Contradiction Guard
  // A. CONTRADICTS NEGATIVE FINDING GUARD (CRITICAL CLINICAL SAFETY)
  const contradictsNegative = (canonicalCase.negativeFindings || []).some((neg) => {
    const nLower = String(neg || '').toLowerCase().trim();
    if (!nLower) return false;
    const coreNeg = nLower.replace(/^(?:no|not|denies|without)\s+/, '').trim();
    if (!coreNeg || coreNeg.length < 3) return false;
    return lowerQ.includes(coreNeg);
  });
  if (contradictsNegative) {
    return { accepted: false, reason: 'CONTRADICTS_NEGATIVE_FINDING' };
  }

  // B. Duration already known
  const hasKnownDuration = canonicalCase.duration && canonicalCase.duration !== 'unspecified' && canonicalCase.duration !== '';
  if (hasKnownDuration && (/\bhow\s+long\b|\bwhen\s+did\b|\bhow\s+many\s+days\b|\bduration\b|\bhow\s+long\s+has\b|\bsince\s+when\b/i.test(lowerQ))) {
    return { accepted: false, reason: 'already_answered' };
  }

  // C. Symptoms/mechanisms/aggravations already answered
  const allKnownFindings = [
    ...(canonicalCase.positiveSymptoms || []),
    ...(canonicalCase.negativeFindings || []),
    ...(canonicalCase.context || []),
  ].map((s) => s.toLowerCase());

  if (lowerQ.includes('weight') && allKnownFindings.some((s) => s.includes('weight'))) {
    if (!lowerQ.includes('completely unable') && !lowerQ.includes('bear any weight')) {
      return { accepted: false, reason: 'already_answered' };
    }
  }

  if (lowerQ.includes('unstable') && allKnownFindings.some((s) => s.includes('unstable') || s.includes('instability'))) {
    return { accepted: false, reason: 'already_answered' };
  }

  if (lowerQ.includes('fever') && allKnownFindings.some((s) => s.includes('fever'))) {
    return { accepted: false, reason: 'already_answered' };
  }

  if ((lowerQ.includes('vomit') || lowerQ.includes('vomiting')) && allKnownFindings.some((s) => s.includes('vomit'))) {
    return { accepted: false, reason: 'already_answered' };
  }

  if (lowerQ.includes('abdominal pain') && allKnownFindings.some((s) => s.includes('abdominal') || s.includes('stomach'))) {
    return { accepted: false, reason: 'already_answered' };
  }

  // D. Systemic Complaint Body-Location Question Guard
  const isSystemicOnly = (canonicalCase.positiveSymptoms || []).length > 0 && (canonicalCase.positiveSymptoms || []).every((sym) => {
    const s = String(sym).toLowerCase();
    return (
      s.includes('dizzy') || s.includes('light-headed') || s.includes('weakness') ||
      s.includes('fatigue') || s.includes('palpitation') || s.includes('nausea') ||
      s.includes('fever') || s.includes('chills') || s.includes('sweating')
    );
  });
  if (isSystemicOnly && (lowerQ.includes('which body part') || lowerQ.includes('where does it hurt') || lowerQ.includes('part of your body') || lowerQ.includes('location of your pain'))) {
    return { accepted: false, reason: 'location_question_unneeded_for_systemic' };
  }

  // E. Unsupported Symptom Assumption Guard
  if ((lowerQ.includes('head pain') || lowerQ.includes('headache')) && !(canonicalCase.positiveSymptoms || []).some((s) => s.toLowerCase().includes('head'))) {
    return { accepted: false, reason: 'unsupported_symptom_assumption' };
  }

  // F. Ambiguous Multi-Concept Binary Question Guard (Section D & G)
  const isMultiConceptBinary =
    (/\bor\b/i.test(lowerQ) && (lowerQ.includes('dizziness') || lowerQ.includes('numbness') || lowerQ.includes('weakness') || lowerQ.includes('confusion') || lowerQ.includes('vision') || lowerQ.includes('tingling'))) ||
    /\b(?:dizziness|numbness|weakness|confusion|vision|tingling)\s+or\s+(?:dizziness|numbness|weakness|confusion|vision|tingling)\b/i.test(lowerQ);

  if (isMultiConceptBinary) {
    return { accepted: false, reason: 'ambiguous_multi_concept_question' };
  }

  // 4. Complaint Domain Relevance Guard (Generic across medical domains)
  const activeDomains = clinicalCaseService.getComplaintDomains(canonicalCase);

  const questionDomains = new Set();
  if (/\burinat|\burine|\bpeni|\bdischarge\b|\bprostate\b|\bbladder\b|\btestic\b|\bgenital\b/i.test(lowerQ)) {
    questionDomains.add('urinary_genital');
  }
  if (/\bstomach\b|\babdomen\b|\babdominal\b|\bspicy\b|\bbowel\b|\bdiarrh\b|\bheartburn\b|\bacid\b|\bepigastric\b/i.test(lowerQ)) {
    questionDomains.add('gastrointestinal');
  }
  if (/\bcough\b|\bwheez\b|\bsputum\b|\blung\b|\bphlegm\b/i.test(lowerQ)) {
    questionDomains.add('respiratory');
  }
  if (/\bchest\s+pain\b|\bpalpitations\b|\bchest\s+tight\b|\bcardiac\b/i.test(lowerQ)) {
    questionDomains.add('cardiovascular');
  }
  if (/\bheadache\b|\bdizzy\b|\bdizziness\b|\bphotophobia\b|\bseizure\b|\bstroke\b/i.test(lowerQ)) {
    questionDomains.add('neurological_heent');
  }

  // If question is in a domain NOT present in activeDomains AND not systemic/general safety
  for (const qDomain of questionDomains) {
    if (!activeDomains.has(qDomain) && !activeDomains.has('systemic_general')) {
      return { accepted: false, reason: 'unrelated_domain' };
    }
  }

  return { accepted: true, reason: 'relevant' };
};

/**
 * Generate next follow-up question or complete symptom summary via Gemini REST API
 * PRIVACY GUARANTEE: Only sends symptoms array, conversation Q&A history, and question count. NO PII.
 */
const generateFollowUp = async (symptoms = [], conversation = [], questionCount = 0) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const currentCount = Number(questionCount) || conversation.length || 0;

  // Hard limit: Max 3 questions
  if (currentCount >= 3) {
    return extractStructuredSummary(symptoms, conversation);
  }

  // Extract canonical case to provide full context to Gemini
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms,
    conversation,
  });

  const previousQuestions = conversation.map((c) => c.question || '').filter(Boolean);
  const previousAnswers = conversation.map((c) => c.answer || '').filter(Boolean);

  // Log conversation begin
  console.log('[GEMINI CONVERSATION]');
  console.log(`Model: ${configuredModel}`);

  if (!apiKey) {
    console.warn('⚠️ [GEMINI SERVICE] GEMINI_API_KEY not configured. Using deterministic fallback.');
    return getValidatedDeterministicFallback(symptoms, conversation, currentCount, canonicalCase, previousQuestions, previousAnswers);
  }

  const formattedHistory = conversation
    .map((item, idx) => `Q${idx + 1}: ${item.question}\nA${idx + 1}: ${item.answer}`)
    .join('\n\n');

  const systemPrompt = `You are MediHeal's conversational symptom assistant for elderly patients.
Your task is to ask 1 short, polite follow-up question (1 sentence max) to clarify missing clinical information, OR output a complete summary when 3 questions have been reached or no useful follow-up question remains.

Respond strictly with a single JSON object matching one of these two schemas:

Schema 1 (When asking a follow-up question):
{
  "status": "ask",
  "question": "Have you noticed any redness, warmth, or locking in your joint?",
  "field": "associated_symptoms",
  "quickOptions": ["Yes", "No"]
}

Schema 2 (When conversation is complete or 3 questions reached):
{
  "status": "complete",
  "summary": {
    "symptoms": ["right knee pain", "knee swelling", "knee instability"],
    "positiveSymptoms": ["right knee pain", "knee swelling", "knee instability"],
    "negativeFindings": ["able to move toes normally"],
    "context": ["twisted knee while walking downstairs"],
    "duration": "1 day",
    "severity": null,
    "additionalContext": []
  }
}

Strict Rules:
- Ask ONLY about clinically relevant missing information for the active complaint.
- Do NOT ask questions about information already provided (e.g. if duration or symptoms are already known, DO NOT ask them again!).
- Do NOT introduce an unrelated body system domain (e.g. do NOT ask about difficulty urinating for a traumatic knee injury!).
- Do NOT repeat previous questions.
- Preserve the patient's anatomical location and mechanism.
- If no additional useful question is necessary or max questions reached, return Schema 2 (status: "complete").`;

  const userPrompt = `Patient Cumulative Clinical Case:
Positive Symptoms: ${canonicalCase.positiveSymptoms.join(', ') || 'none reported'}
Negative Findings: ${canonicalCase.negativeFindings.join(', ') || 'none'}
Injury Mechanism / Context: ${canonicalCase.context.join(', ') || 'none'}
Current Duration: ${canonicalCase.duration || 'unspecified'}
Current Severity: ${canonicalCase.severity || 'null'}
Additional Details: ${canonicalCase.additionalDetails.join(', ') || 'none'}

Previous Questions Asked: ${previousQuestions.join(' | ') || 'none'}
Previous Answers: ${previousAnswers.join(' | ') || 'none'}

Current Question Count: ${currentCount} / 3

Instruction:
Generate 1 relevant follow-up question (Schema 1) targeting missing clinical information ONLY. Do not re-ask known information or introduce unrelated body systems. If no useful question remains, return Schema 2.

Output JSON:`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          { text: userPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1000,
      responseMimeType: 'application/json',
    },
  };

  const endpointUrl = `${GEMINI_API_URL}/${configuredModel}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ [GEMINI SERVICE] HTTP ${response.status}. Using validated deterministic fallback.`);
      return getValidatedDeterministicFallback(symptoms, conversation, currentCount, canonicalCase, previousQuestions, previousAnswers);
    }

    const data = await response.json();
    const candidateContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateContent) {
      return getValidatedDeterministicFallback(symptoms, conversation, currentCount, canonicalCase, previousQuestions, previousAnswers);
    }

    const parsed = parseJSONFromText(candidateContent);
    if (!parsed || typeof parsed !== 'object') {
      return getValidatedDeterministicFallback(symptoms, conversation, currentCount, canonicalCase, previousQuestions, previousAnswers);
    }

    if (parsed.status === 'ask' && parsed.question && typeof parsed.question === 'string') {
      let candidateQ = parsed.question.trim();
      if (candidateQ.length > 150) candidateQ = candidateQ.substring(0, 147) + '...';

      console.log(`[FOLLOWUP CANDIDATE] Question: "${candidateQ}"`);
      const val = validateFollowUpQuestion({
        question: candidateQ,
        canonicalCase,
        previousQuestions,
        previousAnswers,
      });

      console.log(`[FOLLOWUP VALIDATION] accepted=${val.accepted} reason=${val.reason}`);

      if (val.accepted) {
        return {
          status: 'ask',
          question: candidateQ,
          field: parsed.field || 'follow_up',
          quickOptions: Array.isArray(parsed.quickOptions)
            ? parsed.quickOptions.filter((o) => typeof o === 'string' && o.length < 30).slice(0, 4)
            : undefined,
        };
      }

      // ONE-ATTEMPT CONTROLLED REGENERATION WITH FEEDBACK
      console.log(`[FOLLOWUP REGENERATION] Attempting controlled retry for rejected question...`);
      const retryUserPrompt = `${userPrompt}\n\nCRITICAL FEEDBACK:
Your candidate question "${candidateQ}" was REJECTED because it was ${val.reason} (e.g. asking for already known information or introducing an unrelated body system domain).
Generate ONE different, clinically relevant follow-up question targeting missing information only, or return Schema 2 if no useful question remains.`;

      const retryPayload = {
        contents: [
          { parts: [{ text: systemPrompt }, { text: retryUserPrompt }] },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1000, responseMimeType: 'application/json' },
      };

      const retryController = new AbortController();
      const retryTimeoutId = setTimeout(() => retryController.abort(), 8000);
      try {
        const retryRes = await fetch(endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(retryPayload),
          signal: retryController.signal,
        });
        clearTimeout(retryTimeoutId);

        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const retryText = retryData.candidates?.[0]?.content?.parts?.[0]?.text;
          const retryParsed = parseJSONFromText(retryText);

          if (retryParsed && retryParsed.status === 'ask' && retryParsed.question) {
            let retryQ = retryParsed.question.trim();
            if (retryQ.length > 150) retryQ = retryQ.substring(0, 147) + '...';

            const retryVal = validateFollowUpQuestion({
              question: retryQ,
              canonicalCase,
              previousQuestions,
              previousAnswers,
            });

            console.log(`[FOLLOWUP VALIDATION][RETRY] accepted=${retryVal.accepted} reason=${retryVal.reason}`);
            if (retryVal.accepted) {
              return {
                status: 'ask',
                question: retryQ,
                field: retryParsed.field || 'follow_up',
                quickOptions: Array.isArray(retryParsed.quickOptions)
                  ? retryParsed.quickOptions.filter((o) => typeof o === 'string' && o.length < 30).slice(0, 4)
                  : undefined,
              };
            }
          }
        }
      } catch (rErr) {
        clearTimeout(retryTimeoutId);
      }

      // If regeneration also fails -> fallback
      return getValidatedDeterministicFallback(symptoms, conversation, currentCount, canonicalCase, previousQuestions, previousAnswers);
    }

    if (parsed.status === 'complete' && parsed.summary) {
      return validateAndFormatSummary(parsed.summary, symptoms, conversation);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`⚠️ [GEMINI SERVICE] Model ${configuredModel} error: ${err.message}. Using validated fallback.`);
  }

  return getValidatedDeterministicFallback(symptoms, conversation, currentCount, canonicalCase, previousQuestions, previousAnswers);
};

/**
 * Validated Deterministic Fallback Strategy
 */
const getValidatedDeterministicFallback = (symptoms, conversation = [], questionCount = 0, inputCanonicalCase = null, previousQuestions = [], previousAnswers = []) => {
  const currentCount = Number(questionCount) || conversation.length || 0;
  const canonicalCase = inputCanonicalCase || clinicalCaseService.buildCanonicalClinicalCase({ symptoms, conversation });

  if (currentCount >= 3) {
    return {
      status: 'complete',
      summary: {
        symptoms: canonicalCase.positiveSymptoms,
        positiveSymptoms: canonicalCase.positiveSymptoms,
        negativeFindings: canonicalCase.negativeFindings,
        context: canonicalCase.context,
        duration: canonicalCase.duration || 'unspecified',
        severity: canonicalCase.severity,
        additionalDetails: canonicalCase.additionalDetails || [],
        additionalContext: conversation.map((c) => `${c.question}: ${c.answer}`),
      },
    };
  }

  const activeDomains = clinicalCaseService.getComplaintDomains(canonicalCase);
  const hasSeverity = canonicalCase.severity !== null;
  const hasDuration = canonicalCase.duration && canonicalCase.duration !== 'unspecified';

  const candidates = [];

  if (!hasDuration) {
    candidates.push({
      status: 'ask',
      question: 'How long have you been experiencing these symptoms?',
      field: 'duration',
      quickOptions: ['Today', '1-3 days', 'More than 3 days'],
    });
  }

  if (!hasSeverity) {
    candidates.push({
      status: 'ask',
      question: 'How severe is your overall discomfort: mild, moderate, or severe?',
      field: 'severity',
      quickOptions: ['Mild', 'Moderate', 'Severe'],
    });
  }

  if (activeDomains.has('musculoskeletal')) {
    candidates.push({
      status: 'ask',
      question: 'Have you noticed any redness, warmth, or locking in the joint?',
      field: 'associated_musculoskeletal_symptoms',
      quickOptions: ['Yes', 'No'],
    });
  }

  if (activeDomains.has('urinary_genital')) {
    candidates.push({
      status: 'ask',
      question: 'Have you noticed any urinary frequency, urgency, or blood in your urine?',
      field: 'associated_urinary_symptoms',
      quickOptions: ['Yes', 'No'],
    });
  }

  if (activeDomains.has('gastrointestinal')) {
    candidates.push({
      status: 'ask',
      question: 'Have you noticed any changes in your bowel movements or abdominal bloating?',
      field: 'associated_gi_symptoms',
      quickOptions: ['Yes', 'No'],
    });
  }

  if (activeDomains.has('respiratory')) {
    candidates.push({
      status: 'ask',
      question: 'Are you having any wheezing, chest tightness, or coughing up phlegm?',
      field: 'associated_respiratory_symptoms',
      quickOptions: ['Yes', 'No'],
    });
  }

  candidates.push({
    status: 'ask',
    question: 'Are you experiencing any other associated symptoms or changes in your condition?',
    field: 'associated_symptoms',
    quickOptions: ['Yes', 'No'],
  });

  for (const cand of candidates) {
    const val = validateFollowUpQuestion({
      question: cand.question,
      canonicalCase,
      previousQuestions,
      previousAnswers,
    });
    if (val.accepted) {
      return cand;
    }
  }

  return {
    status: 'complete',
    summary: {
      symptoms: canonicalCase.positiveSymptoms,
      positiveSymptoms: canonicalCase.positiveSymptoms,
      negativeFindings: canonicalCase.negativeFindings,
      context: canonicalCase.context,
      duration: canonicalCase.duration || 'unspecified',
      severity: canonicalCase.severity,
      additionalDetails: canonicalCase.additionalDetails || [],
      additionalContext: conversation.map((c) => `${c.question}: ${c.answer}`),
    },
  };
};

/**
 * Validate and sanitize summary output from Gemini
 */
const validateAndFormatSummary = (rawSummary, initialSymptoms, conversation) => {
  const canonicalCase = clinicalCaseService.buildCanonicalClinicalCase({
    symptoms: initialSymptoms,
    conversation,
    duration: typeof rawSummary?.duration === 'string' ? rawSummary.duration : '',
    severity: typeof rawSummary?.severity === 'string' ? rawSummary.severity : '',
    positiveSymptoms: Array.isArray(rawSummary?.positiveSymptoms) ? rawSummary.positiveSymptoms : (Array.isArray(rawSummary?.symptoms) ? rawSummary.symptoms : []),
    negativeFindings: Array.isArray(rawSummary?.negativeFindings) ? rawSummary.negativeFindings : [],
    context: Array.isArray(rawSummary?.context) ? rawSummary.context : [],
  });

  let additionalContext = Array.isArray(rawSummary?.additionalContext)
    ? rawSummary.additionalContext.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean)
    : [];

  if (additionalContext.length === 0 && Array.isArray(conversation)) {
    additionalContext = conversation.map((c) => `${c.question}: ${c.answer}`);
  }

  return {
    status: 'complete',
    summary: {
      symptoms: canonicalCase.positiveSymptoms,
      positiveSymptoms: canonicalCase.positiveSymptoms,
      negativeFindings: canonicalCase.negativeFindings,
      context: canonicalCase.context,
      duration: canonicalCase.duration || 'unspecified',
      severity: canonicalCase.severity || 'moderate',
      additionalContext,
    },
  };
};

/**
 * Fallback structured summary extraction if max questions reached or Gemini fails
 */
const extractStructuredSummary = async (symptoms, conversation) => {
  return getDeterministicFallback(symptoms, conversation, 3);
};

module.exports = {
  generateFollowUp,
  validateFollowUpQuestion,
  getDeterministicFallback,
  validateAndFormatSummary,
  parseDurationFromAnswers,
  parseSeverityFromAnswers,
  extractSymptomConcepts,
};
