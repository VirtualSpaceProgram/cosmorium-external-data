import fs from 'node:fs/promises';
import yaml from 'js-yaml';

const PAGES_DIRECTORY_PATH = './_site/';

const data = [ ];
for (const url of yaml.load(await fs.readFile(new URL('satellites.yaml', import.meta.url), { encoding: 'utf-8' }))) {
	data.push(await (await fetch(url)).text());
}

const pagesDirectory = new URL(PAGES_DIRECTORY_PATH, import.meta.url);
await fs.mkdir(pagesDirectory, { recursive: true });
await fs.writeFile(new URL('satellites.txt', pagesDirectory), data.join(''));
