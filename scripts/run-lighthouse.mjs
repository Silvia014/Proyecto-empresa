
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

const pages = [
  {
    name: "corporate-home",
    url: "http://206.189.186.75:3000/",
  },
  {
    name: "backoffice",
    url: "http://206.189.186.75:3001/backoffice/",
  },
];

const outputDir = resolve("audit/reports");
await mkdir(outputDir, { recursive: true });

for (const page of pages) {
  console.log(`\nAuditing ${page.name}: ${page.url}`);

  try {
    const { stdout, stderr } = await execFileAsync(
      "npx",
      [
        "lighthouse",
        page.url,
        "--output=html",
        "--output=json",
        `--output-path=${resolve(outputDir, page.name)}`,
        "--chrome-flags=--headless",
        "--only-categories=performance,accessibility,best-practices,seo",
      ],
      { maxBuffer: 20 * 1024 * 1024 }
    );

    if (stdout) console.log(stdout);
    if (stderr) console.log(stderr);

    console.log(`Reports generated for ${page.name}`);
  } catch (error) {
    console.error(`Audit failed for ${page.name}:`, error.message);
    if (error.stderr) console.error(error.stderr);
  }
}
