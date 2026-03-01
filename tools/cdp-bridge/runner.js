#!/usr/bin/env node
/**
 * CDP Probe Runner
 * Connects to Chrome via DevTools Protocol, executes a probe script,
 * and dumps the results to a JSON file.
 *
 * Usage:
 *   node runner.js <probe-file> [--tab=<index>] [--screenshot]
 *
 * Prerequisites:
 *   Launch Chrome with: --remote-debugging-port=9222
 */

import CDP from 'chrome-remote-interface';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { basename, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');

// Parse args
const args = process.argv.slice(2);
const probeFile = args.find(a => !a.startsWith('--'));
const tabIndex = parseInt(args.find(a => a.startsWith('--tab='))?.split('=')[1] ?? '0');
const wantScreenshot = args.includes('--screenshot');

if (!probeFile) {
  console.error('Usage: node runner.js <probe-file> [--tab=<index>] [--screenshot]');
  console.error('');
  console.error('Make sure Chrome is running with --remote-debugging-port=9222');
  process.exit(1);
}

async function run() {
  // List available tabs
  const targets = await CDP.List();
  const pages = targets.filter(t => t.type === 'page');

  if (pages.length === 0) {
    console.error('No browser tabs found. Is Chrome running with --remote-debugging-port=9222?');
    process.exit(1);
  }

  console.log(`Found ${pages.length} tab(s):`);
  pages.forEach((p, i) => console.log(`  [${i}] ${p.title} — ${p.url}`));
  console.log(`\nConnecting to tab [${tabIndex}]...`);

  if (tabIndex >= pages.length) {
    console.error(`Tab index ${tabIndex} out of range (max ${pages.length - 1})`);
    process.exit(1);
  }

  // Connect to the selected tab
  const client = await CDP({ target: pages[tabIndex] });
  const { Runtime, Page } = client;

  try {
    await Runtime.enable();

    // Read probe script
    const probeCode = readFileSync(probeFile, 'utf-8');

    // Wrap in async IIFE so probes can use await
    const wrapped = `(async () => { ${probeCode} })()`;

    console.log(`Running probe: ${basename(probeFile)}...\n`);

    const result = await Runtime.evaluate({
      expression: wrapped,
      awaitPromise: true,
      returnByValue: true,
      timeout: 30000,
    });

    // Handle errors
    if (result.exceptionDetails) {
      const err = result.exceptionDetails;
      const output = {
        probe: basename(probeFile),
        timestamp: new Date().toISOString(),
        success: false,
        error: err.text || err.exception?.description || 'Unknown error',
      };
      console.error('Probe error:', output.error);
      dumpResult(output);
      process.exit(1);
    }

    const output = {
      probe: basename(probeFile),
      timestamp: new Date().toISOString(),
      success: true,
      data: result.result.value,
    };

    // Optional screenshot
    if (wantScreenshot) {
      await Page.enable();
      const { data: screenshotData } = await Page.captureScreenshot({ format: 'png' });
      const screenshotPath = join(RESULTS_DIR, `${basename(probeFile, '.js')}-screenshot.png`);
      writeFileSync(screenshotPath, Buffer.from(screenshotData, 'base64'));
      console.log(`Screenshot saved: ${screenshotPath}`);
    }

    dumpResult(output);

    // Pretty print key findings to console
    if (output.data) {
      console.log('\n=== RESULTS ===');
      console.log(JSON.stringify(output.data, null, 2));
    }

  } finally {
    await client.close();
  }
}

function dumpResult(output) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const filename = `${basename(probeFile, '.js')}-${Date.now()}.json`;
  const filepath = join(RESULTS_DIR, filename);
  writeFileSync(filepath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved: ${filepath}`);
}

run().catch(err => {
  console.error('CDP connection failed:', err.message);
  console.error('\nMake sure Chrome is running with:');
  console.error('  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
  process.exit(1);
});
