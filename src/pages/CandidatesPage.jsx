import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Users, Mail, BarChart2, Trash2, Edit2, Clock,
  Search, AlertTriangle, CheckCircle2, XCircle, Minus,
  ChevronDown, ArrowUpDown, Shield, Zap, Target, Filter
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

/* ─── constants ─────────────────────────────────────────────── */

const AVATAR_PALETTES = [
  { bg: '#dbeafe', fg: '#1d4ed8' }, { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#fce7f3', fg: '#be185d' }, { bg: '#ede9fe', fg: '#7c3aed' },
  { bg: '#ccfbf1', fg: '#0f766e' }, { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#fee2e2', fg: '#b91c1c' }, { bg: '#e0f2fe', fg: '#0369a1' },
];

const VERDICT_META = {
  'strong hire': { label: 'Strong Hire', short: 'S.Hire', cls: 'verdict-strong-hire', dot: '#16a34a', bar: '#22c55e' },
  'hire':        { label: 'Hire',        short: 'Hire',   cls: 'verdict-hire',        dot: '#059669', bar: '#10b981' },
  'consider':    { label: 'Consider',    short: 'Consider', cls: 'verdict-consider', dot: '#d97706', bar: '#f59e0b' },
  'reject':      { label: 'Reject',      short: 'Reject', cls: 'verdict-reject',      dot: '#dc2626', bar: '#ef4444' },
};

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'oldest',     label: 'Oldest first' },
  { value: 'name_asc',   label: 'Name A → Z'   },
  { value: 'confidence', label: 'Confidence ↓'  },
  { value: 'coverage',   label: 'Coverage ↓'    },
];

/* ─── helpers ────────────────────────────────────────────────── */

function palette(name) {
  return AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];
}

function normalizeVerdict(v) {
  return (v || '').toString().toLowerCase().replace(/[-_]/g, ' ').trim();
}

function verdictMeta(rec) {
  if (!rec) return null;
  const v = normalizeVerdict(rec.verdict || rec);
  return VERDICT_META[v] || null;
}

function coverage(matrix) {
  if (!matrix) return null;
  const m = (matrix.matched || []).length;
  const p = (matrix.partial  || []).length;
  const x = (matrix.missing  || []).length;
  const total = m + p + x;
  const pct = total > 0 ? Math.round(((m + p * 0.5) / total) * 100) : 0;
  return { matched: m, partial: p, missing: x, total, pct };
}

function fmtDate(d) {
  const date = new Date(d);
  const now  = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60)      return 'just now';
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function topSkills(parsedResume, max = 5) {
  const skills = parsedResume?.skills;
  if (!Array.isArray(skills) || skills.length === 0) return [];
  return skills.slice(0, max).map(s => String(s));
}

function jobTitle(parsedJd) {
  return parsedJd?.title || null;
}

/* ─── CircleScore ────────────────────────────────────────────── */

function CircleScore({ value, size = 52 }) {
  if (value == null) return null;
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  const color = value >= 70 ? '#22c55e' : value >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--slate-100)" strokeWidth={5} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color,
      }}>{value}%</span>
    </div>
  );
}

/* ─── VerdictBar ─────────────────────────────────────────────── */

function VerdictBar({ counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const segments = [
    { key: 'strong hire', color: '#22c55e' },
    { key: 'hire',        color: '#10b981' },
    { key: 'consider',    color: '#f59e0b' },
    { key: 'reject',      color: '#ef4444' },
  ].filter(s => counts[s.key] > 0);

  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', gap: 1, width: '100%' }}>
      {segments.map(s => (
        <div
          key={s.key}
          style={{ background: s.color, width: `${(counts[s.key] / total) * 100}%`, borderRadius: 99 }}
          title={`${VERDICT_META[s.key]?.label}: ${counts[s.key]}`}
        />
      ))}
    </div>
  );
}

/* ─── CandidateCard ──────────────────────────────────────────── */

