#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { runCli } from './index.js';

function readPackageVersion() {
  const packageJson = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  );
  return packageJson.version || '0.0.0';
}

await runCli(process.argv, readPackageVersion());
