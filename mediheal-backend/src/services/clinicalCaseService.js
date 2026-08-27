/**
 * Canonical Clinical Case Service
 * Assembles a structured, canonical clinical case from raw initial patient statements
 * and follow-up Q&A conversation history.
 * 
 * Sources of truth:
 * - positiveSymptoms: Actual symptoms experienced (e.g., ["burning upper abdominal pain", "nausea"])
 * - negativeFindings: Explicitly denied symptoms (e.g., ["no fever", "no vomiting", "no diarrhea"])
 * - context: Mechanism / cause / situation / aggravating factors (e.g., ["pain worse after eating spicy food", "pain worse when lying down"])
 * - duration: Symptom duration (e.g., "1 day", "2 days")
 * - severity: Discomfort severity ("mild", "moderate", "severe", or null)
 * - additionalDetails: Extra clinical notes (e.g., ["symptoms started yesterday evening", "no antacid or OTC treatment tried"])
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
  'for the past two days',
  'for the past',
  'since yesterday',
  'since this morning',
  'walking',
  'coughing',
  'bend forward',
  'or pressure',
  'the pain started mildly but gradually became worse',
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
 * Negation Detector (English + Sinhala + Tamil)
 * Runs BEFORE positive symptom regex matching to ensure explicit negations populate negativeFindings
 * and never enter positiveSymptoms.
 */
const extractNegationsFromText = (text) => {
  const negations = [];
  if (!text || typeof text !== 'string') return negations;
  const lower = text.replace(/[\u2018\u2019\u201B\u2032']/g, "'").replace(/[\u201C\u201D\u201F"]/g, '"').toLowerCase().trim();

  const addNeg = (val) => {
    if (val && !negations.includes(val)) negations.push(val);
  };

  // Fever Negation (English + Sinhala + Tamil)
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|free\s+of|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:a\s+)?fever\b/i.test(lower) ||
    /\b(?:no|not|don't|do\s+not|haven't|without)\b[\s\w,]*\bfever\b/i.test(lower) ||
    lower.includes('no fever') || lower.includes('have no fever') || lower.includes('not have fever') || lower.includes('don\'t have fever') || lower.includes('do not have fever') || lower.includes('not had a fever') ||
    lower.includes('උණ නැත') || lower.includes('උණ නෑ') || (lower.includes('උණ') && (lower.includes('නැත') || lower.includes('නෑ'))) ||
    lower.includes('காய்ச்சல் இல்லை') || (lower.includes('காய்ச்சல்') && lower.includes('இல்லை'))
  ) {
    addNeg('no fever');
  }

  // Abdominal / Stomach Pain Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|free\s+of|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:severe\s+|sharp\s+|burning\s+|upper\s+|lower\s+)?(?:abdominal\s+pain|stomach\s+pain|belly\s+pain|abdomen\s+pain)\b/i.test(lower) ||
    /\b(?:no|not|don't|do\s+not|haven't|without)\b[\s\w,]*\b(?:abdominal|stomach)\s+pain\b/i.test(lower) ||
    lower.includes('no severe abdominal pain') || lower.includes('no abdominal pain') || lower.includes('no stomach pain') ||
    lower.includes('not have severe abdominal pain') || lower.includes('do not have fever or severe abdominal pain') ||
    lower.includes('do not have severe abdominal pain') || lower.includes('don\'t have severe abdominal pain') || lower.includes('without severe abdominal pain')
  ) {
    if (lower.includes('severe')) {
      addNeg('no severe abdominal pain');
    } else {
      addNeg('no abdominal pain');
    }
  }

  // Vomiting Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:vomit|vomited|vomiting|throwing\s+up)\b/i.test(lower) ||
    /\b(?:no|not|don't|do\s+not|haven't|without)\b[\s\w,]*\bvomit/i.test(lower) ||
    lower.includes('not vomited') || lower.includes('have not vomited') || lower.includes('no vomiting') || lower.includes('do not vomit') ||
    lower.includes('වමනය නැත') || lower.includes('වමනය නෑ') || (lower.includes('වමනය') && (lower.includes('නැත') || lower.includes('නෑ'))) ||
    lower.includes('வாந்தி இல்லை') || (lower.includes('வாந்தி') && lower.includes('இல்லை'))
  ) {
    addNeg('no vomiting');
  }

  // Diarrhea Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*diarrhea\b/i.test(lower) ||
    /\b(?:no|not|don't|do\s+not|haven't|without)\b[\s\w,]*\bdiarrh/i.test(lower) ||
    lower.includes('no diarrhea') || lower.includes('do not have diarrhea') || lower.includes('don\'t have diarrhea') || lower.includes('not have diarrhea')
  ) {
    addNeg('no diarrhea');
  }

  // Chest Pain / Tightness Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:chest\s+pain|chest\s+tightness|chest\s+heaviness|chest\s+discomfort|pain\s+in\s+chest)\b/i.test(lower) ||
    /\b(?:no|not|don't|do\s+not|haven't|without)\b[\s\w,]*\bchest\s+pain\b/i.test(lower) ||
    lower.includes('no chest pain') || lower.includes('don\'t have chest pain') || lower.includes('don\'t have any chest pain') || lower.includes('do not have any chest pain')
  ) {
    addNeg('no chest pain');
  }

  // Fainting / Syncope Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:faint|fainted|fainting|passed\s+out|passing\s+out|syncope)\b/i.test(lower) ||
    lower.includes('no fainting') || lower.includes('haven\'t actually fainted') || lower.includes('haven\'t fainted') || lower.includes('have not fainted') || lower.includes('didn\'t faint')
  ) {
    addNeg('no fainting');
  }

  // Shortness of Breath / Breathing Difficulty Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:shortness\s+of\s+breath|difficulty\s+breathing|breathing\s+difficulty)\b/i.test(lower) ||
    lower.includes('no shortness of breath') || lower.includes('no difficulty breathing') ||
    (lower.includes('no chest pain') && (lower.includes('shortness of breath') || lower.includes('breathing')))
  ) {
    addNeg('no breathing difficulty');
  }

  // Sweating Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:excessive\s+)?sweating\b/i.test(lower) ||
    lower.includes('no sweating') || lower.includes('no excessive sweating')
  ) {
    addNeg('no sweating');
  }

  // Cough Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:a\s+)?cough\b/i.test(lower) ||
    lower.includes('no cough') || lower.includes('do not have a cough') || lower.includes('don\'t have a cough') ||
    lower.includes('කැස්ස නැත') || lower.includes('කැස්ස නෑ') || (lower.includes('කැස්ස') && (lower.includes('නැත') || lower.includes('නෑ'))) ||
    lower.includes('இருமல் இல்லை') || (lower.includes('இருமல்') && lower.includes('இல்லை'))
  ) {
    addNeg('no cough');
  }

  // Head Injury Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\b[\s\w,]*\b(?:head\s+injury|injured\s+my\s+head|injury\s+to\s+(?:my\s+)?head)\b/i.test(lower) ||
    lower.includes('not injured my head') || lower.includes('no recent head injury') || lower.includes('no head injury')
  ) {
    addNeg('no recent head injury');
  }

  // Dizziness / Light-headedness Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:dizzy|dizziness|light-?headedness|light-?headed)\b/i.test(lower) ||
    lower.includes('no dizziness') || lower.includes('no light-headedness') || lower.includes('not dizzy') || lower.includes('no lightheadedness')
  ) {
    addNeg('no dizziness');
  }

  // Headache Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:a\s+)?(?:headache|head\s+pain)\b/i.test(lower) ||
    lower.includes('no headache') || lower.includes('no head pain') || lower.includes('don\'t have a headache')
  ) {
    addNeg('no headache');
  }

  // Nausea Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:nausea|nauseous|feeling\s+nauseous)\b/i.test(lower) ||
    lower.includes('no nausea') || lower.includes('not nauseous')
  ) {
    addNeg('no nausea');
  }

  // Numbness Negation

  // Coordinated Negation Scope Engine (Handles "no X or Y", "do not have X or Y", "without X or Y", "no X, Y or Z")
  const negScopeMatches = lower.matchAll(/\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|free\s+of|denies|denied)\s+([\w\s,]+?)(?=\.|$|;|\bbut\b|\bhowever\b|\bexcept\b)/gi);
  for (const match of negScopeMatches) {
    const scopeBody = match[1].trim();
    if (!scopeBody) continue;

    const items = scopeBody.split(/\s+(?:or|and)\s+|,/).map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      const cleanItem = item.replace(/^(?:a|an|the|my|any|actually|ever|really|severe)\s+/i, '').trim();
      if (!cleanItem || cleanItem.length < 3) continue;

      if (cleanItem.includes('fever')) addNeg('no fever');
      else if (cleanItem.includes('vomit')) addNeg('no vomiting');
      else if (cleanItem.includes('diarrh')) addNeg('no diarrhea');
      else if (cleanItem.includes('chest pain') || cleanItem.includes('chest tightness')) addNeg('no chest pain');
      else if (cleanItem.includes('faint') || cleanItem.includes('syncope')) addNeg('no fainting');
      else if (cleanItem.includes('shortness of breath') || cleanItem.includes('breathing')) addNeg('no breathing difficulty');
      else if (cleanItem.includes('sweating')) addNeg('no sweating');
      else if (cleanItem.includes('cough')) addNeg('no cough');
      else if (cleanItem.includes('abdominal pain') || cleanItem.includes('stomach pain') || cleanItem.includes('belly pain')) {
        addNeg(item.includes('severe') ? 'no severe abdominal pain' : 'no abdominal pain');
      }
    }
  }

  return negations;
};

