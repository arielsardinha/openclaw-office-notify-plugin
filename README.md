# openclaw-office-notify (versão endurecida)

Avisa o painel [OpenClaw Office](https://github.com/arielsardinha/openclaw-office) quando agentes recebem mensagens, delegam e concluem trabalho.

## O que ele faz
Hooks **somente de observação**: `message_received`, `message_sent`, `subagent_spawned`, `subagent_ended`. Cada evento vira um POST `start_flow`/`agent_complete` em `/api/workflow` do painel.

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
| `apiToken` | — | Igual ao `OFFICE_API_TOKEN` do painel (ou use a variável de ambiente) |
| `orchestratorAgent` | `coordinator` | Deve coincidir com `orchestrator` no config do painel |
| `includeContent` | `false` | Enviar texto de mensagens/tarefas |
| `timeoutMs` | `2000` | |

Sem `apiToken`, o plugin se desativa (o painel recusa escritas sem token).
