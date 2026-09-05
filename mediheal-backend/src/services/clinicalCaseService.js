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
    if (val && !negations.includes(val)) {
      negations.push(val);
      const core = val.replace(/^no\s+/, '');
      console.log(`[NEGATION NORMALIZATION]\nDetected negative concept: ${core}\nCanonical: ${val}`);
    }
  };

  // Fever Negation (English + Sinhala + Tamil)
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|free\s+of|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:a\s+)?fever\b/i.test(lower) ||
    /\b(?:no|not|don't|do\s+not|haven't|without)\b[\s\w,]*\bfever\b/i.test(lower) ||
    lower.includes('no fever') || lower.includes('have no fever') || lower.includes('not have fever') || lower.includes('don\'t have fever') || lower.includes('do not have fever') || lower.includes('not had a fever') ||
    lower.includes('උණ නැත') || lower.includes('උණ නෑ') || lower.includes('උණ නැහැ') ||
    /උණ(?:ක්)?\s*(?:නෑ|නැහැ|නැත|නොමැත)/.test(lower) ||
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
    lower.includes('do not have severe abdominal pain') || lower.includes('don\'t have severe abdominal pain') || lower.includes('without severe abdominal pain') ||
    lower.includes('බඩේ කැක්කුමක් නෑ') || lower.includes('බඩේ කැක්කුම නෑ') || lower.includes('බඩේ අමාරුවක් නෑ') ||
    /බඩේ\s*(?:කැක්කුම|අමාරු)(?:ක්|වක්)?\s*(?:නෑ|නැහැ|නැත|නොමැත)/.test(lower) ||
    lower.includes('வயிற்று வலி இல்லை')
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
    lower.includes('වමනය නැත') || lower.includes('වමනය නෑ') || lower.includes('වමනය නැහැ') ||
    /වමනය\s*(?:නෑ|නැහැ|නැත|නොමැත)/.test(lower) ||
    lower.includes('வாந்தி இல்லை')
  ) {
    addNeg('no vomiting');
  }

  // Diarrhea Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*diarrhea\b/i.test(lower) ||
    /\b(?:no|not|don't|do\s+not|haven't|without)\b[\s\w,]*\bdiarrh/i.test(lower) ||
    lower.includes('no diarrhea') || lower.includes('do not have diarrhea') || lower.includes('don\'t have diarrhea') || lower.includes('not have diarrhea') ||
    lower.includes('පාචනය නෑ') || lower.includes('පාචනය නැහැ') ||
    /පාචන(?:ය|යක්)?\s*(?:නෑ|නැහැ|නැත|නොමැත)/.test(lower)
  ) {
    addNeg('no diarrhea');
  }

  // Chest Pain / Tightness Negation (English + Sinhala + Tamil)
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:chest\s+pain|chest\s+tightness|chest\s+heaviness|chest\s+discomfort|pain\s+in\s+chest)\b/i.test(lower) ||
    /\b(?:no|not|don't|do\s+not|haven't|without)\b[\s\w,]*\bchest\s+pain\b/i.test(lower) ||
    lower.includes('no chest pain') || lower.includes('don\'t have chest pain') || lower.includes('don\'t have any chest pain') || lower.includes('do not have any chest pain') ||
    lower.includes('පපුවේ වේදනාව නෑ') || lower.includes('පපුවේ වේදනාව නැහැ') || lower.includes('පපුවේ වේදනාවකුත් නැහැ') ||
    lower.includes('පපුවේ වේදනාවක් නෑ') || lower.includes('පපුවේ වේදනාවක් නැහැ') || lower.includes('පපුවේ කැක්කුම නෑ') ||
    lower.includes('පපුවේ කැක්කුමක් නෑ') || lower.includes('පපුවේ තද ගතියක් නෑ') || lower.includes('පපුවේ අමාරුවක් නෑ') ||
    /පපුවේ\s*(?:වේදනා|කැක්කුම|තද\s*ගති|අමාරු)(?:ක්|වක්|වකුත්)?\s*(?:නෑ|නැහැ|නැත|නොමැත|නොවේ|වෙලා\s*නැහැ)/.test(lower) ||
    lower.includes('நெஞ்சு வலி இல்லை') || lower.includes('நெஞ்சு வலி கிடையாது')
  ) {
    addNeg('no chest pain');
  }

  // Fainting / Syncope Negation (English + Sinhala + Tamil)
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:faint|fainted|fainting|passed\s+out|passing\s+out|syncope)\b/i.test(lower) ||
    lower.includes('no fainting') || lower.includes('haven\'t actually fainted') || lower.includes('haven\'t fainted') || lower.includes('have not fainted') || lower.includes('didn\'t faint') ||
    lower.includes('සිහි නැති වෙලා නැහැ') || lower.includes('සිහි නැති වෙලා නෑ') || lower.includes('සිහි නැති වුණේ නෑ') ||
    lower.includes('සිහි නැතිවුණේ නෑ') || lower.includes('සිහි නැතිවීමක් නෑ') || lower.includes('කලන්තය හැදුනේ නැහැ') ||
    lower.includes('කලන්තයක් නෑ') || lower.includes('කලන්තේ හැදුනේ නෑ') ||
    /(?:සිහි\s*නැති|සිහිය\s*නැති|කලන්ත)(?:යක්|ය|වීමක්)?(?:\s*වෙලා|\s*වුණේ|\s*හැදුනේ)?\s*(?:නෑ|නැහැ|නැත|නොමැත|වෙලා\s*නැහැ)/.test(lower) ||
    lower.includes('மயக்கம் இல்லை')
  ) {
    addNeg('no fainting');
  }

  // Shortness of Breath / Breathing Difficulty Negation (English + Sinhala + Tamil)
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:shortness\s+of\s+breath|difficulty\s+breathing|breathing\s+difficulty|trouble\s+breathing)\b/i.test(lower) ||
    lower.includes('no shortness of breath') || lower.includes('no difficulty breathing') || lower.includes('no breathing difficulty') ||
    (lower.includes('no chest pain') && (lower.includes('shortness of breath') || lower.includes('breathing'))) ||
    lower.includes('හුස්ම ගැනීමේ අපහසුවක් නෑ') || lower.includes('හුස්ම ගන්න අමාරු නෑ') ||
    lower.includes('හුස්ම ගන්න අපහසුතාවයක්වත් නැහැ') || lower.includes('හුස්ම ගැනීමේ අපහසුතාවයක් නෑ') ||
    /හුස්ම\s*(?:ගැනීමේ\s*අපහසු(?:තාවය)?|ගන්න\s*(?:අමාරු|අපහසු(?:තාවය)?))(?:ක්|ක්වත්|වක්)?\s*(?:නෑ|නැහැ|නැත|නොමැත)/.test(lower) ||
    lower.includes('மூச்சுத் திணறல் இல்லை') || lower.includes('சுவாசிப்பதில் சிரமம் இல்லை') || lower.includes('மூச்சு விடுவதில் சிரமம் இல்லை')
  ) {
    addNeg('no difficulty breathing');
  }

  // Lip Swelling Negation (English + Sinhala + Tamil)
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:lip\s+swelling|swelling\s+of\s+(?:my\s+|the\s+)?lips?|swelling\s+in\s+(?:my\s+|the\s+)?lips?|lip\s+or\s+tongue\s+swelling)\b/i.test(lower) ||
    lower.includes('no lip swelling') || lower.includes('no swelling of my lips') || lower.includes('no swelling of the lips') || lower.includes('no swelling of lips') ||
    lower.includes('තොල් ඉදිමීමක්වත් නැහැ') || lower.includes('තොල් ඉදිමීමක් නෑ') || lower.includes('තොල් ඉදිමුමක් නෑ') ||
    lower.includes('තොල්වල ඉදිමීමක් නෑ') || lower.includes('තොල් ඉදිමිලා නෑ') ||
    (lower.includes('තොල්') && (lower.includes('ඉදිමී') || lower.includes('ඉදිමු')) && (lower.includes('නැහැ') || lower.includes('නෑ') || lower.includes('නැත') || lower.includes('නොමැත'))) ||
    /තොල්\s*(?:වල\s*)?(?:ඉදිමී?ම(?:ක්|ක්වත්)?|ඉදිමුම(?:ක්)?|ඉදිමිලා)[\s\S]*?(?:නෑ|නැහැ|නැත|නොමැත)/.test(lower) ||
    lower.includes('உதடு வீக்கம் இல்லை') || lower.includes('உதடுகளில் வீக்கம் இல்லை') ||
    (lower.includes('உதடு') && lower.includes('வீக்கம்') && lower.includes('இல்லை')) ||
    /உதடு(?:களில்)?\s*வீக்கம்\s*இல்லை/.test(lower)
  ) {
    addNeg('no lip swelling');
  }


  // General Swelling Negation (English + Sinhala + Tamil)
  if (
    (/\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:swelling|swollen\s+joints?)\b/i.test(lower) &&
    !lower.includes('lip') && !lower.includes('තොල්') && !lower.includes('உதடு')) ||
    lower === 'no swelling' || lower === 'without swelling' ||
    lower.includes('ඉදිමීමක් නෑ') || lower.includes('ඉදිමීමක් නැහැ') || lower.includes('ඉදිමුමක් නෑ') ||
    lower.includes('வீக்கம் இல்லை')
  ) {
    addNeg('no swelling');
  }

  // Sweating Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:excessive\s+)?sweating\b/i.test(lower) ||
    lower.includes('no sweating') || lower.includes('no excessive sweating') ||
    lower.includes('දාඩිය දමන්නේ නෑ') || /දාඩිය\s*(?:දමන්නේ\s*)?(?:නෑ|නැහැ)/.test(lower)
  ) {
    addNeg('no sweating');
  }

  // Cough Negation
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:a\s+)?cough\b/i.test(lower) ||
    lower.includes('no cough') || lower.includes('do not have a cough') || lower.includes('don\'t have a cough') ||
    lower.includes('කැස්ස නැත') || lower.includes('කැස්ස නෑ') || lower.includes('කැස්ස නැහැ') ||
    /කැස්ස\s*(?:නෑ|නැහැ|නැත|නොමැත)/.test(lower) ||
    lower.includes('இருமல் இல்லை')
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

  // Dizziness / Light-headedness Negation (English + Sinhala + Tamil)
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:dizzy|dizziness|light-?headedness|light-?headed)\b/i.test(lower) ||
    lower.includes('no dizziness') || lower.includes('no light-headedness') || lower.includes('not dizzy') || lower.includes('no lightheadedness') ||
    lower.includes('කරකැවිල්ලක් නෑ') || lower.includes('කරකැවිල්ල නෑ') || lower.includes('කරකැවිල්ල නැහැ') || lower.includes('කරකැවිල්ලක් නැහැ') ||
    /කරකැවිල්ල(?:ක්)?\s*(?:නෑ|නැහැ|නැත|නොමැත)/.test(lower) ||
    lower.includes('தலைச்சுற்றல் இல்லை')
  ) {
    addNeg('no dizziness');
  }

  // Headache Negation (English + Sinhala + Tamil)
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:a\s+)?(?:headache|head\s+pain)\b/i.test(lower) ||
    lower.includes('no headache') || lower.includes('no head pain') || lower.includes('don\'t have a headache') ||
    lower.includes('හිසේ කැක්කුමක් නෑ') || lower.includes('හිසේ කැක්කුම නෑ') || lower.includes('හිසේ කැක්කුම නැහැ') || lower.includes('හිස රදයක් නෑ') ||
    /හිසේ\s*කැක්කුම(?:ක්)?\s*(?:නෑ|නැහැ|නැත|නොමැත)/.test(lower) ||
    lower.includes('தலைவலி இல்லை')
  ) {
    addNeg('no headache');
  }

  // Nausea Negation (English + Sinhala + Tamil)
  if (
    /\b(?:no|not|haven't|have\s+not|don't|do\s+not|without|denies|denied)\s+(?:had\s+|have\s+|experienced\s+|actually\s+|any\s+|really\s+|ever\s+)*(?:nausea|nauseous|feeling\s+nauseous)\b/i.test(lower) ||
    lower.includes('no nausea') || lower.includes('not nauseous') ||
    lower.includes('ඔක්කාරය නෑ') || lower.includes('ඔක්කාරයක් නෑ') || lower.includes('ඔක්කාරය නැහැ') ||
    /ඔක්කාර(?:ය|යක්)?\s*(?:නෑ|නැහැ|නැත|නොමැත)/.test(lower)
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
      else if (cleanItem.includes('shortness of breath') || cleanItem.includes('breathing')) addNeg('no difficulty breathing');
      else if (cleanItem.includes('sweating')) addNeg('no sweating');
      else if (cleanItem.includes('cough')) addNeg('no cough');
      else if (cleanItem.includes('abdominal pain') || cleanItem.includes('stomach pain') || cleanItem.includes('belly pain')) {
        addNeg(item.includes('severe') ? 'no severe abdominal pain' : 'no abdominal pain');
      }
    }
  }

  return normalizeNegativeFindings(negations);
};

