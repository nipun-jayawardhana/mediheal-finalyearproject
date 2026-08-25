/**
 * Canonical Clinical Case Service
 * Assembles a structured, canonical clinical case from raw initial patient statements
 * and follow-up Q&A conversation history.
 * 
 * Sources of truth:
 * - positiveSymptoms: Actual symptoms experienced (e.g., ["knee pain", "knee swelling"])
 * - negativeFindings: Explicitly denied symptoms (e.g., ["no fever", "no vomiting"])
 * - context: Mechanism / cause / situation (e.g., ["fall", "injury while playing football"])
 * - duration: Symptom duration (e.g., "today", "3 days")
 * - severity: Discomfort severity ("mild", "moderate", "severe")
 * - additionalDetails: Extra clinical notes
 */

const REDUNDANT_PHRASES = [
  'now it is hurting',
  'now hurting',
  'it is hurting',
  'it hurts',
  'and now it is hurting',
  'and it is hurting',
  'hurting now',
  'feeling unwell',
  'feeling bad',
  'i feel pain',
  'having pain',
  'there is pain',
  'hurting',
];

const BARE_BODY_PARTS = new Set([
  'knee', 'knees', 'ankle', 'ankles', 'hip', 'hips', 'right hip', 'left hip',
  'leg', 'legs', 'foot', 'feet', 'both feet', 'arm', 'arms', 'hand', 'hands',
  'back', 'lower back', 'upper back', 'shoulder', 'shoulders', 'elbow', 'elbows',
  'wrist', 'wrists', 'neck', 'chest', 'stomach', 'abdomen', 'thigh', 'thighs',
  'toe', 'toes', 'finger', 'fingers', 'head', 'body'
]);

/**
 * Checks if string is a bare body part lacking symptom description
 */
const isBareBodyPart = (str) => {
  if (!str || typeof str !== 'string') return false;
  const clean = str.toLowerCase().trim().replace(/^(?:a|an|the|my|both|left|right)\s+/i, '').trim();
  return BARE_BODY_PARTS.has(clean) || BARE_BODY_PARTS.has(str.toLowerCase().trim());
};

/**
 * Normalizes symptom key for deduplication while preserving specific terms
 */
const cleanConceptKey = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().trim()
    .replace(/^[•\-\*\s]+/, '')
    .replace(/^(?:a|an|the|my|and)\s+/i, '')
    .trim();
};

/**
 * Helper to parse duration from natural language text
 */
/**
 * Helper to parse duration from natural language text (English + Sinhala)
 */
const extractDurationFromText = (text) => {
  if (!text || typeof text !== 'string') return '';
  const lower = text.toLowerCase().trim();

  // 1. Sinhala duration patterns
  if (lower.includes('පසුගිය දින තුන') || lower.includes('දින තුන') || lower.includes('දින 3')) {
    return '3 days';
  }
  const siDaysMatch = lower.match(/(?:පසුගිය\s+)?දින\s*(\d+|තුන|දෙක|එක|හතර|පහ|හය|හත)\s*(?:ක්|තුළ)?/i);
  if (siDaysMatch) {
    const siWordToNum = { එක: '1', දෙක: '2', තුන: '3', හතර: '4', පහ: '5', හය: '6', හත: '7' };
    const num = siWordToNum[siDaysMatch[1]] || siDaysMatch[1];
    return `${num} ${Number(num) === 1 ? 'day' : 'days'}`;
  }

  // 2. English duration patterns
  const hoursMatch = lower.match(/(?:past|last|during\s+the\s+last|for|about)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*hours?/i);
  if (hoursMatch) {
    const wordToNum = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12' };
    const num = wordToNum[hoursMatch[1].toLowerCase()] || hoursMatch[1];
    return `${num} ${Number(num) === 1 ? 'hour' : 'hours'}`;
  }

  const daysMatch = lower.match(/(?:past|last|during\s+the\s+last|for|about)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*days?/i);
  if (daysMatch) {
    const wordToNum = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' };
    const num = wordToNum[daysMatch[1].toLowerCase()] || daysMatch[1];
    return `${num} ${Number(num) === 1 ? 'day' : 'days'}`;
  }

  const weeksMatch = lower.match(/(?:past|last|for|about)?\s*(\d+|one|two|three|four)\s*weeks?/i);
  if (weeksMatch) {
    const wordToNum = { one: '1', two: '2', three: '3', four: '4' };
    const num = wordToNum[weeksMatch[1].toLowerCase()] || weeksMatch[1];
    return `${num} ${Number(num) === 1 ? 'week' : 'weeks'}`;
  }

  if (lower.includes('since morning') || lower.includes('this morning')) return 'since morning';
  if (lower.includes('since yesterday')) return '1 day';
  if (lower.includes('1-3 days') || lower.includes('1-3')) return '1-3 days';

  return '';
};

