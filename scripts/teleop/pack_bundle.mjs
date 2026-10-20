// Pack scene.xml, g1.xml and meshes into one file: [u32 headerLen][JSON header][blobs].
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [dir, outFile] = process.argv.slice(2);
const files = ['scene.xml', 'g1.xml', ...readdirSync(join(dir, 'assets')).sort().map(f => `assets/${f}`)];
const blobs = files.map(f => readFileSync(join(dir, f)));
let offset = 0;
const entries = files.map((name, i) => { const e = { name, offset, length: blobs[i].length }; offset += blobs[i].length; return e; });
const header = Buffer.from(JSON.stringify({ version: 1, entry: 'scene.xml', files: entries }));
const len = Buffer.alloc(4); len.writeUInt32LE(header.length);
writeFileSync(outFile, Buffer.concat([len, header, ...blobs]));
console.log(`${files.length} files, ${(4 + header.length + offset) / 1e6} MB -> ${outFile}`);
