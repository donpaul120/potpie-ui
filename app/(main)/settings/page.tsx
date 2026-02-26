"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import { CalendarIcon, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import getHeaders from "@/app/utils/headers.util";
import SettingsService, {
  type TokensByDayItem,
  type AnalyticsSummary,
} from "@/services/SettingsService";

const StackedBarChart = dynamic(() => import("./StackedBarChart"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
      Loading chart…
    </div>
  ),
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

// ── Heatmap helpers ────────────────────────────────────────────────────────────
function intensityColor(val: number): string {
  if (val === 0) return "#e5e7eb";
  if (val < 0.25) return "#d1fae5";
  if (val < 0.5) return "#6ee7b7";
  if (val < 0.75) return "#34d399";
  return "#059669";
}

const HEATMAP_ROWS = 4;
const HEATMAP_COLS = 7;

/** Build heatmap grid from daily token usage. Each cell = that day's tokens normalized 0–1 by max in period. */
function buildIntensityData(
  dailyTokens: { date: string; tokens: number }[]
): number[][] {
  const sorted = [...dailyTokens].sort((a, b) => a.date.localeCompare(b.date));
  const maxTokens = Math.max(1, ...sorted.map((d) => d.tokens));
  const grid: number[][] = [];
  for (let r = 0; r < HEATMAP_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < HEATMAP_COLS; c++) {
      const i = r * HEATMAP_COLS + c;
      const cell = sorted[i];
      const normalized = cell ? cell.tokens / maxTokens : 0;
      row.push(normalized);
    }
    grid.push(row);
  }
  return grid;
}

interface TokenIntensityGridProps {
  intensityData: number[][];
}

