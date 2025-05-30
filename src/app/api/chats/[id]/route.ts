import { supabaseAdmin } from '@/lib/supabase/client';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    // Get chat from Supabase
    const { data: chat, error: chatError } = await supabaseAdmin
      .from('legal_chats')
      .select('*')
      .eq('id', id)
      .single();

    if (chatError || !chat) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    // Get messages from Supabase
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('legal_messages')
      .select('*')
      .eq('chat_id', id)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    return Response.json(
      {
        chat: {
          id: chat.id,
          title: chat.title,
          createdAt: chat.created_at,
          focusMode: chat.focus_mode,
          files: chat.context_documents || [],
        },
        messages: (messages || []).map(msg => ({
          messageId: msg.message_id,
          chatId: msg.chat_id,
          content: msg.content,
          role: msg.role,
          createdAt: new Date(msg.created_at),
          sources: msg.sources || [],
          metadata: JSON.stringify(msg.metadata || {}),
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    // Check if chat exists
    const { data: chat } = await supabaseAdmin
      .from('legal_chats')
      .select('id')
      .eq('id', id)
      .single();

    if (!chat) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    // Delete messages first (due to foreign key constraint)
    await supabaseAdmin
      .from('legal_messages')
      .delete()
      .eq('chat_id', id);

    // Delete chat
    await supabaseAdmin
      .from('legal_chats')
      .delete()
      .eq('id', id);

    return Response.json(
      { message: 'Chat deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in deleting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
