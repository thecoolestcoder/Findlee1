/**
 * Configuration Validator
 * Validates environment variables on application startup
 */

function validateConfig() {
  const required = ['PORT'];
  const optional = [
    'SERPAPI_KEY',
    'OPENAI_API_KEY',
    'GEMINI_API_KEY', 
    'CACHE_TTL_SECONDS',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS',
    'SCRAPER_TIMEOUT_MS',
    'MAX_PRODUCTS_PER_STORE',
    'USE_SERPAPI',
    'USE_WEB_SCRAPERS'
  ];
  
  // Check required variables
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate PORT
  const port = Number(process.env.PORT);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535');
  }
  
  // Check optional variables and warn
  const warnings = [];
  
  // SerpAPI check (most important)
  if (!process.env.SERPAPI_KEY || process.env.SERPAPI_KEY === 'your_serpapi_key_here') {
    warnings.push('⚠️  SERPAPI_KEY not configured');
    warnings.push('   → Get free API key at: https://serpapi.com/users/sign_up');
    warnings.push('   → Free tier: 100 searches/month');
  }
  
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.startsWith('sk-')) {
    warnings.push('⚠️  OPENAI_API_KEY not configured - AI summaries disabled');
  }
  
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    warnings.push('⚠️  GEMINI_API_KEY not configured - AI ranking disabled');
  }
  
  // Check if any data source is enabled
  const useSerpAPI = process.env.USE_SERPAPI === 'true';
  const useWebScrapers = process.env.USE_WEB_SCRAPERS === 'true';
  
  if (!useSerpAPI && !useWebScrapers) {
    warnings.push('⚠️  No data sources enabled!');
    warnings.push('   → Set USE_SERPAPI=true in .env (recommended)');
  }
  
  if (warnings.length > 0) {
    console.warn('\n' + '⚠️  Configuration Warnings '.padEnd(60, '⚠️'));
    warnings.forEach(w => console.warn(w));
    console.warn(''.padEnd(60, '⚠️') + '\n');
  }
  
  return true;
}

module.exports = { validateConfig };