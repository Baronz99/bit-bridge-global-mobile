import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import playwright from '../../appstore/node_modules/playwright/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIDTH = 1080;
const HEIGHT = 1350;
const htmlPath = path.join(__dirname, 'template.html');
const outPath = path.join(__dirname, 'output', 'card-details-social-ad-1080x1350.png');

async function run() {
  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.screenshot({
    path: outPath,
    type: 'png',
    fullPage: false
  });

  await page.close();
  await context.close();
  await browser.close();
  console.log(`Exported ${outPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
