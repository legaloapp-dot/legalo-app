import type { ConversationRow } from '../../lib/chatConversations';

export interface ConversationListModalProps {
  visible: boolean;
  onClose: () => void;
  conversations: ConversationRow[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onDelete: (id: string) => void;
  loading: boolean;
}
