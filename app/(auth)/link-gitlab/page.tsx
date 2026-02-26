"use client";
import getHeaders from "@/app/utils/headers.util";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logoWithText } from "@/public";
import axios from "axios";
import { LucideCheck, LucideExternalLink, LucideGitlab } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import React, { useState } from "react";
import { toast } from "@/components/ui/sonner";

const LinkGitLab = () => {
  const posthog = usePostHog();
  const router = useRouter();

  const [token, setToken] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("https://gitlab.com");
  const [loading, setLoading] = useState(false);

  posthog.capture("gitlab login page viewed");

  const onLinkGitLab = async () => {
    if (!token.trim()) {
      toast.error("Please enter your GitLab Personal Access Token.");
      return;
    }

    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const headers = await getHeaders();

      await axios.post(
        `${baseUrl}/api/v1/link-gitlab`,
        {
          token: token.trim(),
          instance_url: instanceUrl.trim() || "https://gitlab.com",
        },
        { headers }
      );

      posthog.capture("gitlab linked successfully");
      toast.success("GitLab account linked successfully!");
      router.push("/newchat");
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to link GitLab account";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="lg:flex-row flex-col-reverse flex items-center justify-between w-full lg:h-screen relative">
      <div className="flex items-center justify-center w-1/2 h-full p-6">
        <div className="relative h-full w-full rounded-lg overflow-hidden">
          <Image
            src={"/images/landing.png"}
            alt="landing"
            layout="fill"
            objectFit="cover"
          />
        </div>
      </div>

      <div className="w-1/2 h-full flex items-center justify-center flex-col gap-10 text-gray-800 px-12">
        <Image src={logoWithText} alt="logo" />

        <div className="flex items-center justify-center flex-col text-border w-full max-w-md">
          <h3 className="text-2xl font-bold text-black">
            Connect your GitLab account
          </h3>

          <div className="flex items-start justify-start flex-col mt-6 gap-3 text-gray-700 w-full">
            <p className="flex items-center gap-3">
              <LucideCheck
                size={20}
                className="bg-primary rounded-full p-[0.5px] text-white flex-shrink-0"
              />
              Create a Personal Access Token with{" "}
              <code className="bg-gray-100 px-1 rounded text-sm">read_api</code>
              ,{" "}
              <code className="bg-gray-100 px-1 rounded text-sm">
                read_repository
              </code>{" "}
              scopes.
            </p>
            <p className="flex items-center gap-3">
              <LucideCheck
                size={20}
                className="bg-primary rounded-full p-[0.5px] text-white flex-shrink-0"
              />
              For private repositories also add the{" "}
              <code className="bg-gray-100 px-1 rounded text-sm">api</code>{" "}
              scope.
            </p>
          </div>

          <a
            href={`${instanceUrl.trim() || "https://gitlab.com"}/-/user_settings/personal_access_tokens`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mt-3 self-start"
          >
            <LucideExternalLink size={14} />
            Open GitLab token settings
          </a>

          <div className="flex flex-col gap-4 mt-6 w-full">
            <div>
              <Label htmlFor="instance-url" className="text-sm font-medium text-gray-700">
                GitLab Instance URL
              </Label>
              <Input
                id="instance-url"
                type="url"
                placeholder="https://gitlab.com"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Change this for self-hosted GitLab instances.
              </p>
            </div>

            <div>
              <Label htmlFor="gitlab-token" className="text-sm font-medium text-gray-700">
                Personal Access Token
              </Label>
              <Input
                id="gitlab-token"
                type="password"
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <Button
            onClick={onLinkGitLab}
            disabled={loading || !token.trim()}
            className="mt-8 gap-2 w-full"
          >
            <LucideGitlab size={18} />
            {loading ? "Linking..." : "Link GitLab account"}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default LinkGitLab;
