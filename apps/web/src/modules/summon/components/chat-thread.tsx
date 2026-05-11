"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { MessageBubble } from "./message-bubble";
import type { ThreadItem } from "../utils/thread-types";

export type ChatThreadProps = {
  items: ThreadItem[];
  agentName: string;
};

export function ChatThread({ items, agentName }: ChatThreadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="thread-empty">
        <div className="greet">
          <h2>Talk to {agentName}</h2>
          <p>{t("common.empty")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-scroll" ref={ref}>
      <div className="chat-thread">
        {items.map((item) => (
          <MessageBubble key={item.id} item={item} agentName={agentName} />
        ))}
      </div>
    </div>
  );
}
