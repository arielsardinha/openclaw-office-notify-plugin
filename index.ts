/**
 * OpenClaw Office Notify (versão endurecida)
 *
 * Observa eventos do gateway e avisa o painel OpenClaw Office, só localmente.
 * Não lê arquivos de configuração, não chama o gateway, não registra rotas HTTP
 * e não altera o fluxo dos agentes (todos os hooks são de observação).
 *
 * Privacidade: por padrão o painel recebe apenas agente + estado. O texto das
 * mensagens e das tarefas só é enviado com `includeContent: true`.
 */
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const DEFAULT_ENDPOINT = "http://127.0.0.1:4200/api/workflow";
const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_ORCHESTRATOR = "coordinator";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MAX_TRACKED_CHILDREN = 500;

type PluginConfig = {
  endpoint?: string;
  apiToken?: string;
  enabled?: boolean;
  timeoutMs?: number;
  orchestratorAgent?: string;
  includeContent?: boolean;
};

/** Aceita apenas http(s) em loopback, para nada sair desta máquina. */
function parseLoopbackEndpoint(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return LOOPBACK_HOSTS.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

/** "agent:architect:subagent:uuid" -> "architect" */
function agentIdFromSessionKey(sessionKey: unknown): string {
  if (typeof sessionKey !== "string") return "";
  const parts = sessionKey.split(":");
  return parts[0] === "agent" && parts[1] ? parts[1] : "";
}

function clip(text: unknown, max: number): string {
  return typeof text === "string" ? text.slice(0, max) : "";
}

export default definePluginEntry({
  id: "openclaw-office-notify",
  name: "OpenClaw Office Notify",
  description: "Envia estado dos agentes ao painel OpenClaw Office (somente local, somente observação).",
  register(api: any) {
    const config: PluginConfig = api.pluginConfig ?? api.config ?? {};
    if (config.enabled === false) return;

    const endpoint = parseLoopbackEndpoint(config.endpoint || DEFAULT_ENDPOINT);
    if (!endpoint) {
      api.logger?.warn?.("[office-notify] endpoint precisa ser loopback (localhost/127.0.0.1); plugin desativado");
      return;
    }

    const apiToken = config.apiToken || process.env.OFFICE_API_TOKEN || "";
    if (!apiToken) {
      api.logger?.warn?.("[office-notify] sem apiToken/OFFICE_API_TOKEN: o painel recusa escritas; plugin desativado");
      return;
    }

    const timeoutMs = Number.isFinite(config.timeoutMs) ? Number(config.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const orchestrator = config.orchestratorAgent || DEFAULT_ORCHESTRATOR;
    const includeContent = config.includeContent === true;
    const log = (msg: string) => api.logger?.info?.(`[office-notify] ${msg}`);

    // childSessionKey -> agentId, para casar subagent_ended (que só traz targetSessionKey)
    const children = new Map<string, string>();

    async function post(body: Record<string, unknown>): Promise<void> {
      try {
        const res = await fetch(endpoint!, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiToken}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) log(`painel respondeu ${res.status}`);
      } catch (err) {
        log(`falha ao notificar (ignorada): ${err instanceof Error ? err.message : "erro desconhecido"}`);
      }
    }

    api.on("message_received", async (event: any) => {
      const content = includeContent ? clip(event?.content, 200) : "Nova mensagem";
      void post({ action: "start_flow", content, from: "Boss", agent: orchestrator });
    });

    api.on("message_sent", async (event: any) => {
      if (event?.success === false) return;
      const result = includeContent ? clip(event?.content ?? event?.text, 200) : "Resposta enviada";
      void post({ action: "agent_complete", agent: orchestrator, result });
    });

    api.on("subagent_spawned", async (event: any) => {
      const childSessionKey = event?.childSessionKey;
      const agentId = agentIdFromSessionKey(childSessionKey);
      if (!agentId) return;

      if (children.size >= MAX_TRACKED_CHILDREN) children.delete(children.keys().next().value as string);
      children.set(childSessionKey, agentId);

      const task = includeContent ? clip(event?.task ?? event?.prompt, 200) : `Delegado a ${agentId}`;
      void post({ action: "start_flow", content: task, from: "Boss", agent: orchestrator, delegatedTo: agentId });
    });

    api.on("subagent_ended", async (event: any) => {
      const key = event?.targetSessionKey;
      const agentId = children.get(key) || agentIdFromSessionKey(key);
      children.delete(key);
      if (!agentId) return;
      void post({ action: "agent_complete", agent: agentId, result: event?.outcome === "ok" ? "concluído" : String(event?.outcome ?? "encerrado") });
    });

    log(`ativo -> ${endpoint.origin} (conteúdo ${includeContent ? "incluído" : "omitido"})`);
  },
});
