import { supabase } from './supabase';

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'ai';
  content: string;
  category: string | null;
  show_actions: boolean;
  created_at: string;
}

export async function fetchConversations(userId: string): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConversationRow[];
}

export async function createConversation(userId: string, title = 'Nueva consulta'): Promise<ConversationRow> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select()
    .single();
  if (error) throw error;
  return data as ConversationRow;
}

export async function updateConversationTitle(conversationId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId);
  if (error) throw error;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);
  if (error) throw error;
}

export async function fetchConversationMessages(conversationId: string): Promise<ConversationMessageRow[]> {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ConversationMessageRow[];
}

export async function insertConversationMessage(
  conversationId: string,
  role: 'user' | 'ai',
  content: string,
  category?: string | null,
  showActions?: boolean
): Promise<ConversationMessageRow> {
  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      category: category ?? null,
      show_actions: showActions ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ConversationMessageRow;
}

export function toGeminiHistory(
  messages: ConversationMessageRow[],
  limit = 10
): Array<{ role: 'user' | 'model'; parts: { text: string }[] }> {
  return messages
    .slice(-limit)
    .map((m) => ({
      role: m.role === 'ai' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }));
}
