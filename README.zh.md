# dsh-skill-board

[English](README.md) | 简体中文

给 **DeepSeek Harness（DSH）** 用的插件：在「设置 → 技能」里加一页，能看到 Agent 能用哪些技能，并且一行一个开关点着关。

## 为什么做这个

Agent Skills 是延迟加载的：没用到时，上下文里只有 `name` + `description`，正文要等真正相关了才读。好处是省 token，代价是——「我到底装了哪些？这个怎么关？」变成了一个翻文件系统的问题。

这个插件用一个页面回答它：

- 一行一个技能：名字、来源标签、说明、开关
- 随程序分发的只读技能不显示（反正也改不了）
- 开关会往技能的 `SKILL.md` 里写 `disable-model-invocation`

## 安装

要求：带设置面板的 DSH 桌面版（依赖 `@deepseek-ai/dsh-client-ui-settings`）。

```text
plugin_manager action=install_bundle target="<克隆下来的绝对路径>"
```

然后打开 **设置 → 技能**。

卸载：

```text
plugin_manager action=remove_bundle target=@devin-jx/dsh-skill-board
```

## 开关到底改了什么

关掉一个技能，等于往它的 frontmatter 里写：

```yaml
disable-model-invocation: true
```

打开则写 `false`。改动是**永久的**——因为文件即状态，所以对所有新会话都生效，没有「只在这个会话关掉」这种模式。

技能放在这些目录里：

| 路径 | 范围 |
| --- | --- |
| `%USERPROFILE%\.dsh\skills\<name>\SKILL.md` | 所有工作区 |
| `<工作区>\.dsh\skills\<name>\SKILL.md` | 只有那个工作区 |

这个页面列的是用户级和内置技能。项目级技能不显示，因为页面没有会话，拿不到工作区目录。

## 实现

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：注册 `/skill-board/list` 和 `/skill-board/toggle`，外加一个等价的 `skill_board` Agent 工具 |
| `client.js` | Client 半：注册到 `settings.section` 槽位，渲染列表和开关 |
| `cordis.patch.yml` | 往 profile 里插入 `skill-board` 这一行 |

两个容易踩的坑：

1. `ctx.webServer.register` 必须带 `kind: 'exact'`，而且 handler 是 Node 的 `(req, res)`，**不是** Web 的 `Request → Response`。少了 `kind`，请求会一直挂到超时。
2. 查技能目录必须把当前 Agent 作为 `scope` 传进去，否则只能看到全局层（内置技能）。

## 安全

两个路由都是**没有鉴权**的普通 HTTP 端点。它们只绑定 `127.0.0.1`，网络上看不到；但本机任何进程都能调 `/skill-board/toggle` 把技能翻转。对本地桌面工具来说这没问题，但别把这个服务暴露到你不信任的网络里。

## 已知限制

- 只列用户级和内置技能；项目级技能需要会话才能解析
- 随程序打包的技能是只读的，所以不显示
- 还没有搜索框（Agent 工具那边有 `query` 参数）

## 许可证

MIT