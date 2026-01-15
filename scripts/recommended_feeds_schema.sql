-- Recommended Feeds Table Schema
-- Run this SQL in your Supabase SQL Editor

-- Create recommended_feeds table
CREATE TABLE IF NOT EXISTS recommended_feeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_recommended_feeds_order ON recommended_feeds(sort_order);

-- Enable RLS
ALTER TABLE recommended_feeds ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all users (including anonymous) to read active recommended feeds
CREATE POLICY "Anyone can read active recommended feeds"
  ON recommended_feeds
  FOR SELECT
  USING (is_active = true);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_recommended_feeds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_recommended_feeds_updated_at
  BEFORE UPDATE ON recommended_feeds
  FOR EACH ROW
  EXECUTE FUNCTION update_recommended_feeds_updated_at();
