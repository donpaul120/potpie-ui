/**
 * Copy text to clipboard with fallback for non-secure contexts (HTTP).
 *
 * navigator.clipboard is only available in secure contexts (HTTPS / localhost).
 * When unavailable we fall back to the legacy document.execCommand("copy").
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback: create a temporary textarea and use execCommand
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
}
