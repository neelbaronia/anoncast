import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Missing Supabase configuration. DB operations will fail.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseServiceKey || ''
);

/**
 * DATABASE SCHEMA (Run this in Supabase SQL Editor):
 * 
 * -- Table for Shows (one per user/blog)
 * create table shows (
 *   id uuid primary key default gen_random_uuid(),
 *   title text not null,
 *   description text,
 *   author text,
 *   image_url text,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- Table for Episodes (audio files)
 * create table episodes (
 *   id uuid primary key default gen_random_uuid(),
 *   show_id uuid references shows(id) on delete cascade not null,
 *   title text not null,
 *   description text,
 *   audio_url text not null,
 *   duration integer, -- in seconds
 *   published_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 */
