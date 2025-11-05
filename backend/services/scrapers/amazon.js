const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const cheerio = require('cheerio');

async function scrapeAmazon(query) {
  try {
    const baseUrl = 'https://www.amazon.in';
    const url = `${baseUrl}/s?k=${encodeURIComponent(query)}`;
    
    console.log(`   🔍 Amazon: Fetching ${url}`);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    });

    if (!res.ok) {
      console.log(`   ⚠️  Amazon returned status: ${res.status}`);
      return [];
    }

    const html = await res.text();
    
    // Check for bot detection
    if (html.includes('Robot Check') || html.includes('captcha')) {
      console.log('   ⚠️  Amazon bot detection triggered');
      return [];
    }

    const $ = cheerio.load(html);
    const items = [];

    // Try multiple selectors for Amazon's dynamic layout
    const productSelectors = [
      '[data-component-type="s-search-result"]',
      '.s-result-item[data-asin]',
      'div[data-asin]:not([data-asin=""])'
    ];

    let productElements = $([]);
    for (const selector of productSelectors) {
      productElements = $(selector);
      if (productElements.length > 0) {
        console.log(`   ✓ Found products using selector: ${selector}`);
        break;
      }
    }

    if (productElements.length === 0) {
      console.log('   ⚠️  No product elements found on page');
      return [];
    }

    productElements.each((i, el) => {
      if (items.length >= 20) return false;

      try {
        const $el = $(el);
        const asin = $el.attr('data-asin');
        
        if (!asin) return;

        // Title - try multiple selectors
        const title = $el.find('h2 a span').first().text().trim() ||
                     $el.find('h2 span').first().text().trim() ||
                     $el.find('.a-text-normal').first().text().trim();
        
        if (!title) return;

        // Link
        const linkHref = $el.find('h2 a').first().attr('href') ||
                        $el.find('a.a-link-normal').first().attr('href');
        
        let link = '';
        if (linkHref) {
          link = linkHref.startsWith('http') ? linkHref : baseUrl + linkHref;
        } else {
          link = `${baseUrl}/dp/${asin}`;
        }

        // Image
        const image = $el.find('img').first().attr('src') || 
                     $el.find('img').first().attr('data-src') || '';

        // Price - try multiple selectors
        let priceText = $el.find('.a-price-whole').first().text().trim() ||
                       $el.find('.a-price .a-offscreen').first().text() ||
                       $el.find('.a-color-price').first().text();
        
        const price = priceText ? parseInt(priceText.replace(/[^0-9]/g, '')) || 0 : 0;
        
        if (price === 0) return; // Skip if no valid price

        // Original price for discount calculation
        const originalPriceText = $el.find('.a-text-price .a-offscreen').first().text();
        const origPrice = originalPriceText ? parseInt(originalPriceText.replace(/[^0-9]/g, '')) || 0 : 0;
        
        // Calculate discount
        let discount = 0;
        if (origPrice > 0 && origPrice > price) {
          discount = Math.round(((origPrice - price) / origPrice) * 100);
        }

        // Rating - try multiple selectors
        const ratingText = $el.find('.a-icon-alt').first().text() ||
                          $el.find('[aria-label*="stars"]').first().attr('aria-label') || '';
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

        // Reviews
        const reviewsText = $el.find('.a-size-base.s-underline-text').first().text() ||
                           $el.find('[aria-label*="ratings"]').first().attr('aria-label') || '';
        const reviews = reviewsText ? parseInt(reviewsText.replace(/[^0-9]/g, '')) || 0 : 0;

        items.push({
          id: `amazon_${asin}_${Date.now()}`,
          title,
          subtitle: '',
          description: '',
          image,
          store: 'Amazon',
          price,
          originalPrice: origPrice,
          discount,
          rating,
          reviews,
          stock: true,
          link
        });

      } catch (err) {
        // Skip problematic items silently
      }
    });

    console.log(`   ✓ Amazon scraped: ${items.length} products`);
    return items;

  } catch (error) {
    console.error('   ❌ Amazon scraping error:', error.message);
    return [];
  }
}

module.exports = { scrapeAmazon };