/**
 * Code provider configuration utilities.
 *
 * Reads NEXT_PUBLIC_CODE_PROVIDER to determine the active provider
 * and exposes helpers for provider-specific UI behavior.
 */

export type CodeProviderType =
  | "github"
  | "gitlab"
  | "gitbucket"
  | "bitbucket"
  | "local";

export interface ProviderConfig {
  type: CodeProviderType;
  displayName: string;
  /** Whether to use GitHub OAuth (Firebase GithubAuthProvider) */
  usesGithubOAuth: boolean;
  /** Whether PAT-based authentication is the primary flow */
  usesPAT: boolean;
  /** Human-readable label for a repository (e.g. "repository" or "project") */
  repoLabel: string;
  /** Human-readable label for a pull/merge request */
  prLabel: string;
  /** API endpoint prefix for repo operations */
  apiPrefix: string;
}

const PROVIDER_CONFIGS: Record<CodeProviderType, ProviderConfig> = {
  github: {
    type: "github",
    displayName: "GitHub",
    usesGithubOAuth: true,
    usesPAT: false,
    repoLabel: "repository",
    prLabel: "pull request",
    apiPrefix: "/api/v1/repos",
  },
  gitlab: {
    type: "gitlab",
    displayName: "GitLab",
    usesGithubOAuth: false,
    usesPAT: true,
    repoLabel: "project",
    prLabel: "merge request",
    apiPrefix: "/api/v1/repos",
  },
  gitbucket: {
    type: "gitbucket",
    displayName: "GitBucket",
    usesGithubOAuth: false,
    usesPAT: true,
    repoLabel: "repository",
    prLabel: "pull request",
    apiPrefix: "/api/v1/repos",
  },
  bitbucket: {
    type: "bitbucket",
    displayName: "Bitbucket",
    usesGithubOAuth: false,
    usesPAT: true,
    repoLabel: "repository",
    prLabel: "pull request",
    apiPrefix: "/api/v1/repos",
  },
  local: {
    type: "local",
    displayName: "Local",
    usesGithubOAuth: false,
    usesPAT: false,
    repoLabel: "repository",
    prLabel: "pull request",
    apiPrefix: "/api/v1/repos",
  },
};

/**
 * Get the active provider configuration.
 * Falls back to GitHub if NEXT_PUBLIC_CODE_PROVIDER is not set.
 */
export function getProviderConfig(): ProviderConfig {
  const providerType =
    (process.env.NEXT_PUBLIC_CODE_PROVIDER as CodeProviderType) || "github";
  return PROVIDER_CONFIGS[providerType] ?? PROVIDER_CONFIGS.github;
}

/**
 * Get the active provider type string.
 */
export function getProviderType(): CodeProviderType {
  return getProviderConfig().type;
}

/**
 * Check if the active provider is GitHub.
 */
export function isGitHubProvider(): boolean {
  return getProviderType() === "github";
}

/**
 * Check if the active provider is GitLab.
 */
export function isGitLabProvider(): boolean {
  return getProviderType() === "gitlab";
}

/**
 * Get the display name for the active provider.
 */
export function getProviderDisplayName(): string {
  return getProviderConfig().displayName;
}
