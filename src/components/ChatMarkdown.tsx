"use client";

import ReactMarkdown from "react-markdown";

export default function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chatMarkdown">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