/**
 * Extracts causal/mechanism context from natural language text
 */
const extractContextFromText = (text) => {
  const contexts = [];
  if (!text || typeof text !== 'string') return contexts;
  const lower = text.toLowerCase();

  // Fall mechanism
  if (/\bfell\b|\bfall\b|\bfalling\b/i.test(lower)) {
    contexts.push('fall');
  }

  // Football / sports injury mechanism
  if (/playing\s+football|football|soccer/i.test(lower)) {
    contexts.push('injury while playing football');
  } else if (/playing\s+sports|sports\s+injury/i.test(lower)) {
    contexts.push('sports injury');
  }

  // Twisting injury mechanism
  if (/twisted\s+(?:my\s+|it\s+)?(?:ankle|knee|wrist)?|twisting\s+injury/i.test(lower)) {
    if (lower.includes('running')) {
      contexts.push('twisting injury while running');
    } else {
      contexts.push('twisting injury');
    }
  } else if (/while\s+running|\brunning\b/i.test(lower) && !contexts.some(c => c.includes('running'))) {
    contexts.push('while running');
  }

  // Post-meal context
  if (/after\s+(?:a\s+)?meal|after\s+eating/i.test(lower)) {
    contexts.push('symptoms started after meal');
  }

  // Traffic / Accident
  if (/car\s+accident|traffic\s+accident/i.test(lower)) {
    contexts.push('car accident');
  }

  // Symptom Progression / Trend
  if (/progressively\s+worsening|gradually\s+worsened|worsening|getting\s+worse/i.test(lower)) {
    if (lower.includes('abdomen') || lower.includes('abdominal') || lower.includes('stomach')) {
      contexts.push('abdominal pain progressively worsening');
    } else {
      contexts.push('pain progressively worsening');
    }
  }

  // Aggravating Factors
  if (/worse\s+(?:when\s+|with\s+)?walking|\bwalking\b/i.test(lower) && (lower.includes('worse') || lower.includes('especially'))) {
    contexts.push('pain worse when walking');
  }
  if (/worse\s+(?:when\s+|with\s+)?coughing|\bcoughing\b/i.test(lower) && (lower.includes('worse') || lower.includes('especially'))) {
    contexts.push('pain worse when coughing');
  }
  if (/worse\s+(?:when\s+|with\s+)?(?:pressing|pressure)|press(?:ing)?\s+the\s+area/i.test(lower)) {
    if (lower.includes('lower') || lower.includes('right') || lower.includes('abdomen')) {
      contexts.push('pain worse when pressing lower right abdomen');
    } else {
      contexts.push('pain worse with pressure');
    }
  }

  return contexts;
};

/**
 * Extracts specific positive symptoms from initial patient statement,
 * filtering out mechanisms (placed in context) and redundant phrases.
 */
