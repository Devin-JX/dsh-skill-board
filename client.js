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

    function Switch(props) {
      const on = props.on;
      return h('button', {
        onClick: props.onClick,
        disabled: props.disabled,
        title: props.title,
        style: {
          flex: '0 0 auto', width: 42, height: 24, borderRadius: 12, padding: 0, cursor: props.disabled ? 'default' : 'pointer',
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

      const visible = state.skills.filter((s) => !s.readOnly);
      const on = visible.filter((s) => s.modelInvocable).length;

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' } },
          h('div', { style: { fontSize: 15, fontWeight: 600 } }, '技能'),
          h('div', { style: { ...muted, fontSize: 12 } }, visible.length + ' 个技能，当前开 ' + on + ' 个'),
          h('div', { style: { flex: 1 } }),
          h('button', {
            onClick: load, disabled: state.loading,
            style: { fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: 'inherit', border: '1px solid rgba(127,127,127,0.35)' },
          }, state.loading ? '刷新中…' : '刷新'),
        ),
        state.error ? h('div', { style: { fontSize: 12, color: '#e5534b' } }, state.error) : null,
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          visible.map((skill) =>
            h('div', {
              key: skill.name,
              style: {
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px',
                border: '1px solid rgba(127,127,127,0.22)', borderRadius: 10,
                opacity: skill.readOnly ? 0.62 : 1,
              },
            },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' } },
                  h('span', { style: { fontWeight: 600, fontSize: 13.5 } }, skill.name),
                  h('span', { style: { ...muted, fontSize: 11, border: '1px solid rgba(127,127,127,0.3)', borderRadius: 5, padding: '0 5px' } }, skill.sourceLabel),
                  skill.readOnly ? h('span', { style: { fontSize: 11, ...muted } }, '只读') : null,
                ),
                h('div', { style: { fontSize: 12.5, lineHeight: 1.55, marginTop: 3, ...muted } },
                  (skill.description || '').slice(0, 180)),
              ),
              h(Switch, {
                on: skill.modelInvocable,
                disabled: skill.readOnly || busy === skill.name,
                title: skill.readOnly ? '随程序分发，改不了' : '改 SKILL.md 的 disable-model-invocation',
                onClick: () => toggle(skill),
              }),
            ),
          ),
        ),
        h('div', { style: { ...muted, fontSize: 11.5, lineHeight: 1.7 } },
          '关闭后在对应 SKILL.md 写入 disable-model-invocation: true，对所有新会话生效。'),
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