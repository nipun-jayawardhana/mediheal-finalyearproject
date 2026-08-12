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
const normalizeSymptoms = (inputSymptoms) => {
  if (!Array.isArray(inputSymptoms)) return [];
  const normalized = inputSymptoms
    .map((s) => (typeof s === 'string' ? s.toLowerCase().trim() : ''))
    .filter((s) => s.length > 0);
  return Array.from(new Set(normalized));
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
  // Detect high-risk symptoms regardless of other matching results
  const isEmergencyTriggered = normalizedInput.some((userSym) =>
    EMERGENCY_SYMPTOMS.some(
      (emergSym) => userSym === emergSym || userSym.includes(emergSym)
    )
  );

  // 2. Perform Rule Matching
  // Compare normalized symptoms against rule definitions.
  // Choose rule with the highest number of matching symptoms.
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
  let riskLevel;
  let recommendedSpecialist;
  let guidance;
  let emergencyRecommended;
  let matchedSymptoms;

  if (bestRule && maxMatchedSymptoms.length > 0) {
    possibleCondition = bestRule.possibleCondition;
    riskLevel = bestRule.riskLevel;
    recommendedSpecialist = bestRule.recommendedSpecialist;
    guidance = [...bestRule.guidance];
    emergencyRecommended = bestRule.emergencyRecommended;
    matchedSymptoms = maxMatchedSymptoms;
  } else {
    // Default fallback when no meaningful rule matches
    possibleCondition = 'Unable to determine a possible condition';
    riskLevel = 'low';
    recommendedSpecialist = 'General Physician';
    guidance = [
      'Please consult a qualified healthcare professional for further assessment.',
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
    symptoms: normalizedInput,
    duration,
    severity,
    possibleCondition,
    riskLevel,
    recommendedSpecialist,
    guidance,
    matchedSymptoms,
    emergencyRecommended,
    disclaimer: MEDICAL_DISCLAIMER,
  };
};

module.exports = {
  analyzeSymptoms,
  normalizeSymptoms,
  MEDICAL_DISCLAIMER,
  RULES,
  EMERGENCY_SYMPTOMS,
};
