"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { OpenChatProvider } from "./open-chat/OpenChatProvider";
import FloatingChatAssistant from "./open-chat/FloatingChatAssistant";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup"]);

export default function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const chatEnabled = pathname != null && !PUBLIC_PATHS.has(pathname);

  return (
    <OpenChatProvider enabled={chatEnabled}>
      {children}
      {chatEnabled && <FloatingChatAssistant />}
    </OpenChatProvider>
  );
}
