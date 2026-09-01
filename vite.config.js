import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// Scoped to Lift's HUD only. `sim/**` and `render/canvas.js` stay plain JS,
// zero-build, Node-runnable — that split is the one architectural rule this
// repo has (see CLAUDE.md). Bloom and the game picker are untouched; they
// keep running off harness/serve.js (`npm run play`).

/**
 * Copy the runtime asset folders into the build.
 *
 * The sprite sheets are fetched by URL at runtime, never imported, so a
 * bundler has no idea they exist — the first production build produced a 2 kB
 * index.html and not one pixel of art. A missing sheet is also the quietest
 * possible failure, because the loader is built to fall back to coloured
 * rectangles: the game would have looked "fine" and drawn none of its art.
 *
 * Written inline rather than pulling in vite-plugin-static-copy: this repo
 * gets to keep counting its dependencies on one hand.
 */
function copyRuntimeAssets(dirs) {
  return {
    name: 'lift-copy-runtime-assets',
    apply: 'build',
    closeBundle() {
      for (const dir of dirs) {
        const from = path.resolve(dir);
        if (!fs.existsSync(from)) continue;
        const to = path.resolve('dist', dir);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.cpSync(from, to, { recursive: true });
        const count = fs.readdirSync(to, { recursive: true }).length;
        this.info(`copied ${dir} (${count} files)`);
      }
    },
  };
}

export default defineConfig({
  root: '.',
  // Relative, so a build runs from a subdirectory, a file server, or inside a
  // desktop wrapper without being rebuilt for each.
  base: './',
  plugins: [
    solid({ include: 'src/games/lift/ui/**/*.tsx' }),
    copyRuntimeAssets(['src/games/lift/assets']),
  ],
  build: {
    // Every page, not just the picker. The default single entry built the
    // game-chooser page and never followed the link into the game itself.
    rollupOptions: {
      input: {
        picker: 'index.html',
        lift: 'src/games/lift/index.html',
        bloom: 'src/games/bloom/index.html',
      },
    },
  },
  server: {
    // harness/serve.js already owns 5173 (npm run play). Vite gets its own
    // port so both can run side by side during the migration.
    port: 5174,
  },
});
