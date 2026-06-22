
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  job_description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  parsed_resume JSONB,
  parsed_jd JSONB,
  coverage_matrix JSONB,
  risk_analysis JSONB,
  interview_questions JSONB,
  improvement_suggestions JSONB,
  recommendation JSONB,
  confidence_score NUMERIC(5,2),
  workflow_steps JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recruiter_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analyses_candidate_id ON analyses(candidate_id);
CREATE INDEX idx_recruiter_notes_candidate_id ON recruiter_notes(candidate_id);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_candidates" ON candidates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_candidates" ON candidates FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_candidates" ON candidates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_candidates" ON candidates FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_analyses" ON analyses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_analyses" ON analyses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_analyses" ON analyses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_analyses" ON analyses FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "select_notes" ON recruiter_notes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_notes" ON recruiter_notes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_notes" ON recruiter_notes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_notes" ON recruiter_notes FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER analyses_updated_at BEFORE UPDATE ON analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
