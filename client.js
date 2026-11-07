window.__ModuleLoader__.load({
  id: '@devin-jx/dsh-skill-board',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const muted = { opacity: 0.65 };

    async function api(path, body) {
      const res = await fetch(path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
      return data;
    }

    function fmtTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const p = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    function Switch(props) {
      const on = props.on;
      return h('button', {
        onClick: props.onClick,
        disabled: props.disabled,
        title: props.title,
        style: {
          flex: '0 0 auto', width: 42, height: 24, borderRadius: 12, padding: 0,
          cursor: props.disabled ? 'default' : 'pointer',
          border: '1px solid rgba(127,127,127,0.35)',
          background: on ? '#3b82f6' : 'rgba(127,127,127,0.28)',
          position: 'relative', transition: 'background 120ms', opacity: props.disabled ? 0.5 : 1,
        },
      }, h('span', {
        style: {
          position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 9,
          background: '#fff', display: 'block', transition: 'left 120ms',
        },
      }));
    }

    function SkillBoard() {
      const [state, setState] = React.useState({ loading: true, skills: [], total: 0, error: null });
      const [busy, setBusy] = React.useState(null);
      const [query, setQuery] = React.useState('');
      const [confirming, setConfirming] = React.useState(false);

      const load = React.useCallback(async () => {
        setState((s) => ({ ...s, loading: true }));
        try {
          const data = await api('/skill-board/list');
          setState({ loading: false, skills: data.skills || [], total: data.total || 0, error: null });
        } catch (err) {
          setState({ loading: false, skills: [], total: 0, error: String((err && err.message) || err) });
        }
      }, []);

      React.useEffect(() => { load(); }, [load]);

      React.useEffect(() => {
        if (!confirming) return;
        const t = setTimeout(() => setConfirming(false), 4000);
        return () => clearTimeout(t);
      }, [confirming]);

      const toggle = async (skill) => {
        setBusy(skill.name);
        try {
          await api('/skill-board/toggle', { name: skill.name, enabled: !skill.modelInvocable });
          await load();
        } catch (err) {
          setState((s) => ({ ...s, error: String((err && err.message) || err) }));
        } finally {
          setBusy(null);
        }
      };

      const disableAll = async () => {
        setBusy('*');
        setConfirming(false);
        try {
          await api('/skill-board/disable-all', {});
          await load();
        } catch (err) {
          setState((s) => ({ ...s, error: String((err && err.message) || err) }));
        } finally {
          setBusy(null);
        }
      };

      const enableAll = async () => {
        setBusy('*');
        try {
          await api('/skill-board/enable-all', {});
          await load();
        } catch (err) {
          setState((s) => ({ ...s, error: String((err && err.message) || err) }));
        } finally {
          setBusy(null);
        }
      };

      const visible = state.skills.filter((s) => !s.readOnly);
      const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const matched = tokens.length === 0 ? visible : visible.filter((s) =>
        tokens.every((t) =>
          (s.name || '').toLowerCase().includes(t) ||
          (s.description || '').toLowerCase().includes(t) ||
          (s.whenToUse || '').toLowerCase().includes(t) ||
          (s.sourceLabel || '').toLowerCase().includes(t)));
      const on = visible.filter((s) => s.modelInvocable).length;

      const btn = (label, onClick, opts) => h('button', {
        onClick, disabled: (opts && opts.disabled) || false,
        style: {
          fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: (opts && opts.disabled) ? 'default' : 'pointer',
          background: (opts && opts.danger) ? '#c0392b' : 'transparent',
          color: (opts && opts.danger) ? '#fff' : 'inherit',
          border: '1px solid ' + ((opts && opts.danger) ? '#c0392b' : 'rgba(127,127,127,0.35)'),
          opacity: (opts && opts.disabled) ? 0.5 : 1,
        },
      }, label);

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' } },
          h('div', { style: { fontSize: 15, fontWeight: 600 } }, '技能'),
          h('div', { style: { ...muted, fontSize: 12 } },
            visible.length + ' 个可开关，当前开 ' + on + ' 个' + (tokens.length ? '，命中 ' + matched.length + ' 个' : '')),
          h('div', { style: { flex: 1 } }),
          btn('刷新', load, { disabled: state.loading }),
          btn('全部打开', enableAll, { disabled: busy === '*' || on === visible.length }),
          btn(confirming ? '确认全部关闭？' : '全部关闭', () => {
            if (confirming) disableAll(); else setConfirming(true);
          }, { disabled: busy === '*' || on === 0, danger: confirming }),
        ),
        h('input', {
          value: query,
          onChange: (e) => setQuery(e.target.value),
          placeholder: '搜索：名字、说明、什么时候用……（空格分词，多个词同时满足）',
          style: {
            width: '100%', boxSizing: 'border-box', fontSize: 12.5, padding: '7px 10px', borderRadius: 7,
            background: 'transparent', color: 'inherit', border: '1px solid rgba(127,127,127,0.3)', outline: 'none',
          },
        }),
        state.error ? h('div', { style: { fontSize: 12, color: '#e5534b' } }, state.error) : null,
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          matched.map((skill) =>
            h('div', {
              key: skill.name,
              style: {
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px',
                border: '1px solid rgba(127,127,127,0.22)', borderRadius: 10,
                opacity: skill.modelInvocable ? 1 : 0.6,
              },
            },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' } },
                  h('span', { style: { fontWeight: 600, fontSize: 13.5 } }, skill.name),
                  h('span', { style: { ...muted, fontSize: 11, border: '1px solid rgba(127,127,127,0.3)', borderRadius: 5, padding: '0 5px' } }, skill.sourceLabel),
                  skill.mtime ? h('span', { style: { ...muted, fontSize: 11 } }, '改于 ' + fmtTime(skill.mtime)) : null,
                ),
                h('div', { style: { fontSize: 12.5, lineHeight: 1.55, marginTop: 3, ...muted } },
                  (skill.description || '').slice(0, 200)),
              ),
              h(Switch, {
                on: skill.modelInvocable,
                disabled: busy === skill.name || busy === '*',
                title: '改 SKILL.md 的 disable-model-invocation',
                onClick: () => toggle(skill),
              }),
            ),
          ),
        ),
        matched.length === 0 && !state.loading
          ? h('div', { style: { ...muted, fontSize: 12.5 } }, tokens.length ? '没有匹配的技能。' : '还没有安装可开关的技能。把 SKILL.md 放到 ~/.dsh/skills 就会出现在这里。')
          : null,
        h('div', { style: { ...muted, fontSize: 11.5, lineHeight: 1.7 } },
          '关闭后会在对应 SKILL.md 写入 disable-model-invocation: true，对所有新会话生效。'),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'skill-board', order: 45, label: '技能',
        }, SkillBoard));
      },
    };
  },
});