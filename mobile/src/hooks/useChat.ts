import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  createConversation,
  deleteConversation as dbDeleteConversation,
  fetchAttachmentsForConversation,
  fetchConversationMessages,
  fetchConversations,
  insertConversationMessage,
  saveConversationAttachment,
  toGeminiHistory,
  updateConversationTitle,
  uploadChatAttachment,
  type ConversationMessageRow,
  type ConversationRow,
} from '../lib/chatConversations';

export interface UploadAttachment {
  uri: string;
  name: string;
  type: 'image' | 'document';
  mimeType: string;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  signedUrl?: string;
}

export interface ChatMessage {
  id: string;
  type: 'ai' | 'user';
  content: string;
  time: string;
  caseType?: string;
  showActions?: boolean;
  attachments?: MessageAttachment[];
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cleanCategoryFromText(text: string): string {
  return text
    .replace(/```(?:json)?\s*[\s\S]*?```/gi, '')
    .replace(/^\s*\{[\s\S]*?\}\s*$/gm, '')
    .replace(/\n*CATEGORIA:\s*\[?[^\]]*\]?\s*/gi, '')
    .trim();
}

function rowToChatMessage(row: ConversationMessageRow): ChatMessage {
  return {
    id: row.id,
    type: row.role,
    content: row.content,
    time: formatTime(new Date(row.created_at)),
    caseType: row.category ?? undefined,
    showActions: row.show_actions,
  };
}

// 5MB limit for attachments sent to Gemini (base64 encoded)
const MAX_ATTACHMENTS_SIZE_BYTES = 5 * 1024 * 1024;

function estimateBase64Size(base64: string): number {
  // base64 string length * 0.75 ≈ original bytes (roughly)
  return Math.ceil(base64.length * 0.75);
}

