# openclaw-office-notify (versão endurecida)

Avisa o painel [OpenClaw Office](https://github.com/arielsardinha/openclaw-office) quando agentes recebem mensagens, delegam e concluem trabalho.

## O que ele faz
Hooks **somente de observação**: `message_received`, `message_sent`, `subagent_spawned` e `subagent_progress` (fase `ended`). Cada evento vira um POST `start_flow`/`agent_complete` em `/api/workflow` do painel. O manifesto declara `activation.onStartup: true`; sem isso o gateway não importa um plugin só de hooks.

O plugin não guarda estado entre hooks: o agente vem do `agentId` do evento ou da chave da sessão filha (`agent:<id>:subagent:<uuid>`).

## O que ele NÃO faz (diferenças do upstream)
- Não lê `~/.openclaw/openclaw.json`, `.env.local` nem tokens do gateway.
- Não chama `/hooks/wake` nem o gateway; sem "pipeline".
- Não suprime anúncios de subagentes (`subagent_delivery_target` removido).
- Não registra rota HTTP no gateway.
- Não envia comandos `exec` com falha.
- Só aceita endpoint em loopback (`localhost`, `127.0.0.1`, `[::1]`).
- Por padrão envia apenas agente + estado; o texto só vai com `includeContent: true`.

## Configuração (`plugins.entries.openclaw-office-notify.config`)
| Campo | Padrão | Descrição |
|---|---|---|
| `endpoint` | `http://127.0.0.1:4200/api/workflow` | Somente loopback |
| `apiTokenFile` | — | Caminho de um arquivo (0600) com o token do painel. Recomendado: mantém o token fora do `openclaw.json` |
| `apiToken` | — | Token em texto puro (alternativa); também aceita a variável `OFFICE_API_TOKEN` |
| `orchestratorAgent` | `coordinator` | Deve coincidir com `orchestrator` no config do painel |
| `includeContent` | `false` | Enviar texto de mensagens/tarefas |
| `timeoutMs` | `2000` | |

Sem token (`apiTokenFile`, `apiToken` ou `OFFICE_API_TOKEN`), o plugin se desativa (o painel recusa escritas sem token).
