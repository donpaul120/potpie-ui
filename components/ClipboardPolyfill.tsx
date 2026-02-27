"use client";

import { useEffect } from "react";

/**
 * Installs a navigator.clipboard polyfill for non-secure contexts (HTTP).
 * navigator.clipboard is undefined outside of HTTPS/localhost, which causes
 * third-party components (e.g. @assistant-ui/react ActionBarCopy) to crash.
 */
export function ClipboardPolyfill() {
  useEffect(() => {
    if (typeof navigator === "undefined" || navigator.clipboard) return;

    const fallback = {
      writeText: async (text: string): Promise<void> => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(textarea);
        }
      },
      readText: async (): Promise<string> => "",
      read: async (): Promise<ClipboardItems> => [],
      write: async (): Promise<void> => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as Clipboard;

    try {
      Object.defineProperty(navigator, "clipboard", {
        value: fallback,
        configurable: true,
      });
    } catch {
      // Some browsers don't allow overriding navigator properties — ignore
    }
  }, []);

  return null;
}
