import React, { useState } from 'react';
import { Key, CheckCircle2, ExternalLink, Brain, Zap, Info, ChevronRight } from 'lucide-react';

const FREE_MODELS = [
  { value: 'meta-llama/llama-3.1-8b-instruct:free',  label: 'Llama 3.1 8B Instruct',  tag: 'Fast' },
  { value: 'meta-llama/llama-3.2-3b-instruct:free',  label: 'Llama 3.2 3B Instruct',  tag: 'Fastest' },
  { value: 'mistralai/mistral-7b-instruct:free',      label: 'Mistral 7B Instruct',     tag: 'Balanced' },
  { value: 'google/gemma-2-9b-it:free',               label: 'Gemma 2 9B IT',           tag: 'Quality' },
  { value: 'qwen/qwen-2-7b-instruct:free',            label: 'Qwen 2 7B Instruct',      tag: 'Versatile' },
];

const WORKFLOW_STEPS = [
  { n: 1, label: 'Parse Resume',             desc: 'Extract skills, experience, education, projects, certifications' },
  { n: 2, label: 'Parse Job Description',    desc: 'Extract required skills, preferred skills, responsibilities' },
  { n: 3, label: 'Extract Requirements',     desc: 'Enumerate all explicit and implicit requirements' },
  { n: 4, label: 'Extract Candidate Evidence', desc: 'Map resume content to evidence for each requirement' },
  { n: 5, label: 'Match Evidence',           desc: 'Classify requirements as matched, partial, or missing' },
  { n: 6, label: 'Risk Analysis',            desc: 'Detect employment gaps, vague claims, weak impact statements' },
  { n: 7, label: 'Interview Questions',      desc: 'Generate verification + missing-information questions' },
  { n: 8, label: 'Hiring Recommendation',   desc: 'Produce Strong Hire / Hire / Consider / Reject with confidence score' },
];

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('openrouter_api_key') || '');
  const [model,  setModel]  = useState(localStorage.getItem('openrouter_model')  || FREE_MODELS[0].value);
  const [saved,  setSaved]  = useState(false);
  const [show,   setShow]   = useState(false);

  function save() {
    localStorage.setItem('openrouter_api_key', apiKey.trim());
    localStorage.setItem('openrouter_model', model);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const hasKey = Boolean(apiKey.trim());
  const selectedModel = FREE_MODELS.find(m => m.value === model);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Settings</h2>
          <p>Configure your AI provider and review the analysis workflow</p>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s6)', maxWidth: 680 }}>

          {/* ── API Key Card ── */}
          <div className="card">
            <div className="section-title mb-1" style={{ fontSize: 14 }}>
              <Key size={15} /> AI Provider
            </div>
            <p className="text-sm text-muted mb-6" style={{ marginTop: 4 }}>
              Powered by OpenRouter. Get a free API key at{' '}
              <a href="https://openrouter.ai" target="_blank" rel="noreferrer"
                style={{ color: 'var(--blue-600)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                openrouter.ai <ExternalLink size={11} />
              </a>
              {' '}— free-tier models have rate limits but work fully for analysis.
            </p>

            {/* Status pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 20, marginBottom: 'var(--s5)',
              background: hasKey ? 'var(--green-50)' : 'var(--red-50)',
              border: `1px solid ${hasKey ? 'var(--green-100)' : 'var(--red-100)'}`,
              fontSize: 12, fontWeight: 600,
              color: hasKey ? 'var(--green-700)' : 'var(--red-600)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: hasKey ? '#22c55e' : 'var(--red-500)', display: 'block' }}></span>
              {hasKey ? 'API key configured' : 'No API key — analysis disabled'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
              <div className="field">
                <label className="label">OpenRouter API Key</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={show ? 'text' : 'password'}
                    className="input"
                    placeholder="sk-or-v1-…"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    style={{ paddingRight: 80 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(p => !p)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, color: 'var(--slate-500)',
                    }}
                  >
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
                <span className="field-hint">Stored in your browser only — never sent to any server other than OpenRouter.</span>
              </div>

              <div className="field">
                <label className="label">AI Model</label>
                <select className="select" value={model} onChange={e => setModel(e.target.value)}>
                  {FREE_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label} · {m.tag}</option>
                  ))}
                </select>
                <span className="field-hint">All listed models are on the OpenRouter free tier.</span>
              </div>

              <div className="flex items-center gap-3" style={{ marginTop: 'var(--s2)' }}>
                <button className="btn btn-primary" onClick={save}>Save Settings</button>
                {saved && (
                  <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--green-700)' }}>
                    <CheckCircle2 size={14} /> Saved!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Workflow Card ── */}
          <div className="card">
            <div className="section-title mb-1" style={{ fontSize: 14 }}>
              <Brain size={15} /> 8-Step AI Workflow
            </div>
            <p className="text-sm text-muted mb-5" style={{ marginTop: 4 }}>
              Each analysis runs through this agentic pipeline sequentially.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
              {WORKFLOW_STEPS.map(s => (
                <div key={s.n} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 'var(--s3)',
                  padding: 'var(--s3) var(--s4)',
                  background: 'var(--slate-50)', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--slate-100)',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--blue-600)', color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-800)' }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2, lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Quick Start ── */}
          <div className="card">
            <div className="section-title mb-4" style={{ fontSize: 14 }}>
              <Zap size={15} /> Quick Start
            </div>
            <ol style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)', paddingLeft: 'var(--s5)' }}>
              {[
                'Get a free API key from openrouter.ai and paste it above.',
                'Go to Candidates and click "Add Candidate".',
                'Paste the resume text and job description.',
                'Click "Run Analysis" — the 8-step workflow will begin.',
                'Review the full transparency report: overview, coverage matrix, risks, interview prep, and suggestions.',
              ].map((step, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.65 }}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
