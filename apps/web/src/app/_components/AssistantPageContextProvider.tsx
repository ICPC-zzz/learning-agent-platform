"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import {
  createSafeAssistantPageContext,
  mergeAssistantPageContext,
} from "../../lib/assistant/page-context.ts";
import type {
  SafeAssistantPageContext,
  SafeAssistantPageContextInput,
} from "../../lib/assistant/assistant-types.ts";

const AssistantPageContext = createContext<SafeAssistantPageContext | null>(null);
const AssistantPageUpdaterContext = createContext<
  ((value: SafeAssistantPageContextInput) => void) | null
>(null);

export function AssistantPageContextProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: SafeAssistantPageContextInput;
}) {
  const pathname = usePathname();
  const parent = useContext(AssistantPageContext);
  const [context, setContext] = useState<SafeAssistantPageContext>(() => {
    const base = parent ?? createSafeAssistantPageContext(pathname, value);
    return value ? mergeAssistantPageContext(base, value) : base;
  });

  useEffect(() => {
    const base = parent ?? createSafeAssistantPageContext(pathname, value);
    setContext(value ? mergeAssistantPageContext(base, value) : base);
  }, [parent, pathname, value]);

  const updateContext = useCallback((next: SafeAssistantPageContextInput) => {
    setContext((current) => mergeAssistantPageContext(current, next));
  }, []);

  return (
    <AssistantPageContext.Provider value={context}>
      <AssistantPageUpdaterContext.Provider value={updateContext}>
        {children}
      </AssistantPageUpdaterContext.Provider>
    </AssistantPageContext.Provider>
  );
}

export function useAssistantPageContext(): SafeAssistantPageContext {
  const context = useContext(AssistantPageContext);
  const pathname = usePathname();
  if (context) {
    return context;
  }
  return createSafeAssistantPageContext(pathname);
}

export function useAssistantPageContextUpdater(): (value: SafeAssistantPageContextInput) => void {
  const updater = useContext(AssistantPageUpdaterContext);
  return updater ?? (() => undefined);
}
