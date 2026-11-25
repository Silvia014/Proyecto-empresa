"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type TraceEvent = {
  step?: number;
  node?: string;
  status?: string;
  details?: { chunks_found?: number; sources?: string[] };
  next?: string[];
};

type KnowledgeResponse = {
  answer: string;
  run_id: string;
  status: string;
  trace: TraceEvent[];
};

type KnowledgeError = {
  error?: string;
  detail?: string;
  run_id?: string | null;
  trace?: TraceEvent[];
};

export default function KnowledgeAssistant({
  embedded = false,
  onAnswer,
}: {
  embedded?: boolean;
  onAnswer?: (question: string, answer: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [runId, setRunId] = useState("");
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedQuestion = question.trim();
    if (!cleanedQuestion || loading) return;

    setLoading(true);
    setAnswer("");
    setRunId("");
    setTrace([]);
    setError("");

    try {
      const supabase = createClient();
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error("Sign in again to use the knowledge assistant.");
      }

      const response = await fetch("/api/knowledge/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ question: cleanedQuestion }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as KnowledgeError | null;
        if (body?.run_id) setRunId(body.run_id);
        if (Array.isArray(body?.trace)) setTrace(body.trace);
        throw new Error(
          body?.error || body?.detail || `The assistant returned HTTP ${response.status}.`,
        );
      }

      const data = await response.json() as KnowledgeResponse;
      if (!data.answer?.trim() || !data.run_id || !Array.isArray(data.trace)) {
        throw new Error("The assistant returned an invalid response.");
      }

      setAnswer(data.answer);
      setRunId(data.run_id);
      setTrace(data.trace);
      onAnswer?.(cleanedQuestion, data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the knowledge assistant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={embedded ? "text-slate-900 dark:text-slate-100" : "min-h-screen bg-[#f5f0e8] px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6"}>
      <section className={embedded ? "max-w-3xl" : "mx-auto max-w-3xl"}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6a52]">
          Brasaland · Executive knowledge
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-[#5a1f2b] dark:text-rose-200">
          Ask the knowledge base
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Ask about Brasaland&apos;s documented policies and procedures. Answers are generated from relevant source documents.
        </p>

        <form onSubmit={ask} className="mt-8 space-y-3 rounded-2xl border border-[#d8c9b5] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <label htmlFor="knowledge-question" className="block text-sm font-semibold">
            Your question
          </label>
          <textarea
            id="knowledge-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={2000}
            rows={4}
            required
            placeholder="For example: What should a team member do if a guest reports a food allergy?"
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#7d2939] focus:ring-2 focus:ring-[#7d2939]/20 dark:border-slate-600 dark:bg-slate-950"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Answers rely on the indexed Brasaland documents.
            </span>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="rounded-xl bg-[#5a1f2b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#742b3b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Searching documents…" : "Ask"}
            </button>
          </div>
        </form>

        {loading && <p role="status" className="mt-5 text-sm text-slate-600 dark:text-slate-300">Searching documents and preparing an answer…</p>}
        {error && <div role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

        {answer && <section aria-live="polite" className="mt-5 rounded-2xl border border-[#d8c9b5] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-[#5a1f2b] dark:text-rose-200">Answer</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{answer}</p>
        </section>}

        {runId && <details className="mt-4 rounded-xl border border-[#d8c9b5] bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer font-semibold text-[#5a1f2b] dark:text-rose-200">
            Execution trace · {trace.length} steps
          </summary>
          <p className="mt-2 break-all text-xs text-slate-500">Run ID: {runId}</p>
          <ol className="mt-3 space-y-2">
            {trace.map((item, index) => <li key={`${item.step ?? index}-${item.node ?? "node"}`} className="rounded-lg bg-[#fdfaf5] p-3 dark:bg-slate-800">
              <strong>{item.node || "Node"}</strong>
              {item.status && <span> · {item.status}</span>}
              {item.details?.chunks_found !== undefined && <p className="mt-1 text-xs">Chunks retrieved: {item.details.chunks_found}</p>}
              {!!item.details?.sources?.length && <p className="mt-1 text-xs">Sources: {item.details.sources.join(", ")}</p>}
              {!!item.next?.length && <p className="mt-1 text-xs">Next: {item.next.join(", ")}</p>}
            </li>)}
          </ol>
        </details>}
      </section>
    </main>
  );
}