import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, Shield, MessageSquare, Lightbulb, Award,
  Clock, FileText, Target, TrendingUp, CheckCheck, Minus, Edit2,
  User, Mail, Brain, StickyNote, Trash2, ChevronDown, ChevronUp,
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const STEPS = [
  'Parsing resume',
  'Parsing job description',
  'Extracting requirements',
  'Extracting candidate evidence',
  'Matching evidence to requirements',
  'Detecting coverage gaps & risks',
  'Generating interview questions',
  'Generating hiring recommendation',
];

function verdictMeta(verdict) {
  const v = (verdict || '').toLowerCase().replace(/\s+/g, '-');
  return {
    'strong-hire': { label: 'Strong Hire', cls: 'verdict-strong-hire', color: '#14532d', bg: '#f0fdf4' },
    'hire':        { label: 'Hire',         cls: 'verdict-hire',        color: '#065f46', bg: '#ecfdf5' },
    'consider':    { label: 'Consider',     cls: 'verdict-consider',    color: '#78350f', bg: '#fffbeb' },
    'reject':      { label: 'Reject',       cls: 'verdict-reject',      color: '#7f1d1d', bg: '#fef2f2' },
  }[v] || null;
}

function fmtDate(d) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TABS = [
  { id: 'overview',   label: 'Overview',        icon: Target      },
  { id: 'resume',     label: 'Parsed Resume',    icon: FileText    },
  { id: 'coverage',   label: 'Coverage Matrix',  icon: CheckCheck  },
  { id: 'risks',      label: 'Risk Analysis',    icon: Shield      },
  { id: 'interview',  label: 'Interview Prep',   icon: MessageSquare },
  { id: 'suggestions',label: 'Improvements',     icon: Lightbulb   },
  { id: 'notes',      label: 'Recruiter Notes',  icon: StickyNote  },
];

