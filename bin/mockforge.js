#!/usr/bin/env node

import { MockForgeCli } from '../dist/index.js';

const rawArgs = process.argv.slice(2);
const argv = (rawArgs.length === 0 && !process.stdin.isTTY)
  ? [process.argv[0], process.argv[1], 'mcp']
  : process.argv;

MockForgeCli.run(argv)
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((err) => {
    console.error('Fatal CLI exception:', err);
    process.exit(1);
  });
