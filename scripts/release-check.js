#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const nodeBin = process.execPath;
const cliBin = resolve(repoRoot, 'src', 'cli.js');
const jestBin = resolve(repoRoot, 'node_modules', 'jest', 'bin', 'jest.js');
const sampleDeck = resolve(repoRoot, 'samples', 'sample-deck.md');

const failures = [];
const tempRoot = mkdtempSync(join(tmpdir(), 'deckdown-release-'));

function runStep(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    shell: false,
    maxBuffer: 20 * 1024 * 1024
  });

  const ok = result.status === 0;
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  if (ok) {
    console.log(`[ok] ${label}`);
    if (stdout) console.log(indent(stdout));
    return result;
  }

  console.log(`[fail] ${label}`);
  if (stdout) console.log(indent(stdout));
  if (stderr) console.log(indent(stderr));
  failures.push(label);
  return result;
}

function indent(text) {
  return text
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
}

function requireTool(tool, versionArgs = ['--version']) {
  return runStep(`${tool} availability`, tool, versionArgs);
}

function countPngs(dir, pattern) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(name => pattern.test(name)).length;
}

function assertEqual(label, actual, expected) {
  if (actual === expected) {
    console.log(`[ok] ${label}: ${actual}`);
    return true;
  }

  console.log(`[fail] ${label}: expected ${expected}, got ${actual}`);
  failures.push(label);
  return false;
}

function assertPositive(label, value) {
  if (value > 0) {
    console.log(`[ok] ${label}: ${value}`);
    return true;
  }

  console.log(`[fail] ${label}: expected > 0, got ${value}`);
  failures.push(label);
  return false;
}

function assertCondition(label, condition, details = '') {
  if (condition) {
    console.log(`[ok] ${label}`);
    if (details) console.log(indent(details));
    return true;
  }

  console.log(`[fail] ${label}`);
  if (details) console.log(indent(details));
  failures.push(label);
  return false;
}

function parseJson(label, text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    console.log(`[fail] ${label}`);
    console.log(indent(err.message));
    failures.push(label);
    return null;
  }
}

function cleanDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  return dir;
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

console.log('DeckDown release check');
console.log(`Repo root: ${repoRoot}`);
console.log(`Temp root: ${tempRoot}`);

requireTool('gs');
requireTool('pdftoppm', ['-v']);
requireTool('soffice');
requireTool('npm');
requireTool('tar', ['--version']);
runStep('deckdown CLI help', nodeBin, [cliBin, '--help']);

const testFiles = [
  '__tests__/lexer.test.js',
  '__tests__/parser.test.js',
  '__tests__/cli.test.js',
  '__tests__/layout-rendering.test.js',
  '__tests__/integration.test.js'
];

for (const testFile of testFiles) {
  runStep(
    `jest ${testFile}`,
    nodeBin,
    ['--max-old-space-size=2048', '--experimental-vm-modules', jestBin, '--runInBand', testFile]
  );
}

const sampleOut = cleanDir(resolve(tempRoot, 'sample'));
ensureDir(sampleOut);
const samplePdf = resolve(sampleOut, 'sample.pdf');
const samplePptx = resolve(sampleOut, 'sample.pptx');
const samplePngDir = resolve(sampleOut, 'sample-png');
const samplePdfPngDir = resolve(sampleOut, 'sample-pdf-png');
const samplePptxPdfDir = resolve(sampleOut, 'sample-pptx-pdf');
const samplePptxPngDir = resolve(sampleOut, 'sample-pptx-png');

runStep('render sample PDF', nodeBin, [cliBin, sampleDeck, '-o', samplePdf]);
runStep('render sample PNG', nodeBin, [cliBin, sampleDeck, '-o', samplePngDir, '--format', 'png']);
runStep('render sample PPTX', nodeBin, [cliBin, sampleDeck, '-o', samplePptx, '--format', 'pptx']);

if (existsSync(samplePdf)) {
  ensureDir(samplePdfPngDir);
  runStep('convert sample PDF to PNG', 'pdftoppm', ['-png', samplePdf, join(samplePdfPngDir, 'slide')]);
}

if (existsSync(samplePptx)) {
  ensureDir(samplePptxPdfDir);
  ensureDir(samplePptxPngDir);
  const loProfile = `file://${resolve(sampleOut, 'lo-profile-sample')}`;
  runStep(
    'convert sample PPTX to PDF',
    'soffice',
    ['--headless', `-env:UserInstallation=${loProfile}`, '--convert-to', 'pdf', '--outdir', samplePptxPdfDir, samplePptx]
  );

  const convertedPdf = resolve(samplePptxPdfDir, 'sample.pdf');
  if (existsSync(convertedPdf)) {
    runStep('convert sample PPTX PDF to PNG', 'pdftoppm', ['-png', convertedPdf, join(samplePptxPngDir, 'slide')]);
  }
}

