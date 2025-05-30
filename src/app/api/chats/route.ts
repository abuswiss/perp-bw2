import { supabaseAdmin } from '@/lib/supabase/client';

export const GET = async (req: Request) => {
  try {
    const { data: chats, error } = await supabaseAdmin
      .from('legal_chats')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ chats: chats || [] }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
