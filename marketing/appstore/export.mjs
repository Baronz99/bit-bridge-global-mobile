import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(__dirname, 'output');
const TEMPLATE_DIR = path.join(__dirname, 'templates');
const COPY_PATH = path.join(__dirname, 'inputs', 'copy.json');
const WIDTH = 1242;
const HEIGHT = 2688;

const slides = [
  { id: '01', name: 'home' },
  { id: '02', name: 'airtime' },
  { id: '03', name: 'services' },
  { id: '04', name: 'fund-wallet' },
  { id: '05', name: 'timeline' },
  { id: '06', name: 'receipt' },
  { id: '07', name: 'security' },
  { id: '08', name: 'virtual-card' }
];

const defaultCopy = {
  headline: 'Everyday Payments, Simplified',
  sub: 'Fast, secure, and reliable payments',
  proof: 'Built for trust and consistency',
  chips: ['Payments', 'Security', 'Reliability']
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadCopyMap() {
  try {
    const raw = await fs.readFile(COPY_PATH, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Map();
    const map = new Map();
    for (const item of arr) {
      const id = String(item?.id || '').padStart(2, '0');
      if (!id) continue;
      map.set(id, {
        headline: String(item?.headline || defaultCopy.headline),
        sub: String(item?.sub || defaultCopy.sub),
        proof: String(item?.proof || defaultCopy.proof),
        chips: Array.isArray(item?.chips) ? item.chips.map((x) => String(x)) : defaultCopy.chips
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

async function applySlideContent(page, slideId, copy) {
  await page.evaluate(
    ({ slideId, copy }) => {
      const headlineEl = document.getElementById('headline');
      const subheadEl = document.getElementById('subhead');
      const proofEl = document.getElementById('proof');
      const chipsEl = document.getElementById('chips');
      const slideTag = document.getElementById('slideTag');
      const privacyMaskEl = document.getElementById('privacyMask');

      if (headlineEl) headlineEl.textContent = copy.headline;
      if (subheadEl) subheadEl.textContent = copy.sub;
      if (proofEl) proofEl.textContent = copy.proof;
      if (chipsEl) {
        chipsEl.innerHTML = (copy.chips || [])
          .slice(0, 4)
          .map((chip) => `<span class="chip">${String(chip)}</span>`)
          .join('');
      }
      if (slideTag) slideTag.textContent = `Slide ${slideId}/08`;
      if (privacyMaskEl) privacyMaskEl.style.display = slideId === '04' ? 'block' : 'none';
    },
    { slideId, copy }
  );
}

async function exportSlides() {
  await ensureDir(OUT_DIR);
  const copyMap = await loadCopyMap();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1
  });

  for (const slide of slides) {
    const templatePath = path.join(TEMPLATE_DIR, `${slide.id}.html`);
    const outputPath = path.join(OUT_DIR, `${slide.id}-${slide.name}.png`);
    const page = await context.newPage();

    const url = pathToFileURL(templatePath).href;
    await page.goto(url, { waitUntil: 'networkidle' });

    const copy = copyMap.get(slide.id) || defaultCopy;
    await applySlideContent(page, slide.id, copy);

    await page.waitForTimeout(80);
    await page.screenshot({
      path: outputPath,
      type: 'png',
      fullPage: false
    });

    await page.close();
    console.log(`Exported ${path.relative(__dirname, outputPath)}`);
  }

  await context.close();
  await browser.close();
}

exportSlides().catch((error) => {
  console.error('Export failed:', error);
  process.exitCode = 1;
});
