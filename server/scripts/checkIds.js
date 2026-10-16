// Checks that every model named in the server catalog has a builder in the game (client/game-assets/js/objects.js),
// and that the client has no builder the catalog never uses.
const fs = require('fs');
const path = require('path');
const { HAZARD_POOL, SAFE_POOL } = require('../lib/catalog');

const src = fs.readFileSync(path.join(__dirname, '../../client/game-assets/js/objects.js'), 'utf8');
const block = src.match(/const BUILDERS = \{([\s\S]*?)\n\};/);
const client = block ? [...block[1].matchAll(/^ {4}([a-z0-9_]+):/gm)].map((m) => m[1]) : [];
const server = [...new Set([...HAZARD_POOL, ...SAFE_POOL].map((o) => o.model))];
const missing = server.filter((m) => !client.includes(m));
const unused = client.filter((m) => !server.includes(m));
console.log(`Models: server ${server.length}, client builders ${client.length}`);
if (missing.length) console.log('MISSING a client builder:', missing.join(', '));
if (unused.length) console.log('Client builder not in the catalog:', unused.join(', '));
if (!missing.length && !unused.length) console.log('OK');
process.exit(missing.length || unused.length ? 1 : 0);
