import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/module/index.js";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-openrouter-key, x-openrouter-model",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let db: any = null;
  let analysis_id: any = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    db = createClient(supabaseUrl, supabaseKey);

    const openrouterKey = req.headers.get("x-openrouter-key") || Deno.env.get("OPENROUTER_API_KEY");
    const model = req.headers.get("x-openrouter-model") || "meta-llama/llama-3.1-8b-instruct:free";

    if (!openrouterKey) {
      return new Response(JSON.stringify({ error: "OpenRouter API key not configured." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate Supabase env presence
    if (!supabaseUrl || !supabaseKey) {
      const msg = 'Supabase function env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) not configured.';
      try { if (analysis_id) await db.from('analyses').update({ status: 'failed', error_message: msg }).eq('id', analysis_id); } catch (_) {}
      return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const candidate_id = body.candidate_id;
    analysis_id = body.analysis_id;
    if (!candidate_id || !analysis_id) {
      return new Response(JSON.stringify({ error: "candidate_id and analysis_id are required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: candidate } = await db.from("candidates").select("*").eq("id", candidate_id).maybeSingle();
    if (!candidate) {
      return new Response(JSON.stringify({ error: "Candidate not found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": supabaseUrl,
            "X-Title": "Resume Intelligence Auditor",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
            max_tokens: 2000,
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`OpenRouter error ${res.status}: ${err}`);
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Mark analysis as failed so frontend sees a terminal state instead of "stuck"
        try {
          await db.from("analyses").update({ status: "failed", error_message: `LLM error: ${msg}` }).eq("id", analysis_id);
        } catch (updateErr) {
          // ignore update errors
        }
        throw e;
      }
    }

    function parseJSON(raw: string): unknown {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const cleaned = (match ? match[1] : raw).trim();
      try {
        return JSON.parse(cleaned);
      } catch {
        // Try extracting first {...} or [...]
        const obj = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (obj) {
          try { return JSON.parse(obj[1]); } catch { /* ignore */ }
        }
        return { raw: cleaned };
      }
    }

    async function markStep(stepName: string) {
      try {
        const { data: cur } = await db.from("analyses").select("workflow_steps").eq("id", analysis_id).maybeSingle();
        let steps: string[] = [];
        const raw = cur?.workflow_steps;
        if (Array.isArray(raw)) steps = raw as string[];
        else if (typeof raw === 'string') {
          try { steps = JSON.parse(raw); } catch { steps = []; }
        } else if (raw == null) steps = [];
        else if (typeof raw === 'object') {
          // sometimes JSONB comes through as object
          try { steps = raw as string[]; } catch { steps = [] }
        }
        steps.push(stepName);
        const res = await db.from("analyses").update({ workflow_steps: steps }).eq("id", analysis_id).select().maybeSingle();
        try { console.log('markStep:', stepName, 'updated:', !!res); } catch (_) {}
      } catch (e) {
        // Log but don't crash the whole function for a step update error
        try { console.error('markStep error', e); } catch (_) {}
      }
    }

    // ── Step 1: Parse Resume ──────────────────────────────────────────────────
    try { console.log('step: parse_resume - calling LLM'); } catch(_) {}
    const parsedResumeRaw = await callLLM(
      "You are a resume parser. Extract structured information from resumes. Always respond with valid JSON only, no markdown.",
      `Parse this resume and return a JSON object with these keys:
- skills: array of skill strings
- experience: array of objects { company, role, duration, highlights: string[] }
- education: array of objects { institution, degree, year }
- projects: array of objects { name, description, technologies: string[] }
- certifications: array of strings
- employment_gaps: array of strings describing any gaps

Resume:
${candidate.resume_text}`
    );
    const parsedResume = parseJSON(parsedResumeRaw);
    try { console.log('parsedResume type:', typeof parsedResume); } catch(_) {}
    await markStep("parse_resume");
    try {
      const r = await db.from('analyses').update({ parsed_resume: parsedResume }).eq('id', analysis_id).select().maybeSingle();
      try { console.log('persist parsed_resume ok=', !!r); } catch(_) {}
    } catch (e) { try { console.error('persist parsed_resume error', e); } catch(_) {} }

    // ── Step 2: Parse Job Description ─────────────────────────────────────────
    try { console.log('step: parse_jd - calling LLM'); } catch(_) {}
    const parsedJDRaw = await callLLM(
      "You are a job description parser. Extract structured requirements. Always respond with valid JSON only, no markdown.",
      `Parse this job description and return a JSON object with these keys:
- required_skills: array of strings
- preferred_skills: array of strings
- experience_requirements: array of strings
- responsibilities: array of strings
- title: string

Job Description:
${candidate.job_description}`
    );
    const parsedJD = parseJSON(parsedJDRaw);
    try { console.log('parsedJD type:', typeof parsedJD); } catch(_) {}
    await markStep("parse_jd");
    try {
      const r = await db.from('analyses').update({ parsed_jd: parsedJD }).eq('id', analysis_id).select().maybeSingle();
      try { console.log('persist parsed_jd ok=', !!r); } catch(_) {}
    } catch (e) { try { console.error('persist parsed_jd error', e); } catch(_) {} }

    // ── Step 3 & 4: Extract Requirements and Evidence ──────────────────────────
    await markStep("extract_requirements");
    await markStep("extract_evidence");

    // ── Step 5: Coverage Matrix ───────────────────────────────────────────────
    try { console.log('step: match_evidence - evaluating coverage'); } catch(_) {}

    // Normalize texts and short-circuit when resume and JD text are identical,
    // to ensure exact matches yield full coverage instead of relying on the LLM output.
    function normalizeText(t: any) {
      if (!t) return '';
      return String(t).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const rawResume = normalizeText(candidate.resume_text);
    const rawJD = normalizeText(candidate.job_description);

    let coverageMatrix: any = null;

    if (rawResume && rawJD && rawResume === rawJD) {
      try { console.log('Exact text match between resume and job description — short-circuiting coverage to 100%'); } catch(_) {}
      // Build jd terms from parsedJD.required_skills if available, otherwise from the normalized JD
      let jdTerms: string[] = [];
      try {
        if (parsedJD && Array.isArray((parsedJD as any).required_skills) && (parsedJD as any).required_skills.length > 0) {
          jdTerms = (parsedJD as any).required_skills.map((s: any) => String(s).toLowerCase()).filter((x: string) => x.length > 0);
        } else {
          jdTerms = rawJD.split(' ').filter(Boolean);
        }
      } catch (_) { jdTerms = rawJD.split(' ').filter(Boolean); }

      const matched = jdTerms.map(t => ({ requirement: t, evidence: `Exact match: ${t}` }));
      coverageMatrix = { matched, partial: [], missing: [] };
      await markStep("match_evidence");
      try {
        const r = await db.from('analyses').update({ coverage_matrix: coverageMatrix }).eq('id', analysis_id).select().maybeSingle();
        try { console.log('persist coverage_matrix ok=', !!r); } catch(_) {}
      } catch (e) { try { console.error('persist coverage_matrix error', e); } catch(_) {} }
    } else {
      try { console.log('step: match_evidence - calling LLM'); } catch(_) {}
      const coverageRaw = await callLLM(
        "You are a resume-to-job matcher. Analyze how well a candidate's resume satisfies job requirements. Always respond with valid JSON only, no markdown.",
        `Given the job requirements and candidate evidence below, produce a coverage matrix.

Return a JSON object with:
- matched: array of objects { requirement: string, evidence: string }
- partial: array of objects { requirement: string, evidence: string, reason: string }
- missing: array of objects { requirement: string, reason: string }

Job Requirements (parsed):
${JSON.stringify(parsedJD, null, 2)}

Candidate Resume (parsed):
${JSON.stringify(parsedResume, null, 2)}`
      );
      coverageMatrix = parseJSON(coverageRaw);
      try { console.log('coverageMatrix type:', typeof coverageMatrix); } catch(_) {}
      await markStep("match_evidence");
      try {
        const r = await db.from('analyses').update({ coverage_matrix: coverageMatrix }).eq('id', analysis_id).select().maybeSingle();
        try { console.log('persist coverage_matrix ok=', !!r); } catch(_) {}
      } catch (e) { try { console.error('persist coverage_matrix error', e); } catch(_) {} }
    }

    // ── Step 6: Risk Analysis ─────────────────────────────────────────────────
    try { console.log('step: detect_risks - calling LLM'); } catch(_) {}
    const riskRaw = await callLLM(
      "You are a resume risk analyst. Identify red flags and weaknesses in resumes. Always respond with valid JSON only, no markdown.",
      `Analyze this resume for risks and red flags.

Return a JSON object with:
- summary: string (1–2 sentence overview)
- items: array of objects { type: string, severity: "high"|"medium"|"low", description: string, recommendation: string }

Look for: employment gaps, generic/vague achievements, weak impact statements, missing quantified results, missing project details, job hopping, credential gaps.

Resume:
${candidate.resume_text}

Parsed Data:
${JSON.stringify(parsedResume, null, 2)}`
    );
    const riskAnalysis = parseJSON(riskRaw);
    try { console.log('riskAnalysis type:', typeof riskAnalysis); } catch(_) {}
    await markStep("detect_risks");
    try {
      const r = await db.from('analyses').update({ risk_analysis: riskAnalysis }).eq('id', analysis_id).select().maybeSingle();
      try { console.log('persist risk_analysis ok=', !!r); } catch(_) {}
    } catch (e) { try { console.error('persist risk_analysis error', e); } catch(_) {} }

    // ── Step 7: Interview Questions ───────────────────────────────────────────
    try { console.log('step: generate_questions - calling LLM'); } catch(_) {}
    const questionsRaw = await callLLM(
      "You are an interview preparation expert. Generate targeted interview questions. Always respond with valid JSON only, no markdown.",
      `Generate interview questions for this candidate applying to this role.

Return a JSON object with:
- verification_questions: array of objects { question: string, rationale: string } — to verify claims in the resume
- missing_information_questions: array of objects { question: string, rationale: string } — to fill gaps not covered in the resume

Coverage Matrix (what's missing):
${JSON.stringify(coverageMatrix, null, 2)}

Resume Summary:
${JSON.stringify(parsedResume, null, 2)}`
    );
    const interviewQuestions = parseJSON(questionsRaw);
    try { console.log('interviewQuestions type:', typeof interviewQuestions); } catch(_) {}
    await markStep("generate_questions");
    try {
      const r = await db.from('analyses').update({ interview_questions: interviewQuestions }).eq('id', analysis_id).select().maybeSingle();
      try { console.log('persist interview_questions ok=', !!r); } catch(_) {}
    } catch (e) { try { console.error('persist interview_questions error', e); } catch(_) {} }

    // ── Step 8: Improvement Suggestions ───────────────────────────────────────
    try { console.log('step: improvement_suggestions - calling LLM'); } catch(_) {}
    const suggestionsRaw = await callLLM(
      "You are a resume coach. Provide specific, actionable resume improvement advice. Always respond with valid JSON only, no markdown.",
      `Provide improvement suggestions for this resume targeting the given job description.

Return a JSON object with:
- summary: string
- items: array of objects { category: string, priority: "high"|"medium"|"low", suggestion: string, example: string }

Risk Analysis:
${JSON.stringify(riskAnalysis, null, 2)}

Missing Requirements:
${JSON.stringify((coverageMatrix as any).missing || [], null, 2)}`
    );
    const improvementSuggestions = parseJSON(suggestionsRaw);
    try { console.log('improvementSuggestions type:', typeof improvementSuggestions); } catch(_) {}
    try {
      const r = await db.from('analyses').update({ improvement_suggestions: improvementSuggestions }).eq('id', analysis_id).select().maybeSingle();
      try { console.log('persist improvement_suggestions ok=', !!r); } catch(_) {}
    } catch (e) { try { console.error('persist improvement_suggestions error', e); } catch(_) {} }
    // ── Step 8: Hiring Recommendation ─────────────────────────────────────────
    try { console.log('step: generate_recommendation - calling LLM'); } catch(_) {}
    const recRaw = await callLLM(
      "You are a senior recruiter making hiring decisions. Be analytical and evidence-based. Always respond with valid JSON only, no markdown.",
      `Make a hiring recommendation for this candidate.

Return a JSON object with:
- verdict: one of "Strong Hire", "Hire", "Consider", "Reject"
- confidence: number 0–100 (your confidence in this verdict)
- reasoning: string (2–4 sentence explanation)
- supporting_evidence: array of strings (top reasons they are a fit)
- missing_evidence: array of strings (top reasons they are not a fit)

Coverage Matrix:
${JSON.stringify(coverageMatrix, null, 2)}

Risk Analysis Summary: ${(riskAnalysis as any).summary || ""}

Job Requirements:
${JSON.stringify(parsedJD, null, 2)}`
    );
    const recommendation = parseJSON(recRaw);
    const confidenceScore = (recommendation as any).confidence ?? null;
    await markStep("generate_recommendation");

    // ── Persist results ───────────────────────────────────────────────────────
    await db.from("analyses").update({
      status: "completed",
      parsed_resume: parsedResume,
      parsed_jd: parsedJD,
      coverage_matrix: coverageMatrix,
      risk_analysis: riskAnalysis,
      interview_questions: interviewQuestions,
      improvement_suggestions: improvementSuggestions,
      recommendation,
      confidence_score: confidenceScore,
    }).eq("id", analysis_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Ensure the analysis is marked failed in the DB so UI doesn't remain stuck
    try {
      // analysis_id may not be defined if the error occurs before parsing body
      if (typeof analysis_id !== 'undefined' && analysis_id) {
        await db.from("analyses").update({ status: "failed", error_message: msg }).eq("id", analysis_id);
      }
    } catch (updateErr) {
      // ignore
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
