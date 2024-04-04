import fs from 'node:fs/promises';
import yaml from 'js-yaml';
import * as core from '@actions/core';
import { PNG } from 'pngjs';
import { Buffer } from 'node:buffer';

const PAGES_DIRECTORY_PATH = './_site/';

const data = [];
for (const url of yaml.load(await fs.readFile(new URL('satellites.yaml', import.meta.url), { encoding: 'utf-8' }))) {
	const responseText = await (await fetch(url)).text();
	if (!responseText.includes('\n')) {
		// 改行が含まれていなければ、404とみなす
		core.error(`${url} から「${responseText}」が返りました。`);
		continue;
	}
	data.push(await (await fetch(url)).text());
}

const pagesDirectory = new URL(PAGES_DIRECTORY_PATH, import.meta.url);
await fs.mkdir(pagesDirectory, { recursive: true });
await fs.writeFile(new URL('satellites.txt', pagesDirectory), data.join(''));

// generate png

const blockSize = 4;
const targetSize = 128;
const json = (await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json')).text();
const obj = JSON.parse(await json);
const buff = Buffer.alloc(targetSize * blockSize * targetSize * blockSize * 4);
const currentTime = Date.now();
const currentTimeIncsThick = BigInt(Date.now()) * 10000n + 621355968000000000n;

const buff2 = Buffer.alloc(8);
buff2.writeBigInt64BE(currentTimeIncsThick);

for (let i = 0; i < 2; i++) {
	for (let j = 0; j < 4; j++) {
		buff[(i * blockSize + 3 + (targetSize - 1) * targetSize * blockSize * blockSize) * 4 + j] = buff2[i * 4 + j];
	}
}


let idx = 0;
const writeFloat = (buf, val, idx, x, y) => {
	const ix = idx % targetSize;
	const iy = targetSize - Math.floor(idx / targetSize) - 1;
	const pos = ix * blockSize * 4 + iy * targetSize * blockSize * blockSize * 4;
	const offset = x * 4 + (blockSize - y - 1) * targetSize * blockSize * 4;

	buf.writeFloatBE(val, pos + offset);
};
const writebyte = (buf, val, idx, x, y) => {
	const ix = idx % targetSize;
	const iy = targetSize - Math.floor(idx / targetSize) - 1;
	const pos = ix * blockSize * 4 + iy * targetSize * blockSize * blockSize * 4;
	const offset = x * 4 + (blockSize - y - 1) * targetSize * blockSize * 4;

	buf[pos + offset] = val;
};
for (const sat of obj) {
	const ep = (currentTime - Date.parse(sat.EPOCH + 'Z')) / 1000;
	const isStarlink = (sat.OBJECT_NAME.indexOf('STARLINK') !== -1);


	writeFloat(buff, ep, idx, 0, 0);
	writeFloat(buff, sat.INCLINATION, idx, 0, 1);
	writeFloat(buff, sat.RA_OF_ASC_NODE, idx, 0, 2);
	writeFloat(buff, sat.ECCENTRICITY, idx, 0, 3);
	writeFloat(buff, sat.ARG_OF_PERICENTER, idx, 1, 0);
	writeFloat(buff, sat.MEAN_ANOMALY, idx, 1, 1);
	writeFloat(buff, sat.MEAN_MOTION, idx, 1, 2);
	writeFloat(buff, sat.BSTAR, idx, 1, 3);
	writebyte(buff, isStarlink ? 2 : 1, idx, 2, 0);
	idx++;
}

const png = new PNG({
	colorType: 6,
	bitDepth: 8,
	width: targetSize * blockSize,
	height: targetSize * blockSize,
});
png.data = buff;
await fs.writeFile(new URL('satellites.png', pagesDirectory), PNG.sync.write(png));
