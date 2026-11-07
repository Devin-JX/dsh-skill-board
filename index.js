import { readFile, writeFile } from 'node:fs/promises'

export const name = 'skill-board'
export const inject = ['tools', 'skills', 'workingDirectory', 'webServer', 'agents']

/** Rewrite one frontmatter key, inserting it when absent. */
function setFrontmatter(content, key, value) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n)?/)
  if (!m) throw new Error('这个技能没有 YAML frontmatter，无法切换')
  const body = m[1]
  const line = `${key}: ${value}`
  const re = new RegExp(`^${key}\\s*:.*$`, 'm')
  const next = re.test(body) ? body.replace(re, line) : `${line}\n${body}`
  return `${content.slice(0, m.index)}---\n${next}\n---${m[2] ?? '\n'}${content.slice(m.index + m[0].length)}`
}

const SOURCE_LABEL = {
  'project-dsh': '项目 .dsh',
  'project-agents': '项目 .agents',
  custom: '自定义目录',
  'user-dsh': '用户 .dsh',
  'user-agents': '用户 .agents',
  bundled: '内置',
  runtime: '运行时',
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(payload)
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1e6) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

export function apply(ctx) {
  const cwdOf = async (exec) => {
    try {
      if (exec?.agent) return await ctx.workingDirectory.ensure(exec.agent, exec.signal)
    } catch {}
    return ctx.workingDirectory.defaultDirectory
  }

  const snapshot = async (exec) => {
    const scope = exec?.agent
    const cwd = await cwdOf(exec)
    return ctx.skills.snapshot({ cwd, scope })
  }

  const list = async (exec, query) => {
    const snap = await snapshot(exec)
    const q = typeof query === 'string' ? query.trim().toLowerCase() : ''
    const matched = q
      ? snap.skills.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            (s.whenToUse ?? '').toLowerCase().includes(q),
        )
      : snap.skills
    const isReadOnly = (s) => s.source === 'bundled' || (s.path ?? '').includes('app.asar')
    return {
      ok: true,
      complete: snap.complete,
      total: snap.skills.length,
      skills: matched.map((s) => ({
        name: s.name,
        description: s.description,
        source: s.source,
        sourceLabel:
          s.source === 'custom' && isReadOnly(s) ? '预设·只读' : (SOURCE_LABEL[s.source] ?? s.source),
        readOnly: isReadOnly(s),
        path: s.path ?? null,
        modelInvocable: s.invocation.modelInvocable,
        userInvocable: s.invocation.userInvocable,
      })),
    }
  }

  const setEnabled = async (name, enabled, exec) => {
    const snap = await snapshot(exec)
    const skill = snap.skills.find((s) => s.name === name)
    if (!skill) throw new Error(`找不到技能 ${name}`)
    if (skill.source === 'bundled' || (skill.path ?? '').includes('app.asar'))
      throw new Error(`${name} 是随程序分发的技能（打包在 app.asar 里），只读，关不掉。`)
    if (!skill.path) throw new Error(`${name} 没有可编辑的文件路径`)
    if (!skill.path.toLowerCase().endsWith('.md')) throw new Error('只能编辑 .md 技能文件')

    const before = await readFile(skill.path, 'utf8')
    const after = setFrontmatter(before, 'disable-model-invocation', enabled ? 'false' : 'true')
    if (after !== before) await writeFile(skill.path, after, 'utf8')
    return { ok: true, name, modelInvocable: enabled, changed: after !== before, path: skill.path }
  }

  const liveScope = () => {
    try {
      const live = ctx.agents.list()
      return live.length > 0 ? live[0] : undefined
    } catch {
      return undefined
    }
  }

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: '/skill-board/list',
      handler: async (_req, res) => {
        try {
          sendJson(res, 200, await list({ agent: liveScope() }, undefined))
        } catch (error) {
          sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }),
  )

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: '/skill-board/toggle',
      handler: async (req, res) => {
        try {
          const body = await readJson(req)
          sendJson(res, 200, await setEnabled(String(body.name ?? ''), Boolean(body.enabled), { agent: liveScope() }))
        } catch (error) {
          sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }),
  )

  ctx.tools.register({
    name: 'skill_board',
    description:
      '管理本机已安装的 Agent Skills：列出全部技能（名字、说明、来源、是否对模型可见），或把某个技能对模型打开/关闭。' +
      '开关改的是技能文件 frontmatter 的 disable-model-invocation，改完对所有新会话永久生效。' +
      '内置（bundled）技能只读，切换会失败。',
    parameters: {
      action: {
        type: 'string',
        required: true,
        description: "list 列出全部技能；on 打开；off 关闭。",
        enum: ['list', 'on', 'off'],
      },
      name: {
        type: 'string',
        description: '技能名（kebab-case），action 为 on/off 时必填。',
      },
      query: {
        type: 'string',
        description: 'action 为 list 时可选：按名字或描述模糊搜索，记不住技能名时用它。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        required: ['ok'],
        properties: {
          ok: { type: 'boolean' },
          skills: { type: 'array' },
          changed: { type: 'boolean' },
          name: { type: 'string' },
        },
      },
      render: (args, value) => {
        if (!value.ok) return [{ type: 'text', text: `失败：${value.error ?? '未知错误'}` }]
        if (args.action === 'list') {
          const lines = value.skills.map((s) => {
            const lock = s.readOnly ? '🔒' : ''
            const head = `${s.modelInvocable ? '●' : '○'} ${s.name}　[${s.sourceLabel}]${lock}`
            const body = `    ${s.description.slice(0, 110)}`
            const where = s.readOnly || !s.path ? '' : `\n    ${s.path}`
            return head + '\n' + body + where
          })
          const scope = args.query ? `，命中 ${value.skills.length} 个` : ''
          return [
            {
              type: 'text',
              text: `共 ${value.total} 个技能${scope}（● 对模型可见 / ○ 已关闭）\n\n${lines.join('\n') || '（没有匹配的技能）'}`,
            },
          ]
        }
        return [
          {
            type: 'text',
            text: `${value.modelInvocable ? '已打开' : '已关闭'}：${value.name}${value.changed ? '' : '（本来就是该状态，文件未改动）'}`,
          },
        ]
      },
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        if (args.action === 'list') return await list(exec, args.query)
        const name = typeof args.name === 'string' ? args.name.trim() : ''
        if (!name) throw new Error('action 为 on/off 时必须给 name')
        return await setEnabled(name, args.action === 'on', exec)
      } catch (error) {
        return { ok: false, error: String(error?.message ?? error) }
      }
    },
  })
}
