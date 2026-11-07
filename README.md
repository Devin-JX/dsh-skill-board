# dsh-skill-board

English | [简体中文](README.zh.md)

A **DeepSeek Harness (DSH)** plugin that adds a **Skills** page to Settings, so you can see every skill your agent can use and toggle each one on or off with a click.

> 给 DSH（DeepSeek Harness）用的插件：在「设置 → 技能」里列出所有可开关的 Agent Skills，一行一个开关。

## Why

Once you have more than a handful of skills, three questions get hard to answer:

1. **Which skills can my agent actually see right now?**
2. **Where did this one come from** — mine, this project, or shipped with the app?
3. **A skill keeps firing when I do not want it — how do I shut it up?**

In DSH all three are filesystem questions. Skills live in five roots (two user-level, two project-level, one bundled), and the switch is one line inside `SKILL.md`:

```yaml
disable-model-invocation: true
```

**Get the key wrong and nothing errors** — the skill just silently drops out of the catalog, and you end up blaming the model for ignoring it.

This page turns that into a list: name, source, description, toggle.

### When you do not need it

- **Two or three skills, and you know where they are** — editing the file is faster.
- **You want "off just for this session"** — this plugin cannot do that. It edits the file, so the change is permanent.
- **You want to switch off a skill shipped inside the app** — those are read-only.

## Install

Requirements: DSH desktop build with the Settings UI (`@deepseek-ai/dsh-client-ui-settings`).

```text
plugin_manager action=install_bundle target="<absolute path to your clone>"
```

Then open **Settings → Skills**.

Remove it with:

```text
plugin_manager action=remove_bundle target=@devin-jx/dsh-skill-board
```

## What the toggle actually does

Turning a skill off writes this line into its frontmatter:

```yaml
disable-model-invocation: true
```

Turning it back on writes `false`. The change is **permanent** — it applies to every new session, because the file is the state. There is no per-session override.

Skills live in one of these roots:

| Path | Scope |
| --- | --- |
| `%USERPROFILE%\.dsh\skills\<name>\SKILL.md` | all workspaces |
| `<workspace>\.dsh\skills\<name>\SKILL.md` | that workspace only |

This page lists the user-level and bundled skills. Project-level skills are not shown because the page has no session to resolve a workspace from.

## How it works

| File | Role |
| --- | --- |
| `index.js` | Host half: registers `/skill-board/list` and `/skill-board/toggle`, plus an equivalent `skill_board` agent tool |
| `client.js` | Client half: registers into the `settings.section` slot and renders the list |
| `cordis.patch.yml` | Inserts the `skill-board` row into the profile |

Two details that are easy to get wrong:

1. `ctx.webServer.register` needs `kind: 'exact'`, and the handler is Node's `(req, res)` — **not** a Web `Request → Response` function. Without `kind`, requests hang until they time out.
2. Skill discovery must receive the calling agent as `scope`; without it only the global layer (bundled skills) is visible.

## Security

Both routes are plain HTTP endpoints with **no authentication**. They are bound to `127.0.0.1`, so they are not reachable from the network, but any local process can call `/skill-board/toggle` and flip a skill. That is fine for a local desktop tool; do not expose this server to a network you do not trust.

## Known limitations

- Only user-level and bundled skills are listed; project-level skills need a session.
- Skills shipped inside the app are read-only and therefore hidden.
- No search box yet (the agent tool has a `query` parameter).

## License

MIT