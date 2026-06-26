"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type {
  AssistantChatMessage,
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
}

interface AssistantConversationContextValue extends AssistantConversationSnapshot {
  setMessages: Dispatch<SetStateAction<AssistantChatMessage[]>>;
  setDraftQuestion: Dispatch<SetStateAction<string>>;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<AssistantResponse["state"] | null>>;
  setProviderMode: Dispatch<SetStateAction<AssistantResponse["providerMode"] | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setConversationId: Dispatch<SetStateAction<string>>;
  resetConversation: () => void;
}

const STORAGE_KEY = "lap-web-assistant-conversation-v1";
const MAX_STORED_MESSAGES = 20;

const AssistantConversationContext = createContext<AssistantConversationContextValue | null>(null);

export function AssistantConversationProvider({ children }: { children: ReactNode }) {
  const initialSnapshot = loadSnapshot();

  const [conversationId, setConversationId] = useState(() => initialSnapshot.conversationId);
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => initialSnapshot.messages);
  const [draftQuestion, setDraftQuestion] = useState(() => initialSnapshot.draftQuestion);
  const [isSubmitting, setIsSubmitting] = useState(() => initialSnapshot.isSubmitting);
  const [status, setStatus] = useState<AssistantResponse["state"] | null>(() => initialSnapshot.status);
  const [providerMode, setProviderMode] = useState<AssistantResponse["providerMode"] | null>(() => initialSnapshot.providerMode);
  const [error, setError] = useState<string | null>(() => initialSnapshot.error);

  useEffect(() => {
    saveSnapshot({ conversationId, messages, draftQuestion, isSubmitting, status, providerMode, error });
  }, [conversationId, messages, draftQuestion, isSubmitting, status, providerMode, error]);

  const value = useMemo<AssistantConversationContextValue>(() => ({
    conversationId,
    messages,
    draftQuestion,
    isSubmitting,
    status,
    providerMode,
    error,
    setConversationId,
    setMessages,
    setDraftQuestion,
    setIsSubmitting,
    setStatus,
    setProviderMode,
    setError,
    resetConversation: () => {
      setMessages([]);
      setDraftQuestion("");
      setIsSubmitting(false);
      setStatus(null);
      setProviderMode(null);
      setError(null);
      setConversationId(createConversationId());
    },
  }), [conversationId, draftQuestion, error, isSubmitting, messages, providerMode, status]);

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

function loadSnapshot(): AssistantConversationSnapshot {
  if (typeof window === "undefined") {
    return emptySnapshot();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptySnapshot();
    }

    const parsed = JSON.parse(raw) as Partial<AssistantConversationSnapshot> | null;
    if (!parsed || typeof parsed !== "object") {
      return emptySnapshot();
    }

    return {
      conversationId: typeof parsed.conversationId === "string" && parsed.conversationId.trim().length > 0
        ? parsed.conversationId
        : createConversationId(),
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.filter(isAssistantChatMessage).slice(0, MAX_STORED_MESSAGES)
        : [],
      draftQuestion: typeof parsed.draftQuestion === "string" ? parsed.draftQuestion : "",
      isSubmitting: typeof parsed.isSubmitting === "boolean" ? parsed.isSubmitting : false,
      status: isAssistantResponseState(parsed.status) ? parsed.status : null,
      providerMode: isAssistantProviderMode(parsed.providerMode) ? parsed.providerMode : null,
      error: typeof parsed.error === "string" && parsed.error.trim().length > 0 ? parsed.error : null,
    };
  } catch {
    return emptySnapshot();
  }
}

function saveSnapshot(snapshot: AssistantConversationSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      conversationId: snapshot.conversationId,
      messages: snapshot.messages.slice(0, MAX_STORED_MESSAGES),
      draftQuestion: snapshot.draftQuestion,
      isSubmitting: snapshot.isSubmitting,
      status: snapshot.status,
      providerMode: snapshot.providerMode,
      error: snapshot.error,
    }));
  } catch {
    // Ignore storage failures.
  }
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
  };
}

function createConversationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `assistant-conv-${crypto.randomUUID()}`;
  }

  return `assistant-conv-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function isAssistantChatMessage(value: unknown): value is AssistantChatMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && (record.role === "user" || record.role === "assistant")
    && typeof record.content === "string"
    && typeof record.createdAt === "string";
}

function isAssistantResponseState(value: unknown): value is AssistantConversationSnapshot["status"] {
  return value === "ok" || value === "blocked" || value === "unavailable" || value === "error" || value === null;
}

function isAssistantProviderMode(value: unknown): value is AssistantConversationSnapshot["providerMode"] {
  return value === "real" || value === "blocked" || value === "unavailable" || value === "error" || value === null;
}
