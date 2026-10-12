// Procesa las planillas de /planillas, cifra los datos con la contraseña
// (variable de entorno HUB_PASSWORD) y arma el sitio en /_site.
// Lo ejecuta GitHub Actions en cada cambio del repositorio.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const XLSX = require('xlsx');
const P = require('./parsers.js');

// Funciona con los archivos en carpetas (planillas/, logos/, config/) o todos sueltos en la raíz del repositorio.
const ROOT = fs.existsSync(path.join(__dirname, '..', 'index.html')) && !fs.existsSync(path.join(__dirname, 'index.html')) ? path.join(__dirname, '..') : __dirname;
const OUT = path.join(ROOT, '_site');
const inDirs = (exts) => [ROOT, path.join(ROOT, 'planillas'), path.join(ROOT, 'logos'), path.join(ROOT, 'config')].filter(d => fs.existsSync(d))
  .flatMap(d => fs.readdirSync(d).filter(f => exts.test(f) && !f.startsWith('~$')).map(f => path.join(d, f)));

const pw = process.env.HUB_PASSWORD;
if (!pw) { console.error('Falta el secreto HUB_PASSWORD (Settings > Secrets and variables > Actions).'); process.exit(1); }

const paths = inDirs(/\.(xlsx|xlsm|xls|ods|csv)$/i).sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
const files = paths.map(p => path.basename(p));
if (!files.length) { console.error('No se encontraron planillas (.xlsx o .csv) en el repositorio.'); process.exit(1); }

const found = [];
for (const full of paths) {
  const f = path.basename(full);
  let wb;
  if (/\.csv$/i.test(f)) {
    const txt = fs.readFileSync(full, 'utf8').replace(/^﻿/, '');
    const first = txt.split(/\r?\n/)[0];
    const FS = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    wb = XLSX.read(txt, { type: 'string', FS, raw: true });
  } else {
    wb = XLSX.read(fs.readFileSync(full), { cellDates: true, dense: true });
  }
  const fd = P.readWorkbook(wb, XLSX);
  if (!fd.length) {
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }).filter(r => r.some(x => x != null && String(x).trim() !== ''));
    if (rows.length <= 1) console.log(`· ${f}: sin registros todavía.`);
    else console.warn(`⚠ ${f}: no se reconoce el formato (revisá los encabezados). Se omite.`);
    continue;
  }
  console.log(`✓ ${f}: ${fd.map(x => x.kind + ' (hoja ' + x.sheet + ')').join(', ')}`);
  found.push(...fd);
}
if (!found.some(x => x.kind === 'carga')) { console.error('Falta la planilla de carga GPS (hoja con Jugador, Periodo, Actividad, Distancia…).'); process.exit(1); }

const DB = { players: [], matches: [], gps: [], train: [], seq: [], bipP: [], well: [], antro: [], inj: [] };
const msgs = P.applyFound(DB, found);
msgs.forEach(m => console.log('  ' + m));

const cfgPath = [path.join(ROOT, 'config', 'ajustes.json'), path.join(ROOT, 'ajustes.json')].find(p => fs.existsSync(p)) || '';
DB._cfg = cfgPath ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
DB._meta = { built: new Date().toISOString().slice(0, 10), archivos: files };

// gzip + AES-256-GCM con clave derivada por PBKDF2-SHA256
const ITER = 250000;
const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(pw, salt, ITER, 32, 'sha256');
const c = crypto.createCipheriv('aes-256-gcm', key, iv);
const body = Buffer.concat([c.update(zlib.gzipSync(Buffer.from(JSON.stringify(DB)))), c.final(), c.getAuthTag()]);
const enc = { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: body.toString('base64') };

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'logos'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'data.enc'), JSON.stringify(enc));
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(OUT, 'index.html'));
for (const l of inDirs(/\.webp$/i)) fs.copyFileSync(l, path.join(OUT, 'logos', path.basename(l)));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`Sitio listo en _site (datos cifrados: ${(enc.ct.length / 1e6).toFixed(2)} MB).`);
