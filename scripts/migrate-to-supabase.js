// Simple migration script to run the Supabase migration
// Run with: node scripts/migrate-to-supabase.js

import { runMigration } from '../src/lib/db/migrate-to-supabase.js';

console.log('Starting migration to Supabase...');

runMigration()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });