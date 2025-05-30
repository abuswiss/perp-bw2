import db from './index'
import { supabaseAdmin } from '../supabase/client'
import { chats, messages } from './schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function migrateToSupabase() {
  console.log('Starting migration to Supabase...')

  try {
    // Create a default organization for existing data
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'Default Organization',
        subscription_tier: 'free',
        settings: {}
      })
      .select()
      .single()

    if (orgError) {
      console.error('Error creating organization:', orgError)
      return
    }

    console.log('Created default organization:', org.id)

    // Migrate existing chats
    const existingChats = await db.select().from(chats).all()
    console.log(`Found ${existingChats.length} chats to migrate`)

    for (const chat of existingChats) {
      try {
        // Create a default matter for each chat
        const { data: matter, error: matterError } = await supabaseAdmin
          .from('matters')
          .insert({
            organization_id: org.id,
            name: chat.title || 'Untitled Research',
            description: `Migrated from chat: ${chat.id}`,
            status: 'active',
            metadata: { 
              migrated: true, 
              originalChatId: chat.id,
              originalFiles: chat.files || []
            }
          })
          .select()
          .single()

        if (matterError) {
          console.error(`Error creating matter for chat ${chat.id}:`, matterError)
          continue
        }

        // Create the legal chat
        const { error: chatError } = await supabaseAdmin
          .from('legal_chats')
          .insert({
            id: chat.id,
            matter_id: matter.id,
            title: chat.title,
            focus_mode: chat.focusMode,
            created_at: chat.createdAt,
            metadata: { 
              migrated: true, 
              originalFiles: chat.files 
            }
          })

        if (chatError) {
          console.error(`Error migrating chat ${chat.id}:`, chatError)
          continue
        }

        // Migrate messages for this chat
        const chatMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.chatId, chat.id))
          .all()

        console.log(`Migrating ${chatMessages.length} messages for chat ${chat.id}`)

        for (const message of chatMessages) {
          const { error: msgError } = await supabaseAdmin
            .from('legal_messages')
            .insert({
              chat_id: chat.id,
              message_id: message.messageId,
              role: message.role as 'user' | 'assistant' | 'system',
              content: message.content,
              sources: message.metadata,
              created_at: (message.metadata as any)?.createdAt || new Date().toISOString()
            })

          if (msgError) {
            console.error(`Error migrating message ${message.id}:`, msgError)
          }
        }

        console.log(`Successfully migrated chat ${chat.id} with its messages`)
      } catch (error) {
        console.error(`Error processing chat ${chat.id}:`, error)
      }
    }

    console.log('Migration completed!')
    
    // Return migration summary
    return {
      organization_id: org.id,
      chats_migrated: existingChats.length,
      status: 'completed'
    }

  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

// Utility function to run the migration
export async function runMigration() {
  try {
    const result = await migrateToSupabase()
    console.log('Migration result:', result)
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  }
}