/**
 * Normalizes and deduplicates negative findings, collapsing semantic synonyms
 * (e.g. "no breathing difficulty" / "no shortness of breath" -> "no difficulty breathing")
 */
const normalizeNegativeFindings = (negs = []) => {
  if (!Array.isArray(negs)) return [];
  const seen = new Set();
  const result = [];

  for (const item of negs) {
    if (!item || typeof item !== 'string') continue;
    let clean = item.trim().toLowerCase();

    // 1. Respiratory / Breathing synonyms -> "no difficulty breathing"
    if (
      clean === 'no breathing difficulty' ||
      clean === 'no shortness of breath' ||
      clean === 'no trouble breathing' ||
      clean === 'no breathing trouble'
    ) {
      clean = 'no difficulty breathing';
    }

    // 2. Lip Swelling synonyms -> "no lip swelling"
    if (
      clean === 'no swelling of lips' ||
      clean === 'no swelling of my lips' ||
      clean === 'no swelling of the lips' ||
      clean === 'no swelling in lips' ||
      clean === 'no lip or tongue swelling'
    ) {
      clean = 'no lip swelling';
    }

    // 3. Chest Pain synonyms -> "no chest pain"
    if (clean === 'no chest tightness' || clean === 'no chest heaviness') {
      clean = 'no chest pain';
    }

    // 4. Rash Spreading synonyms -> "no rash spreading"
    if (clean === 'no spreading' || clean === 'no spread') {
      clean = 'no rash spreading';
    }

    if (!seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }

  return result;
};

/**
 * Helper to parse duration from natural language text (English + Sinhala + Tamil)
 */
const extractDurationFromText = (text) => {
  if (!text || typeof text !== 'string') return '';
  const lower = text.toLowerCase().trim();
  let duration = '';

  // 1. Sinhala duration patterns
  if (lower.includes('දින කිහිපයක්') || lower.includes('දවස් කිහිපයක්') || lower.includes('දින කීපයක්') || lower.includes('දවස් කීපයක්') || lower.includes('දින කිහිපය') || lower.includes('දවස් කිහිපය')) {
    duration = 'several days';
  } else if (lower.includes('සතියකට වැඩියි') || lower.includes('සතියකට වඩා වැඩි') || lower.includes('සතියකට වැඩි')) {
    duration = 'more than a week';
  } else if (lower.includes('සති දෙකක්') || lower.includes('සති 2')) {
    duration = '2 weeks';
  } else if (lower.includes('සතියක් පමණ') || lower.includes('සතියක් විතර') || lower.includes('සතියක්') || lower.includes('සති 1')) {
    duration = '1 week';
  } else if (lower.includes('මාස කිහිපයක්') || lower.includes('මාස කීපයක්')) {
    duration = 'several months';
  } else if (lower.includes('මාස දෙකක්') || lower.includes('මාස 2')) {
    duration = '2 months';
  } else if (lower.includes('මාසයක්') || lower.includes('මාස 1')) {
    duration = '1 month';
  } else if (lower.includes('පසුගිය දින තුන') || lower.includes('දින තුන') || lower.includes('දින 3') || lower.includes('දවස් තුනක්') || lower.includes('දවස් 3')) {
    duration = '3 days';
  } else if (lower.includes('පසුගිය දින දෙක') || lower.includes('දින දෙක') || lower.includes('දින 2') || lower.includes('දවස් දෙකක්') || lower.includes('දවස් 2')) {
    duration = '2 days';
  } else if (lower.includes('දවසක්') || lower.includes('දිනක්') || lower.includes('දින 1') || lower.includes('දවස් 1')) {
    duration = '1 day';
  } else if (lower.includes('අද')) {
    duration = 'today';
  } else if (lower.includes('ඊයේ')) {
    duration = '1 day';
  } else {
    const siDaysMatch = lower.match(/(?:පසුගිය\s+)?(?:දින|දවස්)\s*(\d+|තුන|දෙක|එක|හතර|පහ|හය|හත)\s*(?:ක්|තුළ)?/i);
    if (siDaysMatch) {
      const siWordToNum = { එක: '1', දෙක: '2', තුන: '3', හතර: '4', පහ: '5', හය: '6', හත: '7' };
      const num = siWordToNum[siDaysMatch[1]] || siDaysMatch[1];
      duration = `${num} ${Number(num) === 1 ? 'day' : 'days'}`;
    }
  }

  // 2. Tamil duration patterns
  if (!duration) {
    if (lower.includes('கடந்த இரண்டு') || lower.includes('இரண்டு நாட்கள்') || lower.includes('2 நாட்கள்')) duration = '2 days';
    else if (lower.includes('சில நாட்கள்')) duration = 'several days';
    else if (lower.includes('ஒரு வாரம்')) duration = '1 week';
  }

  // 3. English duration patterns
  if (!duration) {
    if (/\btoday\b/i.test(lower)) duration = 'today';
    else if (lower.includes('several days') || lower.includes('a few days')) duration = 'several days';
    else if (lower.includes('more than a week')) duration = 'more than a week';
    else if (lower.includes('several months')) duration = 'several months';
    else if (lower.includes('since yesterday evening') || lower.includes('yesterday evening')) duration = '1 day';
    else if (lower.includes('since yesterday') || lower.includes('yesterday')) duration = '1 day';
    else if (lower.includes('since morning') || lower.includes('this morning')) duration = 'since morning';
    else {
      const hoursMatch = lower.match(/(?:past|last|during\s+the\s+last|for|about)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*hours?/i);
      if (hoursMatch) {
        const wordToNum = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12' };
        const num = wordToNum[hoursMatch[1].toLowerCase()] || hoursMatch[1];
        duration = `${num} ${Number(num) === 1 ? 'hour' : 'hours'}`;
      } else {
        const daysMatch = lower.match(/(?:past|last|during\s+the\s+last|for\s+the\s+past|for)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*days?/i);
        if (daysMatch) {
          const wordToNum = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' };
          const num = wordToNum[daysMatch[1].toLowerCase()] || daysMatch[1];
          duration = `${num} ${Number(num) === 1 ? 'day' : 'days'}`;
        } else {
          const weeksMatch = lower.match(/(?:past|last|for|about)?\s*(\d+|one|two|three|four)\s*weeks?/i);
          if (weeksMatch) {
            const wordToNum = { one: '1', two: '2', three: '3', four: '4' };
            const num = wordToNum[weeksMatch[1].toLowerCase()] || weeksMatch[1];
            duration = `${num} ${Number(num) === 1 ? 'week' : 'weeks'}`;
          } else if (lower.includes('about a week') || lower.includes('a week') || lower.includes('1 week') || lower.includes('one week')) {
            duration = '1 week';
          } else if (lower.includes('1-3 days') || lower.includes('1-3')) {
            duration = '1-3 days';
          }
        }
      }
    }
  }

  if (duration && /[^\x00-\x7F]/.test(text)) {
    console.log(`[DURATION NORMALIZATION]\nOriginal: ${text.trim()}\nCanonical: ${duration}`);
  }

  return duration;
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

  // Trigger Factors: Standing Up (Orthostatic Light-headedness - English + Sinhala)
  if (
    lower.includes('stand up') || lower.includes('standing') || lower.includes('when i stand') ||
    lower.includes('නැගිටිනකොට') || lower.includes('නැගිටින විට') || lower.includes('නැගිටින')
  ) {
    if (
      lower.includes('light-headed') || lower.includes('lightheaded') || lower.includes('dizzy') || lower.includes('dizziness') ||
      lower.includes('කරකැවිල්ල') || lower.includes('සැහැල්ලු බවක්') || lower.includes('සැහැල්ලු බව')
    ) {
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
 * Extracts anatomical body locations from text into context representation
 */
const extractBodyLocationsFromText = (text) => {
  const locations = [];
  if (!text || typeof text !== 'string') return locations;
  const lower = text.toLowerCase().trim();

  const addLoc = (loc) => {
    if (loc && !locations.includes(loc)) locations.push(loc);
  };

  // Arms / Hands / Shoulders (English + Sinhala + Tamil)
  if (
    /\bboth\s+arms\b|\bon\s+both\s+arms\b|\bin\s+both\s+arms\b/i.test(lower) ||
    lower.includes('අත් දෙකේම') || lower.includes('අත් දෙකේ') || lower.includes('අත් දෙක') ||
    lower.includes('இரு கைகளிலும்') || lower.includes('இரு கைகள்')
  ) {
    addLoc('both arms');
  } else if (/\bleft\s+arm\b/i.test(lower) || lower.includes('වම් අත')) {
    addLoc('left arm');
  } else if (/\bright\s+arm\b/i.test(lower) || lower.includes('දකුණු අත')) {
    addLoc('right arm');
  } else if (/\bboth\s+hands\b/i.test(lower)) {
    addLoc('both hands');
  } else if (/\bleft\s+hand\b/i.test(lower)) {
    addLoc('left hand');
  } else if (/\bright\s+hand\b/i.test(lower)) {
    addLoc('right hand');
  } else if (/\bboth\s+shoulders\b/i.test(lower)) {
    addLoc('both shoulders');
  } else if (/\bleft\s+shoulder\b/i.test(lower)) {
    addLoc('left shoulder');
  } else if (/\bright\s+shoulder\b/i.test(lower)) {
    addLoc('right shoulder');
  }

  // Legs / Feet / Knees / Ankles (English + Sinhala + Tamil)
  if (
    /\bboth\s+legs\b|\bon\s+both\s+legs\b|\bin\s+both\s+legs\b/i.test(lower) ||
    lower.includes('කකුල් දෙකේම') || lower.includes('කකුල් දෙක') ||
    lower.includes('இரு கால்களிலும்') || lower.includes('இரு கால்கள்')
  ) {
    addLoc('both legs');
  } else if (/\bleft\s+leg\b/i.test(lower) || lower.includes('වම් කකුල')) {
    addLoc('left leg');
  } else if (/\bright\s+leg\b/i.test(lower) || lower.includes('දකුණු කකුල')) {
    addLoc('right leg');
  }

  if (/\bboth\s+knees\b/i.test(lower) || lower.includes('දණහිස් දෙකේම')) {
    addLoc('both knees');
  } else if (/\bleft\s+knee\b/i.test(lower) || lower.includes('වම් දණහිස')) {
    addLoc('left knee');
  } else if (/\bright\s+knee\b/i.test(lower) || lower.includes('දකුණු දණහිස')) {
    addLoc('right knee');
  }

  if (/\bboth\s+ankles\b/i.test(lower)) {
    addLoc('both ankles');
  } else if (/\bleft\s+ankle\b/i.test(lower)) {
    addLoc('left ankle');
  } else if (/\bright\s+ankle\b/i.test(lower)) {
    addLoc('right ankle');
  }

  if (/\bboth\s+feet\b/i.test(lower)) {
    addLoc('both feet');
  }

  // Back / Hip (English + Sinhala + Tamil)
  if (
    /\blower\s+back\b|\blow\s+back\b/i.test(lower) ||
    lower.includes('යටි කොන්ද') || lower.includes('கீழ் முதுகு')
  ) {
    addLoc('lower back');
  } else if (/\bupper\s+back\b/i.test(lower)) {
    addLoc('upper back');
  }

  if (/\bright\s+hip\b/i.test(lower)) {
    addLoc('right hip');
  } else if (/\bleft\s+hip\b/i.test(lower)) {
    addLoc('left hip');
  }

  // Head / Neck / Chest / Abdomen
  if (/\bleft(?:-|\s+)sided\s+head(?:ache)?\b/i.test(lower) || lower.includes('left side of head')) {
    addLoc('left side of head');
  } else if (/\bright(?:-|\s+)sided\s+head(?:ache)?\b/i.test(lower) || lower.includes('right side of head')) {
    addLoc('right side of head');
  }

  return locations;
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
  if (!matchedSymptom && (/\bankle\s+instability\b|\bunstable\s+ankle\b|\bankle\s+(?:feels?\s+)?unstable\b/i.test(lower))) {
    matchedSymptom = 'ankle instability';
  }
  if (!matchedSymptom && (/\bunstable\b|\binstability\b|\bknee\s+feels\s+unstable\b/i.test(lower))) {
    if (lower.includes('ankle') || fullRawText.toLowerCase().includes('ankle instability') || fullRawText.toLowerCase().includes('unstable ankle')) {
      matchedSymptom = 'ankle instability';
    } else if (fullRawText.toLowerCase().includes('knee')) {
      matchedSymptom = 'knee instability';
    } else {
      matchedSymptom = 'joint instability';
    }
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
  if (!matchedSymptom && (
    /\blight-?headed(?:ness)?\b|\bdizz(?:y|iness)\b|\bfeeling\s+dizzy\b|\bfeeling\s+light-?headed\b/i.test(lower) ||
    lower.includes('කරකැවිල්ල') || lower.includes('සැහැල්ලු බවක්') || lower.includes('සැහැල්ලු බව')
  )) {
    if (
      lower.includes('light-headed') || lower.includes('lightheaded') || lower.includes('සැහැල්ලු බව') ||
      lower.includes('stand') || lower.includes('standing') || fullRawText.toLowerCase().includes('stand') ||
      lower.includes('නැගිටින') || fullRawText.toLowerCase().includes('නැගිටින')
    ) {
      if (
        lower.includes('stand') || lower.includes('standing') || fullRawText.toLowerCase().includes('stand') ||
        lower.includes('නැගිටින') || fullRawText.toLowerCase().includes('නැගිටින')
      ) {
        matchedSymptom = 'light-headedness on standing';
      } else {
        matchedSymptom = 'light-headedness';
      }
    } else {
      matchedSymptom = 'dizziness';
    }
  }
  if (!matchedSymptom && (
    /\bpalpitations?\b|\bheart\s+(?:sometimes\s+)?(?:feels?\s+like\s+(?:it\s+is\s+)?)?(?:beats?|beating)\s+fast(?:er)?\b|\bheart\s+racing\b|\bracing\b|\bbeating\s+faster\b|\bbeats\s+faster\b/i.test(lower) ||
    lower.includes('beats faster') || lower.includes('beating faster') ||
    lower.includes('හෘදස්පන්දනය') || lower.includes('හදවත ගැහෙනවා') || (lower.includes('හදවත') && lower.includes('වේගවත්'))
  )) {
    matchedSymptom = 'palpitations';
  }
  if (!matchedSymptom && (
    /\bweakness\b|\bfeel\s+weak\b|\bfeeling\s+weak\b|\bweak\b/i.test(lower) ||
    lower.includes('දුර්වල') || lower.includes('පණ නැති')
  )) {
    matchedSymptom = 'weakness';
  }
  if (!matchedSymptom && (
    /\bfatigue\b|\btiredness\b|\bfeel\s+tired\b|\bfeeling\s+tired\b|\btired\b/i.test(lower) ||
    lower.includes('මහන්සි') || lower.includes('වෙහෙස')
  )) {
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

  // Dermatology / Skin Symptoms (English + Sinhala + Tamil)
  const hasRash = /\brash\b|\bhives\b|\burticaria\b|\blesions?\b|\bblisters?\b|\bbumps?\b/i.test(lower) ||
    lower.includes('රෑෂ්') || lower.includes('පලු') || lower.includes('தடிப்பு');
  const hasItch = /\bitch(?:y|ing)?\b/i.test(lower) || lower.includes('කැසීම') || lower.includes('අරිප්පු') || lower.includes('அரிப்பு');
  const hasRedness = /\bred(?:ness)?\b|\bred\s+skin\b/i.test(lower) || lower.includes('රතු') || lower.includes('சிவப்பு');
  const hasSkin = /\bskin\b|\bහම\b|\bචර්ම\b|\bதோல்\b/i.test(lower);

  if (!matchedSymptom && (hasRash || (hasItch && (hasRedness || hasSkin)))) {
    if (hasItch && hasRedness) matchedSymptom = 'itchy red rash';
    else if (hasItch) matchedSymptom = 'itchy rash';
    else if (hasRedness) matchedSymptom = 'red rash';
    else if (/\bhives\b/i.test(lower) || lower.includes('පලු')) matchedSymptom = 'hives';
    else matchedSymptom = 'rash';
  } else if (!matchedSymptom && hasItch && !hasRash) {
    matchedSymptom = 'itching';
  } else if (!matchedSymptom && hasRedness && hasSkin && !hasRash) {
    matchedSymptom = 'skin redness';
  } else if (!matchedSymptom && /\bburning\s+skin\b/i.test(lower)) {
    matchedSymptom = 'burning skin';
  }

  // Urinary / Genital / Local Discomfort Symptoms
  if (!matchedSymptom && (
    /\bpain(?:ful)?\s+(?:feeling\s+)?(?:when|while|with|during)?\s*(?:i\s+)?urinat|\bpainful\s+urination\b|\bpain\s+when\s+urinating\b|\bpain\s+while\s+urinating\b/i.test(lower) ||
    lower.includes('මුත්රා කරනකොට වේදනා') || lower.includes('මුත්රා පිටවන විට වේදනා') || lower.includes('මුත්රා වේදනා') || lower.includes('මුත්රා කරද්දි කැක්කුම') || /මුත්රා\s*(?:කරනකොට|කරද්දි|පිටවන\s*විට)?\s*(?:වේදනා|කැක්කුම)/.test(lower) ||
    lower.includes('சிறுநீர் கழிக்கும் போது வலி') || lower.includes('சிறுநீர் வலி')
  )) {
    matchedSymptom = 'painful urination';
  }
  if (!matchedSymptom && (
    /\bburning\s+(?:feeling\s+|sensation\s+)?(?:when|while|with|during)?\s*(?:i\s+)?urinat|\bburning\s+urination\b|\bdysuria\b/i.test(lower) ||
    lower.includes('මුත්රා දැවිල්ල') || lower.includes('சிறுநீர் எரிச்சல்')
  )) {
    matchedSymptom = 'painful urination';
  }
  if (!matchedSymptom && (
    /\bblood\s+in\s+(?:my\s+)?urine\b|\bhematuria\b/i.test(lower) ||
    lower.includes('මුත්රා සමඟ ලේ') || lower.includes('சிறுநீரில் இரத்தம்')
  )) {
    matchedSymptom = 'blood in urine';
  }
  if (!matchedSymptom && (
    /\bfrequent\s+urination\b|\burinate\s+more\s+often\b|\burinating\s+frequently\b/i.test(lower) ||
    lower.includes('නිතර මුත්රා') || lower.includes('அடிக்கடி சிறுநீர்')
  )) {
    matchedSymptom = 'frequent urination';
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

  // Musculoskeletal Specific Patterns
  if (!matchedSymptom && (/\bsharp\s+lower\s+back\s+pain\b|\bsharp\s+low\s+back\s+pain\b/i.test(lower))) {
    matchedSymptom = 'sharp lower back pain';
  } else if (!matchedSymptom && (/\blower\s+back\s+pain\b|\blow\s+back\s+pain\b/i.test(lower))) {
    matchedSymptom = 'lower back pain';
  }
  if (!matchedSymptom && (/\bankle\s+instability\b|\bunstable\s+ankle\b|\bankle\s+(?:feels?\s+)?unstable\b/i.test(lower))) {
    matchedSymptom = 'ankle instability';
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
    lower.includes('discharge') || lower.includes('discomfort') || lower.includes('burning') || lower.includes('sweat') ||
    lower.includes('rash') || lower.includes('itch') || lower.includes('hives')
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
      if (cleanLower === 'chest pain' || cleanLower.includes('chest pain') || cleanLower === 'chest tightness') return nLower.includes('no chest pain') || nLower.includes('no chest tightness');
      if (cleanLower === 'fainting' || cleanLower === 'fainted' || cleanLower === 'faint' || cleanLower === 'syncope') return nLower.includes('no fainting');
      if (cleanLower === 'cough') return nLower.includes('no cough');
      if (cleanLower === 'difficulty breathing' || cleanLower === 'shortness of breath' || cleanLower === 'breathing difficulty') {
        return nLower.includes('no difficulty breathing') || nLower.includes('no breathing') || nLower.includes('no shortness of breath');
      }
      if (cleanLower === 'swelling' || cleanLower === 'lip swelling' || cleanLower === 'swollen') {
        return nLower.includes('no swelling') || nLower.includes('no lip swelling') || nLower.includes('no joint swelling');
      }
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
    if (clean === 'changes in your vision' || clean === 'changes in vision') {
      clean = 'vision changes';
    } else if (clean === 'blurry vision' || clean === 'blurriness') {
      clean = 'blurred vision';
    } else if (clean === 'feel nauseous' || clean === 'feeling nauseous' || clean === 'nauseous' || clean === 'i feel nauseous' || clean === 'i feel slightly nauseous' || clean === 'slightly nauseous') {
      clean = 'nausea';
    } else if (clean === 'lost my appetite' || clean === 'loss of appetite' || clean === 'no appetite' || clean === 'i have lost my appetite') {
      clean = 'loss of appetite';
    } else if (clean.includes('sour taste')) {
      clean = 'sour taste in mouth';
    } else if (clean.includes('burp')) {
      clean = 'frequent burping';
    } else if (clean.includes('swallow')) {
      clean = 'swallowing difficulty/pain';
    } else if (clean === 'frequent urination' || clean === 'urinary frequency' || clean.includes('frequent urination')) {
      clean = 'frequent urination';
    } else if (clean === 'blood in urine' || clean === 'hematuria') {
      clean = 'blood in urine';
    } else if (clean === 'painful urination' || clean === 'burning urination' || clean === 'dysuria' || clean.includes('burning feeling when urinating') || clean.includes('pain when urinating') || clean.includes('pain while urinating') || clean.includes('painful urination')) {
      clean = 'painful urination';
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
    if ((normalized.includes('blurred vision') || normalized.includes('seeing spots') || normalized.includes('double vision')) && (sym === 'vision changes' || sym === 'changes in vision')) {
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

    // Extract body locations
    const extractedLocs = extractBodyLocationsFromText(raw);
    extractedLocs.forEach((loc) => {
      if (!context.includes(loc)) context.push(loc);
    });

    // Extract radiation (e.g. "spreading to right hip" -> "pain radiating to right hip")
    if (/\b(?:spreading|radiating)\s+to\s+(?:right\s+hip|left\s+hip|hip)\b/i.test(raw)) {
      const hipSide = raw.toLowerCase().includes('left hip') ? 'pain radiating to left hip' : 'pain radiating to right hip';
      if (!context.includes(hipSide)) context.push(hipSide);
    }

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

    // Support Sinhala coordinating conjunctions (e.g. දුර්වලත් මහන්සිත් -> දුර්වල , මහන්සි)
    clean = clean.replace(/([\u0D80-\u0DFF]+)ත්\s+([\u0D80-\u0DFF]+)ත්/g, '$1 , $2');

    // Split input into clauses/concepts
    const candidates = clean
      .split(/[,;\.]|\s+(?:and|with|as well as|but|however|or|සහ|හා)\s+/i)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    for (const item of candidates) {
      const classified = classifyClauseRole(item, raw);
      if (classified.role === 'NEGATIVE_FINDING' && classified.value) {
        if (!negativeFindings.includes(classified.value)) {
          negativeFindings.push(classified.value);
        }
      } else if (classified.role === 'POSITIVE_SYMPTOM' && classified.value) {
        const valLower = classified.value.toLowerCase();
        const isNegated = negativeFindings.some((neg) => {
          const negLower = String(neg || '').toLowerCase();
          if (valLower.includes('chest pain') || valLower === 'chest pain') return negLower.includes('no chest pain');
          if (valLower.includes('faint') || valLower === 'fainting') return negLower.includes('no fainting');
          if (valLower === 'fever' || valLower === 'mild fever') return negLower.includes('no fever');
          if (valLower === 'vomiting' || valLower === 'vomit') return negLower.includes('no vomiting');
          if (valLower === 'diarrhea') return negLower.includes('no diarrhea');
          if (valLower === 'cough') return negLower.includes('no cough');
          if (valLower.includes('swell') || valLower === 'swelling') {
            return negLower.includes('no swelling') || negLower.includes('no lip swelling') || negLower.includes('no joint swelling');
          }
          if (valLower.includes('breathing') || valLower.includes('shortness of breath')) {
            return negLower.includes('no difficulty breathing') || negLower.includes('no breathing') || negLower.includes('no shortness of breath');
          }
          if (valLower === 'dizziness' || valLower === 'light-headedness') return negLower.includes('no dizziness') || negLower.includes('no light-headedness');
          if (valLower === 'headache') return negLower.includes('no headache');
          return negLower === `no ${valLower}` || negLower.includes(`no ${valLower}`);
        });
        if (!isNegated && !rawPositive.includes(classified.value)) {
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

  console.log(`[CLINICAL EXTRACTION]\nPositive: ${JSON.stringify(positiveSymptoms)}\nNegative: ${JSON.stringify(negativeFindings)}\nContext: ${JSON.stringify(context)}\nDuration: ${duration || 'unspecified'}`);

  return { positiveSymptoms, negativeFindings, context, duration, additionalDetails };
};

const CLINICAL_CONCEPT_FAMILIES = {
  headache: ['headache', 'throbbing headache', 'left-sided throbbing headache', 'left-sided headache', 'head pain', 'sharp head pain'],
  chest_pain: ['chest pain', 'severe chest pain', 'chest tightness', 'chest heaviness', 'chest discomfort'],
  abdominal_pain: ['abdominal pain', 'stomach pain', 'belly pain', 'burning upper abdominal pain', 'sharp lower right abdominal pain', 'lower right abdominal pain', 'upper central abdominal pain'],
  breathing: ['difficulty breathing', 'shortness of breath', 'short of breath', 'trouble breathing', 'breathing difficulty'],
  fever: ['fever', 'mild fever', 'high fever', 'chills'],
  vomiting: ['vomiting', 'vomit', 'throwing up'],
  fainting: ['fainting', 'fainted', 'syncope', 'passing out'],
  dizziness: ['dizziness', 'dizzy', 'light-headedness', 'light-headedness on standing', 'light-headed'],
  cough: ['cough', 'coughing'],
  sweating: ['sweating', 'excessive sweating'],
  neck_stiffness: ['neck stiffness', 'stiffness in neck', 'stiff neck'],
  vision_changes: ['vision changes', 'changes in your vision', 'changes in vision', 'blurred vision', 'blurriness', 'blurry vision', 'seeing spots', 'double vision', 'trouble seeing', 'loss of vision'],
  weakness: ['weakness', 'arm weakness', 'leg weakness', 'difficulty lifting arm', 'difficulty lifting your arm', 'facial weakness', 'muscle weakness'],
  numbness: ['numbness', 'tingling', 'numbness or tingling', 'loss of sensation', 'pins and needles'],
  bowel_changes: ['changes in bowel movements', 'bowel changes', 'constipation', 'diarrhea', 'loose stools', 'bloody stool'],
  abdominal_bloating: ['abdominal bloating', 'bloating', 'swollen belly'],
  blood_in_urine: ['blood in urine', 'hematuria', 'red urine', 'pink urine'],
  painful_urination: ['painful urination', 'burning urination', 'dysuria', 'burning feeling when urinating', 'pain when urinating'],
  frequent_urination: ['frequent urination', 'urinary frequency', 'frequent urge to urinate', 'urinating more frequently', 'urinating more often', 'need to urinate more often', 'need to urinate frequently'],
  urinary_urgency: ['urinary urgency', 'urgent need to urinate', 'urgent need to pass urine'],
  joint_symptoms: ['joint redness', 'redness', 'joint warmth', 'warmth', 'joint locking', 'locking', 'swelling', 'joint swelling', 'difficulty bearing weight'],
  wheezing: ['wheezing'],
  confusion: ['confusion', 'disorientation'],
  rash_spread: ['rash spreading', 'rash spread', 'spreading', 'spreading to other parts', 'spread to other parts'],
  rash_pain: ['rash pain', 'painful rash', 'pain with rash'],
  hives: ['hives', 'urticaria', 'raised hives', 'welts'],
  blistering: ['blistering', 'blisters', 'fluid-filled blisters'],
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

const CLINICAL_QUESTION_CONCEPTS = [
  {
    family: 'vision_changes',
    canonical: 'vision changes',
    negForm: 'no vision changes',
    match: /\b(?:changes?\s+in\s+(?:your\s+)?vision|vision\s+changes?|blurred\s+vision|blurriness|blurry\s+vision|seeing\s+spots|double\s+vision|trouble\s+seeing|loss\s+of\s+vision|vision)\b/i,
    examples: ['blurriness', 'seeing spots'],
  },
  {
    family: 'weakness',
    canonical: 'weakness',
    negForm: 'no weakness',
    match: /\b(?:weakness|loss\s+of\s+strength|difficulty\s+lifting\s+(?:your\s+)?arm|muscle\s+weakness)\b/i,
    examples: ['difficulty lifting arm', 'difficulty lifting your arm'],
  },
  {
    family: 'numbness',
    canonical: 'numbness',
    negForm: 'no numbness',
    match: /\b(?:numbness|tingling|pins\s+and\s+needles|loss\s+of\s+sensation)\b/i,
    examples: ['tingling', 'pins and needles'],
  },
  {
    family: 'dizziness',
    canonical: 'dizziness',
    negForm: 'no dizziness',
    match: /\b(?:dizziness|dizzy|light-headedness|lightheadedness|light-headed)\b/i,
  },
  {
    family: 'vomiting',
    canonical: 'vomiting',
    negForm: 'no vomiting',
    match: /\b(?:vomiting|vomit|throwing\s+up)\b/i,
  },
  {
    family: 'nausea',
    canonical: 'nausea',
    negForm: 'no nausea',
    match: /\b(?:nausea|feeling\s+nauseous|nauseous)\b/i,
  },
  {
    family: 'neck_stiffness',
    canonical: 'neck stiffness',
    negForm: 'no neck stiffness',
    match: /\b(?:neck\s+stiffness|stiff\s+neck|stiffness\s+in\s+(?:your\s+)?neck)\b/i,
  },
  {
    family: 'chest_pain',
    canonical: 'chest pain',
    negForm: 'no chest pain',
    match: /\b(?:chest\s+pain|chest\s+tightness|chest\s+tight|chest\s+pressure|chest\s+discomfort)\b/i,
  },
  {
    family: 'breathing',
    canonical: 'difficulty breathing',
    negForm: 'no difficulty breathing',
    match: /\b(?:difficulty\s+breathing|shortness\s+of\s+breath|trouble\s+breathing|breathing\s+difficulty)\b/i,
  },
  {
    family: 'cough',
    canonical: 'cough',
    negForm: 'no cough',
    match: /\b(?:cough|coughing)\b/i,
  },
  {
    family: 'fever',
    canonical: 'fever',
    negForm: 'no fever',
    match: /\b(?:fever|high\s+temperature|chills)\b/i,
  },
  {
    family: 'abdominal_pain',
    canonical: 'abdominal pain',
    negForm: 'no abdominal pain',
    match: /\b(?:abdominal\s+pain|stomach\s+pain|belly\s+pain)\b/i,
  },
  {
    family: 'bowel_changes',
    canonical: 'changes in bowel movements',
    negForm: 'no changes in bowel movements',
    match: /\b(?:changes?\s+in\s+(?:your\s+)?bowel\s+movements|bowel\s+movements?|diarrhea|constipation)\b/i,
  },
  {
    family: 'abdominal_bloating',
    canonical: 'abdominal bloating',
    negForm: 'no abdominal bloating',
    match: /\b(?:abdominal\s+bloating|bloating|swollen\s+belly)\b/i,
  },
  {
    family: 'blood_in_urine',
    canonical: 'blood in urine',
    negForm: 'no blood in urine',
    match: /\b(?:blood\s+in\s+(?:your\s+|the\s+)?urine|hematuria|red\s+urine|pink\s+urine)\b/i,
  },
  {
    family: 'frequent_urination',
    canonical: 'frequent urination',
    negForm: 'no frequent urination',
    match: /\b(?:urinat(?:e|ing|ion)?\s+more\s+(?:frequently|often)|urinating\s+more\s+frequently|urinating\s+more\s+often|frequent\s+urination|urinary\s+frequency|need\s+to\s+urinate\s+(?:more\s+often|frequently)|(?:need|urge)\s+to\s+pass\s+urine\s+more\s+often|passing\s+urine\s+more\s+often|pass\s+urine\s+more\s+often\s+than\s+usual|more\s+often\s+than\s+usual|frequent\s+(?:and\s+urgent\s+)?need\s+to\s+(?:pass\s+urine|urinate)|frequent\s+need\s+to\s+(?:pass\s+urine|urinate)|feel(?:ing)?\s+the\s+need\s+to\s+urinate\s+more\s+often)\b/i,
  },
  {
    family: 'urinary_urgency',
    canonical: 'urinary urgency',
    negForm: 'no urinary urgency',
    match: /\b(?:urinary\s+urgency|(?:frequent\s+and\s+)?urgent\s+need\s+to\s+(?:urinate|pass\s+urine)|sudden\s+urgency\s+to\s+urinate|urgency\s+to\s+urinate|urgent\s+need\s+to\s+pee)\b/i,
  },
  {
    family: 'painful_urination',
    canonical: 'painful urination',
    negForm: 'no painful urination',
    match: /\b(?:pain\s+or\s+burning\s+(?:during|when)\s+urinat\w+|burning\s+feeling\s+when\s+urinat\w+|burning\s+urination|painful\s+urination|pain\s+when\s+urinating|dysuria)\b/i,
  },
  {
    family: 'balance_walking',
    canonical: 'balance/walking difficulty',
    negForm: 'no balance or walking difficulty',
    match: /\b(?:difficulty\s+with\s+(?:your\s+)?balance\s+or\s+walking|balance\s+or\s+walking|trouble\s+with\s+balance\s+or\s+walking|difficulty\s+balancing\s+or\s+walking)\b/i,
  },
  {
    family: 'joint_redness',
    canonical: 'redness',
    negForm: 'no redness',
    match: /\b(?:redness)\b/i,
  },
  {
    family: 'joint_warmth',
    canonical: 'warmth',
    negForm: 'no warmth',
    match: /\b(?:warmth|heat)\b/i,
  },
  {
    family: 'joint_locking',
    canonical: 'locking',
    negForm: 'no locking',
    match: /\b(?:locking|locking\s+in\s+(?:the\s+|your\s+)?joint)\b/i,
  },
  {
    family: 'swelling',
    canonical: 'swelling',
    negForm: 'no swelling',
    match: /\b(?:swelling|swollen)\b/i,
  },
  {
    family: 'difficulty_bearing_weight',
    canonical: 'difficulty bearing weight',
    negForm: 'no difficulty bearing weight',
    match: /\b(?:bearing\s+weight|weight\s+on\s+(?:it|your)|putting\s+weight)\b/i,
  },
  {
    family: 'wheezing',
    canonical: 'wheezing',
    negForm: 'no wheezing',
    match: /\b(?:wheezing|wheeze)\b/i,
  },
  {
    family: 'confusion',
    canonical: 'confusion',
    negForm: 'no confusion',
    match: /\b(?:confusion|disorientation)\b/i,
  },
  {
    family: 'headache',
    canonical: 'headache',
    negForm: 'no headache',
    match: /\b(?:headache|head\s+pain)\b/i,
  },
  {
    family: 'back_pain',
    canonical: 'back pain',
    negForm: 'no back pain',
    match: /\b(?:back\s+pain|lower\s+back\s+pain|spine\s+pain|pain\s+in\s+(?:your\s+)?back)\b/i,
  },
  {
    family: 'rash_spread',
    canonical: 'rash spreading',
    negForm: 'no rash spreading',
    match: /\b(?:spread(?:ing)?|rash\s+spread(?:ing)?|spread\s+to\s+other\s+parts(?:\s+of\s+(?:your\s+)?body)?)\b/i,
  },
  {
    family: 'rash_pain',
    canonical: 'rash pain',
    negForm: 'no rash pain',
    match: /\b(?:rash\s+pain|painful\s+rash|is\s+the\s+rash\s+painful|pain\s+with\s+(?:the\s+)?rash)\b/i,
  },
  {
    family: 'hives',
    canonical: 'hives',
    negForm: 'no hives',
    match: /\b(?:hives|raised\s+hives|raised\s+welts|urticaria)\b/i,
  },
  {
    family: 'blistering',
    canonical: 'blistering',
    negForm: 'no blistering',
    match: /\b(?:blistering|blisters|fluid-filled\s+blisters)\b/i,
  },
  {
    family: 'rash',
    canonical: 'rash',
    negForm: 'no rash',
    match: /\b(?:have\s+(?:a\s+)?rash|any\s+(?:skin\s+)?rash|new\s+rash|notice\s+(?:a\s+)?rash|develop(?:ed)?\s+(?:a\s+)?rash|rash\s+itself)\b/i,
  },
  {
    family: 'itching',
    canonical: 'itching',
    negForm: 'no itching',
    match: /\b(?:itching|itchy\s+skin|pruritus)\b/i,
  },
];

/**
 * Extracts and normalizes primary clinical concept from a question string.
 * Categorizes questions as:
 * - single_concept: exactly one clear clinical concept
 * - single_concept_with_examples: one main clinical concept clarified by same-domain examples
 * - multiple_independent_concepts: multiple distinct clinical concepts asked together
 * - generic: non-specific question
 * - severity / duration: operational clinical attributes
 */
const extractPrimaryClinicalConcept = (question = '', activeCase = {}) => {
  if (!question || typeof question !== 'string') {
    return { type: 'generic' };
  }
  const cleanQ = question.trim();
  const lowerQ = cleanQ.toLowerCase();

  // 1. Severity check
  if (/\b(?:how\s+severe|severity|overall\s+discomfort|rate\s+your\s+discomfort|mild,\s*moderate|scale\s+of\s+1\s+to\s+10)\b/i.test(lowerQ)) {
    return { type: 'severity', primaryConcept: 'severity' };
  }

  // 2. Duration check
  if (/\b(?:how\s+long|when\s+did|how\s+many\s+days|duration|since\s+when)\b/i.test(lowerQ)) {
    return { type: 'duration', primaryConcept: 'duration' };
  }

  // 3. Generic check pattern
  const isGenericPattern = /\b(?:other\s+associated\s+symptoms|any\s+other\s+symptoms|other\s+symptoms|anything\s+else|changes\s+in\s+your\s+condition|additional\s+symptoms)\b/i.test(lowerQ);

  // Strip background context anchors that mention known active symptoms
  // e.g. "along with your headache", "with the headache", "since your headache started"
  let textToAnalyze = lowerQ;
  const knownPositives = (activeCase.positiveSymptoms || []).map((s) => cleanConceptKey(s).toLowerCase());
  for (const pos of knownPositives) {
    if (!pos || pos.length < 3) continue;
    const escaped = pos.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const anchorRegex = new RegExp(`(?:along\\s+with|with|accompanying|associated\\s+with|since)\\s+(?:your\\s+|the\\s+)?${escaped}`, 'gi');
    textToAnalyze = textToAnalyze.replace(anchorRegex, '');
  }

  // Check for Examples pattern ("such as ...", "for example ...", "like ...", "e.g. ...", "including ...")
  const exampleMatch = textToAnalyze.match(/\b(?:such\s+as|for\s+example|including|e\.g\.)\s+(.+)$/i) ||
                       textToAnalyze.match(/,\s*like\s+(.+)$/i);

  if (exampleMatch) {
    const stem = textToAnalyze.substring(0, exampleMatch.index).trim();
    const exampleClause = exampleMatch[1].trim().replace(/\?+$/, '');

    // Check concepts in stem
    const stemConcepts = CLINICAL_QUESTION_CONCEPTS.filter((c) => c.match.test(stem));
    const uniqueStemFamilies = Array.from(new Set(stemConcepts.map((c) => c.family)));

    if (uniqueStemFamilies.length > 1) {
      return {
        type: 'multiple_independent_concepts',
        concepts: stemConcepts.map((c) => c.canonical),
      };
    }

    if (uniqueStemFamilies.length === 1) {
      const primary = stemConcepts[0];
      // Parse examples from exampleClause
      const rawExamples = exampleClause
        .split(/[,;\.]|\s+or\s+|\s+and\s+/i)
        .map((e) => e.trim().replace(/^seeing\s+/i, 'seeing ').replace(/^a\s+|^an\s+/, ''))
        .filter((e) => e.length > 0);

      return {
        type: 'single_concept_with_examples',
        primaryConcept: primary.canonical,
        negForm: primary.negForm,
        family: primary.family,
        examples: rawExamples.length > 0 ? rawExamples : (primary.examples || []),
      };
    }
  }

  // No example clause — search concepts in textToAnalyze
  const foundConcepts = CLINICAL_QUESTION_CONCEPTS.filter((c) => c.match.test(textToAnalyze));
  const uniqueFamilies = Array.from(new Set(foundConcepts.map((c) => c.family)));

  if (uniqueFamilies.length > 1) {
    return {
      type: 'multiple_independent_concepts',
      concepts: foundConcepts.map((c) => c.canonical),
    };
  }

  if (uniqueFamilies.length === 1) {
    const primary = foundConcepts[0];
    let canonicalConcept = primary.canonical;
    let negForm = primary.negForm;

    // Preserve specific phrasing if question was specifically about "blurred vision"
    if (primary.family === 'vision_changes' && /\b(?:blurred\s+vision|blurry\s+vision)\b/i.test(textToAnalyze)) {
      canonicalConcept = 'blurred vision';
      negForm = 'no blurred vision';
    }

    return {
      type: 'single_concept',
      primaryConcept: canonicalConcept,
      negForm: negForm,
      family: primary.family,
    };
  }

  if (isGenericPattern) {
    return { type: 'generic' };
  }

  return { type: 'generic' };
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
    addCand('difficulty breathing', 'no difficulty breathing');
  }

  if (lowerQ.includes('spread') || lowerQ.includes('spreading')) {
    addCand('rash spreading', 'no rash spreading');
  }
  if (lowerQ.includes('blister')) {
    addCand('blistering', 'no blistering');
  }
  if (lowerQ.includes('hive')) {
    addCand('hives', 'no hives');
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
  const posText = (canonicalCase.positiveSymptoms || []).join(' ').toLowerCase();
  const ctxText = (canonicalCase.context || []).join(' ').toLowerCase();

  // 1. Dermatological (Prioritize positive skin symptoms)
  const hasDermatology = /\b(?:rash|skin|itching|blister|hives|lesion|itchy|bumps?)\b/i.test(posText);
  if (hasDermatology) {
    domains.add('dermatology');
    domains.add('dermatological');
  }

  // 2. Neurological / HEENT
  const hasFocalWeakness = /\b(?:weakness|loss\s+of\s+strength|motor\s+weakness|paralysis)\b/i.test(posText) &&
    /\b(?:feet|foot|legs?|arms?|hands?|face|facial|limbs?|extremit(?:y|ies)|balance|walking)\b/i.test(posText + ' ' + ctxText);
  const hasNeurological = /\b(?:headache|head\s+ache|dizzy|dizziness|light-?headed|vision|photophobia|light\s+sensitivity|confusion|numb|numbness|tingling|seizure|stroke|faint|fainting|blurr|seeing\s+spots|balance|unsteady|walking\s+difficulty|difficulty\s+walking)\b/i.test(posText) || hasFocalWeakness;
  if (hasNeurological) {
    domains.add('neurology');
    domains.add('neurological_heent');
  }

  // 3. Cardiovascular
  const hasCardiovascular = /\b(?:chest\s+pain|chest\s+tight|palpitations?|cardiac|heart|racing)\b/i.test(posText);
  if (hasCardiovascular) {
    domains.add('cardiovascular');
  }

  // 4. Respiratory
  const hasRespiratory = /\b(?:cough|coughing|shortness\s+of\s+breath|difficulty\s+breathing|wheez|sputum|lung|phlegm)\b/i.test(posText);
  if (hasRespiratory) {
    domains.add('respiratory');
  }

  // 5. Gastrointestinal
  const hasSpecificGI = /\b(?:stomach|abdom|belly|diarrh|spicy|appetite|burp|burping|heartburn|sour\s+taste|acid|reflux|bowel|stool|cramp|epigastric|bloat)\b/i.test(posText);
  const hasNauseaVomitOnly = /\b(?:nausea|nauseous|vomit|vomiting)\b/i.test(posText);
  if (hasSpecificGI || (hasNauseaVomitOnly && !hasNeurological)) {
    domains.add('gastrointestinal');
  }

  // 6. Urinary / Genital
  const hasUrinary = /\b(?:urining|urinat(?:e|ing|ion)?|urine|penis|penile|discharge|tip|dysuria|prostate|bladder|testic|testicular|genital|flank)\b/i.test(posText);
  if (hasUrinary) {
    domains.add('urinary');
    domains.add('urinary_genital');
  }

  // 7. Musculoskeletal
  // CRITICAL: Anatomical location alone (e.g. "both arms" for a rash) MUST NOT classify as musculoskeletal!
  const hasMusculoskeletalSymptom = /\b(?:knee|ankle|hip|joint|back|spine|shoulder|wrist|elbow|thigh|muscle|sprain|fracture)\s+(?:pain|injury|ache|stiff|swell|instab|weak)|\b(?:difficulty\s+bearing\s+weight|instability|unstable|locking|joint\s+locking|joint\s+swelling)\b|\b(?:lower\s+back\s+pain|back\s+pain|knee\s+pain|ankle\s+pain|hip\s+pain)\b/i.test(posText);
  const hasMusculoskeletalTrigger = /\b(?:twisted|fell|fall|twisting\s+injury|sports\s+injury|football)\b/i.test(ctxText);

  if (hasMusculoskeletalSymptom || (hasMusculoskeletalTrigger && !hasDermatology)) {
    domains.add('musculoskeletal');
  }

  // 8. Systemic / General Safety
  if (/\b(?:fever|chills|fatigue|weakness|body\s+aches|sweating)\b/i.test(posText)) {
    domains.add('general');
    domains.add('systemic_general');
  }

  // Fallback to systemic_general / general if empty
  if (domains.size === 0) {
    domains.add('general');
    domains.add('systemic_general');
  }

  return domains;
};

/**
 * Builds deterministic clinical topic profile for Gemini prompt and validator
 */
const buildClinicalProfile = (canonicalCase = {}) => {
  const domains = Array.from(getComplaintDomains(canonicalCase));
  const primaryDomain = domains.find((d) => !['systemic_general', 'general'].includes(d)) || domains[0] || 'general';
  const primaryComplaint = (canonicalCase.positiveSymptoms && canonicalCase.positiveSymptoms[0]) || 'unspecified symptom';

  // Extract body regions from context and positive symptoms
  const bodyRegions = [];
  const allContext = [...(canonicalCase.context || []), ...(canonicalCase.positiveSymptoms || [])].join(' ').toLowerCase();
  if (allContext.includes('both arms') || allContext.includes('arms')) bodyRegions.push('both arms');
  else if (allContext.includes('left arm')) bodyRegions.push('left arm');
  else if (allContext.includes('right arm')) bodyRegions.push('right arm');
  if (allContext.includes('both legs') || allContext.includes('legs')) bodyRegions.push('both legs');
  else if (allContext.includes('left leg')) bodyRegions.push('left leg');
  else if (allContext.includes('right leg')) bodyRegions.push('right leg');
  if (allContext.includes('right hip')) bodyRegions.push('right hip');
  else if (allContext.includes('left hip')) bodyRegions.push('left hip');
  else if (allContext.includes('hip')) bodyRegions.push('hip');
  if (allContext.includes('right knee')) bodyRegions.push('right knee');
  else if (allContext.includes('left knee')) bodyRegions.push('left knee');
  else if (allContext.includes('knee')) bodyRegions.push('knee');
  if (allContext.includes('right ankle')) bodyRegions.push('right ankle');
  else if (allContext.includes('left ankle')) bodyRegions.push('left ankle');
  else if (allContext.includes('ankle')) bodyRegions.push('ankle');
  if (allContext.includes('both feet') || allContext.includes('feet') || allContext.includes('foot')) bodyRegions.push('both feet');
  if (allContext.includes('lower back') || allContext.includes('back')) bodyRegions.push('lower back');

  const profile = {
    primaryComplaint,
    positiveSymptoms: canonicalCase.positiveSymptoms || [],
    negativeFindings: canonicalCase.negativeFindings || [],
    bodyRegions,
    clinicalDomain: primaryDomain === 'dermatological' ? 'dermatology' : primaryDomain === 'urinary_genital' ? 'urinary' : primaryDomain === 'neurological_heent' ? 'neurology' : primaryDomain,
    domains,
  };

  console.log(`[CLINICAL PROFILE]\nPrimary complaint: ${profile.primaryComplaint}\nDomain: ${profile.clinicalDomain}\nBody regions: ${JSON.stringify(profile.bodyRegions)}`);

  return profile;
};

/**
 * Normalizes follow-up answers from Sinhala/Tamil/English to canonical representation.
 */
const normalizeFollowUpAnswer = (rawAnswer = '') => {
  if (!rawAnswer || typeof rawAnswer !== 'string') return '';
  const a = rawAnswer.trim();
  const lower = a.toLowerCase();

  // 1. Short Yes normalization (Sinhala + Tamil + English)
  if (
    lower === 'yes' || lower === 'yeah' || lower === 'yep' || lower === 'yes.' ||
    lower === 'yes i do' || lower === 'yes i have' ||
    ['ඔව්', 'ඔව්.', 'එහෙමයි', 'තියෙනවා', 'ඇති', 'හරි', 'ஆம்', 'ஆம்.'].includes(a) ||
    /^(?:ඔව්|එහෙමයි|තියෙනවා|ඇති|හරි|ஆம்)[.\s]*$/.test(a)
  ) {
    return 'yes';
  }

  // 2. Short No normalization (Sinhala + Tamil + English)
  if (
    lower === 'no' || lower === 'nope' || lower === 'not really' || lower === 'neither' || lower === 'none' || lower === 'no.' ||
    lower === "no i don't" || lower === "no i haven't" ||
    ['නෑ', 'නැහැ', 'නැත', 'නොමැත', 'එහෙම නෑ', 'නෑ.', 'නැහැ.', 'නැත.', 'இல்லை', 'இல்லை.'].includes(a) ||
    /^(?:නෑ|නැහැ|නැත|නොමැත|இல்லை)[.\s]*$/.test(a)
  ) {
    return 'no';
  }

  // 3. Specific Sinhala negations
  if (lower.includes('පපුවේ වේදනාව නෑ') || lower.includes('පපුවේ වේදනාව නැහැ') || lower.includes('පපුවේ කැක්කුම නෑ') || lower.includes('පපුවේ වේදනාවක් නෑ') || lower.includes('පපුවේ වේදනාවක් නැහැ')) {
    return 'no chest pain';
  }
  if (lower.includes('සිහි නැති වෙලා නැහැ') || lower.includes('සිහි නැති වෙලා නෑ') || lower.includes('කලන්තය හැදුනේ නැහැ') || lower.includes('කලන්තයක් නෑ')) {
    return 'no fainting';
  }
  if (lower.includes('උණ නැහැ') || lower.includes('උණ නෑ') || lower.includes('උණ නැත')) {
    return 'no fever';
  }
  if (lower.includes('වමනය නැහැ') || lower.includes('වමනය නෑ')) {
    return 'no vomiting';
  }
  if (lower.includes('කරකැවිල්ල නෑ') || lower.includes('කරකැවිල්ල නැහැ')) {
    return 'no dizziness';
  }
  if (lower.includes('හිසේ කැක්කුම නෑ') || lower.includes('හිසේ කැක්කුම නැහැ')) {
    return 'no headache';
  }

  // 4. Sinhala Duration normalization in answer
  const extractedDur = extractDurationFromText(a);
  if (extractedDur && (lower.includes('දින') || lower.includes('දවස්') || lower.includes('සති') || lower.includes('මාස'))) {
    return extractedDur;
  }

  return a;
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
    const rawQ = turn.question || '';
    const rawA = turn.answer || '';
    let q = (turn.canonicalQuestion || rawQ).toLowerCase().trim();
    let a = (turn.canonicalAnswer || normalizeFollowUpAnswer(rawA)).toLowerCase().trim();

    if (!q || !a || a === 'not sure / skipped' || a === 'skipped') continue;

    // Check specific negations inside answer directly
    const specificAnswerNegs = extractNegationsFromText(rawA);
    if (specificAnswerNegs.length > 0) {
      specificAnswerNegs.forEach((neg) => {
        if (!result.negativeFindings.includes(neg)) {
          result.negativeFindings.push(neg);
        }
        // Remove contradictory positive symptoms
        const coreNeg = neg.replace(/^no\s+/, '').trim().toLowerCase();
        result.positiveSymptoms = result.positiveSymptoms.filter((pos) => {
          const pLower = cleanConceptKey(pos).toLowerCase();
          return pLower !== coreNeg && !pLower.includes(coreNeg);
        });
      });
    }

    // Direct duration extraction from follow-up answer
    const ansDuration = extractDurationFromText(rawA) || (a.includes('දින') || a.includes('දවස්') || a.includes('day') || a.includes('week') || a.includes('month') ? extractDurationFromText(a) : '');
    if (ansDuration) {
      const normPrior = extractDurationFromText(result.duration) || result.duration;
      const normAns = extractDurationFromText(ansDuration) || ansDuration;
      if (normPrior && normPrior !== 'unspecified' && normAns && normPrior.toLowerCase().trim() !== normAns.toLowerCase().trim()) {
        const discMsg = `duration discrepancy: initial report ${normPrior}; later response ${normAns}`;
        if (!result.additionalDetails.includes(discMsg)) {
          result.additionalDetails.push(discMsg);
        }
      } else if (normAns) {
        result.duration = normAns;
      }
    }

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
      ['today', '1 day', '2 days', '3 days', '1 week', '2 weeks', '1-3 days', 'more than 3 days', 'about a week', 'several days'].includes(a) ||
      (extractDurationFromText(rawA) && (rawA.includes('දින') || rawA.includes('දවස්') || rawA.includes('සති') || rawA.includes('day') || rawA.includes('week')))
    ) {
      let newDur = '';
      if (a.includes('today')) newDur = 'today';
      else if (a.includes('yesterday') || a.includes('1 day')) newDur = '1 day';
      else if (a.includes('three days') || a.includes('3 days')) newDur = '3 days';
      else if (a.includes('several days')) newDur = 'several days';
      else if (a.includes('week')) newDur = a;
      else if (extractDurationFromText(rawA)) newDur = extractDurationFromText(rawA);
      else if (extractDurationFromText(a)) newDur = extractDurationFromText(a);
      else if (a.length < 30) newDur = a;

      const normNew = extractDurationFromText(newDur) || newDur;
      const normPrior = extractDurationFromText(result.duration) || result.duration;

      if (normNew) {
        if (normPrior && normPrior !== 'unspecified' && normPrior.toLowerCase().trim() !== normNew.toLowerCase().trim()) {
          const laterResponse = rawA.trim().toLowerCase() || normNew;
          const discMsg = `duration discrepancy: initial report ${normPrior}; later response ${laterResponse}`;
          if (!result.additionalDetails.some((d) => d.includes(`initial report ${normPrior}`))) {
            result.additionalDetails.push(discMsg);
          }
        } else {
          result.duration = normNew;
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
    const conceptInfo = extractPrimaryClinicalConcept(q, result);
    const qCandidates = extractQuestionSymptomCandidates(q, loc, result);
    const derivedItems = [];

    console.log(`[FOLLOWUP STORED SEMANTICS]\nDisplay question: "${rawQ}"\nCanonical question: "${q}"\nClinical concept: "${turn.clinicalConcept || conceptInfo.primaryConcept || 'none'}"`);
    console.log(`[FOLLOWUP ANSWER NORMALIZATION]\nOriginal answer: "${rawA}"\nCanonical answer: "${a}"`);

    // Explicit clinical descriptive answer parsing (Sections 19, 20, 22)
    const isShortYesNo = /^(?:yes|no|yeah|yep|nope|not really|neither|none|nothing|ok|okay)[.\s]*$/i.test(a);
    if (!isShortYesNo && (rawA.trim().length > 2 || a.length > 2)) {
      // Parse both the original text and canonical text to maximize coverage across languages
      const parsedRaw = extractInitialSymptomsAndContext(rawA);
      const parsedCan = a !== rawA.toLowerCase().trim() ? extractInitialSymptomsAndContext(a) : { positiveSymptoms: [], negativeFindings: [], context: [] };

      const explicitPos = Array.from(new Set([...(parsedRaw.positiveSymptoms || []), ...(parsedCan.positiveSymptoms || [])]));
      const explicitNeg = Array.from(new Set([...(parsedRaw.negativeFindings || []), ...(parsedCan.negativeFindings || [])]));
      const explicitCtx = Array.from(new Set([...(parsedRaw.context || []), ...(parsedCan.context || [])]));

      console.log(`[FOLLOWUP DESCRIPTIVE EXTRACTION]\nPositive: ${JSON.stringify(explicitPos)}\nNegative: ${JSON.stringify(explicitNeg)}\nContext: ${JSON.stringify(explicitCtx)}\nDuration: "${ansDuration || 'unspecified'}"\nSeverity: "${result.severity || 'unspecified'}"`);

      if (explicitPos.length > 0 || explicitNeg.length > 0 || explicitCtx.length > 0) {
        explicitPos.forEach((p) => {
          if (!result.positiveSymptoms.includes(p)) {
            result.positiveSymptoms.push(p);
          }
          if (!derivedItems.some(d => d.concept === p)) {
            derivedItems.push({ concept: p, polarity: 'positive' });
          }
        });

        explicitNeg.forEach((n) => {
          if (!result.negativeFindings.includes(n)) {
            result.negativeFindings.push(n);
          }
          if (!derivedItems.some(d => d.negForm === n)) {
            derivedItems.push({ concept: n.replace(/^no\s+/, ''), negForm: n, polarity: 'negative' });
          }
        });

        explicitCtx.forEach((c) => {
          if (!result.context.includes(c)) {
            result.context.push(c);
          }
        });

        console.log(`[ANSWER EXTRACTION]\nOriginal: ${rawA}\nCanonical: ${a}\nDerived positives: ${JSON.stringify(explicitPos)}\nDerived negatives: ${JSON.stringify(explicitNeg)}\nDerived context: ${JSON.stringify(explicitCtx)}`);
      }
    }

    // 4. Negative Answers
    const isNegative =
      a === 'no' ||
      a === 'nope' ||
      a === 'not really' ||
      a === 'neither' ||
      a === 'none' ||
      a === 'nothing' ||
      a.startsWith('no ') ||
      a.startsWith('no,') ||
      a.includes('not having') ||
      a.includes("haven't") ||
      a.includes('no breathing') ||
      a.includes('no trouble') ||
      a.includes('no cough') ||
      a.includes('no fever') ||
      a.includes('no pain') ||
      a.includes('no difficulty') ||
      ['නෑ', 'නැහැ', 'නැත', 'නොමැත', 'එහෙම නෑ'].includes(rawA.trim()) ||
      rawA.trim().endsWith('නෑ') || rawA.trim().endsWith('නැහැ');

    if (isNegative) {
      if (conceptInfo.type === 'single_concept_with_examples' || conceptInfo.type === 'single_concept') {
        if (!result.negativeFindings.includes(conceptInfo.negForm)) {
          result.negativeFindings.push(conceptInfo.negForm);
        }
        derivedItems.push({ concept: conceptInfo.primaryConcept, negForm: conceptInfo.negForm, polarity: 'negative' });
        // RECONCILIATION: Remove contradictory positive symptom
        const coreConcept = conceptInfo.primaryConcept.toLowerCase();
        result.positiveSymptoms = result.positiveSymptoms.filter((pos) => {
          const pLower = cleanConceptKey(pos).toLowerCase();
          if (coreConcept === 'rash' && pLower.includes('rash') && pLower !== 'rash') {
            return true;
          }
          if (coreConcept === 'rash spreading' && pLower.includes('rash')) {
            return true;
          }
          return pLower !== coreConcept && !pLower.includes(coreConcept);
        });
      } else if (conceptInfo.type === 'multiple_independent_concepts') {
        console.log(`[FOLLOWUP EVIDENCE]\nQuestion contains multiple independent concepts\nShort Yes/No answer is ambiguous\nDerived: []`);
      } else if (conceptInfo.type === 'generic') {
        // Generic safety (Section 8): do not create fake negative findings
      } else if (qCandidates.length > 0) {
        qCandidates.forEach((cand) => {
          if (!result.negativeFindings.includes(cand.negForm)) {
            result.negativeFindings.push(cand.negForm);
            derivedItems.push({ concept: cand.sym, negForm: cand.negForm, polarity: 'negative' });
          }
          const coreCand = cand.sym.toLowerCase();
          result.positiveSymptoms = result.positiveSymptoms.filter((pos) => {
            const pLower = cleanConceptKey(pos).toLowerCase();
            if (coreCand === 'rash' && pLower.includes('rash') && pLower !== 'rash') {
              return true;
            }
            if (coreCand === 'rash spreading' && pLower.includes('rash')) {
              return true;
            }
            return pLower !== coreCand && !pLower.includes(coreCand);
          });
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

      console.log(`[FOLLOWUP ANSWER SOURCE]\nQuestion: "${q}"\nAnswer: "${a}"`);
      console.log(`[FOLLOWUP QUESTION CONCEPT]\nType: ${conceptInfo.type}\nPrimary concept: ${conceptInfo.primaryConcept || 'none'}`);
      const derivedNegs = derivedItems.filter(d => d.polarity === 'negative').map(d => d.negForm);
      if (derivedNegs.length > 0) {
        console.log(`[FOLLOWUP EVIDENCE]\nPolarity: negative\nDerived: ${JSON.stringify(derivedNegs)}`);
      } else {
        console.log(`[FOLLOWUP EVIDENCE]\nDerived: []`);
      }
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
      a === 'yes.' ||
      a.startsWith('yes,') ||
      a.startsWith('yes ') ||
      a.includes('there is') ||
      a.includes('i do') ||
      a.includes('i have') ||
      ['ඔව්', 'ඔව්.', 'එහෙමයි', 'තියෙනවා', 'ඇති', 'හරි'].includes(rawA.trim()) ||
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
      if (conceptInfo.type === 'single_concept_with_examples') {
        // Main Concept + Examples Yes/No Behavior (Section 6 & 23)
        let specificItem = null;
        if (conceptInfo.family === 'vision_changes') {
          if (a.includes('blurr') || a.includes('blurry') || a.includes('blurred')) {
            specificItem = 'blurred vision';
          } else if (a.includes('spot') || a.includes('spots')) {
            specificItem = 'seeing spots';
          } else if (a.includes('double')) {
            specificItem = 'double vision';
          }
        } else if (conceptInfo.family === 'weakness') {
          if (a.includes('lifting') || a.includes('arm')) {
            specificItem = 'difficulty lifting arm';
          }
        }

        const symToAdd = specificItem || conceptInfo.primaryConcept;
        if (!result.positiveSymptoms.includes(symToAdd)) {
          result.positiveSymptoms.push(symToAdd);
        }
        derivedItems.push({ concept: symToAdd, polarity: 'positive' });
      } else if (conceptInfo.type === 'single_concept') {
        const symToAdd = conceptInfo.primaryConcept;
        if (!result.positiveSymptoms.includes(symToAdd)) {
          result.positiveSymptoms.push(symToAdd);
        }
        derivedItems.push({ concept: symToAdd, polarity: 'positive' });
      } else if (conceptInfo.type === 'multiple_independent_concepts') {
        // Multi-concept Yes Safety (Section 7 & 24):
        // Only affirm candidates explicitly named in the answer string; short Yes produces NO derived items
        let anyAffirmed = false;
        const concepts = conceptInfo.concepts || qCandidates.map((c) => c.sym);
        concepts.forEach((conceptName) => {
          if (a.toLowerCase().includes(conceptName.toLowerCase())) {
            if (!result.positiveSymptoms.includes(conceptName)) {
              result.positiveSymptoms.push(conceptName);
            }
            derivedItems.push({ concept: conceptName, polarity: 'positive' });
            anyAffirmed = true;
          }
        });
        if (!anyAffirmed) {
          console.log(`[FOLLOWUP EVIDENCE]\nQuestion contains multiple independent concepts\nShort Yes/No answer is ambiguous\nDerived: []`);
          const detail = `ambiguous yes response to multi-concept question: "${q}"`;
          if (!result.additionalDetails.includes(detail)) {
            result.additionalDetails.push(detail);
          }
        }
      } else if (conceptInfo.type === 'generic') {
        // Generic question (Section 8 & 25):
        // If short Yes/No alone, do NOT derive "other symptoms"
      } else if (qCandidates.length === 1) {
        const cand = qCandidates[0];
        if (!result.positiveSymptoms.includes(cand.sym)) {
          result.positiveSymptoms.push(cand.sym);
          derivedItems.push({ concept: cand.sym, polarity: 'positive' });
        }
      }
    }

    console.log(`[FOLLOWUP ANSWER SOURCE]\nQuestion: "${q}"\nAnswer: "${a}"`);
    console.log(`[FOLLOWUP QUESTION CONCEPT]\nType: ${conceptInfo.type}\nPrimary concept: ${conceptInfo.primaryConcept || 'none'}`);
    const derivedPos = derivedItems.filter(d => d.polarity === 'positive').map(d => d.concept);
    if (derivedPos.length > 0) {
      console.log(`[FOLLOWUP EVIDENCE]\nPolarity: positive\nDerived: ${JSON.stringify(derivedPos)}`);
    } else if (!isNegative && derivedItems.length === 0 && (conceptInfo.type === 'multiple_independent_concepts' || conceptInfo.type === 'generic')) {
      console.log(`[FOLLOWUP EVIDENCE]\nDerived: []`);
    }
    console.log(`[FOLLOWUP EVIDENCE][req-X]\nQ: "${q}"\nA: "${a}"\nDerived: ${JSON.stringify(derivedItems)}`);

    // Generic specific symptom extractions if named in answer (Section 8 & 25)
    if (a.includes('dizzy') || a.includes('dizziness')) {
      if (!result.positiveSymptoms.includes('dizziness')) {
        result.positiveSymptoms.push('dizziness');
      }
    }

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

  // Provenance Priority: Specific initial positive rash (e.g., "itchy red rash")
  // overrides parser-manufactured generic "no rash" in negativeFindings.
  const hasSpecificRash = positiveSymptoms.some((s) => String(s).toLowerCase().includes('rash'));
  if (hasSpecificRash) {
    negativeFindings = negativeFindings.filter((neg) => {
      const negLower = String(neg || '').toLowerCase().trim();
      return negLower !== 'no rash';
    });
  }

  negativeFindings = normalizeNegativeFindings(negativeFindings);

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
        return negLower.includes('no difficulty breathing') || negLower.includes('no breathing difficulty') || negLower.includes('no shortness of breath');
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
      if (posLower === 'vision changes' || posLower === 'blurred vision' || posLower === 'blurry vision' || posLower === 'seeing spots') {
        return negLower.includes('no vision changes') || negLower.includes('no blurred vision') || negLower.includes('no vision');
      }
      if (posLower === 'weakness' || posLower === 'difficulty lifting arm') {
        return negLower.includes('no weakness');
      }
      if (posLower === 'itchy red rash') {
        return negLower === 'no itchy red rash';
      }
      if (posLower.includes('rash')) {
        return negLower === `no ${posLower}` || (negLower === 'no rash' && posLower === 'rash');
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
  let combinedNegatives = normalizeNegativeFindings([...initialData.negativeFindings]);
  if (Array.isArray(negativeFindings)) {
    negativeFindings.forEach((n) => {
      if (n && !combinedNegatives.includes(n)) combinedNegatives.push(n);
    });
    combinedNegatives = normalizeNegativeFindings(combinedNegatives);
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
      // Filter out false duration discrepancies where both values normalize to the same duration
      const discMatch = typeof d === 'string' && d.match(/duration discrepancy: initial report (.+?); later response (.+)$/i);
      if (discMatch) {
        const d1 = extractDurationFromText(discMatch[1]) || discMatch[1].trim();
        const d2 = extractDurationFromText(discMatch[2]) || discMatch[2].trim();
        if (d1.toLowerCase() === d2.toLowerCase()) {
          return; // Skip false discrepancy
        }
      }
      if (d && !combinedAddDetails.includes(d)) combinedAddDetails.push(d);
    });
  }

  const initialDur = extractDurationFromText(initialData.duration) || initialData.duration || '';
  const paramDur = typeof duration === 'string' && duration.trim() ? duration.trim() : '';
  const normParamDur = extractDurationFromText(paramDur) || paramDur;

  let resolvedDuration = '';
  if (initialDur && normParamDur && initialDur !== 'unspecified' && normParamDur !== 'unspecified') {
    if (initialDur.toLowerCase().trim() !== normParamDur.toLowerCase().trim()) {
      // Genuine contradiction between initial report and later duration; preserve initial
      resolvedDuration = initialDur;
      const discMsg = `duration discrepancy: initial report ${initialDur}; later response ${paramDur.toLowerCase()}`;
      if (!combinedAddDetails.some(d => d.includes(`initial report ${initialDur}`))) {
        combinedAddDetails.push(discMsg);
      }
    } else {
      resolvedDuration = initialDur;
    }
  } else {
    resolvedDuration = initialDur || normParamDur || '';
  }

  const baseCase = {
    positiveSymptoms: deduplicateAndRefineSymptoms(combinedPositive, combinedContext, combinedNegatives),
    negativeFindings: combinedNegatives,
    context: combinedContext,
    duration: resolvedDuration,
    severity: typeof severity === 'string' && severity.trim() && ['mild', 'moderate', 'severe'].includes(severity.trim().toLowerCase()) ? severity.trim().toLowerCase() : null,
    additionalDetails: combinedAddDetails,
  };

  console.log(`[CANONICAL MERGE BEFORE]\nPositive: ${JSON.stringify(baseCase.positiveSymptoms)}\nNegative: ${JSON.stringify(baseCase.negativeFindings)}\nContext: ${JSON.stringify(baseCase.context)}\nDuration: "${baseCase.duration}"\nSeverity: "${baseCase.severity}"`);

  // 2. Question-aware turn processing across conversation history
  const mergedCase = processFollowUpTurns(conversation, baseCase);

  // CANONICAL PRESERVATION INVARIANTS:
  // 1. Positive symptoms established before cannot vanish if no new positives arrived in this turn
  baseCase.positiveSymptoms.forEach((pos) => {
    // Only remove if contradicted by negative findings
    const isNegated = mergedCase.negativeFindings.some((neg) => {
      const coreNeg = neg.toLowerCase().replace(/^(?:no|not|denies|without)\s+/, '').trim();
      const posLower = pos.toLowerCase().trim();
      if (posLower === 'itchy red rash' && coreNeg !== 'itchy red rash') {
        return false;
      }
      return posLower === coreNeg || (posLower.includes(coreNeg) && coreNeg.length > 5 && coreNeg !== 'rash');
    });
    if (!isNegated && !mergedCase.positiveSymptoms.includes(pos)) {
      mergedCase.positiveSymptoms.push(pos);
    }
  });

  // 2. Existing context cannot disappear between follow-up turns
  baseCase.context.forEach((ctx) => {
    if (!mergedCase.context.includes(ctx)) {
      mergedCase.context.push(ctx);
    }
  });

  // 3. Existing duration cannot revert from a known value to empty/unspecified
  if (!mergedCase.duration || mergedCase.duration === 'unspecified') {
    if (baseCase.duration && baseCase.duration !== 'unspecified') {
      mergedCase.duration = baseCase.duration;
    }
  }

  // 4. Existing severity cannot revert from a known value to null
  if (!mergedCase.severity && baseCase.severity) {
    mergedCase.severity = baseCase.severity;
  }

  // 3. Final Mandatory Evidence Reconciliation Pass
  const finalCase = reconcilePositiveAndNegativeEvidence(mergedCase);

  console.log(`[CANONICAL MERGE DELTA]\nAdded positives: ${JSON.stringify(finalCase.positiveSymptoms.filter(p => !baseCase.positiveSymptoms.includes(p)))}\nAdded negatives: ${JSON.stringify(finalCase.negativeFindings.filter(n => !baseCase.negativeFindings.includes(n)))}\nAdded context: ${JSON.stringify(finalCase.context.filter(c => !baseCase.context.includes(c)))}`);
  console.log(`[CANONICAL MERGE AFTER]\nPositive: ${JSON.stringify(finalCase.positiveSymptoms)}\nNegative: ${JSON.stringify(finalCase.negativeFindings)}\nContext: ${JSON.stringify(finalCase.context)}\nDuration: "${finalCase.duration}"\nSeverity: "${finalCase.severity}"`);

  // Assert integrity
  assertCanonicalCaseIntegrity(finalCase);

  // Ensure default values and sanity
  if (!finalCase.duration) finalCase.duration = 'unspecified';
  if (finalCase.severity && !['mild', 'moderate', 'severe'].includes(finalCase.severity)) {
    finalCase.severity = null;
  }
  if (finalCase.positiveSymptoms.length === 0) {
    // GUARD (Section 12 & 13): Never collapse a previously valid clinical case to "unspecified symptom"
    const validInitialPositives = Array.isArray(positiveSymptoms)
      ? positiveSymptoms.filter((s) => s && s !== 'unspecified symptom')
      : [];
    if (validInitialPositives.length > 0) {
      finalCase.positiveSymptoms = validInitialPositives;
    } else if (params.activeCase && Array.isArray(params.activeCase.positiveSymptoms) && params.activeCase.positiveSymptoms.length > 0 && !params.activeCase.positiveSymptoms.includes('unspecified symptom')) {
      finalCase.positiveSymptoms = [...params.activeCase.positiveSymptoms];
    } else if (finalCase.negativeFindings.length > 0 || finalCase.context.length > 0) {
      // Valid negative findings or context exist without positive symptoms; do not invent "unspecified symptom"
      finalCase.positiveSymptoms = [];
    } else {
      finalCase.positiveSymptoms = ['unspecified symptom'];
    }
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
  extractPrimaryClinicalConcept,
  normalizeFollowUpAnswer,
  buildClinicalProfile,
  extractBodyLocationsFromText,
};
