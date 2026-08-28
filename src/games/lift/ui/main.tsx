import { render } from 'solid-js/web';
import { StatBar } from './hud/StatBar';

// Mounted before app.js runs (script order in index.html), so `#stat-bar-mount`
// and the `hud` store it reads both exist by the time app.js's refresh()
// starts calling setHud(...).
const mount = document.getElementById('stat-bar-mount');
if (mount) render(() => <StatBar />, mount);
