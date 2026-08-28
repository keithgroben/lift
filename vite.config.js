import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// Scoped to Lift's HUD only. `sim/**` and `render/canvas.js` stay plain JS,
// zero-build, Node-runnable — that split is the one architectural rule this
// repo has (see CLAUDE.md). Bloom and the game picker are untouched; they
// keep running off harness/serve.js (`npm run play`).
export default defineConfig({
  root: '.',
  plugins: [
    solid({ include: 'src/games/lift/ui/**/*.tsx' }),
  ],
  server: {
    // harness/serve.js already owns 5173 (npm run play). Vite gets its own
    // port so both can run side by side during the migration.
    port: 5174,
  },
});
