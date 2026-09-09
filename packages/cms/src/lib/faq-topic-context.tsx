"use client";

import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

type FaqTopicContextValue = {
  activeTopic: string;
  setActiveTopic: (topic: string) => void;
};

const FaqTopicContext = createContext<FaqTopicContextValue | null>(null);

export function FaqTopicProvider({
  initialTopic,
  children,
}: {
  initialTopic: string;
  children: ReactNode;
}) {
  const [activeTopic, setActiveTopicState] = useState(initialTopic);
  const setActiveTopic = useCallback((topic: string) => setActiveTopicState(topic), []);

  return (
    <FaqTopicContext.Provider value={{ activeTopic, setActiveTopic }}>
      {children}
    </FaqTopicContext.Provider>
  );
}

export function useFaqTopic(): FaqTopicContextValue {
  const ctx = useContext(FaqTopicContext);
  if (!ctx) {
    throw new Error("useFaqTopic must be used within a FaqTopicProvider");
  }
  return ctx;
}
