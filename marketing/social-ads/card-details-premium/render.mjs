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
    slug: 'editorial',
    className: 'concept-editorial',
    label: 'CARD DETAILS',
    brandSub: 'Card security, refined.',
    headline: 'Security in every card action.',
    subtext: 'One screen for reveal, freeze, funding, and confidence.',
    bullets: ['Banking-grade controls', 'Clear activity feed', 'Designed for trust']
  },
  {
    slug: 'glass',
    className: 'concept-glass',
    label: 'PREMIUM CONTROL',
    brandSub: 'Sleek control layer.',
    headline: 'Manage cards with elegant precision.',
    subtext: 'A polished command center for your virtual card lifecycle.',
    bullets: ['Smooth visual depth', 'Fast decision controls', 'High-confidence UX']
  },
  {
    slug: 'data-grid',
    className: 'concept-grid',
    label: 'TRUST ENGINE',
    brandSub: 'Built for predictable money movement.',
    headline: 'Clarity, status, and action in one flow.',
    subtext: 'From balance to controls to history, every signal is visible.',
    bullets: ['Operational clarity', 'Status at a glance', 'Reliable daily execution']
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
          document.getElementById('label').textContent = conceptData.label;
          document.getElementById('brandSub').textContent = conceptData.brandSub;
          document.getElementById('headline').textContent = conceptData.headline;
          document.getElementById('subtext').textContent = conceptData.subtext;

          const bulletsNode = document.getElementById('bullets');
          bulletsNode.innerHTML = '';
          for (const bullet of conceptData.bullets) {
            const chip = document.createElement('span');
            chip.className = 'bullet';
            chip.textContent = bullet;
            bulletsNode.appendChild(chip);
          }
        },
        {
          conceptData: concept,
          sizeClass: size.className,
          logoSrc: pathToFileURL(logoPath).href
        }
      );

      const outPath = path.join(outputDir, `card-details-${concept.slug}-${size.key}.png`);
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
