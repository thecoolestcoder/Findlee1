// Use native fetch (Node.js 18+) or fallback to node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

const MAX_PRODUCTS = Number(process.env.MAX_PRODUCTS_PER_STORE) || 15;

/**
 * Search Google Shopping for products
 * Enhanced with better link extraction and store detection
 */
async function searchGoogleShopping(query) {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey || apiKey === 'your_serpapi_key_here') {
    console.log('⚠️  SerpAPI key not configured');
    return [];
  }

  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.append('engine', 'google_shopping');
    url.searchParams.append('q', query);
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('num', String(MAX_PRODUCTS));
    url.searchParams.append('gl', 'in'); // India
    url.searchParams.append('hl', 'en'); // English

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`SerpAPI returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    const results = data.shopping_results || [];

    return results.map((item, index) => {
      // Extract price
      let price = 0;
      if (item.extracted_price) {
        price = item.extracted_price;
      } else if (item.price) {
        // IMPROVED: Handle currency symbols gracefully
        const priceStr = String(item.price).replace(/[^0-9.]/g, '');
        price = parseFloat(priceStr) || 0;
      }

      // Extract rating and reviews
      let rating = 0;
      let reviews = 0;
      
      if (item.rating) {
        rating = parseFloat(item.rating) || 0;
      }
      
      if (item.reviews) {
        const reviewStr = String(item.reviews).replace(/[^0-9]/g, '');
        reviews = parseInt(reviewStr) || 0;
      }
      
      if (item.reviews_original_text && rating === 0) {
        const ratingMatch = item.reviews_original_text.match(/(\d+\.?\d*)/);
        if (ratingMatch) {
          rating = parseFloat(ratingMatch[1]);
        }
      }

      // FIX: Enhanced link extraction with priority for direct store links
      let productLink = '';
      let store = 'Google Shopping';
      
      // Try to get direct link from product_link first
      if (item.product_link) {
        productLink = item.product_link;
      } 
      // Try to extract from link parameter
      else if (item.link) {
        try {
          const linkUrl = new URL(item.link);
          
          // Check if it's a Google redirect
          if (item.link.includes('google.com/url') || item.link.includes('google.com/shopping')) {
            // Try to extract the actual URL from parameters
            const actualUrl = linkUrl.searchParams.get('url') || 
                            linkUrl.searchParams.get('q') ||
                            linkUrl.searchParams.get('adurl');
            
            if (actualUrl) {
              productLink = decodeURIComponent(actualUrl);
            } else {
              // If no direct URL found, use the redirect (not ideal but better than nothing)
              productLink = item.link;
            }
          } else {
            // Direct link, use as-is
            productLink = item.link;
          }
        } catch (e) {
          productLink = item.link;
        }
      }

      // Detect store from link or source
      let detectedStore = '';
      if (productLink) {
        const linkLower = productLink.toLowerCase();
        if (linkLower.includes('amazon')) {
          detectedStore = 'Amazon';
        } else if (linkLower.includes('flipkart')) {
          detectedStore = 'Flipkart';
        } else if (linkLower.includes('myntra')) {
          detectedStore = 'Myntra';
        } else if (linkLower.includes('ebay')) {
          detectedStore = 'eBay';
        } else if (linkLower.includes('jiomart')) {
          detectedStore = 'JioMart';
        } else if (linkLower.includes('tatacliq')) {
          detectedStore = 'Tata CLiQ';
        } else if (linkLower.includes('croma')) {
          detectedStore = 'Croma';
        } else if (linkLower.includes('reliance')) {
          detectedStore = 'Reliance Digital';
        }
      }
      
      // Use the detected store, fall back to source, fall back to default
      store = detectedStore || item.source || store;


      // Extract original price and discount
      let originalPrice = 0;
      let discount = 0;
      
      if (item.extracted_original_price && item.extracted_original_price > price) {
        originalPrice = item.extracted_original_price;
        discount = Math.round(((originalPrice - price) / originalPrice) * 100);
      }

      return {
        id: `serp_${index}_${Date.now()}`,
        title: item.title || 'Unknown Product',
        subtitle: store,
        description: item.snippet || '',
        image: item.thumbnail || '',
        store: store,
        // Ensure price is an integer for cleaner display
        price: Math.round(price), 
        originalPrice: Math.round(originalPrice),
        discount: discount,
        rating: rating,
        reviews: reviews,
        stock: true,
        link: productLink || item.link || ''
      };
    }).filter(item => item.price > 0 && item.link); // Only return items with valid price AND link
  } catch (error) {
    console.error('❌ SerpAPI error:', error.message);
    return [];
  }
}

/**
 * Get account info and usage stats
 */
async function getAccountInfo() {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey || apiKey === 'your_serpapi_key_here') {
    return null;
  }

  try {
    const url = `https://serpapi.com/account.json?api_key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      plan: data.plan_name || data.account_type || 'Free',
      searchesLeft: data.total_searches_left || 0,
      searchesUsed: data.this_month_usage || 0,
      resetDate: data.plan_searches_left || data.next_reset_date || 'Unknown'
    };
  } catch (error) {
    console.error('⚠️  Could not fetch SerpAPI account info:', error.message);
    return null;
  }
}

module.exports = {
  searchGoogleShopping,
  getAccountInfo
};