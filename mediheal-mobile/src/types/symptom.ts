export type RiskLevel = 'low' | 'medium' | 'high';
export type SeverityLevel = 'mild' | 'moderate' | 'severe';

export interface SymptomAnalysisRequest {
  symptoms: string[];
  duration?: string;
  severity?: SeverityLevel;
}

export interface SymptomAnalysisResult {
  symptomCheckId: string;
  symptoms: string[];
  possibleCondition: string;
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
