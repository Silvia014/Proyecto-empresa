import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

type AgentResponse = {
  answer?: unknown;
  detail?: unknown;
  error?: unknown;
  run_id?: unknown;
  status?: unknown;
  trace?: unknown;
};

function apiBase() {
  const configured = process.env.RAG_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return process.env.NODE_ENV === "development" ? "http://localhost:8000" : "";
}

export async function POST(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;

  if (!canAccess(actor.role, "knowledge")) {
    return NextResponse.json(
      { error: "You do not have access to the knowledge assistant." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question || question.length > 2000) {
    return NextResponse.json(
      { error: "Enter a question between 1 and 2,000 characters." },
      { status: 400 },
    );
  }

  const base = apiBase();
  if (!base) {
    return NextResponse.json(
      { error: "The knowledge service is not configured. Set RAG_API_URL to the deployed FastAPI service." },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const response = await fetch(`${base}/agent/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify({ question }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    const result = await response.json().catch(() => null) as AgentResponse | null;

    if (!response.ok) {
      const detail = typeof result?.error === "string"
        ? result.error
        : typeof result?.detail === "string"
          ? result.detail
          : "The knowledge assistant is temporarily unavailable.";

      return NextResponse.json(
        {
          error: detail,
          run_id: typeof result?.run_id === "string" ? result.run_id : null,
          status: typeof result?.status === "string" ? result.status : null,
          trace: Array.isArray(result?.trace) ? result.trace : [],
        },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    if (
      typeof result?.answer !== "string"
      || !result.answer.trim()
      || typeof result.run_id !== "string"
      || !Array.isArray(result.trace)
    ) {
      return NextResponse.json(
        { error: "The knowledge assistant returned an invalid response." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        answer: result.answer,
        run_id: result.run_id,
        status: typeof result.status === "string" ? result.status : "success",
        trace: result.trace,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Knowledge query error:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "The knowledge assistant is temporarily unavailable." },
      { status: 502 },
    );
  }
}
