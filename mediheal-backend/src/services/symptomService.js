/**
 * Symptom Analysis Service
 * Safe rule-based symptom analysis and specialist recommendation engine.
 * Designed with a clean interface so that rule-based logic can easily be
 * swapped or augmented with an AI API (e.g. Hugging Face / OpenAI) in the future.
 */

// Constant Disclaimer required on ALL responses
const MEDICAL_DISCLAIMER =
  'This result provides preliminary healthcare guidance only and does not constitute a medical diagnosis. Please consult a qualified healthcare professional for proper evaluation.';

// Urgent guidance string for emergency symptoms
const EMERGENCY_GUIDANCE_MESSAGE = 'Seek immediate professional medical assistance.';

// High-risk emergency symptom triggers (normalized lowercase)
const EMERGENCY_SYMPTOMS = [
  'severe chest pain',
  'difficulty breathing',
  'unconsciousness',
  'sudden weakness on one side',
  'severe bleeding',
  'seizure',
];

// Predefined Rule Definitions
const RULES = [
  {
    id: 'RULE_1',
    symptoms: ['fever', 'cough', 'sore throat'],
    possibleCondition: 'Possible viral respiratory infection',
    riskLevel: 'medium',
    recommendedSpecialist: 'General Physician',
    guidance: [
      'Rest adequately',
      'Stay hydrated',
      'Monitor temperature',
      'Seek medical attention if symptoms worsen',
    ],
    emergencyRecommended: false,
  },
  {
    id: 'RULE_2',
    symptoms: ['headache', 'fever'],
    possibleCondition: 'Possible febrile illness',
    riskLevel: 'medium',
    recommendedSpecialist: 'General Physician',
    guidance: [
      'Rest adequately',
      'Stay hydrated',
      'Monitor symptoms and seek medical advice if condition persists',
    ],
    emergencyRecommended: false,
  },
  {
    id: 'RULE_3',
    symptoms: ['skin rash', 'itching'],
    possibleCondition: 'Possible dermatological condition',
    riskLevel: 'low',
    recommendedSpecialist: 'Dermatologist',
    guidance: [
      'Avoid scratching the affected area',
      'Keep the area clean and dry',
      'Consult a dermatologist if rash spreads or worsens',
    ],
    emergencyRecommended: false,
  },
  {
    id: 'RULE_4',
    symptoms: ['stomach pain', 'vomiting'],
    possibleCondition: 'Possible gastrointestinal condition',
    riskLevel: 'medium',
    recommendedSpecialist: 'Gastroenterologist',
    guidance: [
      'Stay hydrated with small sips of fluid',
      'Avoid solid foods until vomiting subsides',
      'Consult a gastroenterologist or medical professional',
    ],
    emergencyRecommended: false,
  },
  {
    id: 'RULE_5',
    symptoms: ['chest pain', 'shortness of breath'],
    possibleCondition: 'Possible cardiac or respiratory emergency',
    riskLevel: 'high',
    recommendedSpecialist: 'Cardiologist',
    guidance: [
      'Seek immediate professional medical assistance.',
      'Avoid physical exertion',
    ],
    emergencyRecommended: true,
  },
  {
    id: 'RULE_6',
    symptoms: ['weakness', 'dizziness'],
    possibleCondition: 'Possible general medical condition',
    riskLevel: 'medium',
    recommendedSpecialist: 'General Physician',
    guidance: [
      'Sit or lie down immediately to prevent falling',
      'Drink fluids and rest',
      'Seek medical evaluation if dizziness persists',
    ],
    emergencyRecommended: false,
  },
  {
    id: 'RULE_7',
    symptoms: ['ear pain', 'hearing difficulty'],
    possibleCondition: 'Possible ear-related condition',
    riskLevel: 'low',
    recommendedSpecialist: 'ENT Specialist',
    guidance: [
      'Keep ears dry',
      'Do not insert objects into ear canal',
      'Consult an ENT specialist for an ear examination',
    ],
    emergencyRecommended: false,
  },
  {
    id: 'RULE_8',
    symptoms: ['joint pain', 'swelling'],
    possibleCondition: 'Possible musculoskeletal condition',
    riskLevel: 'medium',
    recommendedSpecialist: 'Orthopedic Specialist',
    guidance: [
      'Rest the affected joint',
      'Apply ice packs to reduce swelling',
      'Consult an orthopedic specialist for evaluation',
    ],
    emergencyRecommended: false,
  },
];

