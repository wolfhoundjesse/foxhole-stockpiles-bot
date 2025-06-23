-- Migration: Create global user_timezones table
-- Date: 2025-06-23
-- Description: Add table to store user timezone preferences globally (one per user)

-- Drop the existing per-guild table if it exists
DROP TABLE IF EXISTS user_timezones CASCADE;

-- Create the new global timezone table
CREATE TABLE user_timezones (
  user_id TEXT PRIMARY KEY,
  timezone TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient timezone lookups
CREATE INDEX idx_user_timezones_timezone ON user_timezones(timezone);

-- Add comment for documentation
COMMENT ON TABLE user_timezones IS 'Stores user timezone preferences globally (one timezone per user across all servers)';