const directPngs = countPngs(samplePngDir, /^slide-\d{3}\.png$/);
const pdfPngs = countPngs(samplePdfPngDir, /^slide-\d+\.png$/);
const pptxPngs = countPngs(samplePptxPngDir, /^slide-\d+\.png$/);

assertPositive('direct PNG slides', directPngs);
assertEqual('PDF-to-PNG slide count matches direct PNG', pdfPngs, directPngs);
assertEqual('PPTX-to-PNG slide count matches direct PNG', pptxPngs, directPngs);

const npmPackDir = ensureDir(resolve(tempRoot, 'npm-pack'));
const npmPackResult = runStep(
  'npm pack',
  'npm',
  ['pack', '--json', '--pack-destination', npmPackDir],
  { env: { npm_config_cache: resolve(tempRoot, 'npm-cache') } }
);

if (npmPackResult.status === 0) {
  const packInfoList = parseJson('parse npm pack output', npmPackResult.stdout || '');
  const packInfo = Array.isArray(packInfoList) ? packInfoList[0] : null;

  if (packInfo) {
    const tarball = resolve(npmPackDir, packInfo.filename);
    assertCondition('npm pack tarball exists', existsSync(tarball), tarball);

    const packedPaths = new Set((packInfo.files || []).map(file => file.path));
    assertCondition('npm pack includes CLI entrypoint', packedPaths.has('src/cli.js'));
    assertCondition('npm pack includes compiler entrypoint', packedPaths.has('src/index.js'));
    assertCondition('npm pack excludes tests', !Array.from(packedPaths).some(file => file.startsWith('__tests__/')));
    assertCondition('npm pack excludes dist output', !Array.from(packedPaths).some(file => file.startsWith('dist/')));
    assertCondition('npm pack excludes samples', !Array.from(packedPaths).some(file => file.startsWith('samples/')));
    assertCondition('npm pack excludes repo scripts', !Array.from(packedPaths).some(file => file.startsWith('scripts/')));

    const packedPackageResult = runStep('inspect packed package.json', 'tar', ['-xOf', tarball, 'package/package.json']);
    if (packedPackageResult.status === 0) {
      const packedPackage = parseJson('parse packed package.json', packedPackageResult.stdout || '');
      if (packedPackage) {
        assertCondition(
          'packed bin points to src/cli.js',
          packedPackage.bin?.deckdown === './src/cli.js'
        );
        assertCondition(
          'packed exports point to src/index.js',
          packedPackage.exports?.['.'] === './src/index.js'
        );
      }
    }

    const packedCliResult = runStep('inspect packed CLI entrypoint', 'tar', ['-xOf', tarball, 'package/src/cli.js']);
    if (packedCliResult.status === 0) {
      assertCondition(
        'packed CLI has shebang',
        (packedCliResult.stdout || '').startsWith('#!/usr/bin/env node')
      );
    }

    const extractDir = ensureDir(resolve(npmPackDir, 'extract'));
    const extractResult = runStep('extract packed npm artifact', 'tar', ['-xzf', tarball, '-C', extractDir]);
    const packedPackageDir = resolve(extractDir, 'package');
    const packedCliPath = resolve(packedPackageDir, 'src', 'cli.js');
    const packedNodeModules = resolve(packedPackageDir, 'node_modules');

    if (extractResult.status === 0) {
      assertCondition('packed CLI extracted', existsSync(packedCliPath), packedCliPath);

      if (!existsSync(packedNodeModules)) {
        symlinkSync(resolve(repoRoot, 'node_modules'), packedNodeModules, 'dir');
      }

      runStep('packed CLI help', packedCliPath, ['--help']);

      const packedSmokePdf = resolve(npmPackDir, 'packed-smoke.pdf');
      runStep('packed CLI sample render', packedCliPath, [sampleDeck, '-o', packedSmokePdf]);
      assertCondition('packed CLI sample output exists', existsSync(packedSmokePdf), packedSmokePdf);

      if (existsSync(packedCliPath)) {
        const packedCliContents = readFileSync(packedCliPath, 'utf8');
        assertCondition(
          'extracted packed CLI retains shebang',
          packedCliContents.startsWith('#!/usr/bin/env node')
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error('');
  console.error(`Release check failed (${failures.length} blocker${failures.length === 1 ? '' : 's'}).`);
  for (const label of failures) {
    console.error(`- ${label}`);
  }
  process.exit(1);
}

console.log('');
console.log('Release check passed.');
