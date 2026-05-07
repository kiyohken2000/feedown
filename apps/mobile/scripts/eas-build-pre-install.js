#!/usr/bin/env node
/*
 * Trims the monorepo to mobile-only before EAS Build runs `yarn install`.
 *
 * Without this, yarn at the repo root pulls in workers/web/functions deps
 * (notably miniflare -> sharp), which fails on the EAS macOS runner because
 * sharp's prebuilt binary isn't picked up under yarn 1.x workspaces and the
 * source-build fallback needs node-gyp/libvips.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const rootPkgPath = path.join(repoRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));

pkg.workspaces = ['apps/mobile'];
delete pkg.dependencies;

fs.writeFileSync(rootPkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('[eas-build-pre-install] workspaces -> ["apps/mobile"], root deps cleared');
