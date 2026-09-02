import { For, Show, createSignal } from 'solid-js';
import { SaveRow, saves, savesBridge, setSaves } from './saves-store';

/**
 * The saves panel (issue #15). A tower is about six hours; before this, closing
 * the tab lost one.
 *
 * Three things are deliberate here:
 *
 *  - **Loading is confirmed in place, not in a browser dialog.** A `confirm()`
 *    blocks the page and, in this codebase, would block the extension driving
 *    it too. The row grows its own "load this, lose the current tower?" line.
 *  - **Every row says what the tower WAS**, not just when it was written. "day
 *    212 · 26 floors · 84 people" is how a player recognises their own save;
 *    a timestamp is how a filesystem does.
 *  - **A save only in this tab is labelled.** The store falls back to memory
 *    when the browser refuses it, and a fallback that looks identical to a real
 *    save is worse than no save at all.
 */

const money = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

function when(ms: number) {
  if (!Number.isFinite(ms)) return 'unknown';
  const age = Date.now() - ms;
  if (age < 60_000) return 'just now';
  if (age < 3_600_000) return Math.floor(age / 60_000) + ' min ago';
  const date = new Date(ms);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + time;
}

function towerLine(row: SaveRow) {
  const s = row.summary;
  if (!s) return 'no reading recorded';
  const parts = [
    'day ' + s.day,
    s.floors + (s.floors === 1 ? ' floor' : ' floors') + (s.basements ? ' + B' + s.basements : ''),
    s.population + (s.population === 1 ? ' person' : ' people'),
    money(s.money),
  ];
  if (s.star) parts.push(s.star);
  if (s.over) parts.push('BANKRUPT');
  return parts.join(' · ');
}

export function SavesPanel() {
  const [name, setName] = createSignal('');

  const submit = (event: Event) => {
    event.preventDefault();
    const chosen = name().trim();
    savesBridge.saveNamed(chosen);
    setName('');
  };

  const ask = (key: string, verb: 'load' | 'delete') => setSaves('confirming', { key, verb });
  const cancel = () => setSaves('confirming', null);
  const asking = (key: string, verb: 'load' | 'delete') =>
    saves.confirming?.key === key && saves.confirming.verb === verb;

  return (
    <Show when={saves.open}>
      {/* The scrim closes on click, which is the escape hatch a player reaches
          for before they find the Escape key. */}
      <div class="saves-scrim" onClick={() => savesBridge.close()} aria-hidden="true" />
      <div class="saves-panel" role="dialog" aria-modal="true" aria-label="saved towers">
        <header class="saves-head">
          <h2>SAVED TOWERS</h2>
          <button type="button" class="saves-close" onClick={() => savesBridge.close()} aria-label="close">×</button>
        </header>

        <Show when={saves.storageWarning}>
          <p class="saves-warning">{saves.storageWarning}</p>
        </Show>

        <form class="saves-new" onSubmit={submit}>
          <input
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="name this tower"
            aria-label="name for the new save"
            maxLength={60}
          />
          <button type="submit" disabled={saves.busy}>save</button>
        </form>

        <Show when={saves.message}>
          {(message) => <p class={'saves-message saves-' + message().tone}>{message().text}</p>}
        </Show>

        <div class="saves-list">
          <Show when={saves.rows.length} fallback={<p class="saves-empty">No saves yet. The game autosaves once a day as you play.</p>}>
            <For each={saves.rows}>
              {(row) => (
                <div class={'saves-row' + (row.key === saves.autosaveKey ? ' saves-row-auto' : '')}>
                  <div class="saves-row-head">
                    <b class="saves-name">{row.name}</b>
                    <Show when={row.key === saves.autosaveKey}><span class="saves-tag">AUTO</span></Show>
                    <Show when={row.memoryOnly}>
                      <span class="saves-tag saves-tag-warn" title="the browser refused to store this; it is gone when the tab closes">THIS TAB ONLY</span>
                    </Show>
                    <span class="saves-when">{when(row.savedAt)}</span>
                  </div>
                  <div class="saves-tower">{towerLine(row)}</div>

                  <Show
                    when={!asking(row.key, 'load') && !asking(row.key, 'delete')}
                    fallback={
                      <div class="saves-confirm">
                        <span>
                          {asking(row.key, 'load')
                            ? 'Load this? The tower on screen is replaced.'
                            : 'Delete this save for good?'}
                        </span>
                        <button
                          type="button"
                          class="saves-danger"
                          onClick={() => {
                            const verb = saves.confirming?.verb;
                            cancel();
                            if (verb === 'load') savesBridge.load(row.key); else savesBridge.remove(row.key);
                          }}
                        >
                          yes
                        </button>
                        <button type="button" onClick={cancel}>no</button>
                      </div>
                    }
                  >
                    <div class="saves-actions">
                      <button type="button" disabled={saves.busy} onClick={() => ask(row.key, 'load')}>load</button>
                      <button type="button" disabled={saves.busy} onClick={() => savesBridge.download(row.key)}>
                        export file
                      </button>
                      <button type="button" disabled={saves.busy} onClick={() => ask(row.key, 'delete')}>delete</button>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>

        <footer class="saves-foot">
          <label class="saves-import">
            import a save file
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                // Cleared so choosing the same file twice fires twice — a
                // player who fixes a bad file and re-picks it expects a retry.
                event.currentTarget.value = '';
                if (file) savesBridge.upload(file);
              }}
            />
          </label>
          <span class="saves-foot-note">A save file survives a cleared cache, and can be sent to whoever is debugging.</span>
        </footer>
      </div>
    </Show>
  );
}
