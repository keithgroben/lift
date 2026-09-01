import type { Component } from 'solid-js';
import { render } from 'solid-js/web';
import { StatBar } from './hud/StatBar';
import { ContextLine, TopBar } from './hud/TopBar';

// Mounted before app.js runs (script order in index.html), so the mount points
// and the `hud` store they read both exist by the time app.js's refresh()
// starts calling setHud(...).
const mounts: [string, Component][] = [
  ['top-bar-mount', TopBar],
  ['hud-context-mount', ContextLine],
  ['stat-bar-mount', StatBar],
];
for (const [id, Panel] of mounts) {
  const mount = document.getElementById(id);
  if (mount) render(() => <Panel />, mount);
}
