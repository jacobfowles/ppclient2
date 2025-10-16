-- Run this in Supabase SQL Editor to check leadership layers

-- Check if any leadership layers exist for church 33
SELECT
  id,
  church_id,
  name,
  level,
  description,
  active,
  created_at
FROM leadership_layers
WHERE church_id = 33
ORDER BY level;

-- Check all leadership layers regardless of church (to verify table has data)
SELECT
  church_id,
  COUNT(*) as layer_count,
  COUNT(*) FILTER (WHERE active = true) as active_count,
  COUNT(*) FILTER (WHERE active = false) as inactive_count
FROM leadership_layers
GROUP BY church_id
ORDER BY church_id;
