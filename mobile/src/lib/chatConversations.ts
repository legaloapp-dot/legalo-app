import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface ConversationAttachmentRow {
  id: string;
  message_id: string;
  conversation_id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

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

export async function fetchConversations(
  userId: string
): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConversationRow[];
}

export async function createConversation(
  userId: string,
  title = 'Nueva consulta'
): Promise<ConversationRow> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select()
    .single();
  if (error) throw error;
  return data as ConversationRow;
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId);
  if (error) throw error;
}

export async function deleteConversation(
  conversationId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);
  if (error) throw error;
}

export async function fetchConversationMessages(
  conversationId: string
): Promise<ConversationMessageRow[]> {
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

export async function uploadChatAttachment(
  userId: string,
  uri: string,
  fileName: string,
  mimeType: string
): Promise<{ storagePath: string; base64: string }> {
  const path = `${userId}/${Date.now()}-${fileName}`;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  const buffer = base64ToArrayBuffer(base64);
  const { error } = await supabase.storage
    .from('chat-attachments')
    .upload(path, buffer, { contentType: mimeType, cacheControl: '3600' });
  if (error) throw error;
  return { storagePath: path, base64 };
}

export async function saveConversationAttachment(params: {
  messageId: string;
  conversationId: string;
  userId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}): Promise<ConversationAttachmentRow> {
  const { data, error } = await supabase
    .from('conversation_attachments')
    .insert({
      message_id: params.messageId,
      conversation_id: params.conversationId,
      user_id: params.userId,
      storage_path: params.storagePath,
      file_name: params.fileName,
      mime_type: params.mimeType,
      file_size: params.fileSize ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ConversationAttachmentRow;
}

export async function fetchAttachmentsForConversation(
  conversationId: string
): Promise<ConversationAttachmentRow[]> {
  const { data, error } = await supabase
    .from('conversation_attachments')
    .select('*')
    .eq('conversation_id', conversationId);
  if (error) throw error;
  return (data ?? []) as ConversationAttachmentRow[];
}

export function toGeminiHistory(
  messages: ConversationMessageRow[],
  limit = 10
): Array<{ role: 'user' | 'model'; parts: { text: string }[] }> {
  return messages.slice(-limit).map((m) => ({
    role: m.role === 'ai' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }));
}

export interface HistoryAttachment {
  messageId: string;
  base64: string;
  mimeType: string;
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export interface GeminiHistoryMessage {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export async function fetchBase64FromSignedUrl(
  signedUrl: string
): Promise<string> {
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error('Failed to fetch attachment');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function toGeminiHistoryWithAttachments(
  messages: ConversationMessageRow[],
  attachmentsByMessageId: Record<string, HistoryAttachment[]>,
  limit = 10
): GeminiHistoryMessage[] {
  return messages.slice(-limit).map((m) => {
    const parts: GeminiPart[] = [];

    if (m.content.trim()) {
      parts.push({ text: m.content });
    }

    const msgAttachments = attachmentsByMessageId[m.id] ?? [];
    for (const att of msgAttachments) {
      parts.push({
        inlineData: { mimeType: att.mimeType, data: att.base64 },
      });
    }

    if (parts.length === 0) {
      parts.push({ text: '[Mensaje vacío]' });
    }

    return {
      role: m.role === 'ai' ? ('model' as const) : ('user' as const),
      parts,
    };
  });
}
