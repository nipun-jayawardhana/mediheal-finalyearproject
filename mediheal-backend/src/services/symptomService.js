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
  'chest pain',
  'chest tightness',
  'tight and heavy feeling in chest',
  'chest heaviness',
  'difficulty breathing',
  'shortness of breath',
  'short of breath',
  'unconsciousness',
  'sudden weakness on one side',
  'severe bleeding',
  'seizure',
  // Sinhala emergency triggers
  'පපුවේ කැක්කුම',
  'තද පපුවේ කැක්කුම',
  'හුස්ම ගැනීමේ අමාරුව',
  'හුස්ම ගන්න අමාරුයි',
  'සිහිය නැතිවීම',
  'ලේ ගැලීම',
  // Tamil emergency triggers
  'நெஞ்சு வலி',
  'கடுமையான நெஞ்சு வலி',
  'மூச்சுத் திணறல்',
  'சுவாசிப்பதில் சிரமம்',
  'மயக்கம்',
  'ரத்தப்போக்கு',
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
  {
    id: 'RULE_9',
    symptoms: ['leg pain', 'knee pain', 'ankle pain', 'wrist pain', 'hip pain', 'shoulder pain', 'elbow pain', 'back pain', 'injury', 'fall'],
    possibleCondition: 'Possible Musculoskeletal Injury',
    riskLevel: 'low',
    recommendedSpecialist: 'Orthopedic Specialist',
    guidance: [
      'Rest the affected area and avoid strenuous weight-bearing activities.',
      'Apply cold compress / ice pack wrapped in a cloth for 15-20 minutes to reduce swelling.',
      'Consult an Orthopedic Specialist or Physical Therapist for clinical evaluation.',
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
  { match: ['joint pain', 'swollen joint', 'joint ache', 'joint swelling'], canonical: 'joint pain' },
  { match: ['knee pain', 'knee ache', 'knee hurts', 'pain in knee', 'pain in my knee'], canonical: 'knee pain' },
  { match: ['knee swelling', 'swollen knee', 'swelling in knee', 'swelling in my knee'], canonical: 'knee swelling' },
  { match: ['ankle pain', 'ankle ache', 'ankle hurts', 'pain in ankle'], canonical: 'ankle pain' },
  { match: ['ankle swelling', 'swollen ankle', 'swelling in ankle'], canonical: 'ankle swelling' },
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
      if (syn.match.some((pattern) => clean === pattern || clean === `${pattern}s`)) {
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
  const normalizedMatched = normalizedInput.some((userSym) =>
    EMERGENCY_SYMPTOMS.some(
      (emergSym) => userSym === emergSym || userSym.includes(emergSym)
    )
  );
  if (normalizedMatched) return true;

  // Additional raw text check for complex descriptions (e.g. chest heaviness/tightness radiating to shoulder/arm, shortness of breath)
  const combinedRawText = (Array.isArray(rawSymptoms) ? rawSymptoms.join(' ') : String(rawSymptoms || '')).toLowerCase();
  
  const hasChestRedFlags =
    (combinedRawText.includes('chest') || combinedRawText.includes('පපුවේ') || combinedRawText.includes('நெஞ்சு')) &&
    (combinedRawText.includes('tight') ||
      combinedRawText.includes('heavy') ||
      combinedRawText.includes('pain') ||
      combinedRawText.includes('discomfort') ||
      combinedRawText.includes('pressure') ||
      combinedRawText.includes('spread') ||
      combinedRawText.includes('shoulder') ||
      combinedRawText.includes('arm'));

  const hasRespiratoryRedFlags =
    combinedRawText.includes('short of breath') ||
    combinedRawText.includes('shortness of breath') ||
    combinedRawText.includes('difficulty breathing') ||
    combinedRawText.includes('trouble breathing') ||
    combinedRawText.includes('can\'t breathe') ||
    combinedRawText.includes('හුස්ම');

  const hasUnconsciousnessOrStroke =
    combinedRawText.includes('unconscious') ||
    combinedRawText.includes('fainted') ||
    combinedRawText.includes('seizure') ||
    combinedRawText.includes('weakness on one side') ||
    combinedRawText.includes('severe bleeding');

  return hasChestRedFlags || hasRespiratoryRedFlags || hasUnconsciousnessOrStroke;
};

/**
 * Checks for Acute / Urgent Abdominal Red-Flag Combinations
 * (e.g. localized lower-right abdominal pain + worsening + nausea/fever/loss of appetite)
 */
const isUrgentAbdominalSymptom = (positiveSymptoms = [], context = []) => {
  const allText = [...positiveSymptoms, ...context].join(' ').toLowerCase();

  const hasLocalizedAbdominalPain =
    allText.includes('lower right abdominal') ||
    allText.includes('right lower abdominal') ||
    allText.includes('lower right abdomen') ||
    allText.includes('right lower quadrant') ||
    allText.includes('sharp abdominal pain') ||
    allText.includes('lower abdominal pain') ||
    allText.includes('stomach pain') ||
    allText.includes('abdominal pain');

  if (!hasLocalizedAbdominalPain) return false;

  const hasWorsening =
    allText.includes('worsening') ||
    allText.includes('worsened') ||
    allText.includes('getting worse') ||
    allText.includes('coughing') ||
    allText.includes('walking') ||
    allText.includes('pressure');

  const hasSystemicOrGI =
    allText.includes('nausea') ||
    allText.includes('vomiting') ||
    allText.includes('fever') ||
    allText.includes('appetite');

  return (hasLocalizedAbdominalPain && (hasWorsening || hasSystemicOrGI));
};

/**
 * Analyzes symptoms based on safe rule-based matching and emergency triggers.
 * Accepts either a raw symptom array or a canonical clinical case object.
 * @param {Array<string>|Object} input - Array of symptom strings OR canonical clinical case object
 * @param {string} [defaultDuration] - Optional duration
 * @param {string} [defaultSeverity] - Severity: mild, moderate, severe
 * @returns {Object} Analysis result object
 */
const analyzeSymptoms = (input, defaultDuration = '', defaultSeverity = 'mild') => {
  let clinicalCase;

  if (input && typeof input === 'object' && !Array.isArray(input)) {
    clinicalCase = input;
  } else {
    const syms = Array.isArray(input) ? input : [String(input || '')];
    clinicalCase = {
      positiveSymptoms: syms,
      negativeFindings: [],
      context: [],
      duration: defaultDuration || 'unspecified',
      severity: defaultSeverity || 'mild',
    };
  }

  const positive = Array.isArray(clinicalCase.positiveSymptoms) ? clinicalCase.positiveSymptoms : [];
  const context = Array.isArray(clinicalCase.context) ? clinicalCase.context : [];
  const duration = clinicalCase.duration || defaultDuration || 'unspecified';
  const severity = (clinicalCase.severity && clinicalCase.severity !== 'null' && clinicalCase.severity !== 'unspecified')
    ? clinicalCase.severity
    : (defaultSeverity && defaultSeverity !== 'mild' ? defaultSeverity : null);

  const normalizedInput = normalizeSymptoms([...positive, ...context]);

  // 1. Check Emergency Safety Triggers
  const isEmergencyTriggered = isEmergencySymptom([
    ...positive,
    ...context,
    ...normalizedInput,
  ]);

  const isUrgentAbdominal = isUrgentAbdominalSymptom(positive, context);

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

  if (isUrgentAbdominal) {
    possibleCondition = 'Possible acute abdominal condition requiring urgent evaluation';
    possibleConditions = [{ condition: possibleCondition, confidence: 'high' }];
    riskLevel = 'high';
    recommendedSpecialist = 'Gastroenterologist';
    guidance = [
      'Seek prompt in-person medical assessment, especially because the pain is localized and worsening.',
      'Do not consume solid food or take strong painkillers until evaluated by a healthcare professional.',
      'Consult a Gastroenterologist or visit an urgent care clinic immediately.',
    ];
    emergencyRecommended = true;
    matchedSymptoms = positive;
  } else if (bestRule && maxMatchedSymptoms.length > 0) {
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
    symptoms: positive.length > 0 ? positive : (normalizedInput.length > 0 ? normalizedInput : ['unspecified symptom']),
    positiveSymptoms: positive,
    negativeFindings: clinicalCase.negativeFindings || [],
    context: context,
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