function CandidateCard({ candidate, analysis, onDelete, onNavigate, deleting }) {
  const pal    = palette(candidate.name);
  const rec    = analysis?.recommendation;
  const vm     = verdictMeta(rec);
  const cov    = coverage(analysis?.coverage_matrix);
  const skills = topSkills(analysis?.parsed_resume);
  const title  = jobTitle(analysis?.parsed_jd);
  const conf   = analysis?.confidence_score ?? null;
  const risks  = analysis?.risk_analysis?.items || [];
  const highRisks = risks.filter(r => r.severity === 'high').length;
  const allRisks  = risks.length;

  const isReady      = analysis?.status === 'completed';
  const isProcessing = analysis?.status === 'processing';
  const isFailed     = analysis?.status === 'failed';

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--slate-200)',
      borderRadius: 'var(--r-xl)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--slate-300)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--slate-200)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      {/* ── Top accent line for verdict ── */}
      {vm && (
        <div style={{ height: 3, background: vm.bar, width: '100%' }} />
      )}

      <div style={{ padding: 'var(--s5) var(--s6)' }}>
        {/* ── Row 1: Avatar + Info + Confidence ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s4)', marginBottom: 'var(--s4)' }}>
          {/* Avatar */}
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--r-xl)',
            background: pal.bg, color: pal.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 18, flexShrink: 0,
            letterSpacing: '-0.02em',
          }}>
            {candidate.name.charAt(0).toUpperCase()}
          </div>

          {/* Name block */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--slate-900)', letterSpacing: '-0.01em' }}>
                {candidate.name}
              </span>
              {vm && (
                <span className={`badge ${vm.cls}`} style={{ fontSize: 10 }}>{vm.label}</span>
              )}
              {isProcessing && (
                <span className="badge badge-blue" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div className="spin" style={{ width: 8, height: 8, borderWidth: 1.5 }}></div>
                  Analyzing
                </span>
              )}
              {isFailed && <span className="badge badge-red" style={{ fontSize: 10 }}>Failed</span>}
            </div>
            <div style={{ color: 'var(--slate-500)', fontSize: 13, marginTop: 6 }}>{candidate.email}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              {title && <div className="chip">{title}</div>}
              {skills?.length > 0 && <div className="chip">{skills.join(', ')}</div>}
            </div>
          </div>

          {/* Confidence */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 'var(--s4)' }}>
            <CircleScore value={conf} />
            <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>{fmtDate(candidate.created_at)}</div>
          </div>
        </div>

        {/* ── Row 2: Coverage + Risks + Actions ── */}
        <div style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ width: 120 }}>
                <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>Coverage</div>
                <div style={{ marginTop: 6 }}>
                  <VerdictBar counts={{ 'strong hire': (analysis?.verdict_counts?.['strong hire'] || 0), 'hire': (analysis?.verdict_counts?.hire || 0), 'consider': (analysis?.verdict_counts?.consider || 0), 'reject': (analysis?.verdict_counts?.reject || 0) }} />
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--slate-700)' }}>{cov ? `${cov.pct}% match` : 'No analysis yet'}</div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Shield size={14} />
                <div style={{ fontSize: 13 }}>{highRisks} high risks</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Target size={14} />
                <div style={{ fontSize: 13 }}>{(analysis?.coverage_matrix?.matched || []).length} matched</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isReady ? (
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate(`/candidates/${candidate.id}/analysis`)}>
                <BarChart2 size={12} /> View Report
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate(`/candidates/${candidate.id}/analysis`)}>
                <Zap size={12} /> {isProcessing ? 'View Progress' : 'Analyze'}
              </button>
            )}
            <button className="btn btn-secondary btn-icon btn-sm" onClick={() => onNavigate(`/candidates/${candidate.id}/edit`)} title="Edit">
              <Edit2 size={13} />
            </button>
            <button className="btn btn-danger btn-icon btn-sm" onClick={() => onDelete(candidate.id)} disabled={deleting === candidate.id} title="Delete">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([]);
  const [analyses,   setAnalyses]   = useState({});
  const [loading,    setLoading]    = useState(true);
  const [deleting,   setDeleting]   = useState(null);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [sort,       setSort]       = useState('newest');
  const [showSort,   setShowSort]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('candidates').select('*').order('created_at', { ascending: false });
    if (data?.length) {
      setCandidates(data);
      const { data: ad } = await supabase
        .from('analyses')
        .select('*')
        .in('candidate_id', data.map(c => c.id))
        .order('created_at', { ascending: false });
      const map = {};
      (ad || []).forEach(a => { if (!map[a.candidate_id]) map[a.candidate_id] = a; });
      setAnalyses(map);
    } else {
      setCandidates([]);
    }
    setLoading(false);
  }

  async function remove(id) {
    if (!confirm('Delete this candidate and all associated analysis data?')) return;
    setDeleting(id);
    await supabase.from('candidates').delete().eq('id', id);
    setCandidates(p => p.filter(c => c.id !== id));
    setDeleting(null);
  }

  const filtered = useMemo(() => {
    let list = candidates.slice();
    if (search.trim()) list = list.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [candidates, search]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb"><Link to="/">Candidates</Link></div>
          <h2>Candidates</h2>
          <p>Manage your candidates and run AI-driven resume analysis</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/candidates/new" className="btn btn-primary"><Plus size={13} /> Add Candidate</Link>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 'var(--s5)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
            <div className="input-with-icon" style={{ flex: 1 }}>
              <Search size={14} />
              <input className="input" placeholder="Search candidates" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty-state page-body"><div className="spin spin-slate"></div></div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map(c => (
              <CandidateCard
                key={c.id}
                candidate={c}
                analysis={analyses[c.id]}
                onDelete={remove}
                onNavigate={navigate}
                deleting={deleting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