export function useChat(clientId: string | undefined) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Track whether we've done the initial load for the current clientId
  const initializedRef = useRef<string | null>(null);
  // Track if title has been generated for current conversation (prevents stale closure issues)
  const titleGeneratedForConvRef = useRef<string | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!clientId) {
      setConversations([]);
      return;
    }
    setConversationsLoading(true);
    try {
      const list = await fetchConversations(clientId);
      setConversations(list);
      return list;
    } catch {
      setConversations([]);
      return [] as ConversationRow[];
    } finally {
      setConversationsLoading(false);
    }
  }, [clientId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const [rows, attRows] = await Promise.all([
        fetchConversationMessages(conversationId),
        fetchAttachmentsForConversation(conversationId),
      ]);

      const signedUrlMap: Record<string, string> = {};
      if (attRows.length > 0) {
        const { data: signed } = await supabase.storage
          .from('chat-attachments')
          .createSignedUrls(
            attRows.map((a) => a.storage_path),
            3600
          );
        if (signed) {
          for (const item of signed) {
            if (item.signedUrl && item.path)
              signedUrlMap[item.path] = item.signedUrl;
          }
        }
      }

      const byMessage: Record<string, MessageAttachment[]> = {};
      for (const att of attRows) {
        if (!byMessage[att.message_id]) byMessage[att.message_id] = [];
        byMessage[att.message_id].push({
          id: att.id,
          messageId: att.message_id,
          storagePath: att.storage_path,
          fileName: att.file_name,
          mimeType: att.mime_type,
          signedUrl: signedUrlMap[att.storage_path],
        });
      }

      setMessages(
        rows.map((row) => ({
          ...rowToChatMessage(row),
          attachments: byMessage[row.id],
        }))
      );
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Initial load: fetch conversations, activate most recent or create one
  useEffect(() => {
    if (!clientId || initializedRef.current === clientId) return;
    initializedRef.current = clientId;

    void (async () => {
      setConversationsLoading(true);
      try {
        let list = await fetchConversations(clientId);
        if (list.length === 0) {
          const created = await createConversation(clientId);
          list = [created];
        }
        setConversations(list);
        const first = list[0];
        setActiveConversationId(first.id);
        await loadMessages(first.id);
      } catch {
        setConversations([]);
      } finally {
        setConversationsLoading(false);
      }
    })();
  }, [clientId, loadMessages]);

  const switchConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id);
      await loadMessages(id);
    },
    [loadMessages]
  );

  const newConversation = useCallback(async () => {
    if (!clientId) return;
    try {
      const created = await createConversation(clientId);
      setConversations((prev) => [created, ...prev]);
      setActiveConversationId(created.id);
      setMessages([]);
    } catch {
      // silently fail
    }
  }, [clientId]);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await dbDeleteConversation(id);
        setConversations((prev) => {
          const next = prev.filter((c) => c.id !== id);
          // If we deleted the active one, switch to the next available or create one later
          if (id === activeConversationId) {
            if (next.length > 0) {
              void switchConversation(next[0].id);
            } else {
              setActiveConversationId(null);
              setMessages([]);
            }
          }
          return next;
        });
      } catch {
        // silently fail
      }
    },
    [activeConversationId, switchConversation]
  );

  const sendMessage = useCallback(
    async (text: string, attachmentsToUpload: UploadAttachment[] = []) => {
      const hasText = text.trim().length > 0;
      if (!clientId || (!hasText && attachmentsToUpload.length === 0)) return;

      // If no active conversation, create one first
      let convId = activeConversationId;
      if (!convId) {
        try {
          const created = await createConversation(clientId);
          setConversations((prev) => [created, ...prev]);
          setActiveConversationId(created.id);
          convId = created.id;
        } catch {
          setSendError('No se pudo crear la conversacion');
          return;
        }
      }

      setSendError(null);
      setSending(true);

      // Upload attachments to Storage (base64 returned for reuse with Gemini)
      const uploadResults = await Promise.allSettled(
        attachmentsToUpload.map(async (att) => {
          const { storagePath, base64 } = await uploadChatAttachment(
            clientId,
            att.uri,
            att.name,
            att.mimeType
          );
          return { att, storagePath, base64 };
        })
      );
      const successfulUploads = uploadResults
        .filter(
          (
            r
          ): r is PromiseFulfilledResult<{
            att: UploadAttachment;
            storagePath: string;
            base64: string;
          }> => r.status === 'fulfilled'
        )
        .map((r) => r.value);

      // Check if all uploads failed when user only sent attachments
      if (attachmentsToUpload.length > 0 && successfulUploads.length === 0) {
        setSendError('No se pudieron subir los archivos. Intenta de nuevo.');
        setSending(false);
        return;
      }

      // Build attachments array for Gemini (images + PDFs)
      const geminiAttachments = successfulUploads
        .filter(
          (u) =>
            u.att.mimeType.startsWith('image/') ||
            u.att.mimeType === 'application/pdf'
        )
        .map((u) => ({ base64: u.base64, mimeType: u.att.mimeType }));

      // Check total size of attachments for Gemini
      const totalSize = geminiAttachments.reduce(
        (sum, att) => sum + estimateBase64Size(att.base64),
        0
      );
      if (totalSize > MAX_ATTACHMENTS_SIZE_BYTES) {
        setSendError(
          `Los archivos son muy grandes (${Math.round(
            totalSize / 1024 / 1024
          )}MB). Máximo permitido: 5MB.`
        );
        setSending(false);
        return;
      }

      // Insert user message to DB
      let userRow: ConversationMessageRow;
      try {
        userRow = await insertConversationMessage(convId, 'user', text.trim());
      } catch {
        setSendError('Error al guardar el mensaje');
        setSending(false);
        return;
      }

      // Save attachment records to DB + create signed URLs
      const savedAttachments = await Promise.allSettled(
        successfulUploads.map(async ({ att, storagePath }) => {
          const saved = await saveConversationAttachment({
            messageId: userRow.id,
            conversationId: convId!,
            userId: clientId,
            storagePath,
            fileName: att.name,
            mimeType: att.mimeType,
          });
          const { data: signed } = await supabase.storage
            .from('chat-attachments')
            .createSignedUrl(storagePath, 3600);
          const result: MessageAttachment = {
            id: saved.id,
            messageId: userRow.id,
            storagePath,
            fileName: att.name,
            mimeType: att.mimeType,
            signedUrl: signed?.signedUrl,
          };
          return result;
        })
      );
      const finalAttachments: MessageAttachment[] = savedAttachments
        .filter(
          (r): r is PromiseFulfilledResult<MessageAttachment> =>
            r.status === 'fulfilled'
        )
        .map((r) => r.value);

      const userMsg: ChatMessage = {
        ...rowToChatMessage(userRow),
        attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Check if title needs to be generated (use ref to avoid stale closure)
      const shouldGenerateTitle =
        titleGeneratedForConvRef.current !== convId && text.trim().length > 0;

      // Build history from current messages (before the new user message)
      const currentRows = messages.map(
        (m): ConversationMessageRow => ({
          id: m.id,
          conversation_id: convId!,
          role: m.type,
          content: m.content,
          category: m.caseType ?? null,
          show_actions: m.showActions ?? false,
          created_at: new Date().toISOString(),
        })
      );
      const history = toGeminiHistory(currentRows);

      const aiMessageId = Date.now().toString();

      try {
        const aiInputText = text.trim() || '[Archivos adjuntos]';
        const { data, error: fnError } = await supabase.functions.invoke(
          'legal-chat',
          {
            body: {
              message: aiInputText,
              history,
              ...(geminiAttachments.length > 0 && {
                attachments: geminiAttachments,
              }),
            },
          }
        );

        if (fnError) {
          const errMsg =
            typeof fnError === 'object' &&
            fnError !== null &&
            'message' in fnError
              ? (fnError as { message?: string }).message
              : String(fnError);
          throw new Error(
            data?.error || errMsg || 'Error al conectar con la función'
          );
        }
        if (data?.error) throw new Error(data.error);

        const responseText =
          data?.response || 'No pude procesar tu consulta. Intenta de nuevo.';
        const category: string | null = data?.category || null;
        const cleanedText = cleanCategoryFromText(responseText);

        // Insert AI message to DB
        const aiRow = await insertConversationMessage(
          convId,
          'ai',
          cleanedText,
          category,
          !!category
        );

        setMessages((prev) => [...prev, rowToChatMessage(aiRow)]);

        // Auto-title: use first 50 chars of the user's first message
        if (shouldGenerateTitle) {
          titleGeneratedForConvRef.current = convId;
          const title = text.trim().slice(0, 50);
          void updateConversationTitle(convId, title).then(() => {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? { ...c, title, updated_at: new Date().toISOString() }
                  : c
              )
            );
          });
        } else {
          // Keep conversations list updated_at fresh
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? { ...c, updated_at: new Date().toISOString() }
                : c
            )
          );
        }
      } catch (err) {
        setSendError(
          err instanceof Error ? err.message : 'Error al conectar con LÉGALO AI'
        );
        const fallbackMsg: ChatMessage = {
          id: aiMessageId,
          type: 'ai',
          content:
            'Lo siento, hubo un error al procesar tu consulta. Verifica tu conexión e intenta de nuevo.',
          time: formatTime(new Date()),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setSending(false);
      }
    },
    [clientId, activeConversationId, messages]
  );

  return {
    conversations,
    conversationsLoading,
    refreshConversations,
    activeConversationId,
    messages,
    messagesLoading,
    sendMessage,
    sending,
    sendError,
    newConversation,
    switchConversation,
    deleteConversation,
  };
}
