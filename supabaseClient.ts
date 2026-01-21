import { createClient } from '@supabase/supabase-js';

// Credenciais do Supabase (Hardcoded para garantir funcionamento no ambiente atual)
const supabaseUrl = 'https://rygqymvcynmfdpvvicdo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5Z3F5bXZjeW5tZmRwdnZpY2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NTYyNDAsImV4cCI6MjA4NDUzMjI0MH0.xEDEP4UZ3nfNNxx62MwSgQe_oUTCdCBVFkuV2Pr_VSA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
