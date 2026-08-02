import fs from 'fs';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

import dbConnect from '../lib/db';
import { listClusterDatabases, getClusterWideStats } from '../lib/db-analytics.server';

function fmt(bytes: number) {
  return (bytes / (1024 ** 3)).toFixed(3) + ' GB';
}

async function main() {
  await dbConnect();
  const dbs = await listClusterDatabases();
  console.log('Databases seen:', dbs.map(d => `${d.name} (${fmt(d.sizeOnDisk)})`).join(', '));

  const stats = await getClusterWideStats(dbs);
  console.log('\nPer-database breakdown:');
  for (const row of stats.perDatabase) {
    console.log(`  ${row.name}: dataSize=${fmt(row.dataSize)} indexSize=${fmt(row.indexSize)} storageSize=${fmt(row.storageSize)} total=${fmt(row.totalSize)}${row.error ? ' ERROR: ' + row.error : ''}`);
  }

  console.log('\nCluster totals:');
  console.log('  dataSize:', fmt(stats.dataSize));
  console.log('  indexSize:', fmt(stats.indexSize));
  console.log('  storageSize:', fmt(stats.storageSize));
  console.log('  totalSize (dataSize+indexSize):', fmt(stats.totalSize));
  console.log('  failedDatabases:', stats.failedDatabases);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
