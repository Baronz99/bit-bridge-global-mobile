import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import playwright from '../../appstore/node_modules/playwright/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.join(__dirname, 'template.html');
const outputDir = path.join(__dirname, 'output');
const logoPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'logos', 'bitbridge-logo-clear.png');

const sizes = [
  { key: '1080x1080', className: 'size-square', width: 1080, height: 1080 },
  { key: '1080x1920', className: 'size-story', width: 1080, height: 1920 },
  { key: '1200x628', className: 'size-landscape', width: 1200, height: 628 }
];

const concepts = [
  {
    slug: 'vault',
    className: 'concept-vault',
    tag: 'BANK TRANSFER',
    brandSub: 'Secure transfers, every day.',
    headline: 'Send money with verified confidence.',
    subtext: 'Recipient checks, transfer review, and PIN confirmation in one trusted flow.',
    chips: ['Recipient verification', 'Review summary', 'PIN-protected submit']
  },
  {
    slug: 'cobalt',
    className: 'concept-cobalt',
    tag: 'TRANSFER FLOW',
    brandSub: 'Precision in every transfer step.',
    headline: 'From recipient check to success receipt.',
    subtext: 'A clean three-step journey for controlled, reliable bank transfers.',
    chips: ['Step 1 recipient', 'Step 2 review', 'Step 3 completion']
  },
  {
    slug: 'teal',
    className: 'concept-teal',
    tag: 'DAILY TRANSFERS',
    brandSub: 'Fast, trusted, trackable.',
    headline: 'Transfer clarity built for daily use.',
    subtext: 'Amount, fees, and confirmation details are visible before you commit.',
    chips: ['Fee transparency', 'Daily limit awareness', 'Timeline-ready receipt']
  }
];

async function render() {
  await fs.mkdir(outputDir, { recursive: true });
  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true });

  for (const size of sizes) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });

    for (const concept of concepts) {
      await page.evaluate(
        ({ conceptData, sizeClass, logoSrc }) => {
          const canvas = document.getElementById('canvas');
          canvas.className = `canvas ${sizeClass} ${conceptData.className}`;
          document.getElementById('logo').setAttribute('src', logoSrc);
          document.getElementById('tag').textContent = conceptData.tag;
          document.getElementById('brandSub').textContent = conceptData.brandSub;
          document.getElementById('headline').textContent = conceptData.headline;
          document.getElementById('subtext').textContent = conceptData.subtext;

          const chipsNode = document.getElementById('chips');
          chipsNode.innerHTML = '';
          for (const chipText of conceptData.chips) {
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.textContent = chipText;
            chipsNode.appendChild(chip);
          }
        },
        {
          conceptData: concept,
          sizeClass: size.className,
          logoSrc: pathToFileURL(logoPath).href
        }
      );

      const outPath = path.join(outputDir, `bank-transfer-${concept.slug}-${size.key}.png`);
      await page.screenshot({ path: outPath, type: 'png', fullPage: false });
      console.log(`Exported ${outPath}`);
    }

    await page.close();
    await context.close();
  }

  await browser.close();
}

render().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
