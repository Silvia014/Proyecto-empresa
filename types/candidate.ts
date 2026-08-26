export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  position: string;
  status: string;
  stage: string;
  linkedin_url?: string;
  cv_url?: string;
  experience_years?: number;
}

export interface CandidatesResponse {
  total: number;
  page: number;
  limit: number;
  data: Candidate[];
}

//Estructuras de la API

export interface CreateCandidateRequest {
  full_name: string;
  email: string;
  phone: string;
  position: string;
  linkedin_url?: string;
  cv_url?: string;
  experience_years?: number;
}

export interface UpdateCandidateRequest {
  full_name?: string;
  email?: string;
  phone?: string;
  position?: string;
  linkedin_url?: string;
  cv_url?: string;
  experience_years?: number;
}

export interface UpdateCandidateStatusRequest {
  status?: string;
  stage?: string;
}