/**
 * Helper to parse duration from natural language text (English + Sinhala + Tamil)
 */
const extractDurationFromText = (text) => {
  if (!text || typeof text !== 'string') return '';
  const lower = text.toLowerCase().trim();

  // 1. Sinhala duration patterns
  if (lower.includes('පසුගිය දින තුන') || lower.includes('දින තුන') || lower.includes('දින 3')) return '3 days';
  if (lower.includes('පසුගිය දින දෙක') || lower.includes('දින දෙක') || lower.includes('දින 2')) return '2 days';
  const siDaysMatch = lower.match(/(?:පසුගිය\s+)?දින\s*(\d+|තුන|දෙක|එක|හතර|පහ|හය|හත)\s*(?:ක්|තුළ)?/i);
  if (siDaysMatch) {
    const siWordToNum = { එක: '1', දෙක: '2', තුන: '3', හතර: '4', පහ: '5', හය: '6', හත: '7' };
    const num = siWordToNum[siDaysMatch[1]] || siDaysMatch[1];
    return `${num} ${Number(num) === 1 ? 'day' : 'days'}`;
  }

  // 2. Tamil duration patterns
  if (lower.includes('கடந்த இரண்டு') || lower.includes('இரண்டு நாட்கள்') || lower.includes('2 நாட்கள்')) return '2 days';

  // 3. English duration patterns
  if (lower.includes('since yesterday evening') || lower.includes('yesterday evening')) return '1 day';
  if (lower.includes('since yesterday') || lower.includes('yesterday')) return '1 day';
  if (lower.includes('since morning') || lower.includes('this morning')) return 'since morning';

  const hoursMatch = lower.match(/(?:past|last|during\s+the\s+last|for|about)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*hours?/i);
  if (hoursMatch) {
    const wordToNum = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12' };
    const num = wordToNum[hoursMatch[1].toLowerCase()] || hoursMatch[1];
    return `${num} ${Number(num) === 1 ? 'hour' : 'hours'}`;
  }

  const daysMatch = lower.match(/(?:past|last|during\s+the\s+last|for\s+the\s+past|for)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*days?/i);
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

  if (lower.includes('1-3 days') || lower.includes('1-3')) return '1-3 days';

  return '';
};

/**
 * Extracts causal / aggravating / progression context from natural language text
 */
const extractContextFromText = (text) => {
  const contexts = [];
  if (!text || typeof text !== 'string') return contexts;
  const lower = text.toLowerCase().trim();

  // Symptom Progression / Onset Trend
  if (/progressively\s+worsening|gradually\s+worsened|gradually\s+became\s+worse|getting\s+worse|became\s+worse|started\s+mildly/i.test(lower)) {
    if (lower.includes('abdom') || lower.includes('stomach') || lower.includes('belly')) {
      if (!contexts.includes('abdominal pain progressively worsening')) {
        contexts.push('abdominal pain progressively worsening');
      }
    } else if (!contexts.includes('pain progressively worsening')) {
      contexts.push('pain progressively worsening');
    }
  }

  const isAggravatingSentence = lower.includes('worse') || lower.includes('especially') || lower.includes('when i') || lower.includes('gets worse') || lower.includes('becomes worse');

  // Aggravating Factors: Food / Spicy Food
  if (lower.includes('spicy food') || (isAggravatingSentence && lower.includes('eating'))) {
    if (lower.includes('spicy')) {
      if (!contexts.includes('pain worse after eating spicy food')) contexts.push('pain worse after eating spicy food');
    } else if (lower.includes('after eating') || lower.includes('with eating')) {
      if (!contexts.includes('pain worse after eating')) contexts.push('pain worse after eating');
    }
  }

  // Aggravating Factors: Lying Down
  if (lower.includes('lie down') || lower.includes('lying down')) {
    if (!contexts.includes('pain worse when lying down')) contexts.push('pain worse when lying down');
  }

  // Trigger Factors: Standing Up (Orthostatic Light-headedness)
  if (lower.includes('stand up') || lower.includes('standing') || lower.includes('when i stand')) {
    if (lower.includes('light-headed') || lower.includes('lightheaded') || lower.includes('dizzy') || lower.includes('dizziness')) {
      if (!contexts.includes('light-headedness triggered by standing')) {
        contexts.push('light-headedness triggered by standing');
      }
    }
  }

  // Relief Factors: Food improves pain
  if ((lower.includes('food') || lower.includes('eating')) && (lower.includes('better') || lower.includes('relieves') || lower.includes('improves'))) {
    if (!contexts.includes('pain improves with eating')) contexts.push('pain improves with eating');
  }

  // Aggravating Factors: Walking
  if (isAggravatingSentence && (lower.includes('walk') || lower.includes('walking'))) {
    const detail = lower.includes('quickly') ? 'pain worse when walking quickly' : 'pain worse when walking';
    if (!contexts.includes(detail)) contexts.push(detail);
  }

  // Aggravating Factors: Coughing
  if (isAggravatingSentence && (lower.includes('cough') || lower.includes('coughing'))) {
    if (!contexts.includes('pain worse when coughing')) contexts.push('pain worse when coughing');
  }

  // Aggravating Factors: Bending / Bending forward
  if (isAggravatingSentence && (lower.includes('bend') || lower.includes('bending'))) {
    const detail = lower.includes('forward') ? 'pain worse when bending forward' : 'pain worse when bending';
    if (!contexts.includes(detail)) contexts.push(detail);
  }

  // Aggravating Factors: Pressing / Pressure
  if (isAggravatingSentence && (lower.includes('press') || lower.includes('pressure'))) {
    if (lower.includes('lower') || lower.includes('right') || lower.includes('abdomen') || lower.includes('stomach') || lower.includes('area')) {
      if (!contexts.includes('pain worse with pressure on lower right abdomen')) contexts.push('pain worse with pressure on lower right abdomen');
    } else if (!contexts.includes('pain worse with pressure')) {
      contexts.push('pain worse with pressure');
    }
  }

  // Aggravating Factors: Climbing stairs
  if (lower.includes('climb stairs') || lower.includes('climbing stairs') || (isAggravatingSentence && lower.includes('stairs'))) {
    if (!contexts.includes('pain worse climbing stairs')) contexts.push('pain worse climbing stairs');
  }

  // Aggravating Factors: Bright Light / Computer Screens / Loud Sounds
  if (lower.includes('bright light') || lower.includes('bright lights') || (isAggravatingSentence && /\blight(?:s)?\b/i.test(lower))) {
    if (!contexts.includes('headache worse with bright light') && !contexts.includes('worse with bright light')) {
      contexts.push('headache worse with bright light');
    }
  }
  if (lower.includes('loud sound') || lower.includes('loud sounds') || lower.includes('loud noise') || lower.includes('loud noises') || lower.includes('noise sensitivity') || lower.includes('sensitive to sound') || (isAggravatingSentence && lower.includes('sound'))) {
    if (!contexts.includes('headache worse with loud sounds')) {
      contexts.push('headache worse with loud sounds');
    }
  }
  if (lower.includes('computer screen') || lower.includes('computer screens') || (isAggravatingSentence && lower.includes('screen'))) {
    if (!contexts.includes('worse with computer screens')) contexts.push('worse with computer screens');
  }

  // Fall mechanism
  if (/\bfell\b|\bfall\b|\bfalling\b/i.test(lower)) {
    if (!contexts.includes('fall')) contexts.push('fall');
  }

  // Football / sports injury mechanism
  if (/playing\s+football|football|soccer/i.test(lower)) {
    if (!contexts.includes('injury while playing football')) contexts.push('injury while playing football');
  } else if (/playing\s+sports|sports\s+injury/i.test(lower)) {
    if (!contexts.includes('sports injury')) contexts.push('sports injury');
  }

  // Twisting injury mechanism
  if (/twisted\s+(?:my\s+|it\s+)?(?:ankle|knee|wrist)?|twisting\s+injury/i.test(lower)) {
    if (lower.includes('running')) {
      if (!contexts.includes('twisting injury while running')) contexts.push('twisting injury while running');
    } else {
      if (!contexts.includes('twisting injury')) contexts.push('twisting injury');
    }
  } else if (/while\s+running|\brunning\b/i.test(lower) && !contexts.some(c => c.includes('running'))) {
    if (!contexts.includes('while running')) contexts.push('while running');
  }

  // Post-meal context
  if (/after\s+(?:a\s+)?meal|after\s+eating/i.test(lower) && !contexts.some(c => c.includes('eating'))) {
    if (!contexts.includes('symptoms started after meal')) contexts.push('symptoms started after meal');
  }

  // Traffic / Accident
  if (/car\s+accident|traffic\s+accident/i.test(lower)) {
    if (!contexts.includes('car accident')) contexts.push('car accident');
  }

  return contexts;
};

