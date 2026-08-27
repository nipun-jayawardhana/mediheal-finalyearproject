export type RiskLevel = 'low' | 'medium' | 'high';
export type SeverityLevel = 'mild' | 'moderate' | 'severe';

export interface SymptomAnalysisRequest {
  symptoms: string[];
  duration?: string;
  severity?: SeverityLevel | null;
  positiveSymptoms?: string[];
  negativeFindings?: string[];
  context?: string[];
  additionalDetails?: string[];
  conversation?: SymptomConversationTurn[];
  analysisRequestId?: string;
  language?: string;
}

export interface PossibleConditionItem {
  condition: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface SymptomAnalysisResult {
  symptomCheckId: string;
  symptoms: string[];
  positiveSymptoms?: string[];
  negativeFindings?: string[];
  context?: string[];
  additionalDetails?: string[];
  possibleCondition: string;
  possibleConditions?: PossibleConditionItem[];
  analysisSource?: 'openbiollm' | 'rule-based-fallback' | 'rule-based-emergency';
  modelName?: string;
  riskLevel: RiskLevel;
  recommendedSpecialist: string;
  displayRecommendedSpecialist?: string;
  guidance: string[];
  matchedSymptoms: string[];
  emergencyRecommended: boolean;
  disclaimer: string;
  emergencyWarning?: string;
  createdAt: string;
}

export interface SymptomAnalysisResponse {
  success: boolean;
  message: string;
  analysis: SymptomAnalysisResult;
}

export interface SymptomCheckRecord {
  _id: string;
  patientId: string;
  symptoms: string[];
  positiveSymptoms?: string[];
  negativeFindings?: string[];
  context?: string[];
  additionalDetails?: string[];
  duration?: string;
  severity?: SeverityLevel | null;
  possibleCondition: string;
  possibleConditions?: PossibleConditionItem[];
  analysisSource?: 'openbiollm' | 'gemini-secondary' | 'rule-based-fallback' | 'rule-based-emergency';
  modelName?: string;
  riskLevel: RiskLevel;
  recommendedSpecialist: string;
  displayRecommendedSpecialist?: string;
  guidance: string[];
  matchedSymptoms: string[];
  emergencyRecommended: boolean;
  disclaimer: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SymptomHistoryResponse {
  success: boolean;
  count: number;
  data: SymptomCheckRecord[];
}

export interface SymptomCheckDetailResponse {
  success: boolean;
  data: SymptomCheckRecord;
}

export interface SymptomConversationTurn {
  question: string;
  answer: string;
}

export interface SymptomFollowUpRequest {
  symptoms: string[];
  conversation: SymptomConversationTurn[];
  questionCount: number;
  language?: string;
}

export interface SymptomSummaryData {
  symptoms: string[];
  positiveSymptoms?: string[];
  negativeFindings?: string[];
  context?: string[];
  additionalDetails?: string[];
  duration: string;
  severity: SeverityLevel | null;
  additionalContext: string[];
}

export interface SymptomFollowUpResponseData {
  status: 'ask' | 'complete' | 'emergency';
  question?: string;
  field?: string;
  quickOptions?: string[];
  summary?: SymptomSummaryData;
  isEmergency?: boolean;
  emergencyWarning?: string;
}

export interface SymptomFollowUpResponse {
  success: boolean;
  data: SymptomFollowUpResponseData;
}

