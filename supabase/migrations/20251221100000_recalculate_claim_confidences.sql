-- Recalculate all claim confidences with enhanced scoring
-- This migration updates confidence using recency decay and source weighting

-- Create a function to calculate confidence (temporary, for migration only)
CREATE OR REPLACE FUNCTION temp_recalculate_confidence(p_claim_id uuid)
RETURNS float
LANGUAGE plpgsql
AS $$
DECLARE
  v_claim_type text;
  v_evidence_count int;
  v_total_weight float := 0;
  v_base_confidence float;
  v_avg_weight float;
  v_confidence float;
  r record;
BEGIN
  -- Get claim type
  SELECT type INTO v_claim_type FROM identity_claims WHERE id = p_claim_id;

  -- Get evidence count
  SELECT COUNT(*) INTO v_evidence_count
  FROM claim_evidence WHERE claim_id = p_claim_id;

  IF v_evidence_count = 0 THEN
    RETURN 0;
  END IF;

  -- Calculate base confidence from count
  v_base_confidence := CASE
    WHEN v_evidence_count = 1 THEN 0.5
    WHEN v_evidence_count = 2 THEN 0.7
    WHEN v_evidence_count = 3 THEN 0.8
    ELSE 0.9
  END;

  -- Calculate weighted sum
  FOR r IN
    SELECT
      ce.strength,
      e.source_type,
      e.evidence_date
    FROM claim_evidence ce
    JOIN evidence e ON e.id = ce.evidence_id
    WHERE ce.claim_id = p_claim_id
  LOOP
    DECLARE
      v_strength_mult float;
      v_source_mult float;
      v_decay float;
      v_half_life float;
      v_age_years float;
    BEGIN
      -- Strength multiplier
      v_strength_mult := CASE r.strength
        WHEN 'strong' THEN 1.2
        WHEN 'medium' THEN 1.0
        WHEN 'weak' THEN 0.7
        ELSE 1.0
      END;

      -- Source weight
      v_source_mult := CASE r.source_type
        WHEN 'certification' THEN 1.5
        WHEN 'resume' THEN 1.0
        WHEN 'story' THEN 0.8
        WHEN 'inferred' THEN 0.6
        ELSE 1.0
      END;

      -- Recency decay (based on claim type)
      v_half_life := CASE v_claim_type
        WHEN 'skill' THEN 4.0
        WHEN 'achievement' THEN 7.0
        WHEN 'attribute' THEN 15.0
        ELSE NULL  -- education/certification don't decay
      END;

      IF v_half_life IS NULL OR r.evidence_date IS NULL THEN
        v_decay := 1.0;
      ELSE
        v_age_years := EXTRACT(EPOCH FROM (NOW() - r.evidence_date)) / (365.25 * 24 * 60 * 60);
        IF v_age_years <= 0 THEN
          v_decay := 1.0;
        ELSE
          v_decay := POWER(0.5, v_age_years / v_half_life);
        END IF;
      END IF;

      v_total_weight := v_total_weight + (v_strength_mult * v_source_mult * v_decay);
    END;
  END LOOP;

  -- Calculate final confidence
  v_avg_weight := v_total_weight / v_evidence_count;
  v_confidence := v_base_confidence * v_avg_weight;

  -- Cap at 0.95
  RETURN LEAST(v_confidence, 0.95);
END;
$$;

-- Update all claims
UPDATE identity_claims
SET
  confidence = temp_recalculate_confidence(id),
  updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT claim_id FROM claim_evidence
);

-- Log how many claims were updated
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM identity_claims
  WHERE id IN (SELECT DISTINCT claim_id FROM claim_evidence);
  RAISE NOTICE 'Recalculated confidence for % claims', v_count;
END $$;

-- Clean up temporary function
DROP FUNCTION temp_recalculate_confidence(uuid);
