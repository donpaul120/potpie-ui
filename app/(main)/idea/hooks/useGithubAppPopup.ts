import { useRef, useEffect } from "react";
import { isGitLabProvider } from "@/lib/provider-config";

/**
 * Shared hook for opening provider app installation popup or redirect.
 * For GitHub: opens the GitHub App installation popup and polls for closure.
 * For GitLab: redirects to /link-gitlab page.
 * Handles cleanup of intervals and timeouts on unmount.
 *
 * @param onInstalled - Callback invoked when popup is closed (installation detected, GitHub only)
 */
export function useGithubAppPopup(onInstalled?: () => void) {
  const popupRef = useRef<Window | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const openGithubPopup = () => {
    // For GitLab, redirect to the link-gitlab page instead of opening a popup
    if (isGitLabProvider()) {
      window.location.href = "/link-gitlab";
      return;
    }

    const githubAppUrl =
      "https://github.com/apps/" +
      process.env.NEXT_PUBLIC_GITHUB_APP_NAME +
      "/installations/select_target?setup_action=install";

    // Clear any existing interval/timeout before opening new popup
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    popupRef.current = window.open(
      githubAppUrl,
      "_blank",
      "width=1000,height=700"
    );

    if (!popupRef.current) {
      return;
    }

    // Poll for popup closure
    intervalRef.current = setInterval(() => {
      if (popupRef.current?.closed) {
        // Clear interval immediately when popup is closed
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Dispatch event for components that listen to it
        window.dispatchEvent(new CustomEvent("github-app-installed"));

        // Invoke callback if provided
        if (onInstalled) {
          // Use timeout to allow backend to sync
          timeoutRef.current = setTimeout(() => {
            onInstalled();
            timeoutRef.current = null;
          }, 2000);
        }
      }
    }, 1000);
  };

  return { openGithubPopup, popupRef };
}