/**
 * Normalizes symptom array:
 * - Lowercase
 * - Trim whitespace
 * - Remove duplicates
 * - Filter out blank strings
 * @param {Array<string>} inputSymptoms
 * @returns {Array<string>} normalized symptoms
 */
// Controlled free-text symptom synonym mappings (natural patient phrasing -> canonical symptom term)
const SYMPTOM_SYNONYMS = [
  { match: ['stomach hurts', 'stomach hurt', 'pain in stomach', 'pain in my stomach', 'pain in belly', 'belly pain', 'abdominal pain', 'tummy pain', 'stomach ache', 'stomachache', 'stomach pain'], canonical: 'stomach pain' },
  { match: ['feeling like vomiting', 'throwing up', 'throw up', 'feel sick', 'queasy', 'nauseous', 'nausea', 'vomiting'], canonical: 'vomiting' },
  { match: ['can\'t breathe properly', 'can\'t breathe', 'cannot breathe', 'shortness of breath', 'short of breath', 'gasping', 'trouble breathing', 'difficulty breathing'], canonical: 'difficulty breathing' },
  { match: ['pain in chest', 'chest hurts', 'chest tightness', 'chest pain'], canonical: 'chest pain' },
  { match: ['high temperature', 'feverish', 'running a fever', 'fever'], canonical: 'fever' },
  { match: ['skin rash', 'itchy skin', 'rashes', 'skin itching', 'skin redness', 'itching'], canonical: 'skin rash' },
  { match: ['ear pain', 'ear ache', 'ear hurts', 'earache'], canonical: 'ear pain' },
  { match: ['joint pain', 'swollen joint', 'joint ache', 'joint swelling', 'knee pain', 'elbow pain', 'swelling'], canonical: 'joint pain' },
  { match: ['headache', 'head hurts', 'head ache', 'throbbing head'], canonical: 'headache' },
  { match: ['sore throat', 'throat pain', 'scratchy throat', 'throat hurts'], canonical: 'sore throat' },
  { match: ['cough', 'coughing', 'dry cough', 'wet cough'], canonical: 'cough' },
  { match: ['weakness', 'feeling weak', 'tiredness', 'fatigue'], canonical: 'weakness' },
  { match: ['dizziness', 'dizzy', 'feeling dizzy', 'lightheaded'], canonical: 'dizziness' },
];

// List of known disease / diagnosis names (not patient-reported symptoms)
const KNOWN_DISEASES = [
  'viral infection',
  'gastritis',
  'influenza',
  'flu',
  'bronchitis',
  'pneumonia',
  'covid',
  'covid-19',
  'diabetes',
  'asthma',
  'appendicitis',
  'gastroenteritis',
  'migraine',
  'dermatitis',
  'arthritis',
  'pharyngitis',
];

/**
 * Normalizes symptom array:
 * - Lowercase & trim whitespace
 * - Excludes known disease names (which are diagnoses, not symptoms)
 * - Maps natural free-text phrases to canonical symptom keywords via controlled synonym map
 * - Remove duplicates
 * - Filter out blank strings
 * @param {Array<string>} inputSymptoms
 * @returns {Array<string>} normalized symptoms
 */
const normalizeSymptoms = (inputSymptoms) => {
  if (!Array.isArray(inputSymptoms)) return [];
  const normalized = [];

  for (const raw of inputSymptoms) {
    if (typeof raw !== 'string') continue;
    const clean = raw.toLowerCase().trim();
    if (!clean) continue;

    // Filter out disease names (not patient-reported symptoms)
    if (KNOWN_DISEASES.includes(clean)) {
      console.log(`[SYMPTOM ENGINE] Excluding disease name from symptom processing: "${clean}"`);
      continue;
    }

    // Check against controlled synonym map
    let canonical = clean;
    for (const syn of SYMPTOM_SYNONYMS) {
      if (syn.match.some((pattern) => clean === pattern || clean.includes(pattern))) {
        canonical = syn.canonical;
        break;
      }
    }

    if (!normalized.includes(canonical)) {
      normalized.push(canonical);
    }
  }

  return normalized;
};

