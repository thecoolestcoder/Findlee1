// scrapeFlipkart.js
// Robust Puppeteer scraper with stealth, popup close, flexible waits, and debug mode.

const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const PRODUCT_SELECTORS = [
  '[data-id]',
  '._1AtVbE',
  '._2kHMtA',
  '.cPHDOP',
  '._13oc-S',
  '.s1Q9rs',     // sometimes individual card selector
  '._4rR01T'     // title selector directly present in some cards
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function autoScroll(page, maxScrolls = 20, delay = 400) {
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, Math.floor(window.innerHeight * 0.9)));
    await sleep(delay + Math.random() * 300);
  }
  // final small wait for lazy content
  await sleep(600 + Math.random() * 600);
}

async function fetchPageContentWithBrowser(url, opts = {}) {
  const {
    headless = true,
    timeout = 60000,
    proxy = null,
    debug = false,
  } = opts;

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--disable-infobars',
    '--window-size=1366,768'
  ];
  if (proxy) launchArgs.push(`--proxy-server=${proxy}`);

  const browser = await puppeteer.launch({
    headless,
    args: launchArgs,
    defaultViewport: { width: 1366, height: 768 },
  });

  const page = await browser.newPage();
  // realistic UA
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9', referer: 'https://www.google.com/' });
  page.setDefaultNavigationTimeout(timeout);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    // Immediately try close login popup if present
    try {
      const closeSelector = 'button._2KpZ6l._2doB4z';
      await page.waitForSelector(closeSelector, { timeout: 3000 }).then(() => page.click(closeSelector)).catch(()=>{});
    } catch {}

    // small pause
    await sleep(800);

    // Wait for any product selector - try multiple times with short scrolls
    let found = false;
    for (let attempt = 0; attempt < 4 && !found; attempt++) {
      // try to wait for at least one known selector
      for (const sel of PRODUCT_SELECTORS) {
        try {
          await page.waitForSelector(sel, { timeout: 3000 });
          found = true;
          break;
        } catch (e) { /* try next selector */ }
      }
      if (!found) {
        // scroll a bit to trigger lazy loading or modal dismissal
        await autoScroll(page, 2, 500);
        await sleep(800);
      }
    }

    // extra scrolling to load more products
    await autoScroll(page, 10, 450);

    // Grab rendered HTML
    const html = await page.content();

    // If debug and no product selectors found in HTML, keep page open for inspection
    const htmlHasProducts = PRODUCT_SELECTORS.some(sel => {
      try { return !!(cheerio.load(html)(sel).length); } catch (e){ return false; }
    });

    if (!htmlHasProducts && debug) {
      console.log('   ⚠️  No product selectors found in rendered HTML — leaving browser open for debugging at your request.');
      console.log('   -> Inspect the opened browser, then press ENTER here to close it.');
      // open a REPL-ish wait for user input in console
      // NOTE: this only works if you run test in the same terminal
      await new Promise((resolve) => {
        process.stdin.resume();
        process.stdin.once('data', () => {
          process.stdin.pause();
          resolve();
        });
      });
      // after ENTER, continue
    }

    if (!debug) {
      await page.close();
      await browser.close();
    } else if (!htmlHasProducts) {
      // in debug mode, if we kept browser open, don't close here
      // return HTML so user can inspect
    } else {
      await page.close();
      await browser.close();
    }

    return html;
  } catch (err) {
    try { await page.close(); } catch (e) {}
    try { await browser.close(); } catch (e) {}
    throw err;
  }
}

function parseProductsFromHtml(html) {
  const $ = cheerio.load(html);
  const items = [];

  // find first matching container set
  let productElements = $([]);
  for (const selector of PRODUCT_SELECTORS) {
    const found = $(selector);
    if (found.length > 0) {
      productElements = found;
      break;
    }
  }

  productElements.each((i, el) => {
    if (items.length >= 40) return false;
    try {
      const $el = $(el);

      const title =
        $el.find('._4rR01T').first().text().trim() ||
        $el.find('.s1Q9rs').first().text().trim() ||
        $el.find('._2WkVRV').first().text().trim() ||
        $el.find('.IRpwTGD').first().text().trim() ||
        $el.find('a[title]').first().attr('title') || '';

      if (!title) return;

      let link = $el.find('a').first().attr('href') || '';
      if (link) link = link.startsWith('http') ? link : 'https://www.flipkart.com' + link;
      else return;

      const image =
        $el.find('img').first().attr('src') ||
        $el.find('img').first().attr('data-src') ||
        $el.find('img').first().attr('data-image') || '';

      const priceText =
        $el.find('._30jeq3').first().text() ||
        $el.find('._1_WHN1').first().text() ||
        $el.find('._3I9_wc').first().text() ||
        $el.find('div[class*="price"]').first().text();
      const price = priceText ? parseInt(priceText.replace(/[^0-9]/g, '')) || 0 : 0;
      if (price === 0) return;

      const originalPriceText =
        $el.find('._3I9_wc').first().text() ||
        $el.find('._11B7B').first().text() ||
        $el.find('._3auQ3N').first().text();
      const origPrice = originalPriceText ? parseInt(originalPriceText.replace(/[^0-9]/g, '')) || 0 : 0;

      const discountText =
        $el.find('._3Ay6Sb').first().text() ||
        $el.find('._1uv9Cb').first().text();
      let discount = discountText ? parseInt(discountText.replace(/[^0-9]/g, '')) || 0 : 0;
      if (origPrice > 0 && origPrice > price && discount === 0) {
        discount = Math.round(((origPrice - price) / origPrice) * 100);
      }

      const ratingText =
        $el.find('._3LWZlK').first().text() ||
        $el.find('._1lRcqv').first().text() ||
        $el.find('div[class*="rating"]').first().text();
      const rating = ratingText ? parseFloat(ratingText.match(/[\d.]+/)?.[0] || '0') : 0;

      const reviewsText =
        $el.find('._2_R_DZ').first().text() ||
        $el.find('span[class*="rating"]').last().text();
      const reviews = reviewsText ? parseInt(reviewsText.replace(/[^0-9]/g, '')) || 0 : 0;

      items.push({
        id: `flipkart_${i}_${Date.now()}`,
        title,
        subtitle: '',
        description: '',
        image,
        store: 'Flipkart',
        price,
        originalPrice: origPrice,
        discount,
        rating,
        reviews,
        stock: true,
        link
      });
    } catch (e) {
      // skip
    }
  });

  return items;
}

async function scrapeFlipkart(query, opts = {}) {
  try {
    const baseUrl = 'https://www.flipkart.com';
    const url = `${baseUrl}/search?q=${encodeURIComponent(query)}`;
    console.log(`   🔍 Flipkart (browser): Fetching ${url}`);

    const html = await fetchPageContentWithBrowser(url, {
      headless: opts.headless ?? true,
      timeout: opts.timeout ?? 60000,
      proxy: opts.proxy ?? null,
      debug: opts.debug ?? false,
    });

    if (!html || html.length < 1000 || html.includes('Access Denied') || html.toLowerCase().includes('blocked')) {
      console.log('   ⚠️  Flipkart returned a blocked/empty page from browser rendering');
      return [];
    }

    const products = parseProductsFromHtml(html);
    console.log(`   ✓ Flipkart scraped: ${products.length} products`);
    return products;
  } catch (err) {
    console.error('   ❌ Flipkart scraping error:', err.message);
    return [];
  }
}

module.exports = { scrapeFlipkart };
