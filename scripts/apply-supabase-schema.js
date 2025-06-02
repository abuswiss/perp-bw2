#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchema() {
  console.log('🚀 Applying Supabase schema...');
  
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.warn(`⚠️  Warning on statement ${i + 1}:`, error.message);
        }
      } catch (err) {
        console.warn(`⚠️  Warning on statement ${i + 1}:`, err.message);
      }
    }
    
    console.log('✅ Schema application completed!');
    
    // Verify key tables exist
    console.log('\n🔍 Verifying table creation...');
    const tablesToCheck = ['matters', 'agent_tasks', 'documents', 'case_citations'];
    
    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.log(`❌ Table '${table}': ${error.message}`);
        } else {
          console.log(`✅ Table '${table}': OK`);
        }
      } catch (err) {
        console.log(`❌ Table '${table}': ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error applying schema:', error);
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function applySchemaAlternative() {
  console.log('🚀 Applying Supabase schema (alternative method)...');
  
  try {
    // Create essential tables individually with error handling
    const createMatterTable = `
      CREATE TABLE IF NOT EXISTS matters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        matter_number TEXT,
        client_name TEXT,
        practice_area TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    const createAgentTasksTable = `
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        matter_id UUID REFERENCES matters(id) ON DELETE CASCADE,
        agent_type TEXT NOT NULL,
        query TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    const createDocumentsTable = `
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        matter_id UUID REFERENCES matters(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        file_type TEXT,
        file_size BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    const tables = [
      { name: 'matters', sql: createMatterTable },
      { name: 'agent_tasks', sql: createAgentTasksTable },
      { name: 'documents', sql: createDocumentsTable }
    ];
    
    for (const table of tables) {
      console.log(`📝 Creating table: ${table.name}`);
      const { error } = await supabase.rpc('exec_sql', { sql: table.sql });
      if (error) {
        console.warn(`⚠️  Warning creating ${table.name}:`, error.message);
      } else {
        console.log(`✅ Table ${table.name} created successfully`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in alternative schema application:', error);
  }
}

// Run both approaches
async function main() {
  await applySchemaAlternative();
  console.log('\n' + '='.repeat(50) + '\n');
  await applySchema();
}

main().catch(console.error);