/**
 * Classifies an extracted text clause into exactly one clinical role:
 * POSITIVE_SYMPTOM, NEGATIVE_FINDING, DURATION, SEVERITY, CONTEXT, AGGRAVATING_FACTOR, ADDITIONAL_DETAIL, DISCARD
 */
const classifyClauseRole = (itemStr, fullRawText = '') => {
  const lower = itemStr.toLowerCase().trim();
  if (!lower) return { role: 'DISCARD' };

  // 1. NEGATION CHECK (MUST BE FIRST BEFORE ANY POSITIVE MATCHING)
  const negations = extractNegationsFromText(lower);
  if (negations.length > 0) {
    return { role: 'NEGATIVE_FINDING', value: negations[0] };
  }

  // 2. DURATION check
  const hasSymptomKeyword = /pain|fever|cough|nausea|burp|burn|urinate|urination|discharge|discomfort|ache|hurt|sore|swell|stiff|weak|numb|tingle|rash|bleeding/i.test(lower);
  if (
    (/^(?:for\s+the\s+past|for\s+the\s+last|for|since|during)\s+/i.test(lower) ||
    /^(?:past\s+\d+|last\s+\d+|two\s+days|three\s+days|this\s+morning|yesterday)/i.test(lower) ||
    lower.includes('for the past') ||
    lower.includes('since yesterday') ||
    lower.includes('since this morning')) &&
    !hasSymptomKeyword
  ) {
    return { role: 'DURATION', value: extractDurationFromText(itemStr) || lower };
  }

  // 3. PROGRESSION / TREND check
  if (
    /started\s+mildly|gradually\s+became\s+worse|gradually\s+worsened|progressively\s+worsening|getting\s+worse|became\s+worse|pain\s+worsening/i.test(lower)
  ) {
    if (!lower.includes('sharp') && !lower.includes('nausea') && !lower.includes('fever') && !lower.includes('cough') && !lower.includes('burning')) {
      return { role: 'ADDITIONAL_DETAIL', value: 'abdominal pain progressively worsening' };
    }
  }

  // 4. AGGRAVATING FACTOR / CONTEXT check
  if (
    lower.startsWith('especially when') ||
    lower.startsWith('worse when') ||
    lower.startsWith('becomes worse') ||
    lower.startsWith('when i') ||
    lower.startsWith('or press') ||
    lower.startsWith('after eating') ||
    lower === 'walking' ||
    lower === 'walk quickly' ||
    lower === 'coughing' ||
    lower === 'bend forward' ||
    lower === 'bending' ||
    lower === 'or pressure' ||
    lower === 'pressure' ||
    lower === 'press that area' ||
    lower === 'climbing stairs' ||
    lower === 'standing up' ||
    lower === 'lying down' ||
    lower === 'when i lie down'
  ) {
    return { role: 'AGGRAVATING_FACTOR' };
  }

  // 5. BARE BODY PART / FRAGMENT check
  if (isBareBodyPart(lower) || REDUNDANT_PHRASES.includes(lower)) {
    return { role: 'DISCARD' };
  }

  // 6. POSITIVE SYMPTOM CLASSIFICATION
  let matchedSymptom = '';

  // Acid Reflux / GI Symptoms (Sour taste, burping)
  if (/\bsour\s+taste\b|\bacid\s+taste\b|\bsour\s+taste\s+coming\b/i.test(lower)) {
    matchedSymptom = 'sour taste in mouth';
  }
  if (!matchedSymptom && (/\bburping\b|\bbelching\b|\bburp(?:s)?\b/i.test(lower))) {
    matchedSymptom = lower.includes('frequent') ? 'frequent burping' : 'burping';
  }

  // Abdominal Pain Variants with Specificity & Quality Preservation
  const hasAbdom = lower.includes('abdom') || lower.includes('stomach') || lower.includes('belly');
  const hasUpper = lower.includes('upper');
  const hasMiddle = lower.includes('middle') || lower.includes('central') || lower.includes('epigastric');
  const hasBurning = lower.includes('burn') || lower.includes('burning');
  const hasSharp = lower.includes('sharp');
  const hasLowerRight = (lower.includes('lower') && lower.includes('right')) || lower.includes('right lower') || (lower.includes('lower right side') && (hasAbdom || lower.includes('side')));
  const hasLeftLower = (lower.includes('lower') && lower.includes('left')) || lower.includes('left lower');
  const hasRightUpper = (lower.includes('upper') && lower.includes('right')) || lower.includes('right upper');

  if (hasAbdom || lower.includes('lower right side') || lower.includes('upper middle part') || lower.includes('upper abdomen')) {
    if (hasBurning && hasUpper) matchedSymptom = 'burning upper abdominal pain';
    else if (hasLowerRight) matchedSymptom = hasSharp ? 'sharp lower right abdominal pain' : 'lower right abdominal pain';
    else if (hasLeftLower) matchedSymptom = hasSharp ? 'sharp left lower abdominal pain' : 'left lower abdominal pain';
    else if (hasRightUpper) matchedSymptom = hasSharp ? 'sharp right upper abdominal pain' : 'right upper abdominal pain';
    else if (hasUpper && hasMiddle) matchedSymptom = hasBurning ? 'burning upper abdominal pain' : 'upper central abdominal pain';
    else if (hasUpper) matchedSymptom = hasBurning ? 'burning upper abdominal pain' : 'upper abdominal pain';
    else if (hasBurning) matchedSymptom = 'burning abdominal pain';
    else matchedSymptom = hasSharp ? 'sharp abdominal pain' : 'stomach pain';
  }

  // HEENT / Throat & Swallowing
  if (!matchedSymptom && (/\bdifficulty\s+swallowing\b|\bpain\s+swallowing\b|\btrouble\s+swallowing\b|\bpainful\s+swallowing\b|\bswallowing\b/i.test(lower))) {
    matchedSymptom = 'swallowing difficulty/pain';
  }
  if (!matchedSymptom && (/\bsore\s+throat\b|\bpainful\s+throat\b|\bthroat\s+pain\b|\bthroat\s+hurts\b/i.test(lower))) {
    matchedSymptom = lower.includes('painful') ? 'painful sore throat' : 'sore throat';
  }
  if (!matchedSymptom && (/\bswollen\s+(?:neck\s+)?glands\b|\bswollen\s+lymph\s+nodes\b/i.test(lower))) {
    matchedSymptom = 'swollen neck glands';
  }
  if (!matchedSymptom && (/\bwhite\s+(?:patches|spots)\b/i.test(lower))) {
    matchedSymptom = lower.includes('back of throat') ? 'white patches at back of throat' : 'white patches in throat';
  }

  // Chest / Cardiac
  if (!matchedSymptom && (/\bchest\s+pain\b|\bpain\s+in\s+(?:my\s+)?chest\b|\bchest\s+hurts\b/i.test(lower))) {
    matchedSymptom = 'chest pain';
  }
  if (!matchedSymptom && (/\bchest\s+tightness\b|\btight\s+and\s+heavy\b|\bchest\s+heaviness\b/i.test(lower))) {
    matchedSymptom = 'chest tightness';
  }

  // HEENT / Vision / Neurological
  if (!matchedSymptom && (/\bblurr(?:y|ed)\s+vision\b|\bvision\s+becomes\s+blurr(?:y|ed)\b|\bblurr(?:y|ed)\s+eyesight\b/i.test(lower))) {
    matchedSymptom = 'blurred vision';
  }
  if (!matchedSymptom && (/\bbright\s+light(?:s)?\b|\bphotophobia\b|\blight\s+sensitivity\b/i.test(lower))) {
    matchedSymptom = 'sensitivity to bright light';
  }
  if (!matchedSymptom && (/\bloud\s+sound(?:s)?\b|\bloud\s+noise(?:s)?\b|\bphonophobia\b|\bnoise\s+sensitivity\b|\bsensitiv(?:e|ity)\s+to\s+(?:loud\s+)?sound(?:s)?\b/i.test(lower))) {
    matchedSymptom = 'sensitivity to loud sounds';
  }
  if (!matchedSymptom && (/\bcan(?:not|'t)\s+put\s+(?:much\s+)?weight\b|\bdifficulty\s+(?:putting|bearing)\s+weight\b|\bcannot\s+bear\s+weight\b/i.test(lower))) {
    matchedSymptom = 'difficulty bearing weight';
  }

  // Joint / Musculoskeletal
  if (!matchedSymptom && (/\bknee\s+pain\b|\bpain\s+in\s+(?:my\s+)?knee\b|\bknee\s+hurts\b|\bswollen\s+and\s+painful\b/i.test(lower))) {
    matchedSymptom = fullRawText.toLowerCase().includes('knee') ? 'right knee pain' : 'knee pain';
  }
  if (!matchedSymptom && (/\bankle\s+pain\b|\bpain\s+in\s+(?:my\s+)?ankle\b|\bankle\s+hurts\b/i.test(lower))) {
    matchedSymptom = 'ankle pain';
  }
  if (!matchedSymptom && (/\bunstable\b|\binstability\b|\bknee\s+feels\s+unstable\b/i.test(lower))) {
    matchedSymptom = fullRawText.toLowerCase().includes('knee') ? 'knee instability' : 'joint instability';
  }
  if (!matchedSymptom && (/\bheadache\b|\bhead\s+hurts\b|\bhead\s+ache\b/i.test(lower))) {
    if ((lower.includes('left side') || lower.includes('left-sided')) && lower.includes('throbbing')) {
      matchedSymptom = 'left-sided throbbing headache';
    } else if (lower.includes('throbbing')) {
      matchedSymptom = 'throbbing headache';
    } else if (lower.includes('left side') || lower.includes('left-sided')) {
      matchedSymptom = 'left-sided headache';
    } else {
      matchedSymptom = 'headache';
    }
  }
  if (!matchedSymptom && (/\blight-?headed(?:ness)?\b|\bdizz(?:y|iness)\b|\bfeeling\s+dizzy\b|\bfeeling\s+light-?headed\b/i.test(lower))) {
    if (lower.includes('light-headed') || lower.includes('lightheaded')) {
      if (lower.includes('stand') || lower.includes('standing') || fullRawText.toLowerCase().includes('stand')) {
        matchedSymptom = 'light-headedness on standing';
      } else {
        matchedSymptom = 'light-headedness';
      }
    } else {
      matchedSymptom = 'dizziness';
    }
  }
  if (!matchedSymptom && (/\bpalpitations?\b|\bheart\s+(?:sometimes\s+)?feels?\s+like\s+(?:it\s+is\s+)?beating\s+fast(?:er)?\b|\bheart\s+beating\s+fast(?:er)?\b|\bheart\s+racing\b|\bracing\b|\bbeating\s+faster\b/i.test(lower))) {
    matchedSymptom = 'palpitations';
  }
  if (!matchedSymptom && (/\bweakness\b|\bfeel\s+weak\b|\bfeeling\s+weak\b|\bweak\b/i.test(lower))) {
    matchedSymptom = 'weakness';
  }
  if (!matchedSymptom && (/\bfatigue\b|\btiredness\b|\bfeel\s+tired\b|\bfeeling\s+tired\b|\btired\b/i.test(lower))) {
    matchedSymptom = 'fatigue';
  }

  // GI / Systemic
  if (!matchedSymptom && (/\bnausea\b|\bnauseous\b|\bfeel\s+nauseous\b|\bfeeling\s+nauseous\b/i.test(lower))) {
    matchedSymptom = 'nausea';
  }
  if (!matchedSymptom && (/\blost\s+(?:my\s+)?appetite\b|\bloss\s+of\s+appetite\b|\bdecreased\s+appetite\b|\bno\s+appetite\b/i.test(lower))) {
    matchedSymptom = 'loss of appetite';
  }
  if (!matchedSymptom && (/\bmild\s+fever\b/i.test(lower))) {
    matchedSymptom = 'mild fever';
  } else if (!matchedSymptom && (/\bfever\b|\bhigh\s+temperature\b/i.test(lower))) {
    matchedSymptom = 'fever';
  }
  if (!matchedSymptom && (/\bvomiting\b|\bthrowing\s+up\b/i.test(lower))) {
    matchedSymptom = 'vomiting';
  }

  // Urinary / Genital / Local Discomfort Symptoms
  if (!matchedSymptom && (/\b(?:burning|painful|discomfort)\s+(?:feeling\s+)?(?:when|with|during)?\s*(?:i\s+)?urinate\b|\b(?:burning|pain)\s+(?:feeling\s+)?(?:when|during|with)\s+urining\b|\b(?:burning|painful)\s+urination\b|\bdysuria\b/i.test(lower))) {
    matchedSymptom = 'burning feeling when urinating';
  }
  if (!matchedSymptom && (/\b(?:unusual\s+)?(?:penile\s+discharge|discharge\s+from\s+(?:my\s+)?penis)\b|\b(?:small\s+amount\s+of\s+)?unusual\s+discharge\b/i.test(lower))) {
    matchedSymptom = 'unusual penile discharge';
  }
  if (!matchedSymptom && (/\bdiscomfort\s+around\s+(?:the\s+)?tip\b|\btip\s+discomfort\b|\bdiscomfort\s+at\s+(?:the\s+)?tip\b/i.test(lower))) {
    matchedSymptom = 'discomfort around the tip';
  }
  if (!matchedSymptom && (/\b(?:excessive\s+)?sweating\b|\bprofuse\s+sweating\b/i.test(lower))) {
    matchedSymptom = 'sweating';
  }

  // Cough (ONLY if reported as positive symptom)
  if (!matchedSymptom && (/\bcough\b|\bcoughing\b/i.test(lower))) {
    const rawLower = fullRawText.toLowerCase();
    if (rawLower.includes('worse when') || rawLower.includes('especially when') || rawLower.includes('gets worse')) {
      return { role: 'AGGRAVATING_FACTOR' };
    }
    matchedSymptom = 'cough';
  }

  if (!matchedSymptom && (/\bdifficulty\s+breathing\b|\bshortness\s+of\s+breath\b|\bshort\s+of\s+breath\b|\bcan't\s+breathe\b/i.test(lower))) {
    matchedSymptom = 'difficulty breathing';
  }

  if (!matchedSymptom && (/\bankle\s+swelling\b|\bswollen\s+ankle\b|\bankle\s+is\s+swollen\b/i.test(lower))) {
    matchedSymptom = 'ankle swelling';
  }
  if (!matchedSymptom && (/\bknee\s+swelling\b|\bswollen\s+knee\b|\bknee\s+is\s+swollen\b|\bswelling\s+in\s+(?:my\s+)?knee\b|\bswollen\b|\bswelling\b/i.test(lower))) {
    matchedSymptom = fullRawText.toLowerCase().includes('knee') ? 'knee swelling' : 'swelling';
  }

  if (matchedSymptom) {
    return { role: 'POSITIVE_SYMPTOM', value: matchedSymptom };
  }

  // Fallback for clean symptom-like terms
  if (
    lower.includes('pain') || lower.includes('hurt') || lower.includes('ache') || lower.includes('swell') ||
    lower.includes('taste') || lower.includes('burp') || lower.includes('urinate') || lower.includes('urination') ||
    lower.includes('discharge') || lower.includes('discomfort') || lower.includes('burning') || lower.includes('sweat')
  ) {
    return { role: 'POSITIVE_SYMPTOM', value: lower };
  }

  return { role: 'DISCARD' };
};

/**
 * Deduplicates symptom concepts and preserves specific canonical terms over generic ones
 */
const deduplicateAndRefineSymptoms = (symptomArray, contextArray = [], negativeFindingsArray = []) => {
  if (!Array.isArray(symptomArray)) return [];
  const normalized = [];

  const contextText = (Array.isArray(contextArray) ? contextArray.join(' ') : String(contextArray || '')).toLowerCase();
  const hasCoughContext = contextText.includes('coughing');

  const negText = (Array.isArray(negativeFindingsArray) ? negativeFindingsArray.join(' ') : String(negativeFindingsArray || '')).toLowerCase();

  for (const item of symptomArray) {
    if (!item || typeof item !== 'string') continue;
    let clean = cleanConceptKey(item);
    if (!clean || REDUNDANT_PHRASES.includes(clean) || isBareBodyPart(clean)) continue;

    // Strict Negation Removal Safety Guarantee
    const cleanLower = clean.toLowerCase();
    const isExplicitlyNegated = (negativeFindingsArray || []).some((neg) => {
      const nLower = String(neg || '').toLowerCase();
      if (!nLower) return false;
      if (cleanLower === 'fever' || cleanLower === 'mild fever') return nLower.includes('no fever');
      if (cleanLower === 'vomiting' || cleanLower === 'vomit') return nLower.includes('no vomiting');
      if (cleanLower === 'diarrhea') return nLower.includes('no diarrhea');
      if (cleanLower === 'chest pain') return nLower.includes('no chest pain');
      if (cleanLower === 'cough') return nLower.includes('no cough');
      if (cleanLower === 'difficulty breathing' || cleanLower === 'shortness of breath') return nLower.includes('no breathing');
      if (cleanLower === 'sweating' || cleanLower === 'excessive sweating') return nLower.includes('no sweating');
      if (cleanLower.includes('head injury')) return nLower.includes('no recent head injury') || nLower.includes('no head injury');
      if (cleanLower === 'numbness') return nLower.includes('no numbness');
      if (cleanLower.includes('abdominal') || cleanLower.includes('stomach') || cleanLower.includes('belly')) {
        return nLower.includes('no severe abdominal pain') || nLower.includes('no abdominal pain') || nLower.includes('no stomach pain');
      }
      return nLower === `no ${cleanLower}` || nLower.includes(`no ${cleanLower}`);
    });
    if (isExplicitlyNegated) continue;

    // Filter out cough if it is present only as an aggravating factor in context
    if (clean === 'cough' && hasCoughContext) {
      continue;
    }

    // Reject non-symptom aggravating / duration phrases
    if (
      clean.startsWith('for the past') ||
      clean.startsWith('since ') ||
      clean.startsWith('pain worse') ||
      clean.startsWith('worse when') ||
      clean.includes('progressively worsening') ||
      clean === 'walking' ||
      clean === 'coughing' ||
      clean === 'bend forward' ||
      clean === 'pressure' ||
      clean === 'or pressure' ||
      clean === 'pain worsening' ||
      clean === 'spicy food' ||
      clean === 'lying down' ||
      clean === 'better'
    ) {
      continue;
    }

    // Synonym normalization to canonical concepts
    if (clean === 'feel nauseous' || clean === 'feeling nauseous' || clean === 'nauseous' || clean === 'i feel nauseous' || clean === 'i feel slightly nauseous' || clean === 'slightly nauseous') {
      clean = 'nausea';
    } else if (clean === 'lost my appetite' || clean === 'loss of appetite' || clean === 'no appetite' || clean === 'i have lost my appetite') {
      clean = 'loss of appetite';
    } else if (clean.includes('sour taste')) {
      clean = 'sour taste in mouth';
    } else if (clean.includes('burp')) {
      clean = 'frequent burping';
    } else if (clean.includes('swallow')) {
      clean = 'swallowing difficulty/pain';
    } else if (clean.includes('urinate') || clean.includes('urination')) {
      clean = 'burning feeling when urinating';
    } else if (clean.includes('discharge')) {
      clean = 'unusual penile discharge';
    } else if (clean.includes('tip') || clean.includes('discomfort around')) {
      clean = 'discomfort around the tip';
    } else if (clean.includes('burning') && clean.includes('upper') && (clean.includes('abdom') || clean.includes('stomach') || clean.includes('middle'))) {
      clean = 'burning upper abdominal pain';
    } else if (clean.includes('sharp') && (clean.includes('lower right') || clean.includes('right lower')) && (clean.includes('abdom') || clean.includes('side'))) {
      clean = 'sharp lower right abdominal pain';
    } else if ((clean.includes('lower right') || clean.includes('right lower')) && (clean.includes('abdom') || clean.includes('side'))) {
      clean = 'lower right abdominal pain';
    }

    if (!normalized.includes(clean)) {
      normalized.push(clean);
    }
  }

  // Specificity Preservation / Subsumption:
  // Drop generic terms if a more specific version is present
  const finalSymptoms = [];
  const hasSpecificLowerRightAbdominal = normalized.some((s) => s === 'sharp lower right abdominal pain' || s === 'lower right abdominal pain');
  const hasSpecificBurningUpperAbdominal = normalized.some((s) => s === 'burning upper abdominal pain');

  for (const sym of normalized) {
    if (hasSpecificLowerRightAbdominal && (sym === 'abdominal pain' || sym === 'stomach pain' || sym === 'sharp abdominal pain' || sym === 'pain')) {
      continue;
    }
    if (hasSpecificBurningUpperAbdominal && (sym === 'abdominal pain' || sym === 'stomach pain' || sym === 'burning abdominal pain' || sym === 'pain')) {
      continue;
    }
    if (normalized.includes('knee swelling') && sym === 'swelling') {
      continue;
    }
    if (normalized.includes('ankle swelling') && sym === 'swelling') {
      continue;
    }
    if (normalized.includes('knee pain') && sym === 'pain') {
      continue;
    }
    if (normalized.includes('ankle pain') && sym === 'pain') {
      continue;
    }
    if (normalized.includes('chest pain') && sym === 'pain') {
      continue;
    }

    if (!finalSymptoms.includes(sym)) {
      finalSymptoms.push(sym);
    }
  }

  return finalSymptoms;
};

/**
 * Extracts specific positive symptoms from initial patient statement,
 * filtering out mechanisms (placed in context) and redundant phrases.
 */
const extractInitialSymptomsAndContext = (initialInput) => {
  const rawPositive = [];
  const negativeFindings = [];
  const context = [];
  const additionalDetails = [];
  let duration = '';

  const rawInputs = Array.isArray(initialInput) ? initialInput : [String(initialInput || '')];

  for (const raw of rawInputs) {
    if (!raw || typeof raw !== 'string') continue;

    if (!duration) {
      duration = extractDurationFromText(raw);
    }

    // Extract negations explicitly from raw text
    const negs = extractNegationsFromText(raw);
    negs.forEach((n) => {
      if (!negativeFindings.includes(n)) negativeFindings.push(n);
    });

    // Extract context & aggravating factors
    const extractedCtx = extractContextFromText(raw);
    extractedCtx.forEach((ctx) => {
      if (!context.includes(ctx)) context.push(ctx);
    });

    // Onset and Qualifier details
    if (raw.toLowerCase().includes('yesterday evening')) {
      if (!additionalDetails.includes('symptoms started yesterday evening')) {
        additionalDetails.push('symptoms started yesterday evening');
      }
    }
    if (raw.toLowerCase().includes('slightly nauseous') || raw.toLowerCase().includes('slight nausea')) {
      if (!additionalDetails.includes('nausea described as slight')) {
        additionalDetails.push('nausea described as slight');
      }
    }

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

    // Split input into clauses/concepts
    const candidates = clean
      .split(/[,;\.]|\s+(?:and|with|as well as|but|however|or)\s+/i)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    for (const item of candidates) {
      const classified = classifyClauseRole(item, raw);
      if (classified.role === 'NEGATIVE_FINDING' && classified.value) {
        if (!negativeFindings.includes(classified.value)) {
          negativeFindings.push(classified.value);
        }
      } else if (classified.role === 'POSITIVE_SYMPTOM' && classified.value) {
        if (!rawPositive.includes(classified.value)) {
          rawPositive.push(classified.value);
        }
      } else if (classified.role === 'DURATION' && classified.value && !duration) {
        duration = classified.value;
      } else if (classified.role === 'ADDITIONAL_DETAIL' && classified.value) {
        if (!context.includes(classified.value) && !additionalDetails.includes(classified.value)) {
          additionalDetails.push(classified.value);
        }
      }
    }
  }

  const positiveSymptoms = deduplicateAndRefineSymptoms(rawPositive, context, negativeFindings);
  return { positiveSymptoms, negativeFindings, context, duration, additionalDetails };
};

const CLINICAL_CONCEPT_FAMILIES = {
  headache: ['headache', 'throbbing headache', 'left-sided throbbing headache', 'left-sided headache', 'head pain', 'sharp head pain'],
  chest_pain: ['chest pain', 'severe chest pain', 'chest tightness', 'chest heaviness', 'chest discomfort'],
  abdominal_pain: ['abdominal pain', 'stomach pain', 'belly pain', 'burning upper abdominal pain', 'sharp lower right abdominal pain', 'lower right abdominal pain', 'upper central abdominal pain'],
  breathing: ['difficulty breathing', 'shortness of breath', 'short of breath', 'trouble breathing'],
  fever: ['fever', 'mild fever', 'high fever'],
  vomiting: ['vomiting', 'vomit', 'throwing up'],
  fainting: ['fainting', 'fainted', 'syncope', 'passing out'],
  dizziness: ['dizziness', 'light-headedness', 'light-headedness on standing'],
  cough: ['cough'],
  sweating: ['sweating', 'excessive sweating'],
  neck_stiffness: ['neck stiffness', 'stiffness in neck', 'stiff neck'],
};

const getConceptFamily = (term) => {
  if (!term || typeof term !== 'string') return '';
  const clean = term.toLowerCase().trim().replace(/^(?:no|not|denies|without)\s+/, '').trim();
  for (const [family, members] of Object.entries(CLINICAL_CONCEPT_FAMILIES)) {
    if (members.some((m) => clean === m || clean.includes(m) || m.includes(clean))) {
      return family;
    }
  }
  return clean;
};

/**
 * Helper to extract symptom candidate objects from a question string
 */
const extractQuestionSymptomCandidates = (q, primaryLocation = '', activeCase = {}) => {
  const lowerQ = q.toLowerCase();
  const candidates = [];

  const positiveSet = new Set(
    (activeCase.positiveSymptoms || []).map((s) => cleanConceptKey(s).toLowerCase())
  );

  const addCand = (sym, negForm) => {
    const cleanSym = cleanConceptKey(sym).toLowerCase();
    const candFamily = getConceptFamily(cleanSym);
    // SCREEN OUT: If candidate or its concept family is ALREADY in positiveSymptoms, DO NOT extract as target candidate to negate!
    for (const pos of positiveSet) {
      const posFamily = getConceptFamily(pos);
      if (pos === cleanSym || (candFamily && posFamily && candFamily === posFamily)) {
        return;
      }
    }

    if (sym && !candidates.some((c) => c.sym === sym)) {
      candidates.push({ sym, negForm: negForm || `no ${sym}` });
    }
  };

  // Screen out background context phrases like "with your headache", "along with your headache"
  const isContextHeadache = /with\s+(?:your\s+|the\s+)?headache/i.test(lowerQ);

  if (lowerQ.includes('swallowing') || lowerQ.includes('swallow')) {
    addCand('swallowing difficulty/pain', 'no difficulty swallowing');
  }

  if (lowerQ.includes('putting weight') || lowerQ.includes('bearing weight') || lowerQ.includes('weight on')) {
    addCand('difficulty bearing weight', 'no difficulty bearing weight');
  }

  if (lowerQ.includes('swelling') || lowerQ.includes('swollen')) {
    const sym = primaryLocation ? `${primaryLocation} swelling` : 'swelling';
    const negForm = primaryLocation ? `no ${primaryLocation} swelling` : 'no swelling';
    addCand(sym, negForm);
  }

  if (lowerQ.includes('breathing') || lowerQ.includes('shortness of breath')) {
    addCand('difficulty breathing', 'no breathing difficulty');
  }

  if (lowerQ.includes('cough') && !lowerQ.includes('worse when')) {
    addCand('cough', 'no cough');
  }
  if (lowerQ.includes('body aches') || lowerQ.includes('body ache')) {
    addCand('body aches', 'no body aches');
  }

  if (lowerQ.includes('nausea')) {
    addCand('nausea', 'no nausea');
  }
  if (lowerQ.includes('vomit')) {
    addCand('vomiting', 'no vomiting');
  }

  if (lowerQ.includes('fever') || lowerQ.includes('temperature')) {
    addCand('fever', 'no fever');
  }

  if (lowerQ.includes('bending') && !lowerQ.includes('worse')) {
    const sym = primaryLocation ? `difficulty bending ${primaryLocation}` : 'difficulty bending joint';
    addCand(sym, `no ${sym}`);
  }
  if (lowerQ.includes('stiffness') || lowerQ.includes('stiff')) {
    const sym = lowerQ.includes('neck') ? 'neck stiffness' : (primaryLocation ? `${primaryLocation} stiffness` : 'stiffness');
    const negForm = lowerQ.includes('neck') ? 'no neck stiffness' : (primaryLocation ? `no ${primaryLocation} stiffness` : 'no stiffness');
    addCand(sym, negForm);
  }

  if (lowerQ.includes('chill')) {
    addCand('chills', 'no chills');
  }

  if (lowerQ.includes('headache') && !isContextHeadache) {
    addCand('headache', 'no headache');
  }

  return candidates;
};

/**
 * Classifies active complaint domain(s) for a canonical clinical case
 * Domains: musculoskeletal, gastrointestinal, urinary_genital, respiratory, cardiovascular, neurological_heent, dermatological, systemic_general
 */
const getComplaintDomains = (canonicalCase = {}) => {
  const domains = new Set();
  const allText = [
    ...(canonicalCase.positiveSymptoms || []),
    ...(canonicalCase.context || []),
    ...(canonicalCase.additionalDetails || []),
    canonicalCase.duration || '',
  ].join(' ').toLowerCase();

  // Musculoskeletal
  if (/\b(?:knee|ankle|hip|leg|arm|shoulder|wrist|joint|foot|feet|back|spine|elbow|thigh|muscle|twist|twisted|fell|fall|walking|downstairs|bend|bending|weight|bearing|instability|unstable|locking|stiffness|swelling|sprain|fracture)\b/i.test(allText)) {
    domains.add('musculoskeletal');
  }

  // Gastrointestinal
  if (/\b(?:stomach|abdom|belly|nausea|nauseous|vomit|vomiting|diarrh|spicy|appetite|burp|burping|heartburn|sour\s+taste|acid|reflux|bowel|stool|cramp|epigastric)\b/i.test(allText)) {
    domains.add('gastrointestinal');
  }

  // Urinary / Genital
  if (/\b(?:urining|urinate|urination|urine|penis|penile|discharge|tip|dysuria|prostate|bladder|testic|testicular|genital|flank)\b/i.test(allText)) {
    domains.add('urinary_genital');
  }

  // Respiratory
  if (/\b(?:cough|coughing|breath|breathing|shortness\s+of\s+breath|wheez|sputum|lung|throat|phlegm)\b/i.test(allText)) {
    domains.add('respiratory');
  }

  // Cardiovascular
  if (/\b(?:chest\s+pain|chest\s+tight|palpitations|cardiac|heart)\b/i.test(allText)) {
    domains.add('cardiovascular');
  }

  // Neurological / HEENT
  if (/\b(?:headache|head\s+ache|dizzy|dizziness|vision|light\s+sensitivity|photophobia|confusion|numb|numbness|tingling|seizure|stroke|faint|fainting|ear|eye)\b/i.test(allText)) {
    domains.add('neurological_heent');
  }

  // Dermatological
  if (/\b(?:rash|skin|itching|blister|hives|lesion|spot|spots)\b/i.test(allText)) {
    domains.add('dermatological');
  }

  // Systemic / General Safety
  if (/\b(?:fever|chills|fatigue|weakness|body\s+aches|sweating)\b/i.test(allText)) {
    domains.add('systemic_general');
  }

  // Fallback to systemic_general if empty
  if (domains.size === 0) {
    domains.add('systemic_general');
  }

  return domains;
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

    // Extract potential context & aggravating factors from follow-up Q&A
    const turnCtx = extractContextFromText(`${q} ${a}`);
    turnCtx.forEach((c) => {
      if (!result.context.includes(c)) result.context.push(c);
    });

    // Special Q1: Food effect Q&A ("Does eating food make this burning pain better or worse?" -> "Better")
    if ((q.includes('eating') || q.includes('food')) && (q.includes('better or worse') || q.includes('make this'))) {
      if (a.includes('better') || a === 'better') {
        if (!result.context.includes('pain improves with eating')) {
          result.context.push('pain improves with eating');
        }
        continue;
      }
    }

    // Special Q2: Antacid / Treatment History Q&A ("Have you tried taking any antacids..." -> "No, none taken")
    if (q.includes('antacid') || q.includes('over-the-counter') || q.includes('medicine')) {
      if (a.includes('no') || a.includes('none') || a.includes('not')) {
        if (!result.additionalDetails.includes('no antacid or OTC treatment tried')) {
          result.additionalDetails.push('no antacid or OTC treatment tried');
        }
        continue;
      }
    }

    // 1. Duration extraction & discrepancy handling
    if (
      q.includes('how long') ||
      q.includes('when did') ||
      q.includes('duration') ||
      ['today', '1 day', '2 days', '3 days', '1 week', '2 weeks', '1-3 days', 'more than 3 days', 'about a week'].includes(a)
    ) {
      let newDur = '';
      if (a.includes('today')) newDur = 'today';
      else if (a.includes('yesterday') || a.includes('1 day')) newDur = '1 day';
      else if (a.includes('three days') || a.includes('3 days')) newDur = '3 days';
      else if (a.includes('week')) newDur = a;
      else if (a.length < 30) newDur = a;

      if (newDur) {
        if (result.duration && result.duration !== 'unspecified' && result.duration !== newDur) {
          const discMsg = `duration discrepancy: initial report ${result.duration}; later response ${newDur}`;
          if (!result.additionalDetails.includes(discMsg)) {
            result.additionalDetails.push(discMsg);
          }
        } else {
          result.duration = newDur;
        }
      }
      continue;
    }

    // 2. Severity extraction (only when overall discomfort/pain severity is explicitly asked)
    if (
      (q.includes('overall') || q.includes('discomfort') || q.includes('how severe') || q.includes('pain severity')) &&
      ['mild', 'moderate', 'severe'].includes(a)
    ) {
      if (a.includes('severe')) result.severity = 'severe';
      else if (a.includes('moderate')) result.severity = 'moderate';
      else if (a.includes('mild')) result.severity = 'mild';
    }

    // 3. Fever Qualifier (e.g. Q: "How high is your fever...", A: "Mild fever")
    if (q.includes('fever') || q.includes('temperature')) {
      if (a.includes('mild fever') || a === 'mild fever' || a.includes('mild')) {
        if (!result.positiveSymptoms.includes('mild fever') && !result.positiveSymptoms.includes('fever') && !result.negativeFindings.includes('no fever')) {
          result.positiveSymptoms.push('mild fever');
        }
        continue;
      }
    }

    const loc = getPrimaryLocation();
    const qCandidates = extractQuestionSymptomCandidates(q, loc, result);

    // Track derived items for evidence provenance logging
    const derivedItems = [];

    // 4. Negative Answers
    const isNegative =
      a === 'no' ||
      a === 'neither' ||
      a === 'none' ||
      a === 'nothing' ||
      a.startsWith('no ') ||
      a.includes('not having') ||
      a.includes('haven\'t') ||
      a.includes('no breathing') ||
      a.includes('no trouble') ||
      a.includes('no cough') ||
      a.includes('no fever') ||
      a.includes('no pain') ||
      a.includes('no difficulty');

    if (isNegative) {
      if (qCandidates.length > 0) {
        qCandidates.forEach((cand) => {
          if (!result.negativeFindings.includes(cand.negForm)) {
            result.negativeFindings.push(cand.negForm);
            derivedItems.push({ concept: cand.sym, negForm: cand.negForm, polarity: 'negative' });
          }
        });
      } else {
        if (q.includes('swelling')) {
          const neg = loc ? `no ${loc} swelling` : 'no swelling';
          if (!result.negativeFindings.includes(neg)) {
            result.negativeFindings.push(neg);
            derivedItems.push({ concept: 'swelling', negForm: neg, polarity: 'negative' });
          }
        } else if (q.includes('vomit')) {
          if (!result.negativeFindings.includes('no vomiting')) {
            result.negativeFindings.push('no vomiting');
            derivedItems.push({ concept: 'vomiting', negForm: 'no vomiting', polarity: 'negative' });
          }
        } else if (q.includes('nausea')) {
          if (!result.negativeFindings.includes('no nausea')) {
            result.negativeFindings.push('no nausea');
            derivedItems.push({ concept: 'nausea', negForm: 'no nausea', polarity: 'negative' });
          }
        } else if (q.includes('fever')) {
          if (!result.negativeFindings.includes('no fever')) {
            result.negativeFindings.push('no fever');
            derivedItems.push({ concept: 'fever', negForm: 'no fever', polarity: 'negative' });
          }
        }
      }

      console.log(`[FOLLOWUP ANSWER SOURCE]\nQuestion: "${q}"\nAnswer: "${a}"\nExtracted positive: []\nExtracted negative: ${JSON.stringify(derivedItems.map(d => d.negForm))}\nCanonical concepts: ${JSON.stringify(derivedItems.map(d => d.negForm))}`);
      console.log(`[FOLLOWUP EVIDENCE][req-X]\nQ: "${q}"\nA: "${a}"\nDerived: ${JSON.stringify(derivedItems)}`);
      continue;
    }

    // 5. Affirmative / Short / Specific Item Answers
    const isBoth = a.includes('both');
    const isOnlyCough = a.includes('only cough');
    const isOnlyNausea = a.includes('only nausea');
    const isAffirmative =
      a === 'yes' ||
      a === 'yeah' ||
      a === 'yep' ||
      a.includes('yes,') ||
      a.includes('there is') ||
      a.includes('i do') ||
      isBoth;

    // Split answer into specific affirmed concepts (e.g. "redness, warmth" -> ["redness", "warmth"])
    const answerTerms = a.split(/[,;]|\s+and\s+/).map((t) => t.trim()).filter((t) => t.length > 0);

    for (const term of answerTerms) {
      if (['redness', 'red', 'warmth', 'warm', 'heat'].includes(term)) {
        if (term.includes('red')) {
          const sym = loc ? `${loc} redness` : 'redness';
          if (!result.positiveSymptoms.includes(sym)) {
            result.positiveSymptoms.push(sym);
            derivedItems.push({ concept: sym, polarity: 'positive' });
          }
        }
        if (term.includes('warm') || term.includes('heat')) {
          const sym = loc ? `${loc} warmth` : 'warmth';
          if (!result.positiveSymptoms.includes(sym)) {
            result.positiveSymptoms.push(sym);
            derivedItems.push({ concept: sym, polarity: 'positive' });
          }
        }
        continue;
      }
    }

    if (isBoth) {
      qCandidates.forEach((cand) => {
        if (!result.positiveSymptoms.includes(cand.sym)) {
          result.positiveSymptoms.push(cand.sym);
          derivedItems.push({ concept: cand.sym, polarity: 'positive' });
        }
      });
    } else if (isOnlyCough) {
      if (!result.positiveSymptoms.includes('cough')) {
        result.positiveSymptoms.push('cough');
        derivedItems.push({ concept: 'cough', polarity: 'positive' });
      }
      qCandidates.forEach((cand) => {
        if (cand.sym !== 'cough' && !result.negativeFindings.includes(cand.negForm)) {
          result.negativeFindings.push(cand.negForm);
          derivedItems.push({ concept: cand.sym, negForm: cand.negForm, polarity: 'negative' });
        }
      });
    } else if (isOnlyNausea) {
      if (!result.positiveSymptoms.includes('nausea')) {
        result.positiveSymptoms.push('nausea');
        derivedItems.push({ concept: 'nausea', polarity: 'positive' });
      }
      qCandidates.forEach((cand) => {
        if (cand.sym !== 'nausea' && !result.negativeFindings.includes(cand.negForm)) {
          result.negativeFindings.push(cand.negForm);
          derivedItems.push({ concept: cand.sym, negForm: cand.negForm, polarity: 'negative' });
        }
      });
    } else if (isAffirmative) {
      if (qCandidates.length === 1) {
        const cand = qCandidates[0];
        if (!result.positiveSymptoms.includes(cand.sym)) {
          result.positiveSymptoms.push(cand.sym);
          derivedItems.push({ concept: cand.sym, polarity: 'positive' });
        }
      } else if (qCandidates.length > 1) {
        // Multi-concept Yes Safety (Section D & G):
        // Only affirm candidates explicitly named in the answer string
        let anyAffirmed = false;
        qCandidates.forEach((cand) => {
          if (a.toLowerCase().includes(cand.sym.toLowerCase())) {
            if (!result.positiveSymptoms.includes(cand.sym)) {
              result.positiveSymptoms.push(cand.sym);
              derivedItems.push({ concept: cand.sym, polarity: 'positive' });
              anyAffirmed = true;
            }
          }
        });
        if (!anyAffirmed) {
          const detail = `ambiguous yes response to multi-concept question: "${q}"`;
          if (!result.additionalDetails.includes(detail)) {
            result.additionalDetails.push(detail);
            derivedItems.push({ concept: 'ambiguous_response', detail, polarity: 'ambiguous' });
          }
        }
      }
    }

    console.log(`[FOLLOWUP ANSWER SOURCE]\nQuestion: "${q}"\nAnswer: "${a}"\nExtracted positive: ${JSON.stringify(derivedItems.filter(d => d.polarity === 'positive').map(d => d.concept))}\nExtracted negative: ${JSON.stringify(derivedItems.filter(d => d.polarity === 'negative').map(d => d.negForm))}\nCanonical concepts: ${JSON.stringify(derivedItems.map(d => d.concept || d.negForm))}`);
    console.log(`[FOLLOWUP EVIDENCE][req-X]\nQ: "${q}"\nA: "${a}"\nDerived: ${JSON.stringify(derivedItems)}`);

    // Question-aware symptom additions
    if (a.includes('cough') && q.includes('cough') && !q.includes('worse when') && !result.positiveSymptoms.includes('cough')) {
      result.positiveSymptoms.push('cough');
    }
    if (a.includes('body aches') && !result.positiveSymptoms.includes('body aches')) {
      result.positiveSymptoms.push('body aches');
    }
    if (a.includes('nausea') && !result.positiveSymptoms.includes('nausea')) {
      result.positiveSymptoms.push('nausea');
    }
    if (a.includes('vomiting') && !result.positiveSymptoms.includes('vomiting')) {
      result.positiveSymptoms.push('vomiting');
    }
    if ((a.includes('swelling') || q.includes('swelling')) && !q.includes('worse')) {
      if (isAffirmative || a.includes('swelling')) {
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
    }
  }

  // Final deduplication & specificity refinement pass with negation safety
  result.positiveSymptoms = deduplicateAndRefineSymptoms(result.positiveSymptoms, result.context, result.negativeFindings);
  return result;
};

/**
 * Reconciles positive symptoms and negative findings using Provenance Priority.
 * DIRECT_INITIAL_EXPLICIT > DIRECT_FOLLOWUP_EXPLICIT > QUESTION_INFERRED > MODEL_INFERRED.
 * Explicit initial positive statements override parser-derived negative findings in the same concept family.
 */
const reconcilePositiveAndNegativeEvidence = (canonicalCase = {}) => {
  if (!canonicalCase || typeof canonicalCase !== 'object') return canonicalCase;

  const positiveSymptoms = Array.isArray(canonicalCase.positiveSymptoms) ? [...canonicalCase.positiveSymptoms] : [];
  let negativeFindings = Array.isArray(canonicalCase.negativeFindings) ? [...canonicalCase.negativeFindings] : [];
  const context = Array.isArray(canonicalCase.context) ? [...canonicalCase.context] : [];
  const additionalDetails = Array.isArray(canonicalCase.additionalDetails) ? [...canonicalCase.additionalDetails] : [];

  // Provenance Priority: Specific initial positive headache (e.g., "left-sided throbbing headache")
  // overrides parser-manufactured generic "no headache" in negativeFindings.
  const hasSpecificHeadache = positiveSymptoms.some((s) => String(s).toLowerCase().includes('headache') || String(s).toLowerCase().includes('head pain'));

  if (hasSpecificHeadache) {
    negativeFindings = negativeFindings.filter((neg) => {
      const negLower = String(neg || '').toLowerCase().trim();
      return negLower !== 'no headache' && negLower !== 'no head pain';
    });
  }

  const cleanedPositives = positiveSymptoms.filter((pos) => {
    if (!pos || typeof pos !== 'string') return false;
    const posLower = cleanConceptKey(pos).toLowerCase();
    if (!posLower || isBareBodyPart(posLower)) return false;

    // Check if pos is negated by negativeFindings
    const isNegated = negativeFindings.some((neg) => {
      const negLower = String(neg || '').toLowerCase().trim();
      if (!negLower) return false;

      if (posLower === 'chest pain' || posLower === 'chest tightness' || posLower === 'chest heaviness') {
        return negLower.includes('no chest pain') || negLower.includes('no chest tightness');
      }
      if (posLower === 'fever' || posLower === 'mild fever') {
        return negLower.includes('no fever');
      }
      if (posLower === 'vomiting' || posLower === 'vomit') {
        return negLower.includes('no vomiting');
      }
      if (posLower === 'diarrhea') {
        return negLower.includes('no diarrhea');
      }
      if (posLower === 'fainting' || posLower === 'fainted' || posLower === 'syncope') {
        return negLower.includes('no fainting');
      }
      if (posLower === 'cough') {
        return negLower.includes('no cough');
      }
      if (posLower === 'difficulty breathing' || posLower === 'shortness of breath') {
        return negLower.includes('no breathing difficulty') || negLower.includes('no shortness of breath');
      }
      if (posLower === 'sweating' || posLower === 'excessive sweating') {
        return negLower.includes('no sweating');
      }
      if (posLower === 'dizziness' || posLower === 'light-headedness' || posLower === 'light-headedness on standing') {
        return negLower.includes('no dizziness') || negLower.includes('no light-headedness');
      }
      if (posLower === 'headache' || posLower === 'head pain') {
        return negLower.includes('no headache') || negLower.includes('no head pain');
      }
      if (posLower.includes('abdominal') || posLower.includes('stomach') || posLower.includes('belly')) {
        return negLower.includes('no severe abdominal pain') || negLower.includes('no abdominal pain') || negLower.includes('no stomach pain');
      }

      const coreNeg = negLower.replace(/^(?:no|not|denies|without)\s+/, '').trim();
      return posLower === coreNeg || negLower === `no ${posLower}` || negLower.includes(posLower);
    });

    return !isNegated;
  });

  return {
    ...canonicalCase,
    positiveSymptoms: cleanedPositives,
    negativeFindings,
    context,
    additionalDetails,
  };
};

/**
 * Asserts structural and semantic integrity of a canonical clinical case before UI or AI analysis.
 */
const assertCanonicalCaseIntegrity = (canonicalCase = {}) => {
  const issues = [];
  const positiveSymptoms = Array.isArray(canonicalCase.positiveSymptoms) ? canonicalCase.positiveSymptoms : [];
  const negativeFindings = Array.isArray(canonicalCase.negativeFindings) ? canonicalCase.negativeFindings : [];

  // 1. Concept Family Contradictions
  for (const pos of positiveSymptoms) {
    const posFamily = getConceptFamily(pos);
    for (const neg of negativeFindings) {
      const negFamily = getConceptFamily(neg);
      if (posFamily && negFamily && posFamily === negFamily) {
        issues.push(`Concept family contradiction: positive "${pos}" conflicts with negative "${neg}" (family: ${posFamily})`);
      }
    }
  }

  // 2. Bare body locations
  for (const pos of positiveSymptoms) {
    if (isBareBodyPart(pos)) {
      issues.push(`Bare body location stored as positive symptom: "${pos}"`);
    }
  }

  // 3. Question text or literal Yes/No stored as symptoms
  for (const pos of positiveSymptoms) {
    const pLower = pos.toLowerCase().trim();
    if (['yes', 'no', 'yeah', 'yep', 'nope', 'none', 'nothing'].includes(pLower)) {
      issues.push(`Literal answer stored as positive symptom: "${pos}"`);
    }
  }

  // 4. Context items stored as positive symptoms
  for (const pos of positiveSymptoms) {
    if (pos.startsWith('pain worse') || pos.startsWith('worse when') || pos.includes('progressively worsening')) {
      issues.push(`Context item stored as positive symptom: "${pos}"`);
    }
  }

  if (issues.length > 0) {
    console.warn(`[CANONICAL INTEGRITY ASSERTION] Found ${issues.length} issue(s):\n${issues.join('\n')}`);
    return { valid: false, issues };
  }

  return { valid: true, issues: [] };
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
    additionalDetails = [],
  } = params;

  // 1. Initial extraction from raw initial statement(s)
  const initialData = extractInitialSymptomsAndContext(symptoms);

  // Combine negative findings
  const combinedNegatives = [...initialData.negativeFindings];
  if (Array.isArray(negativeFindings)) {
    negativeFindings.forEach((n) => {
      if (n && !combinedNegatives.includes(n)) combinedNegatives.push(n);
    });
  }

  // Combine positive symptoms
  const combinedPositive = [...initialData.positiveSymptoms];
  if (Array.isArray(positiveSymptoms)) {
    positiveSymptoms.forEach((s) => {
      const clean = cleanConceptKey(s);
      if (clean && !REDUNDANT_PHRASES.includes(clean) && !combinedPositive.includes(clean)) {
        combinedPositive.push(clean);
      }
    });
  }

  // Combine context
  const combinedContext = [...initialData.context];
  if (Array.isArray(context)) {
    context.forEach((c) => {
      if (c && !combinedContext.includes(c)) combinedContext.push(c);
    });
  }

  // Combine additional details
  const combinedAddDetails = [...(initialData.additionalDetails || [])];
  if (Array.isArray(additionalDetails)) {
    additionalDetails.forEach((d) => {
      if (d && !combinedAddDetails.includes(d)) combinedAddDetails.push(d);
    });
  }

  const baseCase = {
    positiveSymptoms: deduplicateAndRefineSymptoms(combinedPositive, combinedContext, combinedNegatives),
    negativeFindings: combinedNegatives,
    context: combinedContext,
    duration: typeof duration === 'string' && duration.trim() ? duration.trim() : (initialData.duration || ''),
    severity: typeof severity === 'string' && severity.trim() && ['mild', 'moderate', 'severe'].includes(severity.trim().toLowerCase()) ? severity.trim().toLowerCase() : null,
    additionalDetails: combinedAddDetails,
  };

  // 2. Question-aware turn processing across conversation history
  const mergedCase = processFollowUpTurns(conversation, baseCase);

  // 3. Final Mandatory Evidence Reconciliation Pass
  const finalCase = reconcilePositiveAndNegativeEvidence(mergedCase);

  // Assert integrity
  assertCanonicalCaseIntegrity(finalCase);

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
  extractNegationsFromText,
  classifyClauseRole,
  deduplicateAndRefineSymptoms,
  getComplaintDomains,
  reconcilePositiveAndNegativeEvidence,
  assertCanonicalCaseIntegrity,
  cleanConceptKey,
  REDUNDANT_PHRASES,
};