export default function AnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState(null);
  const [analysis,  setAnalysis]  = useState(null);
  const [notes,     setNotes]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [running,   setRunning]   = useState(false);
  const [step,      setStep]      = useState(-1);
  const [error,     setError]     = useState('');
  const [tab,       setTab]       = useState('overview');
  const [note,      setNote]      = useState('');
  const [savingNote,setSavingNote]= useState(false);

  useEffect(() => { loadData(); }, [id]);

  // When analysis becomes completed, ensure auto-generated recruiter note exists
  useEffect(() => {
    if (analysis?.status === 'completed') {
      ensureAutoNote(analysis);
    }
  }, [analysis?.id, analysis?.status]);

  async function loadData() {
    setLoading(true);
    const [{ data: c }, { data: a }, { data: n }] = await Promise.all([
      supabase.from('candidates').select('*').eq('id', id).maybeSingle(),
      supabase.from('analyses').select('*').eq('candidate_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('recruiter_notes').select('*').eq('candidate_id', id).order('created_at', { ascending: false }),
    ]);
    setCandidate(c);
    setAnalysis(a);
    setNotes(n || []);
    setLoading(false);
  }

  // Build recruiter note from analysis (same heuristics as backend endpoint)
  function buildRecruiterNoteLocal(analysisObj) {
    const matrix = analysisObj.coverage_matrix || {};
    const matched = (matrix.matched || []).length;
    const partial = (matrix.partial || []).length;
    const missing = (matrix.missing || []).length;
    const total = matched + partial + missing;
    const pct = total > 0 ? Math.round(((matched + partial * 0.5) / total) * 100) : 0;
    const topMiss = (matrix.missing || []).slice(0, 5).map(m => m.requirement || String(m));
    const verdict = analysisObj.recommendation?.verdict || 'No verdict';

    const objective = `Objective: ${verdict} — ${pct}% coverage of JD requirements.`;
    const concise = pct >= 70 ? 'Candidate meets most requirements; recommend progressing to interview.' : pct >= 40 ? 'Candidate shows some fit; consider targeted interview questions.' : 'Candidate has notable gaps; consider other candidates or request clarification.';

    const actions = [];
    if (topMiss.length) {
      actions.push(`Ask candidate to provide examples for: ${topMiss.join(', ')}.`);
      actions.push('Request concrete metrics or outcomes for projects listed (impact, scale, results).');
    }
    if ((analysisObj.risk_analysis?.items || []).length) {
      actions.push('Probe identified risks with targeted interview questions.');
    }
    if (!actions.length) actions.push('No immediate actions; validate during interview.');

    const fullNote = `[AUTO] Analysis ${analysisObj.id || 'unknown'}\n${objective}\n${concise}\nActions:\n- ${actions.join('\n- ')}`;
    return { objective, concise, actions, full_note: fullNote };
  }

  // Ensure an auto-generated recruiter note exists for this analysis
  async function ensureAutoNote(analysisObj) {
    if (!analysisObj || !candidate) return;
    try {
      // Check existing notes for this candidate for an auto note for this analysis id
      const { data: existing } = await supabase.from('recruiter_notes').select('*').eq('candidate_id', candidate.id);
      const marker = `[AUTO] Analysis ${analysisObj.id}`;
      if (existing && existing.some(n => typeof n.note === 'string' && n.note.includes(marker))) return; // already exists

      // Try backend generator if configured
      let gen = null;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      if (backendUrl) {
        try {
          const res = await fetch(`${backendUrl.replace(/\/$/, '')}/api/v1/notes/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis: analysisObj }),
          });
          if (res.ok) gen = await res.json();
        } catch (e) { gen = null; }
      }

      if (!gen) gen = buildRecruiterNoteLocal(analysisObj);

      // Insert note into supabase
      await supabase.from('recruiter_notes').insert({ candidate_id: candidate.id, note: gen.full_note });
      // Refresh notes list
      const { data: refreshed } = await supabase.from('recruiter_notes').select('*').eq('candidate_id', candidate.id).order('created_at', { ascending: false });
      setNotes(refreshed || []);
    } catch (e) {
      console.warn('ensureAutoNote failed', e);
    }
  }

  async function runAnalysis() {
    const apiKey = localStorage.getItem('openrouter_api_key');
    const model  = localStorage.getItem('openrouter_model') || 'meta-llama/llama-3.1-8b-instruct:free';

    setRunning(true); setError(''); setStep(0);

    let aid;
    try {
      if (analysis) {
        await supabase.from('analyses').update({ status: 'processing', error_message: null, workflow_steps: [] }).eq('id', analysis.id);
        aid = analysis.id;
      } else {
        const { data } = await supabase.from('analyses').insert({ candidate_id: id, status: 'processing' }).select().maybeSingle();
        aid = data.id;
      }

      // Try Edge Function if API key is set
      let edgeFunctionOk = false;
      if (apiKey) {
        try {
          const url  = import.meta.env.VITE_SUPABASE_URL;
          const key  = import.meta.env.VITE_SUPABASE_ANON_KEY;

          // Start polling immediately
          const poll = setInterval(async () => {
            try {
              const { data } = await supabase.from('analyses').select('*').eq('id', aid).maybeSingle();
              if (!data) return;
              setStep((data.workflow_steps || []).length);
              setAnalysis(data);
              if (data.status === 'completed' || data.status === 'failed') {
                clearInterval(poll);
                setRunning(false);
                setStep(-1);
                if (data.status === 'failed') setError(data.error_message || 'Analysis failed.');
                else setTab('overview');
              }
            } catch (_) {}
          }, 1500);

            const useLocalSimulator = import.meta.env.VITE_USE_LOCAL_SIMULATOR === '1';

            if (useLocalSimulator) {
              // run the improved UI simulator (single path) and mark edgeFunctionOk
              edgeFunctionOk = true;
              await runSimulationSteps(aid);
            } else {
              // default: call the deployed Supabase Edge Function and set edgeFunctionOk if request accepted
              try {
                const res = await fetch(`${url}/functions/v1/analyze-resume`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`,
                    'apikey': key,
                    'x-openrouter-key': apiKey,
                    'x-openrouter-model': model,
                  },
                  body: JSON.stringify({ candidate_id: id, analysis_id: aid }),
                });
                if (res.ok) edgeFunctionOk = true;
                else {
                  // if function returns non-OK, clear polling so fallback can run
                  try { clearInterval(poll); } catch (_) {}
                }
              } catch (e) {
                // network/fetch error — leave edgeFunctionOk false so fallback runs
                try { clearInterval(poll); } catch (_) {}
              }
            }
        } catch (_) {
          // fetch itself failed (network error, CORS, function not deployed, etc.)
        }
      }

      // Fallback: run simulation locally if Edge Function wasn't available
      if (!edgeFunctionOk) {
        console.log('Edge Function unavailable or no API key — running simulation mode.');
        await runSimulationSteps(aid);
      }
    } catch (err) {
      setError(err.message);
      setRunning(false); setStep(-1);
      if (aid) await supabase.from('analyses').update({ status: 'failed', error_message: err.message }).eq('id', aid);
    }
  }

  async function runSimulation() {
    setRunning(true); setError(''); setStep(0);
    let aid;
    try {
      if (analysis) {
        await supabase.from('analyses').update({ status: 'processing', error_message: null, workflow_steps: [] }).eq('id', analysis.id);
        aid = analysis.id;
      } else {
        const { data } = await supabase.from('analyses').insert({ candidate_id: id, status: 'processing' }).select().maybeSingle();
        aid = data.id;
      }
      await runSimulationSteps(aid);
    } catch (err) {
      setError(err.message);
      setRunning(false); setStep(-1);
      if (aid) await supabase.from('analyses').update({ status: 'failed', error_message: err.message }).eq('id', aid);
    }
  }

  async function runSimulationSteps(aid) {
    const stepKeys = [
      'parse_resume',
      'parse_jd',
      'extract_requirements',
      'extract_evidence',
      'match_evidence',
      'detect_risks',
      'generate_questions',
      'generate_recommendation',
    ];

    for (let i = 0; i < stepKeys.length; i++) {
      await new Promise(r => setTimeout(r, 1000));
      setStep(i + 1);
      const currentSteps = stepKeys.slice(0, i + 1);
      await supabase.from('analyses').update({ workflow_steps: currentSteps }).eq('id', aid);
    }

    // Build analysis dynamically based on candidate's resume and JD
    const cand = candidate || {};
    const resumeText = (cand.resume_text || '').toLowerCase();
    const jdText = (cand.job_description || '').toLowerCase();

    // New word-level requirement extraction for more consistent scoring.
    function wordsFrom(text) {
      const stop = new Set(['the','and','for','with','that','this','from','have','has','are','was','were','will','would','should','a','an','in','on','of','to','by','as','is','be','or','at','it','its']);
      const clean = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!clean) return [];
      const toks = clean.split(' ').map(t => t.trim()).filter(t => t.length > 2 && !stop.has(t));
      return Array.from(new Set(toks));
    }

    // Try to extract explicit skill/requirement phrases from common JD sections
    function extractSkillPhrases(jd) {
      if (!jd) return [];
      const lines = jd.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const phrases = [];
      let capture = false;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const lower = l.toLowerCase();
        if (lower.startsWith('required skills') || lower.startsWith('required:') || lower.startsWith('required skills:')) {
          capture = 'required';
          continue;
        }
        if (lower.startsWith('preferred skills') || lower.startsWith('preferred:')) {
          capture = 'preferred';
          continue;
        }
        // stop capture when a new section header appears
        if (/^[A-Za-z ]+:$/.test(l) && !l.toLowerCase().includes('skills')) {
          capture = false;
        }
        if (capture) {
          // strip leading bullet markers
          const cleaned = l.replace(/^[-•*\s]+/, '').replace(/\s+\u2022\s+/g, ', ');
          // split comma-separated items if present
          cleaned.split(/[,;]+/).map(s => s.trim()).filter(Boolean).forEach(s => phrases.push(s.toLowerCase()));
        }
      }
      return Array.from(new Set(phrases));
    }

    const jdTerms = (() => {
      const phrases = extractSkillPhrases(jdText);
      if (phrases.length > 0) return phrases;
      return wordsFrom(jdText);
    })();
    const resumeTerms = wordsFrom(resumeText);

    // Lightweight resume section parser to populate parsed_resume fields when possible
    function parseResumeSections(text) {
      const out = { skills: [], experience: [], education: [], certifications: [], projects: [] };
      if (!text) return out;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      // find section indices
      const idx = {};
      lines.forEach((l, i) => {
        const lower = l.toLowerCase();
        if (lower.startsWith('experience')) idx.experience = i;
        if (lower.startsWith('education')) idx.education = i;
        if (lower.startsWith('skills')) idx.skills = i;
        if (lower.startsWith('certifications') || lower.startsWith('certificates')) idx.certifications = i;
        if (lower.startsWith('projects')) idx.projects = i;
      });

      // helper to slice section
      function sectionLines(startKey, endKeys) {
        if (typeof idx[startKey] === 'undefined') return [];
        const start = idx[startKey] + 1;
        let end = lines.length;
        for (const k of endKeys) if (typeof idx[k] !== 'undefined' && idx[k] > idx[startKey]) end = Math.min(end, idx[k]);
        return lines.slice(start, end);
      }

      // skills: split by commas if found
      const skl = sectionLines('skills', ['experience','education','certifications','projects']);
      if (skl.length) {
        out.skills = skl.join(' ').split(/[,:;·•\-\u2022]/).map(s => s.trim()).filter(Boolean);
      }

      // experience: naive grouping by lines that contain years or '–' dash
      const expLines = sectionLines('experience', ['education','skills','certifications','projects']);
      if (expLines.length) {
        // group contiguous lines into entries when encountering a line with a dash or parentheses (dates)
        let cur = null;
        expLines.forEach(l => {
          if (/\b(\d{4})\b/.test(l) || /\b\w+\s*–\s*\w+/u.test(l) || /\(/.test(l)) {
            if (cur) out.experience.push(cur);
            cur = { role: l, company: '', duration: '', highlights: [] };
          } else if (cur && l.startsWith('•')) {
            cur.highlights.push(l.replace(/^•\s*/, ''));
          } else if (cur && !l.startsWith('•')) {
            cur.highlights.push(l);
          } else {
            // fallback to push as role-only
            out.experience.push({ role: l, company: '', duration: '', highlights: [] });
          }
        });
        if (cur) out.experience.push(cur);
      }

      // education
      const eduLines = sectionLines('education', ['experience','skills','certifications','projects']);
      if (eduLines.length) out.education = eduLines.map(l => ({ institution: l, degree: '', year: '' }));

      // certifications
      const certLines = sectionLines('certifications', ['experience','education','skills','projects']);
      if (certLines.length) out.certifications = certLines.map(l => l.replace(/^•\s*/,'').trim());

      // projects
      const projLines = sectionLines('projects', ['experience','education','skills','certifications']);
      if (projLines.length) out.projects = projLines.map(l => ({ name: l.split('—')[0].trim(), description: l }));

      return out;
    }

    const parsedResumeFromText = parseResumeSections(cand.resume_text || '');

    // If resume and JD text are identical (after trimming), treat as perfect coverage
    let matched = [];
    let partial = [];
    let missing = [];
    let pct = 0;
    let skills = [];

    if (jdText.trim() && resumeText.trim() && jdText.trim() === resumeText.trim()) {
      matched = jdTerms.map(t => ({ requirement: t, evidence: `Exact match: ${t}` }));
      partial = [];
      missing = [];
      // set skills to jd terms when exact match
      skills = jdTerms.slice(0, 8);
      pct = 100;
    } else {
      const jdSet = new Set(jdTerms);
      const resumeSet = new Set(resumeTerms);
      jdTerms.forEach(phrase => {
        const pnorm = phrase.toLowerCase();
        if (resumeSet.has(pnorm) || resumeText.includes(pnorm)) {
          matched.push({ requirement: phrase, evidence: `Contains phrase: ${phrase}` });
          return;
        }
        const words = pnorm.split(' ').filter(Boolean);
        let hits = 0; for (const w of words) if (resumeSet.has(w)) hits++;
        if (hits >= words.length) matched.push({ requirement: phrase, evidence: `All words present: ${phrase}` });
        else if (hits > 0) {
          if (words.length >= 2) matched.push({ requirement: phrase, evidence: `${hits}/${words.length} words matched` });
          else partial.push({ requirement: phrase, evidence: `${hits}/${words.length} words matched` });
        } else missing.push({ requirement: phrase, reason: `No match for '${phrase}'` });
      });

      const total = matched.length + partial.length + missing.length;
      const scoreRaw = total > 0 ? ((matched.length + 0.5 * partial.length) / total) * 100 : 0;
      // smaller deterministic jitter based on id to keep some variability but not large swings
      const seed = String(cand.id || aid || '0');
      let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 101;
      const jitter = ((h % 7) - 3) * 0.5;
      pct = Math.max(0, Math.min(100, Math.round(scoreRaw + jitter)));

      // detected skills: reuse small heuristic
      const detectedSkills = jdTerms.filter(t => ['react','node','javascript','python','java','sql','docker','aws','graphql'].includes(t));
      skills = detectedSkills.length ? detectedSkills : jdTerms.slice(0,5);
      // attach skills to parsed resume if not present
      if (!cand.parsed_experience) cand.parsed_experience = [];
      // note: parsed_resume will be built below
    }

    const recVerdict = pct >= 72 ? 'Strong Hire' : pct >= 50 ? 'Hire' : pct >= 30 ? 'Consider' : 'Reject';

    // Build improvement suggestions from missing/partial requirements
    const suggestions = [];
    missing.slice(0,8).forEach(m => {
      suggestions.push({
        category: 'Skills',
        priority: 'high',
        suggestion: `Add concrete examples or projects demonstrating ${m.requirement}`,
        example: `e.g. "Built a feature using ${m.requirement} that improved X by Y%"`,
      });
    });
    partial.slice(0,8).forEach(p => {
      suggestions.push({
        category: 'Detail',
        priority: 'medium',
        suggestion: `Expand bullets to include measurable impact for ${p.requirement}`,
        example: `e.g. "Reduced latency by 30% while working on ${p.requirement}"`,
      });
    });

    const improvementSummary = suggestions.length > 0 ? 'Concrete suggestions to improve resume fit for this role.' : 'Add concrete impact metrics and project details.';

    // Build a more realistic risk analysis for recruiter consumption when coverage < 90%
    function extractRequiredYears(jd) {
      const m = String(jd || '').match(/(\d+)\+?\s+years/mi);
      return m ? parseInt(m[1], 10) : null;
    }
    function extractResumeYears(text) {
      const m = String(text || '').match(/(\d+)\+?\s+years/mi);
      if (m) return parseInt(m[1], 10);
      const years = Array.from(String(text || '').matchAll(/(19|20)\d{2}/g)).map(x => parseInt(x[0], 10));
      if (years.length >= 2) return Math.max(0, Math.max(...years) - Math.min(...years));
      return null;
    }
    const requiredYears = extractRequiredYears(jdText);
    const resumeYears = extractResumeYears(cand.resume_text || '');

    const riskItems = [];
    // experience-year gap
    if (requiredYears && resumeYears !== null && resumeYears < requiredYears) {
      riskItems.push({
        id: 'experience-years',
        type: 'Experience',
        category: 'Experience',
        description: `Resume shows ${resumeYears || 0} years experience but JD requests ${requiredYears}+ years.`,
        severity: 'high',
        recommendation: `Ask candidate to highlight relevant roles or leadership experience to demonstrate ${requiredYears}+ years. Consider verifying tenure in interview.`,
      });
    }

    // missing skill items (top 5)
    (missing || []).slice(0,5).forEach((m, idx) => {
      riskItems.push({
        id: `missing-${idx}`,
        type: 'Skills',
        category: 'Missing Skill',
        description: `No clear evidence for required skill: ${m.requirement || m}.`,
        severity: 'high',
        recommendation: `Request concrete examples or projects demonstrating ${m.requirement || m}. Ask for outcomes, scale, and tools used.`,
      });
    });

    // partial hits -> medium risk
    (partial || []).slice(0,5).forEach((p, idx) => {
      riskItems.push({
        id: `partial-${idx}`,
        type: 'Skills',
        category: 'Partial Evidence',
        description: `Partial or shallow evidence for: ${p.requirement || p}.`,
        severity: 'medium',
        recommendation: `Probe for depth: which parts of ${p.requirement || p} did the candidate own? Ask for technical details and metrics.`,
      });
    });

    // general summary
    let riskSummary = 'No major red flags detected.';
    if (pct < 90) {
      const topMiss = (missing || []).slice(0,4).map(x => x.requirement || String(x));
      riskSummary = `Coverage ${pct}%. Top gaps: ${topMiss.length ? topMiss.join(', ') : 'n/a'}. Recommend focused interview questions to validate experience, and request examples or code samples where possible.`;
    }

    const risk_analysis = { summary: riskSummary, items: riskItems };

    const mockAnalysis = {
      status: 'completed',
      confidence_score: pct,
      parsed_resume: { skills, experience: cand.parsed_experience?.length ? cand.parsed_experience : parsedResumeFromText.experience, education: cand.parsed_education?.length ? cand.parsed_education : parsedResumeFromText.education, certifications: cand.parsed_certifications?.length ? cand.parsed_certifications : parsedResumeFromText.certifications, projects: parsedResumeFromText.projects || [] },
      parsed_jd: { title: jdText.split('\n')[0]?.trim() || 'Software Role', required_skills: jdTerms.slice(0,6) },
      coverage_matrix: { matched, partial, missing },
      risk_analysis,
      interview_questions: { verification_questions: matched.slice(0,3).map(m=>({ question: `Tell me about ${m.requirement}`, rationale: `Verify ${m.requirement}` })), missing_information_questions: missing.slice(0,3).map(m=>({ question: `Can you describe your experience with ${m.requirement}?`, rationale: `Missing evidence for ${m.requirement}` })) },
      improvement_suggestions: { summary: improvementSummary, items: suggestions },
      recommendation: { verdict: recVerdict, confidence: pct, reasoning: `Automated heuristic: ${pct}% of JD phrases matched.`, supporting_evidence: matched.slice(0,5).map(m=>m.evidence), missing_evidence: missing.slice(0,5).map(m=>m.reason) }
    };

    await supabase.from('analyses').update(mockAnalysis).eq('id', aid);
    const { data } = await supabase.from('analyses').select('*').eq('id', aid).maybeSingle();
    setAnalysis(data);
    setRunning(false);
    setStep(-1);
    setTab('overview');
  }

  async function addNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    const { data } = await supabase.from('recruiter_notes').insert({ candidate_id: id, note: note.trim() }).select().maybeSingle();
    if (data) setNotes(p => [data, ...p]);
    setNote(''); setSavingNote(false);
  }

  async function deleteNote(nid) {
    await supabase.from('recruiter_notes').delete().eq('id', nid);
    setNotes(p => p.filter(n => n.id !== nid));
  }

  async function editNote(nid, newText) {
    try {
      const { data } = await supabase.from('recruiter_notes').update({ note: newText }).eq('id', nid).select().maybeSingle();
      if (data) setNotes(p => p.map(n => n.id === nid ? data : n));
    } catch (e) {
      console.error('Failed to edit note', e);
      throw e;
    }
  }

  async function toggleNoteImportant(nid, important) {
    try {
      const { data } = await supabase.from('recruiter_notes').update({ important: important ? true : false }).eq('id', nid).select().maybeSingle();
      if (data) setNotes(p => p.map(n => n.id === nid ? data : n));
    } catch (e) {
      console.error('Failed to toggle important', e);
    }
  }

  if (loading) return <div className="empty-state page-body"><div className="spin spin-slate"></div></div>;
  if (!candidate) return (
    <div className="empty-state page-body">
      <XCircle size={32} color="var(--red-500)" /><h3>Candidate not found</h3>
      <Link to="/" className="btn btn-secondary mt-4">Go back</Link>
    </div>
  );

  const rec    = analysis?.recommendation || {};
  const vm     = verdictMeta(rec.verdict);
  const isReady = analysis?.status === 'completed';

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <Link to="/">Candidates</Link>
            <ChevronRight size={12} />
            <span>{candidate.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h2>{candidate.name}</h2>
            {vm && !running && <span className={`badge ${vm.cls}`}>{vm.label}</span>}
            {running && (
              <span className="badge badge-blue flex items-center gap-1">
                <div className="spin" style={{ width: 10, height: 10, borderWidth: 1.5 }}></div>
                Analyzing…
              </span>
            )}
          </div>
          <p className="flex items-center gap-1"><Mail size={11} /> {candidate.email}</p>
        </div>
        <div className="page-header-actions">
          <Link to={`/candidates/${id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
          <button className="btn btn-primary" onClick={runAnalysis} disabled={running}>
            {running
              ? <><div className="spin"></div> Analyzing…</>
              : isReady
                ? <><RefreshCw size={14} /> Re-analyze</>
                : <><Play size={14} /> Run Analysis</>}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* ── Error ── */}
        {error && (
          <div className="alert alert-red mb-6" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--s2)' }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={15} />
              <div>
                <strong>Error:</strong> {error}
                {error.includes('API key') && <> — <Link to="/settings" style={{ textDecoration: 'underline', color: 'inherit' }}>Configure in Settings</Link></>}
              </div>
            </div>
            {(error.includes('Edge Function') || error.includes('Failed to fetch') || error.includes('fetch')) && (
              <button 
                className="btn btn-secondary btn-sm mt-1" 
                onClick={runSimulation}
                style={{ background: '#fef2f2', borderColor: '#fee2e2', color: '#b91c1c' }}
              >
                ⚡ Run in Demo/Simulation Mode
              </button>
            )}
          </div>
        )}

        {/* ── Workflow progress ── */}
        {running && (
          <div className="card mb-6">
            <div className="section-title mb-4"><Brain size={14} /> AI Workflow Progress</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
              {STEPS.map((s, i) => (
                <div key={i} className={`wf-step ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}>
                  <div className="wf-step-num">
                    {i < step
                      ? <CheckCircle2 size={12} />
                      : i === step
                        ? <div className="spin" style={{ width: 10, height: 10, borderWidth: 1.5, borderTopColor: 'var(--blue-600)', borderColor: 'rgba(59,130,246,0.2)' }}></div>
                        : i + 1}
                  </div>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── No analysis ── */}
        {!analysis || analysis.status === 'pending' ? (
          <div className="card empty-state">
            <div className="empty-icon"><Zap size={24} color="var(--blue-600)" /></div>
            <h3>Ready to analyze</h3>
            <p>Click "Run Analysis" to trigger the 8-step AI workflow and generate a full transparency report.</p>
            <button className="btn btn-primary mt-4" onClick={runAnalysis} disabled={running}>
              <Play size={14} /> Run Analysis
            </button>
          </div>
        ) : analysis.status === 'failed' ? (
          <div className="alert alert-red">
            <XCircle size={15} />
            <div>
              <strong>Analysis failed.</strong> {analysis.error_message}
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 12 }} onClick={runAnalysis}>Retry</button>
            </div>
          </div>
        ) : isReady ? (
          <>
            {/* ── Tabs ── */}
            <div className="tabs-bar">
              {TABS.map(t => (
                <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                  <t.icon size={13} /> {t.label}
                </button>
              ))}
            </div>

            {tab === 'overview'    && <OverviewTab    analysis={analysis} vm={vm} />}
            {tab === 'resume'      && <ResumeTab      parsed={analysis.parsed_resume} />}
            {tab === 'coverage'    && <CoverageTab    matrix={analysis.coverage_matrix} />}
            {tab === 'risks'       && <RisksTab       risks={analysis.risk_analysis} />}
            {tab === 'interview'   && <InterviewTab   questions={analysis.interview_questions} />}
            {tab === 'suggestions' && <SuggestionsTab suggestions={analysis.improvement_suggestions} candidateId={candidate.id} analysisId={analysis.id} setAnalysis={setAnalysis} />}
            {tab === 'notes'       && <NotesTab notes={notes} note={note} setNote={setNote} addNote={addNote} deleteNote={deleteNote} editNote={editNote} toggleNoteImportant={toggleNoteImportant} saving={savingNote} fmtDate={fmtDate} />}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Overview Tab ───────────────────────────────────────────── */
function OverviewTab({ analysis, vm }) {
  const rec    = analysis.recommendation || {};
  const matrix = analysis.coverage_matrix || {};
  const matched = (matrix.matched || []).length;
  const partial = (matrix.partial || []).length;
  const missing = (matrix.missing || []).length;
  const total   = matched + partial + missing;
  const pct     = total > 0 ? Math.round(((matched + partial * 0.5) / total) * 100) : 0;
  const conf    = analysis.confidence_score ?? rec.confidence ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s6)' }}>
      {/* Stat row */}
      <div className="grid-3">
        {/* Verdict */}
        <div className="stat-card" style={{ background: vm?.bg || '#fff', border: `1px solid ${vm ? '#ccc' : 'var(--slate-200)'}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--s2)' }}>Recommendation</div>
          <div className="stat-value" style={{ fontSize: 22, color: vm?.color || 'var(--slate-400)' }}>{vm?.label || '—'}</div>
          {conf !== null && (
            <div style={{ marginTop: 'var(--s3)' }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>Confidence</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-700)' }}>{conf}%</span>
              </div>
              <div className="progress-track">
                <div className={`progress-fill ${conf >= 70 ? 'progress-green' : conf >= 45 ? 'progress-amber' : 'progress-red'}`} style={{ width: `${conf}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Coverage */}
        <div className="stat-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--s2)' }}>Req. Coverage</div>
          <div className="stat-value" style={{ color: pct >= 70 ? 'var(--green-600)' : pct >= 40 ? 'var(--amber-600)' : 'var(--red-600)' }}>{pct}<span style={{ fontSize: 18 }}>%</span></div>
          <div style={{ marginTop: 'var(--s3)' }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>{matched + partial} of {total} met</span>
            </div>
            <div className="progress-track">
              <div className={`progress-fill ${pct >= 70 ? 'progress-green' : 'progress-amber'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="stat-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--s3)' }}>Requirement Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            {[
              { label: 'Matched',  count: matched, color: '#22c55e', bg: '#f0fdf4' },
              { label: 'Partial',  count: partial, color: '#f59e0b', bg: '#fffbeb' },
              { label: 'Missing',  count: missing, color: 'var(--red-500)', bg: 'var(--red-50)' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: 'block' }}></span>
                  <span style={{ fontSize: 12, color: 'var(--slate-600)' }}>{r.label}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-800)', background: r.bg, padding: '1px 8px', borderRadius: 20 }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fit summary */}
      <div className="grid-2">
        <div className="card">
          <div className="section-title mb-4" style={{ color: 'var(--green-700)' }}>
            <CheckCircle2 size={14} /> Why a Fit
          </div>
          <ul style={{ paddingLeft: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
            {(rec.supporting_evidence || []).map((e, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--slate-700)' }}>{e}</li>
            ))}
            {!rec.supporting_evidence?.length && <li style={{ color: 'var(--slate-400)', fontSize: 13 }}>No supporting evidence captured.</li>}
          </ul>
        </div>

        <div className="card">
          <div className="section-title mb-4" style={{ color: 'var(--red-600)' }}>
            <XCircle size={14} /> Why Not a Fit
          </div>
          <ul style={{ paddingLeft: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
            {(rec.missing_evidence || []).map((e, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--slate-700)' }}>{e}</li>
            ))}
            {!rec.missing_evidence?.length && <li style={{ color: 'var(--slate-400)', fontSize: 13 }}>No major gaps identified.</li>}
          </ul>
        </div>
      </div>

      {/* Reasoning */}
      {rec.reasoning && (
        <div className="card">
          <div className="section-title mb-3"><Brain size={14} /> AI Reasoning</div>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--slate-600)' }}>{rec.reasoning}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Parsed Resume Tab ──────────────────────────────────────── */
function ResumeTab({ parsed }) {
  if (!parsed) return <div className="text-muted text-sm">No parsed data available.</div>;

  return (
    <div style={{ display: 'block', gap: 'var(--s4)' }}>
      {/* Simple Skills list */}
      <div className="parsed-section">
        <div className="parsed-section-head">Skills</div>
        {parsed.skills && parsed.skills.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {parsed.skills.map((s, i) => <span key={i} className="skill-tag">{String(s)}</span>)}
          </div>
        ) : <div className="text-sm text-light">No skills parsed.</div>}
      </div>

      {/* Simple Experience */}
      <div className="parsed-section">
        <div className="parsed-section-head">Experience</div>
        {parsed.experience && parsed.experience.length > 0 ? (
          parsed.experience.map((exp, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{exp.role} — <span style={{ fontWeight: 500 }}>{exp.company}</span></div>
              {exp.duration && <div className="text-sm text-light">{exp.duration}</div>}
              {exp.highlights && exp.highlights.length > 0 && (
                <ul style={{ marginTop: 8 }}>
                  {exp.highlights.map((h, j) => <li key={j} className="text-sm">{h}</li>)}
                </ul>
              )}
            </div>
          ))
        ) : <div className="text-sm text-light">No experience parsed.</div>}
      </div>

      {/* Education & Certifications simple */}
      <div className="parsed-section" style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div className="parsed-section-head">Education</div>
          {parsed.education && parsed.education.length > 0 ? (
            parsed.education.map((e, i) => (
              <div key={i} className="text-sm" style={{ marginBottom: 8 }}>{e.degree} — {e.institution} {e.year ? `· ${e.year}` : ''}</div>
            ))
          ) : <div className="text-sm text-light">No education parsed.</div>}
        </div>
        <div style={{ flex: 1 }}>
          <div className="parsed-section-head">Certifications</div>
          {parsed.certifications && parsed.certifications.length > 0 ? (
            parsed.certifications.map((c, i) => <div key={i} className="text-sm">{typeof c === 'string' ? c : JSON.stringify(c)}</div>)
          ) : <div className="text-sm text-light">No certifications parsed.</div>}
        </div>
      </div>

      {/* Projects */}
      <div className="parsed-section">
        <div className="parsed-section-head">Projects</div>
        {parsed.projects && parsed.projects.length > 0 ? (
          parsed.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              {p.description && <div className="text-sm">{p.description}</div>}
            </div>
          ))
        ) : <div className="text-sm text-light">No projects parsed.</div>}
      </div>
    </div>
  );
}

/* ─── Coverage Matrix Tab ────────────────────────────────────── */
function CoverageTab({ matrix }) {
  if (!matrix) return <div className="text-muted text-sm">No coverage data available.</div>;

  const sections = [
    { key: 'matched', label: 'Matched',  cls: 'matched', icls: 'ci-matched', Icon: CheckCircle2, badgeCls: 'badge-green' },
    { key: 'partial', label: 'Partial',  cls: 'partial', icls: 'ci-partial', Icon: Minus,        badgeCls: 'badge-amber' },
    { key: 'missing', label: 'Missing',  cls: 'missing', icls: 'ci-missing', Icon: XCircle,      badgeCls: 'badge-red'   },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s8)' }}>
      {sections.map(s => {
        const items = matrix[s.key] || [];
        return (
          <div key={s.key}>
            <div className="section-head">
              <div className="section-title">
                <s.Icon size={14} /> {s.label} Requirements
              </div>
              <span className={`badge ${s.badgeCls}`}>{items.length}</span>
            </div>
            {items.length === 0
              ? <p className="text-sm text-light">None in this category.</p>
              : items.map((item, i) => (
                <div key={i} className={`coverage-item ${s.cls}`}>
                  <div className={`coverage-icon ${s.icls}`}>
                    <s.Icon size={12} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--slate-800)', marginBottom: 4 }}>
                      {item.requirement || String(item)}
                    </div>
                    {item.evidence && (
                      <p style={{ fontSize: 12, color: 'var(--slate-600)', lineHeight: 1.6 }}>
                        <span style={{ fontWeight: 600 }}>Evidence:</span> {item.evidence}
                      </p>
                    )}
                    {item.reason && (
                      <p style={{ fontSize: 12, color: 'var(--slate-500)', lineHeight: 1.6, marginTop: 2 }}>
                        {item.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        );
      })}
    </div>
  );
}

/* ─── Risk Analysis Tab ──────────────────────────────────────── */
function RisksTab({ risks }) {
  if (!risks || !(risks.items && risks.items.length)) return (
    <div className="card empty-state">
      <div className="empty-icon"><CheckCircle2 size={24} color="var(--green-600)" /></div>
      <h3>No significant risks detected</h3>
      <p className="text-sm text-muted">The resume does not show major red flags based on automated analysis.</p>
    </div>
  );

  return (
    <div>
      {risks.summary && <div className="alert alert-amber mb-6"><AlertCircle size={15} /><p style={{ fontSize: 13 }}>{risks.summary}</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {risks.items.map((r, i) => (
          <div key={i} className="risk-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{r.type || r.category || 'Risk'}</div>
                <div className="text-sm text-light">{r.description}</div>
              </div>
              <div>
                <span className={`badge ${r.severity === 'high' ? 'badge-red' : r.severity === 'medium' ? 'badge-amber' : 'badge-slate'}`}>{r.severity || 'low'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Interview Prep Tab ─────────────────────────────────────── */
function InterviewTab({ questions }) {
  if (!questions) return <div className="text-muted text-sm">No interview questions generated.</div>;

  const verif   = questions.verification_questions || [];
  const missing = questions.missing_information_questions || [];

  function QList({ items, accentColor }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
        {items.map((q, i) => (
          <div key={i} className="question-item">
            <div className="flex items-start gap-3">
              <div className="question-number" style={{ background: accentColor }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--slate-800)', lineHeight: 1.65 }}>
                  {typeof q === 'string' ? q : q.question}
                </p>
                {q.rationale && (
                  <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 5, lineHeight: 1.5 }}>
                    {q.rationale}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {!items.length && <p className="text-sm text-light">None generated.</p>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s8)' }}>
      <div>
        <div className="section-head">
          <div className="section-title"><CheckCheck size={14} /> Verification Questions</div>
          <span className="badge badge-blue">{verif.length}</span>
        </div>
        <p className="text-sm text-muted mb-4">Use these to validate specific claims in the resume.</p>
        <QList items={verif} accentColor="var(--blue-600)" />
      </div>

      <div>
        <div className="section-head">
          <div className="section-title"><AlertCircle size={14} /> Missing Information Questions</div>
          <span className="badge badge-amber">{missing.length}</span>
        </div>
        <p className="text-sm text-muted mb-4">Use these to fill gaps not covered in the resume.</p>
        <QList items={missing} accentColor="var(--amber-600)" />
      </div>
    </div>
  );
}

/* ─── Improvement Suggestions Tab ────────────────────────────── */
function SuggestionsTab({ suggestions, candidateId, analysisId, setAnalysis }) {
  // Enhanced suggestions UI: priority badges, copy example, add to notes, mark resolved
  if (!suggestions?.items?.length) return (
    <div className="card empty-state">
      <div className="empty-icon"><TrendingUp size={24} color="var(--slate-400)" /></div>
      <h3>No suggestions generated</h3>
      <p className="text-sm text-muted">If analysis coverage is low, try re-running analysis with a fuller resume or enable the simulator to generate sample suggestions.</p>
    </div>
  );

  const order = { high: 0, medium: 1, low: 2 };
  const prioBadge = { high: 'badge-red', medium: 'badge-amber', low: 'badge-slate' };

  // Local UI state for optimistic updates
  const [items, setItems] = React.useState((suggestions.items || []).map((it, idx) => ({ ...it, _idx: idx })));
  const [savingIdx, setSavingIdx] = React.useState(null);

  // Helper: copy example text to clipboard
  async function copyExample(text) {
    try { await navigator.clipboard.writeText(text); alert('Example copied to clipboard'); }
    catch (e) { console.warn('Clipboard unavailable', e); }
  }

  // Add suggestion to recruiter notes (creates a recruiter_notes row)
  async function addToNotes(sugg) {
    if (!candidateId) {
      alert('Candidate ID not available. Cannot add note.');
      return;
    }
    try {
      setSavingIdx(sugg._idx);
      const body = `${sugg.suggestion}${sugg.example ? '\nExample: ' + sugg.example : ''}`;
      const { data, error } = await supabase.from('recruiter_notes').insert({ candidate_id: candidateId, note: body }).select().maybeSingle();
      setSavingIdx(null);
      if (error) throw error;
      alert('Suggestion added to recruiter notes');
    } catch (err) {
      setSavingIdx(null);
      console.error(err);
      alert('Failed to add note');
    }
  }

  // Mark suggestion resolved: set resolved=true and persist to analyses.improvement_suggestions
  async function markResolved(idx) {
    try {
      const updated = items.map((it, i) => i === idx ? { ...it, resolved: true } : it);
      setItems(updated);
      if (analysisId) {
        try {
          const { data, error } = await supabase.from('analyses').update({ improvement_suggestions: { summary: suggestions.summary, items: updated } }).eq('id', analysisId).select().maybeSingle();
          if (!error && data && typeof setAnalysis === 'function') setAnalysis(data);
        } catch (e) { console.warn('persist suggestions failed', e); }
      }
    } catch (e) { console.error(e); }
  }

  // Sort items by priority then unresolved first
  const sorted = items.slice().sort((a, b) => {
    const p = (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    if (p !== 0) return p;
    if ((a.resolved ? 1 : 0) !== (b.resolved ? 1 : 0)) return a.resolved ? 1 : -1;
    return 0;
  });

  return (
    <div>
      {suggestions.summary && (
        <div className="alert alert-blue mb-6">
          <Lightbulb size={15} /><p style={{ fontSize: 13 }}>{suggestions.summary}</p>
        </div>
      )}

      {sorted.map((s, i) => (
        <div key={s._idx || i} className={`suggestion-card prio-${s.priority || 'low'}`} style={{ position: 'relative' }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--slate-800)' }}>{s.category || s.type}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`badge ${prioBadge[s.priority] || 'badge-slate'}`}>{s.priority || 'low'}</span>
              {s.resolved && <span className="badge badge-slate">Resolved</span>}
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.7 }}>{s.suggestion || s.description}</p>
          {s.example && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--slate-50)', borderRadius: 'var(--r-sm)', borderLeft: '3px solid var(--slate-300)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--slate-600)', fontStyle: 'italic' }}>{s.example}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => copyExample(s.example)}>Copy</button>
                <button className="btn btn-ghost btn-sm" onClick={() => addToNotes(s)} disabled={savingIdx === s._idx}>{savingIdx === s._idx ? 'Saving...' : 'Add to notes'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => markResolved(i)}>Mark resolved</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Notes Tab ──────────────────────────────────────────────── */
function NotesTab({ notes, note, setNote, addNote, deleteNote, editNote, toggleNoteImportant, saving, fmtDate }) {
  const [editingId, setEditingId] = React.useState(null);
  const [editingText, setEditingText] = React.useState('');

  async function startEdit(n) {
    setEditingId(n.id);
    setEditingText(n.note);
  }

  async function saveEdit(nid) {
    try {
      await editNote(nid, editingText);
      setEditingId(null);
      setEditingText('');
    } catch (e) { alert('Failed to save note'); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s5)' }}>
      <div className="card">
        <div className="section-title mb-3"><StickyNote size={14} /> Add Note</div>
        <div className="flex gap-3 items-end">
          <textarea
            className="textarea flex-1"
            style={{ minHeight: 72 }}
            placeholder="Add a recruiter note or observation about this candidate…"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
          />
          <button className="btn btn-primary" onClick={addNote} disabled={saving || !note.trim()}>
            {saving ? <div className="spin"></div> : 'Add'}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="card empty-state" style={{ padding: 'var(--s10)' }}>
          <div className="empty-icon"><StickyNote size={22} color="var(--slate-400)" /></div>
          <h3>No notes yet</h3>
          <p>Add observations, flags, or decisions about this candidate.</p>
        </div>
      ) : (
        notes.map(n => (
          <div key={n.id} className="note-card">
            <div style={{ flex: 1 }}>
              {editingId === n.id ? (
                <div>
                  <textarea className="textarea" style={{ minHeight: 80 }} value={editingText} onChange={e => setEditingText(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => saveEdit(n.id)}>Save</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditingText(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--slate-700)' }}>{n.note}</p>
                  <p className="text-xs text-light mt-2"><Clock size={10} style={{ display: 'inline', marginRight: 3 }} />{fmtDate(n.created_at)}</p>
                </>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 8 }}>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => startEdit(n)} title="Edit note">
                <Edit2 size={13} color="var(--slate-500)" />
              </button>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => toggleNoteImportant(n.id, !n.important)} title="Toggle important">
                <Shield size={13} color={n.important ? 'var(--amber-600)' : 'var(--slate-400)'} />
              </button>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => deleteNote(n.id)} title="Delete note">
                <Trash2 size={13} color="var(--slate-400)" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
