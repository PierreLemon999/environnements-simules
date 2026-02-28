/**
 * Auto-increment patch version in manifest.json and package.json.
 * Usage: npx tsx scripts/bump-version.ts [patch|minor|major]
 * Default: patch
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const manifestPath = resolve(root, 'public/manifest.json');
const packagePath = resolve(root, 'package.json');

const bump = (process.argv[2] || 'patch') as 'patch' | 'minor' | 'major';

// Read current version from manifest.json (source of truth)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const [major, minor, patch] = manifest.version.split('.').map(Number);

let newVersion: string;
switch (bump) {
	case 'major':
		newVersion = `${major + 1}.0.0`;
		break;
	case 'minor':
		newVersion = `${major}.${minor + 1}.0`;
		break;
	case 'patch':
	default:
		newVersion = `${major}.${minor}.${patch + 1}`;
		break;
}

// Write to manifest.json
manifest.version = newVersion;
writeFileSync(manifestPath, JSON.stringify(manifest, null, '  ') + '\n', 'utf-8');

// Write to package.json
const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
pkg.version = newVersion;
writeFileSync(packagePath, JSON.stringify(pkg, null, '  ') + '\n', 'utf-8');

console.log(`\n🔖 Version bumped: ${[major, minor, patch].join('.')} → ${newVersion} (${bump})\n`);
