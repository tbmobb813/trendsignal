import fs from 'fs';
import path from 'path';
import { getSupabaseServerClient } from '../lib/supabase-server';

// Load .env.local manually before initializing the client
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach((line) => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key) process.env[key] = val;
      }
    });
  }
} catch (e) {
  console.warn('Failed to load .env.local manually:', e);
}

async function main() {
  const supabase = getSupabaseServerClient();
  console.log('Clearing niche_lookups cache table...');
  
  const { error, count } = await supabase
    .from('niche_lookups')
    .delete({ count: 'exact' })
    .gte('expires_at', new Date(0).toISOString()); // delete all
    
  if (error) {
    console.error('Failed to clear cache:', error);
    process.exit(1);
  }
  
  console.log(`Successfully deleted ${count} cached lookups. Future queries will run live fetches.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
