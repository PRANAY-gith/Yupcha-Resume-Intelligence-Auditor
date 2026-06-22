#!/usr/bin/env node
/*
Simulate the 8-step analysis workflow by updating the `analyses` row
in your Supabase project. Useful for testing the frontend progress UI
without calling the real Edge Function or LLM.

Usage:
  SUPABASE_URL=https://xyz.supabase.co SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/simulate-workflow.js --analysis <analysis_id>
  OR
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/simulate-workflow.js --candidate <candidate_id>

The script will create an `analyses` row (if --candidate) or use the provided
analysis id, then append the eight workflow steps with a short delay.
*/

const args = process.argv.slice(2);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Support a dry-run mode that doesn't require Supabase credentials
const isDry = args.includes('--dry');
if (!isDry && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env unless --dry is used');
  process.exit(1);
}

function usage() {
  console.log('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/simulate-workflow.js --analysis <id>');
  console.log('   or: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/simulate-workflow.js --candidate <candidate_id>');
}

let analysisId = null;
let candidateId = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--analysis') analysisId = args[i+1], i++;
  else if (args[i] === '--candidate') candidateId = args[i+1], i++;
}

if (!analysisId && !candidateId) {
  usage();
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: 'return=representation',
};

async function rest(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...headers, ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) throw new Error(`REST ${res.status} ${text}`);
  return data;
}

async function createAnalysisForCandidate(cid) {
  const body = { candidate_id: cid, status: 'processing', workflow_steps: [] };
  const created = await rest('analyses', { method: 'POST', body: JSON.stringify(body) });
  if (!created || !created[0] || !created[0].id) throw new Error('Failed to create analysis');
  return created[0].id;
}

async function getAnalysis(aid) {
  const q = `analyses?id=eq.${aid}`;
  const rows = await rest(q + '&select=*');
  return (rows && rows[0]) || null;
}

async function patchAnalysis(aid, patch) {
  const q = `analyses?id=eq.${aid}`;
  const res = await rest(q, { method: 'PATCH', body: JSON.stringify(patch) });
  return res && res[0];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const STEPS = [
  'parse_resume',
  'parse_jd',
  'extract_requirements',
  'extract_evidence',
  'match_evidence',
  'detect_risks',
  'generate_questions',
  'generate_recommendation',
];

(async () => {
  try {
    if (isDry) {
      console.log('DRY RUN: Simulating workflow for', analysisId || candidateId);
      for (let i = 0; i < STEPS.length; i++) {
        console.log(`[dry] step ${i+1}/${STEPS.length}: ${STEPS[i]}`);
        await sleep(800);
      }
      console.log('[dry] marking analysis completed');
      console.log('DRY RUN complete');
      return;
    }

    if (!analysisId) {
      console.log('Creating analysis for candidate', candidateId);
      analysisId = await createAnalysisForCandidate(candidateId);
      console.log('Created analysis id', analysisId);
    } else {
      console.log('Using analysis id', analysisId);
      const a = await getAnalysis(analysisId);
      if (!a) throw new Error('analysis id not found');
    }

    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i];
      console.log('Appending step:', step);
      // fetch current steps
      const cur = await getAnalysis(analysisId);
      let steps = [];
      if (Array.isArray(cur.workflow_steps)) steps = cur.workflow_steps;
      else if (typeof cur.workflow_steps === 'string') {
        try { steps = JSON.parse(cur.workflow_steps); } catch { steps = []; }
      }
      steps.push(step);
      await patchAnalysis(analysisId, { workflow_steps: steps });
      // wait a bit so UI polling can pick it up
      await sleep(1200);
    }

    console.log('Marking analysis completed');
    await patchAnalysis(analysisId, { status: 'completed', confidence_score: 85 });
    console.log('Done');
  } catch (err) {
    console.error('Simulator error:', err);
    process.exit(2);
  }
})();
