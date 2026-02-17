import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import playwright from '../appstore/node_modules/playwright/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.join(__dirname, 'template.html');
const outputDir = path.join(__dirname, 'output');
const logoPath = path.resolve(__dirname, '..', '..', 'assets', 'logos', 'bitbridge-logo-clear.png');

const sizes = [
  { key: '1080x1080', className: 'size-square', width: 1080, height: 1080 },
  { key: '1080x1920', className: 'size-story', width: 1080, height: 1920 },
  { key: '1200x628', className: 'size-landscape', width: 1200, height: 628 }
];

const ads = [
  {
    slug: '01-trust-security',
    tag: 'TRUST & SECURITY',
    headline: 'Your money deserves protection.',
    subtext: 'Banking built for peace of mind.',
    amount: '$4,280.20',
    chips: ['Encrypted transfers', 'Live fraud alerts', 'Secure by default'],
    features: [
      ['Payment Shield', 'Active'],
      ['Identity Check', '2-step enabled'],
      ['Withdrawal Lock', 'On']
    ]
  },
  {
    slug: '02-social-banking',
    tag: 'SOCIAL BANKING',
    headline: 'Bank with your people.',
    subtext: 'Share, send, and support in one place.',
    amount: '$2,940.60',
    chips: ['Shared goals', 'Split expenses', 'Group wallets'],
    features: [
      ['Circle Save', '12 members'],
      ['Support Transfers', 'Instant'],
      ['Shared Budgets', '3 active']
    ]
  },
  {
    slug: '03-daily-payments',
    tag: 'DAILY PAYMENTS',
    headline: 'Pay everything. Effortlessly.',
    subtext: 'Bills, transfers, data, and more.',
    amount: '$1,825.10',
    chips: ['One-tap pay', 'Smart reminders', 'Always on'],
    features: [
      ['Utility Bills', 'Due in 2 days'],
      ['Data Top-Up', 'Auto enabled'],
      ['Quick Transfer', '< 10 sec']
    ]
  },
  {
    slug: '04-built-from-real-needs',
    tag: 'BUILT FROM REAL NEEDS',
    headline: 'You asked. We built it.',
    subtext: 'Designed from everyday life.',
    amount: '$3,110.45',
    chips: ['User-requested', 'Faster flows', 'Clear controls'],
    features: [
      ['Saved Beneficiaries', '24 contacts'],
      ['Flexible Limits', 'Custom'],
      ['Receipt Timeline', 'Auto log']
    ]
  },
  {
    slug: '05-finance-without-barriers',
    tag: 'INCLUSIVE FINANCE',
    headline: 'Finance that works for everyone.',
    subtext: '',
    amount: '$950.75',
    chips: ['Simple onboarding', 'Access for all', 'Low-friction banking'],
    features: [
      ['Easy Setup', '3 min start'],
      ['Accessible UI', 'Clear layout'],
      ['Multi-use Wallet', 'Daily ready']
    ]
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

    for (const ad of ads) {
      await page.evaluate(
        ({ adData, sizeClass, logoSrc }) => {
          const canvas = document.getElementById('canvas');
          canvas.className = `canvas ${sizeClass}`;
          document.getElementById('logo').setAttribute('src', logoSrc);
          document.getElementById('tag').textContent = adData.tag;
          document.getElementById('headline').textContent = adData.headline;
          document.getElementById('subtext').textContent = adData.subtext || ' ';
          document.getElementById('amount').textContent = adData.amount;

          const chipsNode = document.getElementById('chips');
          chipsNode.innerHTML = '';
          for (const chip of adData.chips) {
            const span = document.createElement('span');
            span.className = 'chip';
            span.textContent = chip;
            chipsNode.appendChild(span);
          }

          const featuresNode = document.getElementById('features');
          featuresNode.innerHTML = '';
          for (const [name, meta] of adData.features) {
            const row = document.createElement('div');
            row.className = 'feature';
            const left = document.createElement('span');
            left.className = 'feature-name';
            left.textContent = name;
            const right = document.createElement('span');
            right.className = 'feature-meta';
            right.textContent = meta;
            row.appendChild(left);
            row.appendChild(right);
            featuresNode.appendChild(row);
          }
        },
        {
          adData: ad,
          sizeClass: size.className,
          logoSrc: pathToFileURL(logoPath).href
        }
      );

      const fileName = `${ad.slug}-${size.key}.png`;
      const outPath = path.join(outputDir, fileName);
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
