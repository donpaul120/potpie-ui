"use client";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import debounce from "debounce";
import getHeaders from "@/app/utils/headers.util";
import axios from "axios";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LucideGithub, LucideGitlab, LucideSettings } from "lucide-react";
import { getProviderConfig, isGitHubProvider } from "@/lib/provider-config";
import { useRouter } from "next/navigation";

const AllRepos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const router = useRouter();
  const providerConfig = getProviderConfig();

  const githubAppUrl =
    "https://github.com/apps/" +
    process.env.NEXT_PUBLIC_GITHUB_APP_NAME +
    "/installations/select_target?setup_action=install";
  const popupRef = useRef<Window | null>(null);

  const openGitHubPopup = () => {
    popupRef.current = window.open(
      githubAppUrl,
      "_blank",
      "width=1000,height=700"
    );
  };

  const openGitLabSettings = () => {
    router.push("/link-gitlab");
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["all-repos"],
    queryFn: async () => {
      const headers = await getHeaders();
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const response = await axios.get(
        `${baseUrl}${providerConfig.apiPrefix}/user-repos`,
        { headers }
      );
      return response.data.repositories;
    }
  });

  useEffect(() => {
    const handler = debounce((value) => {
      setDebouncedSearchTerm(value);
    }, 500);

    handler(searchTerm);

    return () => {
      handler.clear();
    };
  }, [searchTerm]);

  const renderConnectButton = () => {
    if (isGitHubProvider()) {
      return (
        <Button onClick={openGitHubPopup} className="gap-2">
          <LucideGithub className="rounded-full border border-white p-1" />
          Add new repo from GitHub
        </Button>
      );
    }

    if (providerConfig.type === "gitlab") {
      return (
        <Button onClick={openGitLabSettings} className="gap-2">
          <LucideGitlab size={16} />
          Manage GitLab connection
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="m-10">
      <div className="flex w-full mx-auto items-center space-x-2">
        <Input
          type="text"
          placeholder={`Search your ${providerConfig.displayName} repositories...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {renderConnectButton()}
      </div>
      {!isLoading && data && data.length > 0 ? (
        <Table className="mt-10">
          <TableHeader>
            <TableRow className="border-b-8 border-border">
              <TableHead className="w-[200px] text-primary">Name</TableHead>
              <TableHead className="w-[200px] text-primary">Owner</TableHead>
              <TableHead className="w-[200px] text-primary">Visibility</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data
              .filter((repo: any) =>
                repo.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
              )
              .map((repo: any) => (
                <TableRow key={repo.id ?? repo.full_name} className="hover:bg-gray-100 text-black">
                  <TableCell>
                    <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                      {repo.name}
                    </a>
                  </TableCell>
                  <TableCell>{repo.owner}</TableCell>
                  <TableCell>{repo.private ? "Private" : "Public"}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      ) : isLoading ? (
        <>
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="w-full h-6 mt-4" />
          ))}
        </>
      ) : (
        <div className="flex flex-col items-start h-full w-full">
          <p className="text-primary text-center py-5">
            No {providerConfig.displayName} repositories found.
          </p>
          {providerConfig.type === "gitlab" && (
            <Button
              variant="outline"
              onClick={openGitLabSettings}
              className="mt-2 gap-2"
            >
              <LucideGitlab size={16} />
              Connect GitLab account
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default AllRepos;
