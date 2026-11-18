#!/usr/bin/env node
'use strict';
/* Run by GitHub when a version tag is pushed. Takes the app files waiting in incoming/<version>/,
   wraps them in the Windows runtime and installer, and fills in latest.json.
   Uses only Node's built-in modules. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const VERSION = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(VERSION || '')) throw new Error('Pass the version, like 1.3.0.');
const ROOT = path.join(__dirname, '..');
const IN = path.join(ROOT, 'incoming', VERSION);
const OUT = path.join(ROOT, 'out');
const latest = JSON.parse(fs.readFileSync(path.join(IN, 'latest.json'), 'utf8'));
const ELECTRON = latest.electron;
const appZip = fs.readFileSync(path.join(IN, `poker-night-app-${VERSION}.zip`));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
if (sha(appZip) !== latest.app.sha256) throw new Error('The app files don’t match latest.json.');

function readZip(buf) {
  let end = -1;
  for (let i = buf.length - 22; i >= 0; i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  const files = {};
  let p = buf.readUInt32LE(end + 16);
  for (let n = buf.readUInt16LE(end + 10); n > 0; n -= 1) {
    const method = buf.readUInt16LE(p + 10); const size = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28); const el = buf.readUInt16LE(p + 30); const cl = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42); const name = buf.slice(p + 46, p + 46 + nl).toString('utf8');
    p += 46 + nl + el + cl;
    if (name.endsWith('/')) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.slice(start, start + size);
    files[name] = method === 8 ? zlib.inflateRawSync(raw) : raw;
  }
  return files;
}

const T = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i += 1) c = T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function writeZip(files) {
  const parts = []; const central = []; let off = 0;
  for (const [name, data] of Object.entries(files)) {
    const z = zlib.deflateRawSync(data, { level: 9 }); const nb = Buffer.from(name, 'utf8'); const c = crc(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(0x6000, 10); h.writeUInt16LE(0x5a21, 12);
    h.writeUInt32LE(c, 14); h.writeUInt32LE(z.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nb.length, 26);
    const d = Buffer.alloc(46); d.writeUInt32LE(0x02014b50, 0); d.writeUInt16LE(20, 4); d.writeUInt16LE(20, 6); d.writeUInt16LE(0x0800, 8); d.writeUInt16LE(8, 10); d.writeUInt16LE(0x6000, 12); d.writeUInt16LE(0x5a21, 14);
    d.writeUInt32LE(c, 16); d.writeUInt32LE(z.length, 20); d.writeUInt32LE(data.length, 24); d.writeUInt16LE(nb.length, 28); d.writeUInt32LE(off, 42);
    parts.push(h, nb, z); central.push(d, nb); off += 30 + nb.length + z.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0); const e = Buffer.alloc(22);
  const count = Object.keys(files).length;
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(count, 8); e.writeUInt16LE(count, 10); e.writeUInt32LE(size, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, ...central, e]);
}

fs.mkdirSync(OUT, { recursive: true });
const ez = path.join(OUT, 'electron.zip');
execFileSync('curl', ['-sSL', '--fail', '-o', ez, `https://github.com/electron/electron/releases/download/v${ELECTRON}/electron-v${ELECTRON}-win32-x64.zip`], { stdio: 'inherit' });
const runtime = readZip(fs.readFileSync(ez));
const app = readZip(appZip);
const entries = {};
for (const [name, data] of Object.entries(runtime)) {
  if (name === 'resources/default_app.asar') continue;
  if (name.startsWith('locales/') && !name.startsWith('locales/en-US')) continue;
  entries[`App Files/${name === 'electron.exe' ? 'Poker Night.exe' : name}`] = data;
}
for (const [name, data] of Object.entries(app)) entries[`App Files/resources/app/${name}`] = data;
entries['Install Poker Night.bat'] = fs.readFileSync(path.join(__dirname, 'Install Poker Night.bat'));
if (app['Poker Night Guide.pdf']) entries['START HERE.pdf'] = app['Poker Night Guide.pdf'];
const setupName = `Poker-Night-Setup-${VERSION}.zip`;
const setup = writeZip(entries);
fs.writeFileSync(path.join(OUT, setupName), setup);
fs.copyFileSync(path.join(IN, `poker-night-app-${VERSION}.zip`), path.join(OUT, `poker-night-app-${VERSION}.zip`));
latest.windows = { url: `https://github.com/${process.env.GITHUB_REPOSITORY}/releases/download/v${VERSION}/${setupName}`, sha256: sha(setup), size: setup.length };
fs.writeFileSync(path.join(OUT, 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`);
fs.rmSync(ez);
console.log(`Built ${setupName} (${(setup.length / 1e6).toFixed(1)} MB)`);
