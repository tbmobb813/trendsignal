/**
 * Run with: npx tsx scripts/capture-fixture.ts "some search query"
 *
 * Hits your running dev server's /api/niche endpoint and saves the
 * result straight into test-data/ as clean JSON — no manual curl +
 * copy-paste + hand-extraction required. Filename is auto-slugified
 * from the query.
 *
 * Requires: npm run dev running in another terminal.
 */
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.NICHE_API_BASE ?? 'http://localhost:3000';
const FIXTURE_DIR = path.join(__dirname, '..', 'test-data');

function slugify(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

async function main() {
  const query = process.argv.slice(2).join(' ');

  if (!query) {
    console.error('Usage: npx tsx scripts/capture-fixture.ts "your search query"');
    process.exit(1);
  }

  console.log(`Fetching: "${query}"...`);

  const url = `${API_BASE}/api/niche?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error(`Request failed: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error(body);
    process.exit(1);
  }

  const json = await res.json();
  console.log(`Source: ${json.source} | Videos: ${json.data.videos.length} | Channels: ${json.data.channels.length}`);

  if (!fs.existsSync(FIXTURE_DIR)) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  }

  const filename = `${slugify(query)}.json`;
  const filepath = path.join(FIXTURE_DIR, filename);

  if (fs.existsSync(filepath)) {
    console.log(`Note: overwriting existing fixture at ${filename}`);
  }

  fs.writeFileSync(filepath, JSON.stringify(json.data, null, 2));
  console.log(`Saved to test-data/${filename}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
