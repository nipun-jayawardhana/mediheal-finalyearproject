export type RiskLevel = 'low' | 'medium' | 'high';
export type SeverityLevel = 'mild' | 'moderate' | 'severe';

export interface SymptomAnalysisRequest {
  symptoms: string[];
  duration?: string;
  severity?: SeverityLevel;
  analysisRequestId?: string;
}

export interface PossibleConditionItem {
  condition: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface SymptomAnalysisResult {
  symptomCheckId: string;
  symptoms: string[];
  possibleCondition: string;
  possibleConditions?: PossibleConditionItem[];
  analysisSource?: 'openbiollm' | 'rule-based-fallback' | 'rule-based-emergency';
  modelName?: string;
  riskLevel: RiskLevel;
  recommendedSpecialist: string;
  guidance: string[];
  matchedSymptoms: string[];
  emergencyRecommended: boolean;
  disclaimer: string;
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
  duration?: string;
  severity: SeverityLevel;
  possibleCondition: string;
  possibleConditions?: PossibleConditionItem[];
  analysisSource?: 'openbiollm' | 'rule-based-fallback' | 'rule-based-emergency';
  modelName?: string;
  riskLevel: RiskLevel;
  recommendedSpecialist: string;
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
}

export interface SymptomSummaryData {
  symptoms: string[];
  duration: string;
  severity: SeverityLevel;
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

