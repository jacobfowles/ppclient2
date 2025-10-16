/*
  # Add soft delete functionality to assessments table

  1. Schema Changes
    - Add `deleted_at` column to assessments table (nullable timestamp)
    - Add index on deleted_at for query performance

  2. Security
    - No RLS policy changes needed (existing policies will apply)

  3. Notes
    - Soft deletes allow recovery of accidentally deleted assessment data
    - Queries will need to filter out deleted records using `deleted_at IS NULL`
    - Deleted records remain in database for potential recovery
*/

-- Add deleted_at column to assessments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessments' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE assessments ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Add index for better query performance when filtering deleted records
CREATE INDEX IF NOT EXISTS idx_assessments_deleted_at ON assessments (deleted_at);

-- Add index for common query pattern (church_id + deleted_at)
CREATE INDEX IF NOT EXISTS idx_assessments_church_active ON assessments (church_id, deleted_at);