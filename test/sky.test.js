/**
 * The sky (render/sky.js). Decoration, but decoration with rules: the day has
 * to read as a day, and a surprise has to stay rare enough to be a surprise.
 */
import { FLYERS, cloudScale, daylight, flyerScale, launchChance, makeSky, pickFlyer, skyColors, skyPhase } from '../src/games/lift/render/sky.js';
import { CONFIG } from '../src/games/lift/config.js';
import fs from 'node:fs';

const assert = (c, m) => { if (!c) throw new Error(m); };

/** A rng that walks a fixed list, so every test below is deterministic. */
function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

/** A deterministic spread of values, for anything that needs variety rather
 *  than a pinned answer. A short repeating list is a trap here: a cloud
 *  consumes six draws, so a six-value cycle hands every cloud the same numbers
 *  and the layer comes out perfectly flat. */
function walker(seed = 1) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

export const tests = {
  'the day passes through four skies, in order'() {
    const seen = [];
    for (let t = 0; t < 1; t += 0.01) {
      const { phase } = skyPhase(t);
      if (seen[seen.length - 1] !== phase) seen.push(phase);
    }
    assert(seen.join(' ') === 'night dawn day dusk night',
      'the day did not run night -> dawn -> day -> dusk -> night: ' + seen.join(' '));
  },

  'dawn and dusk are short, and day is the bulk of it'() {
    const count = { night: 0, dawn: 0, day: 0, dusk: 0 };
    for (let t = 0; t < 1; t += 0.001) count[skyPhase(t).phase]++;
    assert(count.day > count.dawn * 3, 'day is not clearly longer than dawn');
    assert(count.day > count.dusk * 3, 'day is not clearly longer than dusk');
    // The two minutes an hour that look like something. Stretch them and the
    // tower spends its whole day in golden hour.
    assert(count.dawn < 200 && count.dusk < 200, 'dawn or dusk eats too much of the day');
  },

  'dawn and dusk do not look like the same event twice'() {
    const [, dawnLow] = skyColors(0.10);
    const [, duskLow] = skyColors(0.78);
    const distance = dawnLow.reduce((sum, v, i) => sum + Math.abs(v - duskLow[i]), 0);
    assert(distance > 60, 'dawn and dusk are nearly the same colour: ' + dawnLow + ' vs ' + duskLow);
    // Dusk runs warmer than dawn: more red, less blue.
    assert(duskLow[0] >= dawnLow[0] && duskLow[2] < dawnLow[2], 'dusk is not the warmer of the two');
  },

  'the sky is darkest at midnight and brightest at midday'() {
    const midnight = skyColors(0)[0].reduce((a, b) => a + b, 0);
    const midday = skyColors(0.5)[0].reduce((a, b) => a + b, 0);
    assert(midday > midnight * 2, 'midday is not clearly brighter than midnight');
    assert(daylight(0.5) > 0.9, 'daylight does not peak around midday');
    assert(daylight(0) < 0.2 && daylight(0.99) < 0.2, 'daylight does not fall away at night');
  },

  'the rare flyers stay rare'() {
    // Every table entry must be reachable in at least one phase...
    for (const flyer of FLYERS) {
      assert(flyer.phases.length > 0, flyer.name + ' can never fly');
      assert(flyer.perMinute > 0, flyer.name + ' has no rate');
    }
    // ...and the surprises must be an order of magnitude scarcer than birds.
    const bird = FLYERS.find((f) => f.name === 'bird');
    for (const name of ['explorer', 'stunt']) {
      const rare = FLYERS.find((f) => f.name === name);
      assert(rare.perMinute * 10 < bird.perMinute,
        name + ' is not rare enough to be a surprise: ' + rare.perMinute + ' vs bird ' + bird.perMinute);
    }
  },

  'nothing flies in a phase it was not written for'() {
    for (const phase of ['night', 'dawn', 'day', 'dusk']) {
      for (let roll = 0; roll < 1; roll += 0.02) {
        const picked = pickFlyer(phase, roll);
        if (picked) assert(picked.phases.includes(phase), picked.name + ' flew at ' + phase);
      }
    }
    // Balloons are a daylight thing; the explorer is a dawn/dusk thing.
    assert(!FLYERS.find((f) => f.name === 'balloon').phases.includes('night'), 'balloons drift at night');
    assert(!FLYERS.find((f) => f.name === 'stunt').phases.includes('night'), 'the stunt plane flies in the dark');
  },

  'the launch chance follows the rate, and never exceeds certainty'() {
    const tiny = launchChance('day', 16);
    const long = launchChance('day', 60000);
    assert(tiny > 0 && tiny < 0.01, 'a single frame launches something far too often: ' + tiny);
    assert(long > 0.05 && long < 1, 'a minute of day sky is not a sane launch chance: ' + long);
    assert(launchChance('day', 1e9) <= 1, 'launch chance passed certainty');
    assert(launchChance('day', 0) === 0, 'no time passed and something still launched');
  },

  'the sky never puts more in the air than the cap allows'() {
    // An rng pinned near zero launches at every opportunity.
    const sky = makeSky(CONFIG, seq([0.0001]));
    for (let i = 0; i < 400; i++) sky.update(16, 0.5, 1200, 900);
    const cap = CONFIG.feel.sky.maxFlyers;
    assert(sky.flyers.length <= cap, 'the sky held ' + sky.flyers.length + ' flyers against a cap of ' + cap);
    assert(sky.flyers.length > 0, 'nothing ever launched');
  },

  'flyers leave, so a long session does not silt up'() {
    const sky = makeSky(CONFIG, seq([0.0001]));
    sky.update(16, 0.5, 1200, 900);
    const launched = sky.flyers.length;
    assert(launched > 0, 'nothing launched to test');
    // Run on with an rng that never launches again; everything should exit.
    const quiet = makeSky(CONFIG, seq([0.9999]));
    quiet.launch('day', 1200, 900);
    for (let i = 0; i < 2000; i++) quiet.update(120, 0.5, 1200, 900);
    assert(quiet.flyers.length === 0, 'a flyer never left the screen');
  },

  'clouds exist, drift, and sit at different depths'() {
    const sky = makeSky(CONFIG, walker(7));
    assert(sky.clouds.length === CONFIG.feel.sky.cloudCount, 'the cloud layer is the wrong size');
    const depths = new Set(sky.clouds.map((c) => c.depth));
    assert(depths.size > 1, 'every cloud sits at the same depth, so the sky is flat');
    for (const cloud of sky.clouds) {
      assert(cloud.speed > 0, 'a cloud does not move');
      assert(cloud.depth > 0 && cloud.depth <= 1, 'a cloud sits outside the depth range');
    }
  },

  'the sky scales with the zoom'() {
    // It did not, and the tower grew around it: zooming in made the building
    // huge and left the clouds and birds the size they already were.
    for (const depth of [0.25, 0.6, 1]) {
      const at1 = cloudScale(depth, 1);
      const at3 = cloudScale(depth, 3);
      assert(at3 > at1, 'a cloud at depth ' + depth + ' did not grow with the zoom');
      // In proportion, not by some token amount: three times the zoom is three
      // times the size.
      assert(Math.abs(at3 / at1 - 3) < 1e-9,
        'a cloud grew out of proportion to the zoom: ' + (at3 / at1).toFixed(2));
    }
    assert(flyerScale(3) === 3 && flyerScale(1) === 1, 'flyers do not draw at the camera scale');

    // Depth still makes near clouds bigger than far ones at the same zoom.
    assert(cloudScale(1, 2) > cloudScale(0.25, 2), 'depth stopped mattering');
    // And nothing draws inside out on a nonsense zoom.
    assert(cloudScale(0.5, 0) === 0 && flyerScale(-4) === 0, 'a negative zoom produced a negative size');
  },

  'the sky cannot touch the simulation'() {
    const text = fs.readFileSync(new URL('../src/games/lift/render/sky.js', import.meta.url), 'utf8');
    assert(!/from '\.\.\/sim\//.test(text), 'the sky imports simulation code');
    assert(!/\bstate\./.test(text.replace(/\/\*[\s\S]*?\*\//g, '')), 'the sky reads simulation state');
  },
};
