import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  createConversation,
  deleteConversation as dbDeleteConversation,
  fetchConversationMessages,
  fetchConversations,
  insertConversationMessage,
  toGeminiHistory,
  updateConversationTitle,
  type ConversationMessageRow,
  type ConversationRow,
} from '../lib/chatConversations';

export interface ChatMessage {
  id: string;
  type: 'ai' | 'user';
  content: string;
  time: string;
  caseType?: string;
  showActions?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
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

export function useChat(clientId: string | undefined) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Track whether we've done the initial load for the current clientId
  const initializedRef = useRef<string | null>(null);

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
      const rows = await fetchConversationMessages(conversationId);
      setMessages(rows.map(rowToChatMessage));
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

  const switchConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    await loadMessages(id);
  }, [loadMessages]);

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

  const deleteConversation = useCallback(async (id: string) => {
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
  }, [activeConversationId, switchConversation]);

  const sendMessage = useCallback(async (text: string) => {
    if (!clientId || !text.trim()) return;

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

    // Insert user message to DB
    let userRow: ConversationMessageRow;
    try {
      userRow = await insertConversationMessage(convId, 'user', text.trim());
    } catch {
      setSendError('Error al guardar el mensaje');
      setSending(false);
      return;
    }

    const userMsg = rowToChatMessage(userRow);
    setMessages((prev) => [...prev, userMsg]);

    // Check if this is the first user message (for auto-title)
    const isFirstUserMessage = messages.filter((m) => m.type === 'user').length === 0;

    // Build history from current messages (before the new user message)
    const currentRows = messages.map((m): ConversationMessageRow => ({
      id: m.id,
      conversation_id: convId!,
      role: m.type,
      content: m.content,
      category: m.caseType ?? null,
      show_actions: m.showActions ?? false,
      created_at: new Date().toISOString(),
    }));
    const history = toGeminiHistory(currentRows);

    const aiMessageId = Date.now().toString();

    try {
      const { data, error: fnError } = await supabase.functions.invoke('legal-chat', {
        body: { message: text.trim(), history },
      });

      if (fnError) {
        const errMsg =
          typeof fnError === 'object' && fnError !== null && 'message' in fnError
            ? (fnError as { message?: string }).message
            : String(fnError);
        throw new Error(data?.error || errMsg || 'Error al conectar con la función');
      }
      if (data?.error) throw new Error(data.error);

      const responseText = data?.response || 'No pude procesar tu consulta. Intenta de nuevo.';
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
      if (isFirstUserMessage) {
        const title = text.trim().slice(0, 50);
        void updateConversationTitle(convId, title).then(() => {
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, title, updated_at: new Date().toISOString() } : c))
          );
        });
      } else {
        // Keep conversations list updated_at fresh
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c
          )
        );
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Error al conectar con LÉGALO AI');
      const fallbackMsg: ChatMessage = {
        id: aiMessageId,
        type: 'ai',
        content: 'Lo siento, hubo un error al procesar tu consulta. Verifica tu conexión e intenta de nuevo.',
        time: formatTime(new Date()),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setSending(false);
    }
  }, [clientId, activeConversationId, messages]);

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
