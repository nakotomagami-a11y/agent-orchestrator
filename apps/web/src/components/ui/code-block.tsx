"use client";

import { useState } from "react";
import { Icon } from "./icon";

export type CodeBlockProps = {
  body: string;
  /** Language hint shown in the header. */
  lang?: string;
  /** Optional file/title shown in the header. */
  title?: string;
  copyLabel?: string;
  copiedLabel?: string;
};

export function CodeBlock({ body, lang, title, copyLabel = "Copy", copiedLabel = "Copied" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <pre className="code-block">
      <div className="head">
        <span>{title ?? lang ?? "code"}</span>
        <button type="button" className="cp" onClick={onCopy}>
          <Icon name="copy" size={11} />
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <code>{body}</code>
    </pre>
  );
}