function TokenIntensityGrid({ intensityData }: TokenIntensityGridProps) {
  return (
    <div className="mb-5 w-full flex items-center justify-center">
      <div
        className="grid gap-x-2 gap-y-4 w-[400px] max-w-full"
        style={{
          gridTemplateColumns: `repeat(${HEATMAP_COLS}, auto)`,
        }}
      >
        {intensityData.map((row, ri) =>
          row.map((val, ci) => (
            <div
              key={`${ri}-${ci}`}
              className="rounded-sm w-11 h-11 sm:w-11 sm:h-11"
              style={{ backgroundColor: intensityColor(val) }}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Date range & chart data ───────────────────────────────────────────────────
function getDateRange(range: string): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "last_week") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

const CHART_COLORS = ["#2B1C37", "#366C9F", "#7FD7AF", "#D8F2DF"];

function buildChartData(
  items: TokensByDayItem[]
): { labels: string[]; datasets: { label: string; data: number[]; backgroundColor: string }[] } {
  const byDate = new Map<string, Map<string, number>>();
  const projectOrder: string[] = [];
  for (const item of items) {
    const projectKey = item.project_id ?? "__others__";
    if (!projectOrder.includes(projectKey)) projectOrder.push(projectKey);
    if (!byDate.has(item.date)) byDate.set(item.date, new Map());
    const dayMap = byDate.get(item.date)!;
    dayMap.set(projectKey, (dayMap.get(projectKey) ?? 0) + item.total_tokens);
  }
  const sortedDates = Array.from(byDate.keys()).sort();
  const othersLast = [...projectOrder].sort((a, b) => (a === "__others__" ? 1 : b === "__others__" ? -1 : 0));
  const labels = sortedDates;
  const datasets = othersLast.map((projectKey, i) => ({
    label: projectKey === "__others__" ? "No project" : projectKey,
    data: sortedDates.map((d) => byDate.get(d)?.get(projectKey) ?? 0),
    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
  }));
  return { labels, datasets };
}

function buildChartDataFromDailyCosts(
  dailyCosts: AnalyticsSummary["daily_costs"] | undefined
): { labels: string[]; datasets: { label: string; data: number[]; backgroundColor: string }[] } {
  if (!dailyCosts || dailyCosts.length === 0) {
    return { labels: [], datasets: [] };
  }
  const sorted = [...dailyCosts].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map((d) => d.date);
  const data = sorted.map((d) => d.tokens ?? 0);
  return {
    labels,
    datasets: [
      {
        label: "All projects",
        data,
        backgroundColor: CHART_COLORS[0],
      },
    ],
  };
}

// ── Provider icons ────────────────────────────────────────────────────────────

function OpenAIIcon() {
  return <img src="/images/openai.svg" alt="OpenAI" width={16} height={16} />;
}


function AnthropicIcon() {
  return <img src="/images/anthropic.svg" alt="Anthropic" width={16} height={16} />;
}


function OpenRouterIcon() {
  return <img src="/images/openrouter.svg" alt="OpenRouter" width={16} height={16} />;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface KeySecrets {
  inference_config: {
    api_key: string;
    provider?: string;
  };
}

interface ApiKeyState {
  api_key: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const queryClient = useQueryClient();

  const [dateRange, setDateRange] = useState("today");

  // Provider key inputs
  const [openAIInput, setOpenAIInput] = useState("");
  const [anthropicInput, setAnthropicInput] = useState("");
const [openRouterInput, setOpenRouterInput] = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: apiKeyData, isLoading: isLoadingKey } = useQuery<ApiKeyState>({
    queryKey: ["api-key"],
    queryFn: async () => {
      const headers = await getHeaders();
      const res = await axios.get<{ api_key: string }>(
        `${BASE_URL}/api/v1/api-keys`,
        { headers }
      );
      return { api_key: res.data.api_key };
    },
  });

  const { data: keySecrets } = useQuery<KeySecrets>({
    queryKey: ["secrets"],
    queryFn: async () => {
      const headers = await getHeaders();
      const res = await axios.get<KeySecrets>(
        `${BASE_URL}/api/v1/secrets/all`,
        { headers }
      );
      return res.data;
    },
  });

  const { startDate, endDate } = useMemo(() => getDateRange(dateRange), [dateRange]);

  const {
    data: tokensByDay,
    isLoading: isLoadingTokens,
    isError: isErrorTokens,
    error: errorTokens,
  } = useQuery({
    queryKey: ["analytics-tokens-by-day", startDate, endDate],
    queryFn: () => SettingsService.getTokensByDay(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });

  const {
    data: analyticsSummary,
    isLoading: isLoadingSummary,
    isError: isErrorSummary,
    error: errorSummary,
  } = useQuery({
    queryKey: ["analytics-summary", startDate, endDate],
    queryFn: () => SettingsService.getAnalyticsSummary(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });

  const chartData = useMemo(() => {
    if (tokensByDay && tokensByDay.length > 0) {
      return buildChartData(tokensByDay);
    }
    if (analyticsSummary?.daily_costs?.length) {
      return buildChartDataFromDailyCosts(analyticsSummary.daily_costs);
    }
    return { labels: [], datasets: [] as { label: string; data: number[]; backgroundColor: string }[] };
  }, [tokensByDay, analyticsSummary?.daily_costs]);

  const {
    totalTokens,
    totalRequests,
    totalThreads,
    intensityData,
  } = useMemo(() => {
    type DayAgg = { date: string; tokens: number; runCount: number };
    let daily: DayAgg[] = [];

    if (analyticsSummary?.daily_costs?.length) {
      daily = analyticsSummary.daily_costs.map((d) => ({
        date: d.date,
        tokens: d.tokens ?? 0,
        runCount: d.run_count ?? 0,
      }));
    } else if (tokensByDay?.length) {
      const byDate = new Map<string, DayAgg>();
      for (const item of tokensByDay) {
        const existing =
          byDate.get(item.date) ??
          ({
            date: item.date,
            tokens: 0,
            runCount: 0,
          } as DayAgg);
        existing.tokens += item.total_tokens;
        byDate.set(item.date, existing);
      }
      daily = Array.from(byDate.values());
    }

    const totalTokens =
      daily.length > 0
        ? daily.reduce((sum, d) => sum + d.tokens, 0)
        : (null as number | null);

    const totalRequests =
      daily.length > 0
        ? daily.reduce((sum, d) => sum + d.runCount, 0)
        : (null as number | null);

    const totalThreads =
      daily.length > 0
        ? daily.filter(
            (d) => (d.tokens ?? 0) > 0 || (d.runCount ?? 0) > 0
          ).length
        : (null as number | null);

    const intensityData =
      daily.length > 0
        ? buildIntensityData(
            daily.map(({ date, tokens }) => ({ date, tokens }))
          )
        : Array(HEATMAP_ROWS)
            .fill(0)
            .map(() => Array(HEATMAP_COLS).fill(0));

    return { totalTokens, totalRequests, totalThreads, intensityData };
  }, [analyticsSummary?.daily_costs, tokensByDay]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const { mutate: generateApiKey, isPending: isGenerating } = useMutation({
    mutationFn: async () => {
      const headers = await getHeaders();
      return axios.post(`${BASE_URL}/api/v1/api-keys`, {}, { headers });
    },
    onSuccess: () => {
      toast.success("API Key generated successfully");
      queryClient.invalidateQueries({ queryKey: ["api-key"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to generate API key");
    },
  });

  const { mutate: saveProviderKey, isPending: isSavingProvider } = useMutation({
    mutationFn: async (data: { provider: string; api_key: string }) => {
      await SettingsService.saveProviderKey(data.provider, data.api_key);
    },
    onSuccess: (_data, variables) => {
      toast.success(`${variables.provider} key saved`);
      queryClient.invalidateQueries({ queryKey: ["secrets"] });
    },
    onError: () => toast.error("Failed to save key"),
  });

  const maskedKey = (key: string) =>
    key ? `${key.slice(0, 4)}${"•".repeat(24)}${key.slice(-4)}` : "";

  const savedProvider = keySecrets?.inference_config?.provider?.toLowerCase();

  return (
    <div className="p-6 w-full min-w-0 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40 bg-white text-sm text-gray-600 border-gray-200">
            <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="last_week">Last Week</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Tokens Used card ────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl mb-5 flex overflow-hidden bg-white">
        {/* Chart */}
        <div className="flex-1 min-w-0 p-5 h-[300px]">
          {isErrorTokens || isErrorSummary ? (
            <div className="h-full flex items-center justify-center text-sm text-amber-600">
              {typeof (errorTokens as any)?.response?.data?.detail === "string"
                ? (errorTokens as any).response.data.detail
                : typeof (errorSummary as any)?.response?.data?.detail === "string"
                  ? (errorSummary as any).response.data.detail
                  : "Analytics temporarily unavailable"}
            </div>
          ) : isLoadingTokens || isLoadingSummary ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Loading analytics…
            </div>
          ) : chartData.labels.length > 0 ? (
            <StackedBarChart labels={chartData.labels} datasets={chartData.datasets} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              No token usage data for this period.
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="w-[22%] min-w-[190px] border-l border-gray-200 flex flex-col divide-y divide-gray-200">
          <div className="flex-1 flex flex-col justify-center px-6 py-5">
            <p className="text-sm font-semibold text-gray-500 mb-1">Total Tokens</p>
            <div className="flex items-end mt-1">
              <span className="text-2xl font-bold text-gray-900">
                {totalTokens != null ? totalTokens.toLocaleString() : "—"}
              </span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center px-6 py-5">
            <p className="text-sm font-semibold text-gray-500 mb-1">Total Requests</p>
            <div className="flex items-end mt-1">
              <span className="text-2xl font-bold text-gray-900">
                {totalRequests != null ? totalRequests.toLocaleString() : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row ──────────────────────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* Left column – two stacked cards */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Your API Key */}
          <div className="border border-gray-200 rounded-xl p-5 bg-white">
            <p className="text-sm font-semibold text-gray-800 mb-4">Your API Key</p>
            <div className="flex items-center gap-3">
              <Input
                readOnly
                className="flex-1 bg-gray-50 text-gray-400 text-sm"
                value={isLoadingKey ? "Loading…" : apiKeyData?.api_key ? maskedKey(apiKeyData.api_key) : ""}
                placeholder="No API key found. Generate one to get started."
              />
              {!apiKeyData?.api_key && (
                <Button size="sm" onClick={() => generateApiKey()} disabled={isGenerating} className="whitespace-nowrap">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {isGenerating ? "Generating…" : "Generate API Key"}
                </Button>
              )}
            </div>
          </div>

          {/* External Providers */}
          <div className="border border-gray-200 rounded-xl p-5 bg-white">
            <p className="text-sm font-semibold text-gray-800 mb-5">External Providers</p>

            {/* OpenAI */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2">
                <OpenAIIcon />
                <span className="text-sm text-gray-700">OpenAI API Key</span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  className="flex-1 bg-white text-sm"
                  placeholder={savedProvider === "openai" && keySecrets?.inference_config.api_key ? maskedKey(keySecrets.inference_config.api_key) : ""}
                  value={openAIInput}
                  onChange={(e) => setOpenAIInput(e.target.value)}
                />
                {openAIInput && (
                  <Button size="sm" disabled={isSavingProvider}
                    onClick={() => { saveProviderKey({ provider: "openai", api_key: openAIInput }); setOpenAIInput(""); }}>
                    Save
                  </Button>
                )}
              </div>
            </div>

            {/* Anthropic */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2">
                <AnthropicIcon />
                <span className="text-sm text-gray-700">Anthropic API Key</span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  className="flex-1 bg-white text-sm"
                  placeholder={savedProvider === "anthropic" && keySecrets?.inference_config.api_key ? maskedKey(keySecrets.inference_config.api_key) : ""}
                  value={anthropicInput}
                  onChange={(e) => setAnthropicInput(e.target.value)}
                />
                {anthropicInput && (
                  <Button size="sm" disabled={isSavingProvider}
                    onClick={() => { saveProviderKey({ provider: "anthropic", api_key: anthropicInput }); setAnthropicInput(""); }}>
                    Save
                  </Button>
                )}
              </div>
            </div>

            {/* OpenRouter */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <OpenRouterIcon />
                <span className="text-sm text-gray-700">OpenRouter API Key</span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  className="flex-1 bg-white text-sm"
                  placeholder={savedProvider === "openrouter" && keySecrets?.inference_config.api_key ? maskedKey(keySecrets.inference_config.api_key) : ""}
                  value={openRouterInput}
                  onChange={(e) => setOpenRouterInput(e.target.value)}
                />
                {openRouterInput && (
                  <Button size="sm" disabled={isSavingProvider}
                    onClick={() => { saveProviderKey({ provider: "openrouter", api_key: openRouterInput }); setOpenRouterInput(""); }}>
                    Save
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right card – Token Use Intensity (from backend) */}
        <div className="w-[28%] min-w-[260px] border border-gray-200 rounded-xl p-5 bg-white">
          <p className="text-sm font-semibold text-gray-800 mb-4">Token Use Intensity</p>

          {/* Heatmap grid – driven by daily token usage */}
          <TokenIntensityGrid intensityData={intensityData} />

          {/* Stats – derived from analytics data */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-gray-900">
                {totalRequests != null ? totalRequests.toLocaleString() : "—"}
              </span>
              <span className="text-xs font-semibold text-gray-400 tracking-wider">MSGS</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-gray-900">
                {totalThreads != null ? totalThreads.toLocaleString() : "—"}
              </span>
              <span className="text-xs font-semibold text-gray-400 tracking-wider">THREADS</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
