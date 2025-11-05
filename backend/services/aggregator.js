const { searchGoogleShopping } = require('./serpapi');
const { scrapeAmazon } = require('./scrapers/amazon');
const { scrapeFlipkart } = require('./scrapers/flipkart');
const { rankProducts } = require('./product_ranker');
const { aiVerdict } = require('./aiAdvisor');

const SCRAPER_TIMEOUT = Number(process.env.SCRAPER_TIMEOUT_MS) || 6000;
const USE_SERPAPI = process.env.USE_SERPAPI === 'true';
const USE_AMAZON_FLIPKART_DIRECT = process.env.USE_AMAZON_FLIPKART_DIRECT === 'true';

/**
 * Wraps a promise with a timeout
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
}

/**
 * Deduplicates products based on title similarity and price
 */
function deduplicateProducts(products) {
  const seen = new Map();
  return products.filter(p => {
    const key = `${p.title.toLowerCase().slice(0, 50).trim()}_${p.price}`;
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

/**
 * [CRITICAL FALLBACK FIX] Filters out low-priced, generic accessories
 * This is ONLY used if the AI ranking fails to prevent price-sort takeover.
 */
function simpleAccessoryFilter(query, products) {
    const queryLower = query.toLowerCase();
    
    // Only apply the filter if the query is for a primary product (not an accessory itself)
    const isPrimaryQuery = !queryLower.includes('case') && 
                           !queryLower.includes('cover') &&
                           !queryLower.includes('charger') &&
                           !queryLower.includes('cable') &&
                           !queryLower.includes('protector') &&
                           !queryLower.includes('stand');

    if (!isPrimaryQuery) {
        return products; // Don't filter if the user is explicitly looking for an accessory
    }

    const filtered = products.filter(p => {
        const titleLower = p.title.toLowerCase();
        
        // Define common accessory keywords
        const isAccessory = titleLower.includes('case') || 
                            titleLower.includes('cover') ||
                            titleLower.includes('protector') || 
                            titleLower.includes('charger') ||
                            titleLower.includes('cable') ||
                            titleLower.includes('stand'); 
        
        // If it's a known accessory AND it's below a low price threshold (e.g., ₹1000), filter it out.
        if (isAccessory && p.price < 1000) {
            return false;
        }
        
        return true;
    });

    const removedCount = products.length - filtered.length;
    if (removedCount > 0) {
        console.log(`⚠️  Applied Simple Accessory Filter: Removed ${removedCount} low-cost accessories.`);
    }

    return filtered;
}


/**
 * Main aggregation function
 * Strategy: Amazon & Flipkart direct scrapers + SerpAPI for everything else
 */
async function getProductResults(query) {
  console.log('🔍 Aggregating products for:', query);
  const startTime = Date.now();

  let items = [];
  const sources = [];

  // STEP 1: Direct scrapers for Amazon & Flipkart ONLY (guaranteed direct links)
  if (USE_AMAZON_FLIPKART_DIRECT) {
    console.log('🎯 Scraping Amazon & Flipkart directly...');
    
    const directScrapers = [
      { name: 'Amazon', fn: scrapeAmazon },
      { name: 'Flipkart', fn: scrapeFlipkart }
    ];

    const scraperPromises = directScrapers.map(({ name, fn }) =>
      withTimeout(
        fn(query).catch(err => {
          console.error(`❌ ${name} scraper error:`, err.message);
          return [];
        }),
        SCRAPER_TIMEOUT
      ).catch(err => {
        console.error(`⏱️  ${name} timeout after ${SCRAPER_TIMEOUT}ms`);
        return [];
      })
    );

    const results = await Promise.allSettled(scraperPromises);

    results.forEach((result, idx) => {
      const name = directScrapers[idx].name;
      const data = result.status === 'fulfilled' ? result.value : [];
      
      if (data.length > 0) {
        items.push(...data);
        sources.push({ name, count: data.length, type: 'direct' });
        console.log(`   ✓ ${name}: ${data.length} products (direct links)`);
      } else {
        sources.push({ name, count: 0, type: 'failed' });
        console.log(`   ⚠️  ${name}: 0 products (scraper may be blocked)`);
      }
    });

    // If both scrapers failed, log a warning
    if (items.length === 0) {
      console.log('   ⚠️  Amazon & Flipkart scrapers returned no results (likely blocked)');
      console.log('   📡 Relying on SerpAPI for all results...');
    }
  }

  // STEP 2: SerpAPI for ALL other stores (eBay, Myntra, JioMart, Walmart, etc.)
  if (USE_SERPAPI) {
    console.log('📡 Using SerpAPI for other stores (eBay, Myntra, JioMart, etc.)...');
    try {
      const serpResults = await withTimeout(
        searchGoogleShopping(query),
        SCRAPER_TIMEOUT
      );
      
      // Filter out Amazon & Flipkart from SerpAPI if we already scraped them directly
      let filteredResults = serpResults;
      if (USE_AMAZON_FLIPKART_DIRECT) {
        const directStores = ['amazon', 'flipkart'];
        filteredResults = serpResults.filter(p => {
          const store = p.store.toLowerCase();
          // Filter out items whose store name contains 'amazon' or 'flipkart'
          return !directStores.some(ds => store.includes(ds)); 
        });
        
        const filtered = serpResults.length - filteredResults.length;
        if (filtered > 0) {
          console.log(`   🔄 Filtered out ${filtered} duplicate Amazon/Flipkart items from SerpAPI`);
        }
      }
      
      // Count link types
      const directLinks = filteredResults.filter(p => !p.link.includes('google.com')).length;
      const redirectLinks = filteredResults.length - directLinks;
      
      items.push(...filteredResults);
      sources.push({ 
        name: 'SerpAPI (Other Stores)', 
        count: filteredResults.length,
        directLinks,
        redirectLinks,
        type: 'serpapi'
      });
      console.log(`   ✓ SerpAPI: ${filteredResults.length} products (${directLinks} direct, ${redirectLinks} redirects)`);
    } catch (error) {
      console.error('❌ SerpAPI error:', error.message);
      sources.push({ name: 'SerpAPI', count: 0, error: error.message });
    }
  }

  // Filter out invalid items
  items = items.filter(item => item && item.price > 0 && item.title && item.link);

  console.log(`✓ Found ${items.length} total products in ${Date.now() - startTime}ms`);

  // Deduplicate
  const beforeDedup = items.length;
  items = deduplicateProducts(items);
  if (beforeDedup > items.length) {
    console.log(`🔄 Removed ${beforeDedup - items.length} duplicates`);
  }

  // Calculate link statistics
  const directLinks = items.filter(p => !p.link.includes('google.com')).length;
  const redirectLinks = items.length - directLinks;

  console.log(`📊 Link breakdown: ${directLinks} direct, ${redirectLinks} redirects`);

  // Handle empty results
  if (items.length === 0) {
    return {
      items: [],
      summary: getSetupMessage(),
      metadata: {
        totalResults: 0,
        rankedByAI: false,
        fetchTime: Date.now() - startTime,
        directLinks: 0,
        redirectLinks: 0,
        sources
      }
    };
  }

  // Sort by price initially (required for topProducts slice)
  items.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));

  // Get top products for AI analysis
  const topCount = Math.min(20, items.length); // FIX: Increased candidate pool from 5 to 20
  const productsForAI = items.slice(0, topCount);

  // Initialize result variables
  let summary = `Found ${items.length} products! Best price starts at ₹${productsForAI[0].price} from ${productsForAI[0].store}.`;
  let rankedProducts = [];
  let rankingFailed = false;

  // Attempt AI ranking and verdict
  try {
    console.log('🤖 Attempting AI ranking...');
    
    // Pass only the top subset to the ranker
    const rankResult = await rankProducts(query, productsForAI); 

    if (rankResult && typeof rankResult === 'object') {
      rankedProducts = rankResult.rankedProducts || [];
      rankingFailed = rankResult.crsFailed || false;
    } else if (Array.isArray(rankResult)) {
      rankedProducts = rankResult;
    }

    // Products used for AI verdict 
    const productsForVerdict = (rankedProducts.length > 0 && !rankingFailed) 
                                ? rankedProducts.slice(0, 5) 
                                : productsForAI.slice(0, 5);
    
    const rankNote = rankingFailed
      ? ' (Note: AI ranking temporarily unavailable, results filtered and sorted by price.)'
      : '';

    console.log('💬 Getting AI verdict...');
    summary = await aiVerdict(productsForVerdict, rankNote);

    // Replace the top subset of items with the ranked products
    if (rankedProducts.length > 0 && !rankingFailed) {
      // Splice the ranked items back into the main list
      items.splice(0, productsForAI.length, ...rankedProducts);
      
      // Ensure the rest of the list remains sorted by price
      const remainingItems = items.splice(productsForAI.length); // Remove the rest
      remainingItems.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
      items.push(...remainingItems); // Add them back
      
      console.log('✓ Applied AI ranking to top products');
    }

  } catch (err) {
    console.error('⚠️  AI ranking/verdict error:', err.message);
    rankingFailed = true;
    summary = `Found ${items.length} products! Best deal: ₹${productsForAI[0].price} from ${productsForAI[0].store}. ${productsForAI[0].discount > 0 ? `(${productsForAI[0].discount}% off!)` : ''}`;
  }


  // CRITICAL FIX: If AI ranking fails, apply simple filter to remove cheap junk
  if (rankingFailed) {
      const beforeFilter = items.length;
      items = simpleAccessoryFilter(query, items);
      
      if (items.length < beforeFilter) {
          // Re-sort by price after filtering
          items.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
          
          // Update summary with the new best product
          const newTopProduct = items[0];
          if (newTopProduct) {
             summary = `Found ${items.length} products! Best deal: ₹${newTopProduct.price} from ${newTopProduct.store}. (Note: AI ranking unavailable. Cheap accessories filtered out.)`;
          }
      }
  }


  return {
    items,
    summary,
    metadata: {
      totalResults: items.length,
      topPrice: items[0]?.price, 
      topStore: items[0]?.store, 
      rankedByAI: !rankingFailed && rankedProducts.length > 0,
      fetchTime: Date.now() - startTime,
      directLinks,
      redirectLinks,
      sources,
      strategy: {
        amazonFlipkartDirect: USE_AMAZON_FLIPKART_DIRECT,
        serpApiOthers: USE_SERPAPI
      }
    }
  };
}

function getSetupMessage() {
  if (!USE_SERPAPI && !USE_AMAZON_FLIPKART_DIRECT) {
    return '⚠️ No data sources enabled. Enable USE_SERPAPI and/or USE_AMAZON_FLIPKART_DIRECT in .env';
  }
  
  const apiKey = process.env.SERPAPI_KEY;
  if (USE_SERPAPI && (!apiKey || apiKey === 'your_serpapi_key_here')) {
    return '🔑 Please add SERPAPI_KEY to .env file. Get free key at: https://serpapi.com/users/sign_up';
  }
  
  return '😔 No products found. Try a different search term.';
}

module.exports = { getProductResults };