import { getSecret } from "../secrets";
import { getSettings } from "../settings";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import type { AIProvider, ProviderId } from "./types";

export type ProviderReason = "env_forced" | "selected" | "auto_key_found" | "auto_no_key" | "selected_but_no_key";

export interface ProviderStatus {
  active: ProviderId;
  reason: ProviderReason;
  model: string;
  /** True when a real provider is configured and usable */
  realProviderReady: boolean;
}

/**
 * Decides which provider serves AI requests:
 * AI_PROVIDER env var > Settings preference > automatic (Anthropic when a key exists, otherwise mock).
 */
export async function getProviderStatus(): Promise<ProviderStatus> {
  const settings = await getSettings();
  const key = getSecret("anthropicApiKey");
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "mock") return { active: "mock", reason: "env_forced", model: "offline-demo-v1", realProviderReady: false };
  if (forced === "anthropic") {
    return key
      ? { active: "anthropic", reason: "env_forced", model: settings.aiModel, realProviderReady: true }
      : { active: "mock", reason: "selected_but_no_key", model: "offline-demo-v1", realProviderReady: false };
  }
  if (settings.aiProvider === "mock") return { active: "mock", reason: "selected", model: "offline-demo-v1", realProviderReady: Boolean(key) };
  if (key) return { active: "anthropic", reason: settings.aiProvider === "anthropic" ? "selected" : "auto_key_found", model: settings.aiModel, realProviderReady: true };
  return {
    active: "mock",
    reason: settings.aiProvider === "anthropic" ? "selected_but_no_key" : "auto_no_key",
    model: "offline-demo-v1",
    realProviderReady: false,
  };
}

export async function getProvider(): Promise<AIProvider> {
  const status = await getProviderStatus();
  if (status.active === "anthropic") {
    const settings = await getSettings();
    const key = getSecret("anthropicApiKey")!;
    return new AnthropicProvider({ apiKey: key.value, model: settings.aiModel, effort: settings.aiEffort });
  }
  return new MockProvider();
}

export { AIError } from "./errors";
export type { AIProvider } from "./types";
