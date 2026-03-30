import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nmneqvsypinszsptmjtk.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_CNEmT1dB4TviBK5XGPGR1A_OGRF-dJq';

export const supabase = createClient(supabaseUrl, supabaseKey);
