import { Request, Response } from 'express';

function summarizeCoverage(matrix: any) {
  const matched = (matrix?.matched || []).length;
  const partial = (matrix?.partial || []).length;
  const missing = (matrix?.missing || []).length;
  const total = matched + partial + missing;
  const pct = total > 0 ? Math.round(((matched + partial * 0.5) / total) * 100) : 0;
  return { matched, partial, missing, total, pct };
}

function topMissing(matrix: any, limit = 3) {
  const missing = matrix?.missing || [];
  return missing.slice(0, limit).map((m: any) => m.requirement || String(m));
}

export async function generateNotesHandler(req: Request, res: Response) {
  try {
    const analysis = req.body.analysis || req.body;
    if (!analysis) return res.status(400).json({ error: 'analysis object required in body' });

    const cov = summarizeCoverage(analysis.coverage_matrix);
    const topMiss = topMissing(analysis.coverage_matrix, 5);
    const verdict = analysis.recommendation?.verdict || 'No verdict';

    const objective = `Objective: ${verdict} — ${cov.pct}% coverage of JD requirements.`;
    const concise = cov.pct >= 70 ? 'Candidate meets most requirements; recommend progressing to interview.' : cov.pct >= 40 ? 'Candidate shows some fit; consider targeted interview questions.' : 'Candidate has notable gaps; consider other candidates or request clarification.';

    const actions: string[] = [];
    if (topMiss.length) {
      actions.push(`Ask candidate to provide examples for: ${topMiss.join(', ')}.`);
      actions.push('Request concrete metrics or outcomes for projects listed (impact, scale, results).');
    }
    if ((analysis.risk_analysis?.items || []).length) {
      actions.push('Probe identified risks with targeted interview questions.');
    }
    if (!actions.length) actions.push('No immediate actions; validate during interview.');

    const fullNote = `[AUTO] Analysis ${analysis.id || 'unknown'}\n${objective}\n${concise}\nActions:\n- ${actions.join('\n- ')}`;

    return res.json({ objective, concise, actions, full_note: fullNote });
  } catch (err: any) {
    console.error('generateNotes error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
