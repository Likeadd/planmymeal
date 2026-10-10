import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
const { chargerCatalogue } = await import('../src/lib/catalogue');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const t = Date.now();
const c = await chargerCatalogue(s as never);
console.log('catalogue', c.length, 'recettes en', Date.now() - t, 'ms');
