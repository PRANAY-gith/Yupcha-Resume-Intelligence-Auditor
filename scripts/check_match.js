// Simple tokenizer/matcher used by the local simulator
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordsFrom(text) {
  const stop = new Set(['the','and','for','with','that','this','from','have','has','are','was','were','will','would','should','a','an','in','on','of','to','by','as','is','be','or','at','it','its']);
  const clean = normalize(text);
  if (!clean) return [];
  const toks = clean.split(' ').map(t => t.trim()).filter(t => t.length > 2 && !stop.has(t));
  return Array.from(new Set(toks));
}

function analyze(resume, jd) {
  const rnorm = normalize(resume);
  const jnorm = normalize(jd);
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
      if (/^[A-Za-z ]+:$/.test(l) && !l.toLowerCase().includes('skills')) {
        capture = false;
      }
      if (capture) {
        const cleaned = l.replace(/^[-•*\s]+/, '').replace(/\s+\u2022\s+/g, ', ');
        cleaned.split(/[,;]+/).map(s => s.trim()).filter(Boolean).forEach(s => phrases.push(s.toLowerCase()));
      }
    }
    return Array.from(new Set(phrases));
  }

  const jdTerms = (() => {
    const phrases = extractSkillPhrases(jd);
    return phrases.length > 0 ? phrases : wordsFrom(jd);
  })();
  const resumeTerms = wordsFrom(resume);
  
  function parseResumeSections(text) {
    const out = { skills: [], experience: [], education: [], certifications: [], projects: [] };
    if (!text) return out;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const idx = {};
    lines.forEach((l, i) => {
      const lower = l.toLowerCase();
      if (lower.startsWith('experience')) idx.experience = i;
      if (lower.startsWith('education')) idx.education = i;
      if (lower.startsWith('skills')) idx.skills = i;
      if (lower.startsWith('certifications') || lower.startsWith('certificates')) idx.certifications = i;
      if (lower.startsWith('projects')) idx.projects = i;
    });
    function sectionLines(startKey, endKeys) {
      if (typeof idx[startKey] === 'undefined') return [];
      const start = idx[startKey] + 1;
      let end = lines.length;
      for (const k of endKeys) if (typeof idx[k] !== 'undefined' && idx[k] > idx[startKey]) end = Math.min(end, idx[k]);
      return lines.slice(start, end);
    }
    const skl = sectionLines('skills', ['experience','education','certifications','projects']);
    if (skl.length) out.skills = skl.join(' ').split(/[,:;·•\-\u2022]/).map(s => s.trim()).filter(Boolean);
    const expLines = sectionLines('experience', ['education','skills','certifications','projects']);
    if (expLines.length) {
      let cur = null;
      expLines.forEach(l => {
        if (/\b(\d{4})\b/.test(l) || /\b\w+\s*–\s*\w+/u.test(l) || /\(/.test(l)) {
          if (cur) out.experience.push(cur);
          cur = { role: l, company: '', duration: '', highlights: [] };
        } else if (cur && l.startsWith('•')) {
          cur.highlights.push(l.replace(/^•\s*/, ''));
        } else if (cur && !l.startsWith('•')) {
          cur.highlights.push(l);
        } else out.experience.push({ role: l, company: '', duration: '', highlights: [] });
      });
      if (cur) out.experience.push(cur);
    }
    const eduLines = sectionLines('education', ['experience','skills','certifications','projects']);
    if (eduLines.length) out.education = eduLines.map(l => ({ institution: l, degree: '', year: '' }));
    const certLines = sectionLines('certifications', ['experience','education','skills','projects']);
    if (certLines.length) out.certifications = certLines.map(l => l.replace(/^•\s*/,'').trim());
    const projLines = sectionLines('projects', ['experience','education','skills','certifications']);
    if (projLines.length) out.projects = projLines.map(l => ({ name: l.split('—')[0].trim(), description: l }));
    return out;
  }

  const parsedResumeFromText = parseResumeSections(resume);
  console.log('Normalized resume starts:', rnorm.slice(0,200));
  console.log('Normalized JD starts:', jnorm.slice(0,200));
  console.log('\nJD terms count:', jdTerms.length);
  console.log('Resume terms count:', resumeTerms.length);

  if (rnorm && jnorm && rnorm === jnorm) {
    console.log('\nExact normalized text match detected — coverage 100%');
    return { matched: jdTerms, partial: [], missing: [] };
  }

  const matched = [];
  const partial = [];
  const missing = [];

  jdTerms.forEach(phrase => {
    const pnorm = normalize(phrase);
    // substring match against normalized resume text
    if (rnorm.includes(pnorm)) {
      matched.push(phrase);
      return;
    }
    // word overlap check
    const words = pnorm.split(' ').filter(Boolean);
    let hits = 0;
    for (const w of words) if (resumeTerms.includes(w)) hits++;
    if (hits >= words.length) matched.push(phrase);
    else if (hits > 0) {
      // Treat partial hits as matched for multi-word phrases to be more forgiving
      if (words.length >= 2) matched.push(phrase);
      else partial.push({ phrase, hits, words: words.length });
    } else missing.push(phrase);
  });

  const total = matched.length + partial.length + missing.length;
  const scoreRaw = total > 0 ? ((matched.length + 0.5 * partial.length) / total) * 100 : 0;
  return { matched, partial, missing, pct: Math.round(scoreRaw) };
}

// Use provided texts if run directly
if (require.main === module) {
  const resume = `Alex Rivera
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
  Real-time financial ledger library for Node.js; used by 40+ companies in production, this is the perfect resume sample
`;

  const jd = `Senior Full-Stack Engineer — FinTech Startup

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
• Track record of improving system reliability or performance`;

  const result = analyze(resume, jd);
  console.log('\nMatched count:', result.matched.length);
  console.log('Matched (examples):', result.matched.slice(0,50));
  console.log('\nPartial (examples):', (result.partial || []).slice(0,50));
  console.log('\nMissing count:', (result.missing || []).length);
  console.log('Coverage pct (word-level):', typeof result.pct === 'number' ? result.pct : 100);
}
