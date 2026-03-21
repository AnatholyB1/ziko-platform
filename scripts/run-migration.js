/**
 * Run migration SQL via multiple Supabase endpoint strategies.
 */
const SUPABASE_URL = 'https://slkobhavpwsubnsmuhya.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsa29iaGF2cHdzdWJuc211aHlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1MjQ3NiwiZXhwIjoyMDg5MzI4NDc2fQ.RmS5gwI64MJNhsAo_EWvJ9aewShmrwc6hEMFaexS7_8';

const sql = `
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS name_fr TEXT;
ALTER TABLE public.food_database ADD COLUMN IF NOT EXISTS name_fr TEXT;
CREATE INDEX IF NOT EXISTS idx_food_name_fr ON public.food_database(name_fr);
`;

async function tryEndpoint(url, body, label) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(`[${label}] Status: ${res.status} — ${text.substring(0, 200)}`);
    return res.status < 400;
  } catch (e) {
    console.log(`[${label}] Error: ${e.message}`);
    return false;
  }
}

async function run() {
  // Strategy 1: Create a helper function first, then call it
  const createFn = `
    CREATE OR REPLACE FUNCTION public.run_migration_011()
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS name_fr TEXT;
      ALTER TABLE public.food_database ADD COLUMN IF NOT EXISTS name_fr TEXT;
      CREATE INDEX IF NOT EXISTS idx_food_name_fr ON public.food_database(name_fr);
    END;
    $$;
  `;
  
  // Try creating function via SQL API
  const endpoints = [
    [`${SUPABASE_URL}/rest/v1/rpc/run_migration_011`, {}, 'rpc-call'],
  ];
  
  // First, let's just test: can we read exercises with name_fr?
  console.log('Testing if name_fr column already exists...');
  const testRes = await fetch(`${SUPABASE_URL}/rest/v1/exercises?select=name,name_fr&limit=1`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });
  const testText = await testRes.text();
  console.log(`Test query status: ${testRes.status} — ${testText.substring(0, 300)}`);
  
  if (testRes.status === 200) {
    console.log('name_fr column already exists!');
    return;
  }
}

run();