const extractInitialSymptomsAndContext = (initialInput) => {
  const positiveSymptoms = [];
  const context = [];
  let duration = '';

  const rawInputs = Array.isArray(initialInput) ? initialInput : [String(initialInput || '')];

  for (const raw of rawInputs) {
    if (!raw || typeof raw !== 'string') continue;

    if (!duration) {
      duration = extractDurationFromText(raw);
    }

    // Extract context
    const extractedCtx = extractContextFromText(raw);
    extractedCtx.forEach((ctx) => {
      if (!context.includes(ctx)) context.push(ctx);
    });

    let clean = raw.trim();

    // Remove mechanism phrases to isolate symptom tokens
    clean = clean.replace(/\bafter\s+i\s+fell\s+down\s+while\s+playing\s+football\b/gi, '');
    clean = clean.replace(/\bafter\s+i\s+twisted\s+it\s+while\s+running\b/gi, '');
    clean = clean.replace(/\bafter\s+i\s+fell\s+down\b/gi, '');
    clean = clean.replace(/\bafter\s+i\s+fell\b/gi, '');
    clean = clean.replace(/\bwhile\s+playing\s+football\b/gi, '');
    clean = clean.replace(/\bwhile\s+running\b/gi, '');

    // Remove redundant phrases
    REDUNDANT_PHRASES.forEach((phrase) => {
      const reg = new RegExp(`\\b${phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
      clean = clean.replace(reg, '');
    });

    // Split input into clauses/concepts if it's a longer statement or list
    const candidates = clean
      .split(/[,;\.]|\s+(?:and|with|as well as)\s+/i)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    for (const item of candidates) {
      const lower = item.toLowerCase().trim();
      if (!lower || REDUNDANT_PHRASES.includes(lower)) continue;
      if (lower.includes('fell') || lower.includes('football') || lower.includes('running')) continue;
      if (isBareBodyPart(lower)) continue;

      let matchedSymptom = '';

      // 1. Abdominal Location & Quality Matchers
      const hasSharp = lower.includes('sharp');
      const hasLowerRight = (lower.includes('lower') && lower.includes('right')) || lower.includes('right lower');
      const hasLeftLower = (lower.includes('lower') && lower.includes('left')) || lower.includes('left lower');
      const hasRightUpper = (lower.includes('upper') && lower.includes('right')) || lower.includes('right upper');
      const hasAbdominal = lower.includes('abdom') || lower.includes('stomach') || lower.includes('belly');

      if (hasAbdominal) {
        if (hasLowerRight) matchedSymptom = hasSharp ? 'sharp lower right abdominal pain' : 'lower right abdominal pain';
        else if (hasLeftLower) matchedSymptom = hasSharp ? 'sharp left lower abdominal pain' : 'left lower abdominal pain';
        else if (hasRightUpper) matchedSymptom = hasSharp ? 'sharp right upper abdominal pain' : 'right upper abdominal pain';
        else matchedSymptom = hasSharp ? 'sharp abdominal pain' : 'stomach pain';
      }

      // 2. Throat & HEENT Symptoms
      if (!matchedSymptom && (/\bsore\s+throat\b|\bpainful\s+throat\b|\bthroat\s+pain\b|\bthroat\s+hurts\b/i.test(lower))) {
        matchedSymptom = lower.includes('painful') ? 'painful sore throat' : 'sore throat';
      }
      if (!matchedSymptom && (/\bswollen\s+(?:neck\s+)?glands\b|\bswollen\s+lymph\s+nodes\b/i.test(lower))) {
        matchedSymptom = 'swollen neck glands';
      }
      if (!matchedSymptom && (/\bwhite\s+(?:patches|spots)\b/i.test(lower))) {
        matchedSymptom = lower.includes('back of throat') ? 'white patches at back of throat' : 'white patches in throat';
      }
      if (!matchedSymptom && (/\bdifficulty\s+swallowing\b|\bpain\s+swallowing\b|\btrouble\s+swallowing\b/i.test(lower))) {
        matchedSymptom = 'difficulty swallowing';
      }

      // 3. Joint & Body Symptoms
      if (!matchedSymptom && (/\bknee\s+pain\b|\bpain\s+in\s+(?:my\s+)?knee\b|\bknee\s+hurts\b/i.test(lower))) {
        matchedSymptom = 'knee pain';
      }
      if (!matchedSymptom && (/\bankle\s+pain\b|\bpain\s+in\s+(?:my\s+)?ankle\b|\bankle\s+hurts\b/i.test(lower))) {
        matchedSymptom = 'ankle pain';
      }
      if (!matchedSymptom && (/\bheadache\b|\bhead\s+hurts\b|\bhead\s+ache\b/i.test(lower))) {
        matchedSymptom = 'headache';
      }
      if (!matchedSymptom && (/\bchest\s+pain\b|\bpain\s+in\s+(?:my\s+)?chest\b/i.test(lower))) {
        matchedSymptom = 'chest pain';
      }

      // 4. Systemic / GI / Fever / Fatigue Qualifiers
      if (!matchedSymptom && (/\bfatigue\b|\btiredness\b|\bexhaustion\b/i.test(lower))) {
        matchedSymptom = 'fatigue';
      }
      if (!matchedSymptom && (/\bloss\s+of\s+appetite\b|\bdecreased\s+appetite\b|\bno\s+appetite\b/i.test(lower))) {
        matchedSymptom = 'loss of appetite';
      }
      if (!matchedSymptom && (/\bmild\s+fever\b/i.test(lower))) {
        matchedSymptom = 'mild fever';
      } else if (!matchedSymptom && (/\bfever\b|\bhigh\s+temperature\b/i.test(lower))) {
        matchedSymptom = 'fever';
      }
      if (!matchedSymptom && (/\bnausea\b|\bfeeling\s+nauseous\b/i.test(lower))) {
        matchedSymptom = 'nausea';
      }
      if (!matchedSymptom && (/\bvomiting\b|\bthrowing\s+up\b/i.test(lower))) {
        matchedSymptom = 'vomiting';
      }
      if (!matchedSymptom && (/\bdifficulty\s+breathing\b|\bshortness\s+of\s+breath\b|\bcan't\s+breathe\b/i.test(lower))) {
        matchedSymptom = 'difficulty breathing';
      }
      if (!matchedSymptom && (/\bankle\s+swelling\b|\bswollen\s+ankle\b/i.test(lower))) {
        matchedSymptom = 'ankle swelling';
      }
      if (!matchedSymptom && (/\bknee\s+swelling\b|\bswollen\s+knee\b/i.test(lower))) {
        matchedSymptom = 'knee swelling';
      }

      // If matched a specific concept
      if (matchedSymptom) {
        if (!positiveSymptoms.includes(matchedSymptom)) {
          positiveSymptoms.push(matchedSymptom);
        }
      } else if (lower.length > 2) {
        // Preservative fallback: keep clean concept clause if not a bare body part or redundant
        if (!isBareBodyPart(lower) && !positiveSymptoms.includes(lower)) {
          positiveSymptoms.push(lower);
        }
      }

      if (positiveSymptoms.length >= 10) break;
    }
  }

  return { positiveSymptoms, context, duration };
};

/**
 * Question-Aware Answer Processing:
 * Processes each (Question, Answer) turn to extract symptoms, negative findings, duration, severity, or location inheritance.
 */
const processFollowUpTurns = (conversation = [], activeCase) => {
  if (!Array.isArray(conversation) || conversation.length === 0) {
    return activeCase;
  }

  const result = {
    positiveSymptoms: [...activeCase.positiveSymptoms],
    negativeFindings: [...activeCase.negativeFindings],
    context: [...activeCase.context],
    duration: activeCase.duration || '',
    severity: activeCase.severity || null,
    additionalDetails: [...(activeCase.additionalDetails || [])],
  };

  // Helper: Find primary body location from positive symptoms or context
  const getPrimaryLocation = () => {
    for (const sym of result.positiveSymptoms) {
      const lower = sym.toLowerCase();
      if (lower.includes('knee')) return 'knee';
      if (lower.includes('ankle')) return 'ankle';
      if (lower.includes('hip')) return 'hip';
      if (lower.includes('leg')) return 'leg';
      if (lower.includes('arm')) return 'arm';
      if (lower.includes('shoulder')) return 'shoulder';
      if (lower.includes('wrist')) return 'wrist';
      if (lower.includes('stomach') || lower.includes('abdominal')) return 'stomach';
      if (lower.includes('chest')) return 'chest';
      if (lower.includes('back')) return 'back';
    }
    return '';
  };

  for (const turn of conversation) {
    const q = (turn.question || '').toLowerCase().trim();
    const a = (turn.answer || '').toLowerCase().trim();

    if (!q || !a || a === 'not sure / skipped' || a === 'skipped') continue;

    // Extract potential context from follow-up Q&A
    const turnCtx = extractContextFromText(`${q} ${a}`);
    turnCtx.forEach((c) => {
      if (!result.context.includes(c)) result.context.push(c);
    });

    // 1. Duration extraction
    if (
      q.includes('how long') ||
      q.includes('when did') ||
      q.includes('duration') ||
      ['today', '1 day', '2 days', '3 days', '1 week', '2 weeks', '1-3 days', 'more than 3 days'].includes(a)
    ) {
      if (a.includes('today')) result.duration = 'today';
      else if (a.includes('yesterday') || a.includes('1 day')) result.duration = '1 day';
      else if (a.includes('three days') || a.includes('3 days')) result.duration = '3 days';
      else if (a.includes('week')) result.duration = a;
      else if (a.length < 30) result.duration = a;
      continue;
    }

    // 2. Severity extraction (only when user explicitly answers overall severity question)
    if (
      q.includes('severe') ||
      q.includes('severity') ||
      q.includes('how severe') ||
      ['mild', 'moderate', 'severe'].includes(a)
    ) {
      if (a.includes('severe')) result.severity = 'severe';
      else if (a.includes('moderate')) result.severity = 'moderate';
      else if (a.includes('mild')) result.severity = 'mild';
      continue;
    }

    // 3. Negative answers
    const isNegative =
      a === 'no' ||
      a.startsWith('no ') ||
      a === 'none' ||
      a === 'nothing' ||
      a.includes('not having') ||
      a.includes('haven\'t');

    if (isNegative) {
      if (q.includes('swelling')) {
        const loc = getPrimaryLocation();
        const neg = loc ? `no ${loc} swelling` : 'no swelling';
        if (!result.negativeFindings.includes(neg)) result.negativeFindings.push(neg);
      }
      if (q.includes('fever')) {
        if (!result.negativeFindings.includes('no fever')) result.negativeFindings.push('no fever');
      }
      if (q.includes('vomiting') || q.includes('vomit')) {
        if (!result.negativeFindings.includes('no vomiting')) result.negativeFindings.push('no vomiting');
      }
      if (q.includes('nausea')) {
        if (!result.negativeFindings.includes('no nausea')) result.negativeFindings.push('no nausea');
      }
      continue;
    }

    // 4. Affirmative answers
    const isAffirmative =
      a === 'yes' ||
      a === 'yeah' ||
      a === 'yep' ||
      a.includes('there is') ||
      a.includes('i do') ||
      a.includes('yes,');

    if (isAffirmative || a.includes('swelling') || a.includes('nausea') || a.includes('vomiting') || a.includes('difficulty')) {
      const loc = getPrimaryLocation();

      if (q.includes('swelling') || a.includes('swelling')) {
        const sym = loc ? `${loc} swelling` : 'swelling';
        if (!result.positiveSymptoms.includes(sym)) {
          const idx = result.positiveSymptoms.indexOf('swelling');
          if (idx !== -1 && loc) {
            result.positiveSymptoms[idx] = `${loc} swelling`;
          } else {
            result.positiveSymptoms.push(sym);
          }
        }
      }

      if (q.includes('bending') || a.includes('bending')) {
        const sym = loc ? `difficulty bending ${loc}` : 'difficulty bending joint';
        if (!result.positiveSymptoms.includes(sym)) result.positiveSymptoms.push(sym);
      }

      if (a.includes('nausea') && !result.positiveSymptoms.includes('nausea')) {
        result.positiveSymptoms.push('nausea');
      }
      if (a.includes('vomiting') && !result.positiveSymptoms.includes('vomiting')) {
        result.positiveSymptoms.push('vomiting');
      }
      if (a.includes('fever') && !result.positiveSymptoms.includes('fever') && !result.positiveSymptoms.includes('mild fever')) {
        result.positiveSymptoms.push('fever');
      }
    }
  }

  return result;
};

/**
 * Builds ONE Canonical Clinical Case from raw inputs and conversation history.
 */
const buildCanonicalClinicalCase = (params = {}) => {
  const {
    symptoms = [],
    conversation = [],
    duration = '',
    severity = '',
    positiveSymptoms = [],
    negativeFindings = [],
    context = [],
  } = params;

  // 1. Initial extraction from raw initial statement(s)
  const initialData = extractInitialSymptomsAndContext(symptoms);

  // Combine with explicit arrays if provided
  const combinedPositive = [...initialData.positiveSymptoms];
  if (Array.isArray(positiveSymptoms)) {
    positiveSymptoms.forEach((s) => {
      const clean = cleanConceptKey(s);
      if (clean && !REDUNDANT_PHRASES.includes(clean) && !combinedPositive.includes(clean)) {
        combinedPositive.push(clean);
      }
    });
  }

  const combinedContext = [...initialData.context];
  if (Array.isArray(context)) {
    context.forEach((c) => {
      if (c && !combinedContext.includes(c)) combinedContext.push(c);
    });
  }

  const baseCase = {
    positiveSymptoms: combinedPositive,
    negativeFindings: Array.isArray(negativeFindings) ? [...negativeFindings] : [],
    context: combinedContext,
    duration: typeof duration === 'string' && duration.trim() ? duration.trim() : (initialData.duration || ''),
    severity: typeof severity === 'string' && severity.trim() ? severity.trim().toLowerCase() : null,
    additionalDetails: [],
  };

  // 2. Question-aware turn processing across conversation history
  const finalCase = processFollowUpTurns(conversation, baseCase);

  // Ensure default values and sanity
  if (!finalCase.duration) finalCase.duration = 'unspecified';
  if (finalCase.severity && !['mild', 'moderate', 'severe'].includes(finalCase.severity)) {
    finalCase.severity = null;
  }
  if (finalCase.positiveSymptoms.length === 0) {
    finalCase.positiveSymptoms = ['unspecified symptom'];
  }

  return finalCase;
};

module.exports = {
  buildCanonicalClinicalCase,
  extractInitialSymptomsAndContext,
  processFollowUpTurns,
  extractContextFromText,
  REDUNDANT_PHRASES,
};
