# Model Sources and BYOK

Copilot V4 can get models from a Copilot plan, your own provider key or local
endpoint, or an agent account you already use. These options are separate.
Adding a key does not change the models supplied by Claude Code, Codex, or
GitHub Copilot.

Settings show where each source sends your requests. Hover the small icon next to a provider name: a lock for Copilot Plus ("Brevilabs servers (US)"), a desktop for a server on this computer or your local network, and a cloud for any other service. The Claude Code, Codex, and GitHub Copilot tabs in Agent settings show the same icon next to the agent name, for example "Amazon Bedrock" when your Claude Code settings turn on Bedrock.

## Choose a model source

| Model source                        | Quick Chat | Agent Chat                                 |
| ----------------------------------- | ---------- | ------------------------------------------ |
| **Copilot-hosted models**           | Yes        | opencode                                   |
| **Your API key or endpoint (BYOK)** | Yes        | opencode, when the provider is shown there |
| **Models reported by opencode**     | No         | opencode                                   |
| **Claude Code account**             | No         | Claude                                     |
| **Codex account**                   | No         | Codex                                      |
| **GitHub Copilot plan**             | Desktop    | GitHub Copilot                             |

Models reported by opencode are routed to their backing provider. Free
opencode Zen models show a warning because that provider may log or train on
prompts; review its terms before sending sensitive content.

## Copilot-hosted models

Lite, Plus, and included Supporter access can provide Copilot-hosted models.
You do not need an API key from an AI provider. Enter your license under
**Settings → Copilot → Basic → Copilot License**, then select **Apply**.

