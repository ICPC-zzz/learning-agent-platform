"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type {
  AssistantChatMessage,
  AssistantContextCompressionView,
  AssistantMultiAgentTaskView,
  AssistantResponse,
} from "../../lib/assistant/assistant-types.ts";

export type { AssistantChatMessage } from "../../lib/assistant/assistant-types.ts";

interface AssistantConversationSnapshot {
  conversationId: string;
  messages: AssistantChatMessage[];
  draftQuestion: string;
  isSubmitting: boolean;
  status: AssistantResponse["state"] | null;
  providerMode: AssistantResponse["providerMode"] | null;
  error: string | null;
  contextCompression: AssistantContextCompressionView | null;
  tasks: AssistantMultiAgentTaskView[];
}

interface AssistantConversationContextValue extends AssistantConversationSnapshot {
  setMessages: Dispatch<SetStateAction<AssistantChatMessage[]>>;
  setDraftQuestion: Dispatch<SetStateAction<string>>;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<AssistantResponse["state"] | null>>;
  setProviderMode: Dispatch<SetStateAction<AssistantResponse["providerMode"] | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setContextCompression: Dispatch<SetStateAction<AssistantContextCompressionView | null>>;
  setTasks: Dispatch<SetStateAction<AssistantMultiAgentTaskView[]>>;
  setConversationId: Dispatch<SetStateAction<string>>;
  resetConversation: () => void;
}

const AssistantConversationContext = createContext<AssistantConversationContextValue | null>(null);

export function AssistantConversationProvider({ children }: { children: ReactNode }) {
  const initialSnapshot = emptySnapshot();

  const [conversationId, setConversationId] = useState(() => initialSnapshot.conversationId);
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => initialSnapshot.messages);
  const [draftQuestion, setDraftQuestion] = useState(() => initialSnapshot.draftQuestion);
  const [isSubmitting, setIsSubmitting] = useState(() => initialSnapshot.isSubmitting);
  const [status, setStatus] = useState<AssistantResponse["state"] | null>(() => initialSnapshot.status);
  const [providerMode, setProviderMode] = useState<AssistantResponse["providerMode"] | null>(() => initialSnapshot.providerMode);
  const [error, setError] = useState<string | null>(() => initialSnapshot.error);
  const [contextCompression, setContextCompression] = useState<AssistantContextCompressionView | null>(() => initialSnapshot.contextCompression);
  const [tasks, setTasks] = useState<AssistantMultiAgentTaskView[]>(() => initialSnapshot.tasks);

  const value = useMemo<AssistantConversationContextValue>(() => ({
    conversationId,
    messages,
    draftQuestion,
    isSubmitting,
    status,
    providerMode,
    error,
    contextCompression,
    tasks,
    setConversationId,
    setMessages,
    setDraftQuestion,
    setIsSubmitting,
    setStatus,
    setProviderMode,
    setError,
    setContextCompression,
    setTasks,
    resetConversation: () => {
      setMessages([]);
      setDraftQuestion("");
      setIsSubmitting(false);
      setStatus(null);
      setProviderMode(null);
      setError(null);
      setContextCompression(null);
      setTasks([]);
      setConversationId(createConversationId());
    },
  }), [contextCompression, conversationId, draftQuestion, error, isSubmitting, messages, providerMode, status, tasks]);

  return (
    <AssistantConversationContext.Provider value={value}>
      {children}
    </AssistantConversationContext.Provider>
  );
}

export function useAssistantConversation(): AssistantConversationContextValue {
  const context = useContext(AssistantConversationContext);
  if (!context) {
    throw new Error("useAssistantConversation must be used within AssistantConversationProvider");
  }
  return context;
}

function emptySnapshot(): AssistantConversationSnapshot {
  return {
    conversationId: createConversationId(),
    messages: [],
    draftQuestion: "",
    isSubmitting: false,
    status: null,
    providerMode: null,
    error: null,
    contextCompression: null,
    tasks: [],
  };
}

function createConversationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `assistant-conv-${crypto.randomUUID()}`;
  }

  return `assistant-conv-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
