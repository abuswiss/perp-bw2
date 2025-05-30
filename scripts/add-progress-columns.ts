import { supabaseAdmin } from '../src/lib/supabase/client';

async function addProgressColumns() {
  try {
    console.log('Adding progress and current_step columns to agent_tasks...');
    
    // Add progress column
    const { error: progressError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;'
    });
    
    if (progressError && !progressError.message.includes('already exists')) {
      console.error('Error adding progress column:', progressError);
    } else {
      console.log('✅ Progress column added successfully');
    }
    
    // Add current_step column
    const { error: stepError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS current_step TEXT;'
    });
    
    if (stepError && !stepError.message.includes('already exists')) {
      console.error('Error adding current_step column:', stepError);
    } else {
      console.log('✅ Current_step column added successfully');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

addProgressColumns();