Without a license, Copilot models appear with a lock. Click a locked row or its
lock icon in a model picker or model settings to open the
[pricing page](https://obsidiancopilot.com/pricing). This does not select or
enable a model; a license is still required to use it.

Licensed models can appear in both places:

- **Basic → Agents → Quick Chat** for regular Copilot chat on desktop, or **Basic → Quick Chat models** on mobile.
- **Basic → Agents → opencode** for Agent Chat.

They do not appear under Claude or Codex, because those agents use their own
accounts and models. The available Copilot lineup changes over time, so use the
model lists in settings as the source of truth.

Copilot-hosted models are cloud services, not local models. Brevilabs's backend
and its vetted enterprise model providers process the full request. Copilot's
privacy policy says request content is processed transiently, not retained, and
not used for training. See the
[privacy policy](https://www.obsidiancopilot.com/en/privacy) for details.

## Bring your own key (BYOK)

BYOK lets you connect Copilot directly to an AI provider, a compatible gateway,
or a model server on your computer. For cloud providers, usage and billing stay
with that provider.

1. Open **Settings → Copilot → BYOK**.
2. Click **Add a provider**.
3. Choose a provider, **Ollama**, **LM Studio**, or **Add a custom provider**.
4. Enter the **API key** and **Base URL** when required.
5. Select or enter at least one model, optionally click **Test**, then click
   **Save**.

Each time you open **BYOK**, Copilot checks your configured providers again. A small
“Verifying providers…” indicator appears while checks run, and each provider updates
as its check finishes. **Verified** means the provider passed its connection or key
check. **No key** or **Invalid key** means you should configure that provider again.
**Check failed** can also mean a connection or rate-limit problem; hover over the
badge for details and reopen the tab to retry. Saving provider changes also refreshes
these checks. A successful check does not guarantee access to every model.

The provider list and model catalog are loaded in the app, so this guide does
not keep a fixed provider or model count. If the endpoint cannot list its
models, you can enter a model ID yourself.

New chat models are enabled for Quick Chat and opencode by default. You can
curate each list independently:

- **Basic → Agents → Quick Chat** controls **Quick Chat models** and its
  **Default model**.
- **Basic → Agents → opencode** controls the models opencode can use and its
  **Default model**.

For enabled, routable models, Copilot passes the saved key and any custom
endpoint override to opencode when it starts. A model that opencode cannot route
is left out of the opencode list, but may still work in Quick Chat.

### Local and Custom Endpoints

Inside **BYOK → Add a provider**, choose **Ollama** or **LM Studio** from the
**Self Host** group to use their local OpenAI-compatible servers. This does not
require a Self-Host license. Their API key is optional, and Copilot fills in the
usual local URL:

- Ollama: `http://localhost:11434/v1`
- LM Studio: `http://localhost:1234/v1`

Start the local server before testing the provider. For another compatible
service or proxy, choose **Add a custom provider** and enter its base URL and
model ID. The API key is optional; add one when the endpoint requires
authentication. Model discovery uses the endpoint's `/v1/models` response, but
you can always enter an exact model ID before searching the discovered list.

If **Test** succeeds but Quick Chat cannot send a message, edit the provider
and turn on **Enable CORS**. Responses then appear after completion instead of
streaming token by token. For LM Studio, you can enable CORS in LM Studio to
keep streaming instead.

## Claude Code, Codex, and GitHub Copilot accounts

Claude, Codex, and GitHub Copilot are Agent Chat backends, not BYOK providers:

- **Claude** inherits authentication and models from the Claude Code CLI. Its
  usage follows your Claude Code account or CLI environment.
- **Codex** inherits authentication and models from the Codex CLI through the
  Codex ACP adapter. Its usage follows your OpenAI account or ChatGPT plan.
- **GitHub Copilot** inherits authentication and models from the GitHub
  Copilot CLI's `copilot login`. Its usage counts against your GitHub Copilot
  plan's premium requests. Copilot ignores CLI settings that would send
  requests elsewhere, such as `COPILOT_PROVIDER_BASE_URL` or tokens in the
  environment, so this agent always uses your GitHub sign-in.

Copilot discovers the models reported by each agent and lets you enable them
under **Basic → Agents → Claude**, **Codex**, or **GitHub Copilot**. Claude and
Codex models stay inside their agents; GitHub Copilot models can also run in
Quick Chat, as described below. None of them become opencode models.

An OpenAI API key is different from a ChatGPT subscription, just as an
Anthropic API key is different from a Claude Code subscription. Use **BYOK** for
API access and the matching agent setup for subscription access.

## GitHub Copilot models in Quick Chat

On desktop, the models of your GitHub Copilot plan also appear in Quick Chat, Quick Ask, and Copilot Commands. Copilot runs them through the same installed GitHub Copilot CLI as the GitHub Copilot agent, using the official GitHub Copilot SDK. Each request is a short, tool-free session whose system prompt is Copilot's Quick Chat prompt instead of GitHub Copilot's own. Mobile can't run the CLI, so these models need desktop Obsidian.

- **Models.** Quick Chat and the GitHub Copilot agent share one model list. Copilot reads it from the CLI at startup, so Quick Chat doesn't wait for an Agent Chat session, and enables each new model in Quick Chat once. A model you turn off under **Basic → Agents → Quick Chat** stays off.
- **Account.** Requests use the CLI's stored sign-in from `copilot login`, or, without one, the GitHub CLI's (`gh`) active github.com account. Switching `gh`'s active account switches the account that pays. **Basic → Agents → Quick Chat** shows the signed-in account. Copilot handles no tokens itself.
- **Images.** Vision models receive images attached to your latest message, within each model's limits on type, size, and count; a notice explains any image left out. Images in earlier messages are described to the model as `[image omitted]`. Models without vision show a notice, and a message with only images is not sent to them.
- **Earlier turns.** The SDK takes one prompt per request, so Copilot quotes the earlier turns of the chat in order before your new message. The model sees the whole conversation, but not as separate chat roles.
- **No tool calling.** GitHub Copilot models can't call Quick Chat's tools. **Vault chat** finds notes for them automatically instead; see [Quick Chat](chat-interface.md#choose-a-chat-mode).

### What GitHub Copilot requests cost

Every Quick Chat turn, Quick Ask, and command run is one GitHub Copilot request, billed to your plan at the model's multiplier: smaller models such as Claude Haiku 4.5 cost a fraction of a request, while the largest models can cost many requests each. Depending on your plan, GitHub bills these as premium requests or as AI credits priced per token; see [GitHub's billing documentation](https://docs.github.com/en/copilot/concepts/billing-and-usage/individuals/billing).

Quick Chat also makes background calls: query expansion on every turn that searches the vault, a title for each new chat, and a summary of each finished chat. That is roughly two requests per vault-chat turn plus two per chat. The **Background model** setting sends these calls to a cheaper model, Claude Haiku 4.5 by default when your plan offers it, so they don't bill at the chat model's multiplier. Context compaction stays on the chat model, because it rewrites what the chat model reads.

## Where keys are stored

Copilot stores provider API keys and the Copilot license key in this device's
**Obsidian Keychain**, not in the vault's `data.json`. The Keychain is
device-specific, so syncing a vault does not copy its credentials to another
computer.

To remove stored credentials, open **Settings → Copilot → Advanced → API Key
Storage** and click **Delete All Keys**.

## Related

- [Getting Started](getting-started.md)
- [Agent Chat](agent-mode-and-tools.md)
- [Models, Effort, and Permissions](models-and-parameters.md)
- [Settings: BYOK](settings.md#byok)
- [Copilot Plans, Privacy, and Self-Hosting](copilot-plus-and-self-host.md)
