import type {
  Candidate,
  CandidatesResponse,
  CreateCandidateRequest,
  UpdateCandidateRequest,
  UpdateCandidateStatusRequest
} from "../types/candidate";

const API_URL = "https://playground.4geeks.com/tracker/api/v1";

export async function getCandidates(): Promise<Candidate[]> {
  const response = await fetch(`${API_URL}/records`);

  if (!response.ok) {
    throw new Error(
      `No se pudieron cargar las candidaturas. Código: ${response.status}`
    );
  }

  const result: CandidatesResponse = await response.json();

  return result.data;
}

export async function createCandidate(
  candidate: CreateCandidateRequest
): Promise<Candidate> {
  const response = await fetch(`${API_URL}/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(candidate)
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo crear la candidatura. Código: ${response.status}`
    );
  }

  const result: { data: Candidate } = await response.json();
  return result.data;
}

export async function updateCandidate(
  id: string,
  candidate: UpdateCandidateRequest
): Promise<Candidate> {
  const response = await fetch(`${API_URL}/records/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(candidate)
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo actualizar la candidatura. Código: ${response.status}`
    );
  }

  const result: { data: Candidate } = await response.json();
  return result.data;
}

export async function updateCandidateStatus(
  id: string,
  status: UpdateCandidateStatusRequest
): Promise<Candidate> {
  const response = await fetch(`${API_URL}/records/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(status)
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo actualizar el estado de la candidatura. Código: ${response.status}`
    );
  }

  const result: { data: Candidate } = await response.json();
  return result.data;
}