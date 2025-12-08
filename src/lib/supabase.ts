import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check for environment variables and provide helpful error message
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!');
  console.error('Please ensure .env.local contains:');
  console.error('VITE_SUPABASE_URL=your-project-url');
  console.error('VITE_SUPABASE_ANON_KEY=your-anon-key');
}

// Create Supabase client (will use placeholder values if env vars are missing)
// This prevents the app from crashing, but operations will fail gracefully
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Export a helper to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

