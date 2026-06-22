import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, User, Mail, FileText, Briefcase, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const SAMPLE = {
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  resume_text: `Alex Rivera
alex.rivera@example.com | (415) 555-0192 | github.com/alexrivera | San Francisco, CA

EXPERIENCE

Senior Software Engineer — Stripe, Inc. (Jan 2021 – Present)
• Led architecture of payment reconciliation microservice handling $2B+ annual transaction volume
• Reduced API p99 latency from 850ms to 120ms via async processing and Redis caching strategies
• Mentored 4 junior engineers; conducted 60+ technical interviews for the platform team
• Designed and shipped real-time fraud detection pipeline (Python, Kafka, PostgreSQL)

Software Engineer — Lyft (Jun 2018 – Dec 2020)
• Built driver earnings dashboard in React serving 500K+ weekly active drivers
• Implemented CI/CD pipeline (GitHub Actions + Docker + Kubernetes) cutting deploy time by 70%
• Owned backend services for driver incentives using Node.js, gRPC, and PostgreSQL

EDUCATION
B.S. Computer Science — UC Berkeley (2018) | GPA: 3.8

SKILLS
JavaScript, TypeScript, React, Node.js, Python, Go, PostgreSQL, MongoDB, Redis, Kafka,
Docker, Kubernetes, AWS (EC2, RDS, Lambda, S3), gRPC, REST API design

CERTIFICATIONS
AWS Certified Solutions Architect – Associate (2022)
Google Cloud Professional Data Engineer (2023)

PROJECTS
OpenLedger (open source) — 1.2K GitHub stars
  Real-time financial ledger library for Node.js; used by 40+ companies in production`,

  job_description: `Senior Full-Stack Engineer — FinTech Startup

We are building the next generation of B2B payment infrastructure and are looking for a
Senior Full-Stack Engineer to join our core platform team.

Required Skills:
• 5+ years of professional software engineering experience
• Strong proficiency in TypeScript and React (frontend)
• Node.js or Python for backend services
• Experience with PostgreSQL or similar relational databases
• Solid understanding of distributed systems and microservice architecture
• Cloud platform experience (AWS preferred)
• Familiarity with containerization (Docker/Kubernetes)

Preferred Skills:
• Experience in the fintech or payments domain
• Kafka or event-driven architecture experience
• Open source contributions
• Experience mentoring junior engineers
• gRPC or Protobuf knowledge

Responsibilities:
• Design and build scalable, high-availability payment APIs
• Collaborate with product, design, and data teams
• Lead technical design reviews and write RFCs
• Drive performance improvements across backend services
• Contribute to engineering culture and hiring

Experience Requirements:
• Led a feature or system end-to-end in a production environment
• Experience handling high-traffic, data-intensive applications
• Track record of improving system reliability or performance`,
};

export default function CandidateFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form,   setForm]   = useState({ name: '', email: '', resume_text: '', job_description: '' });
  const [loading, setLoading] = useState(isEdit);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => { if (isEdit) fetch(); }, [id]);

  async function fetch() {
    const { data } = await supabase.from('candidates').select('*').eq('id', id).maybeSingle();
    if (data) setForm({ name: data.name, email: data.email, resume_text: data.resume_text, job_description: data.job_description });
    setLoading(false);
  }

  function set(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    const { name, email, resume_text, job_description } = form;
    if (!name.trim() || !email.trim() || !resume_text.trim() || !job_description.trim()) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = { name: name.trim(), email: email.trim(), resume_text: resume_text.trim(), job_description: job_description.trim() };
    const { data, error: err } = isEdit
      ? await supabase.from('candidates').update(payload).eq('id', id).select().maybeSingle()
      : await supabase.from('candidates').insert(payload).select().maybeSingle();

    if (err) { setError(err.message); setSaving(false); return; }
    navigate(`/candidates/${data?.id || id}/analysis`);
  }

  if (loading) return (
    <div className="empty-state page-body"><div className="spin spin-slate"></div></div>
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <Link to="/">Candidates</Link>
            <ChevronRight size={12} />
            <span>{isEdit ? 'Edit' : 'New Candidate'}</span>
          </div>
          <h2>{isEdit ? 'Edit Candidate' : 'Add Candidate'}</h2>
          <p>{isEdit ? 'Update details and re-run analysis' : 'Enter resume and job description to begin AI analysis'}</p>
        </div>
        <Link to="/" className="btn btn-secondary"><ArrowLeft size={14} /> Back</Link>
      </div>

      <div className="page-body" style={{ maxWidth: 960 }}>
        {error && (
          <div className="alert alert-red mb-6"><FileText size={15} />{error}</div>
        )}

        {/* Sample banner */}
        {!isEdit && (
          <div className="alert alert-blue mb-6" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="flex items-center gap-3">
              <Sparkles size={15} />
              <span>Want to try it out? Load a sample candidate and run the AI analysis instantly.</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flexShrink: 0 }}
              onClick={async () => {
                try {
                  // Attempt to load the most recently created candidate as a dynamic sample
                  const { data: recent } = await supabase.from('candidates').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
                  if (recent && recent.resume_text && recent.job_description) {
                    setForm({ name: recent.name || SAMPLE.name, email: recent.email || SAMPLE.email, resume_text: recent.resume_text, job_description: recent.job_description });
                  } else {
                    // fallback to built-in sample
                    setForm(SAMPLE);
                  }
                } catch (e) {
                  setForm(SAMPLE);
                }
              }}
            >
              Load Sample
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          {/* Candidate info */}
          <div className="card mb-6">
            <div className="section-head">
              <div className="section-title"><User size={14} /> Candidate Information</div>
            </div>
            <div className="grid-2" style={{ gap: 'var(--s4)' }}>
              <div className="field">
                <label className="label">Full Name</label>
                <input className="input" placeholder="Jane Doe" value={form.name} onChange={set('name')} required />
              </div>
              <div className="field">
                <label className="label">Email Address</label>
                <input className="input" type="email" placeholder="jane@example.com" value={form.email} onChange={set('email')} required />
              </div>
            </div>
          </div>

          {/* Two-column: resume + JD */}
          <div className="grid-2">
            <div className="card">
              <div className="section-head" style={{ marginBottom: 'var(--s3)' }}>
                <div className="section-title"><FileText size={14} /> Resume</div>
                <span className="text-xs text-light">{form.resume_text.length} chars</span>
              </div>
              <textarea
                className="textarea"
                style={{ minHeight: 400, fontFamily: 'inherit', fontSize: 12, lineHeight: 1.7 }}
                placeholder={`Paste the candidate's full resume text here…\n\nInclude:\n• Work experience with dates\n• Skills and technologies\n• Education and certifications\n• Projects`}
                value={form.resume_text}
                onChange={set('resume_text')}
                required
              />
            </div>

            <div className="card">
              <div className="section-head" style={{ marginBottom: 'var(--s3)' }}>
                <div className="section-title"><Briefcase size={14} /> Job Description</div>
                <span className="text-xs text-light">{form.job_description.length} chars</span>
              </div>
              <textarea
                className="textarea"
                style={{ minHeight: 400, fontFamily: 'inherit', fontSize: 12, lineHeight: 1.7 }}
                placeholder={`Paste the full job description here…\n\nInclude:\n• Required and preferred skills\n• Experience requirements\n• Responsibilities\n• Company context`}
                value={form.job_description}
                onChange={set('job_description')}
                required
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Link to="/" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? <><div className="spin"></div> Saving…</>
                : <><Save size={14} /> {isEdit ? 'Save & View Analysis' : 'Add & Start Analysis'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
