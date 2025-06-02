import { supabase } from '../src/lib/supabase/client';

async function createMissingTables() {
  console.log('🔍 Checking and creating missing tables...');

  // Create agent_tasks table if it doesn't exist
  const createAgentTasksTable = `
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      matter_id UUID,
      agent_type TEXT NOT NULL,
      query TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      input_config JSONB DEFAULT '{}',
      output_data JSONB,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // Create agent_executions table if it doesn't exist
  const createAgentExecutionsTable = `
    CREATE TABLE IF NOT EXISTS agent_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID,
      agent_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      current_step TEXT,
      result_data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  try {
    // Test if we can access the database
    console.log('🧪 Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('matters')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Database connection failed:', testError);
      return;
    }

    console.log('✅ Database connection successful');

    // Try to query agent_tasks to see if it exists
    const { data, error } = await supabase
      .from('agent_tasks')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      console.log('📝 agent_tasks table does not exist, creating...');
      
      // Use SQL execution through RPC or direct query
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: createAgentTasksTable
      });

      if (createError) {
        console.error('❌ Failed to create agent_tasks table:', createError);
      } else {
        console.log('✅ agent_tasks table created successfully');
      }
    } else if (error) {
      console.error('❌ Error checking agent_tasks table:', error);
    } else {
      console.log('✅ agent_tasks table already exists');
    }

    // Check agent_executions table
    const { data: execData, error: execError } = await supabase
      .from('agent_executions')
      .select('id')
      .limit(1);

    if (execError && execError.code === '42P01') {
      console.log('📝 agent_executions table does not exist, creating...');
      
      const { error: createExecError } = await supabase.rpc('exec_sql', {
        sql: createAgentExecutionsTable
      });

      if (createExecError) {
        console.error('❌ Failed to create agent_executions table:', createExecError);
      } else {
        console.log('✅ agent_executions table created successfully');
      }
    } else if (execError) {
      console.error('❌ Error checking agent_executions table:', execError);
    } else {
      console.log('✅ agent_executions table already exists');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createMissingTables();