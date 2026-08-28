/**
 * Barrel: evaluation.js was a single 5,589-line file with ~200 exports
 * spanning room scoring, leasing, tenant mix, service coverage, and the
 * whole shaft/transport recommendation engine. Split into
 * sim/evaluation/*.js along those seams; this file re-exports everything so
 * no other module's import path had to change.
 */
export * from './evaluation/room.js';
export * from './evaluation/leasing.js';
export * from './evaluation/mixAndPlacement.js';
export * from './evaluation/serviceCoverage.js';
export * from './evaluation/transport.js';
export * from './evaluation/tower.js';
