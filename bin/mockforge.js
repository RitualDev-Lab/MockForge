#!/usr/bin/env node

import { MockForgeCli } from '../dist/index.js';

MockForgeCli.run(process.argv)
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((err) => {
    console.error('Fatal CLI exception:', err);
    process.exit(1);
  });