/**
 * Checks if any input symptoms match emergency safety triggers.
 * @param {Array<string>} rawSymptoms
 * @returns {boolean}
 */
const isEmergencySymptom = (rawSymptoms) => {
  const normalizedInput = normalizeSymptoms(rawSymptoms);
  return normalizedInput.some((userSym) =>
    EMERGENCY_SYMPTOMS.some(
      (emergSym) => userSym === emergSym || userSym.includes(emergSym)
    )
  );
};

/**
 * Analyzes symptoms based on safe rule-based matching and emergency triggers.
 * @param {Array<string>} rawSymptoms - Array of symptom strings
 * @param {string} [duration] - Optional duration
 * @param {string} [severity] - Severity: mild, moderate, severe
 * @returns {Object} Analysis result object
 */
const analyzeSymptoms = (rawSymptoms, duration = '', severity = 'mild') => {
  const normalizedInput = normalizeSymptoms(rawSymptoms);

  // 1. Check Emergency Safety Triggers
  const isEmergencyTriggered = isEmergencySymptom(normalizedInput);

  // 2. Perform Rule Matching
  let bestRule = null;
  let maxMatchedSymptoms = [];

  for (const rule of RULES) {
    const matched = rule.symptoms.filter((ruleSym) =>
      normalizedInput.some((userSym) => userSym === ruleSym || userSym.includes(ruleSym))
    );

    if (matched.length > maxMatchedSymptoms.length) {
      bestRule = rule;
      maxMatchedSymptoms = matched;
    }
  }

  // 3. Construct Result
  let possibleCondition;
  let possibleConditions = [];
  let riskLevel;
  let recommendedSpecialist;
  let guidance;
  let emergencyRecommended;
  let matchedSymptoms;

  if (bestRule && maxMatchedSymptoms.length > 0) {
    possibleCondition = bestRule.possibleCondition;
    possibleConditions = [{ condition: possibleCondition, confidence: 'medium' }];
    riskLevel = bestRule.riskLevel;
    recommendedSpecialist = bestRule.recommendedSpecialist;
    guidance = [...bestRule.guidance];
    emergencyRecommended = bestRule.emergencyRecommended;
    matchedSymptoms = maxMatchedSymptoms;
  } else {
    // Safe Fallback when no offline rule matches or input is vague
    possibleCondition = 'More information is needed';
    possibleConditions = [{ condition: possibleCondition, confidence: 'low' }];
    riskLevel = severity === 'severe' ? 'medium' : 'low';
    recommendedSpecialist = 'General Physician';
    guidance = [
      'Your symptoms do not match the limited offline safety rules closely enough for a useful preliminary condition suggestion. Please consult a qualified healthcare professional or try the symptom assessment again with more specific symptoms.',
    ];
    emergencyRecommended = false;
    matchedSymptoms = [];
  }

  // 4. Override with Emergency Safety Rules if high-risk symptoms were detected
  if (isEmergencyTriggered) {
    riskLevel = 'high';
    emergencyRecommended = true;
    if (!guidance.includes(EMERGENCY_GUIDANCE_MESSAGE)) {
      guidance.unshift(EMERGENCY_GUIDANCE_MESSAGE);
    }
  }

  return {
    symptoms: normalizedInput.length > 0 ? normalizedInput : (Array.isArray(rawSymptoms) ? rawSymptoms : [String(rawSymptoms)]),
    duration,
    severity,
    possibleCondition,
    possibleConditions,
    riskLevel,
    recommendedSpecialist,
    guidance,
    matchedSymptoms,
    emergencyRecommended,
    disclaimer: MEDICAL_DISCLAIMER,
    analysisSource: isEmergencyTriggered ? 'rule-based-emergency' : 'rule-based-fallback',
    modelName: '',
  };
};

module.exports = {
  analyzeSymptoms,
  normalizeSymptoms,
  isEmergencySymptom,
  MEDICAL_DISCLAIMER,
  RULES,
  EMERGENCY_SYMPTOMS,
};

