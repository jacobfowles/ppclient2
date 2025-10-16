/*
  # Cleanup Old Authentication System

  This migration removes tables and functions from the old custom authentication system
  that have been replaced by Supabase Auth.

  ## What's being removed:
  - church_users table (users now in auth.users with metadata)
  - Old RPC functions (app_set_config, get_config_value - custom functions only)
  - Old authentication-related functions from src/utils/auth.ts are now deprecated

  ## Safety:
  - Only run this AFTER successfully migrating to Supabase Auth
  - Ensure all users have been migrated to auth.users with proper metadata
  - Backup your database before running this migration
*/

-- Drop custom RPC functions only (not built-in PostgreSQL functions)
-- Note: set_config is a PostgreSQL built-in and cannot/should not be dropped
DROP FUNCTION IF EXISTS app_set_config(text, text, boolean);
DROP FUNCTION IF EXISTS get_config_value(text);

-- Drop the church_users table
-- WARNING: This will delete all data in church_users
-- Make sure you've migrated all users to Supabase Auth first!
DROP TABLE IF EXISTS church_users CASCADE;

-- Note: No tables in this schema had foreign key references to church_users
-- All user references were optional and nullable (e.g., team_assignments.assigned_by)
