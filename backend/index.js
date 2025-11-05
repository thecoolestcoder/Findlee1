

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const { getProductResults } = require('./services/aggregator');
const { getAccountInfo } = require('./services/serpapi');
const { validateConfig } = require('./config/validator');

const app = express();

// Validate configuration on startup
try {
  validateConfig();
} catch (error) {
  console.error('❌ Configuration Error:', error.message);
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' }
});

app.use('/api/', limiter);

// Cache setup
const cacheTtl = Number(process.env.CACHE_TTL_SECONDS || 300);
const cache = new NodeCache({ stdTTL: cacheTtl, checkperiod: 120 });

// API key configuration checks
const isOpenAIConfigured = !!process.env.OPENAI_API_KEY && 
  process.env.OPENAI_API_KEY.startsWith('sk-');
const isGeminiConfigured = !!process.env.GEMINI_API_KEY && 
  process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';
const isSerpAPIConfigured = !!process.env.SERPAPI_KEY &&
  process.env.SERPAPI_KEY !== 'your_serpapi_key_here';

// Request validation middleware
const validateQuery = (req, res, next) => {
  const q = req.query.q?.trim();
  
  if (!q) {
    return res.status(400).json({ 
      error: 'Missing query parameter',
      message: 'Please provide a search query using ?q=your-search-term'
    });
  }
  
  if (q.length < 2) {
    return res.status(400).json({ 
      error: 'Query too short',
      message: 'Search query must be at least 2 characters'
    });
  }
  
  if (q.length > 100) {
    return res.status(400).json({ 
      error: 'Query too long',
      message: 'Search query must be less than 100 characters'
    });
  }
  
  req.validQuery = q;
  next();
};

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const serpInfo = isSerpAPIConfigured ? await getAccountInfo() : null;
  
  res.json({ 
    ok: true, 
    message: 'ShopMate Backend is running!',
    config: {
      serpApiConfigured: isSerpAPIConfigured,
      openaiConfigured: isOpenAIConfigured,
      geminiConfigured: isGeminiConfigured,
      cacheEnabled: true,
      cacheTTL: cacheTtl
    },
    serpapi: serpInfo ? {
      plan: serpInfo.plan,
      searchesLeft: serpInfo.searchesLeft,
      searchesUsed: serpInfo.searchesUsed,
      resetDate: serpInfo.resetDate
    } : null,
    stats: {
      cacheKeys: cache.keys().length,
      uptime: Math.round(process.uptime())
    }
  });
});

// Main products endpoint
app.get('/api/products', validateQuery, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const query = req.validQuery;
    const cacheKey = `products:${query.toLowerCase()}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('✓ Cache hit for:', query);
      return res.json({ 
        ...cached,
        source: 'cache',
        responseTime: Date.now() - startTime
      });
    }

    // Fetch fresh results
    console.log('⟳ Fetching fresh results for:', query);
    const results = await getProductResults(query);
    
    // Only cache successful results with products
    if (results.items.length > 0) {
      cache.set(cacheKey, {
        products: results.items,
        summary: results.summary,
        metadata: results.metadata
      });
    }
    
    res.json({ 
      products: results.items, 
      summary: results.summary, 
      metadata: results.metadata,
      source: 'live',
      responseTime: Date.now() - startTime
    });
    
  } catch (err) {
    console.error('❌ Error in /api/products:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message,
      responseTime: Date.now() - startTime
    });
  }
});

// SerpAPI account info endpoint
app.get('/api/serpapi/account', async (req, res) => {
  try {
    const info = await getAccountInfo();
    if (!info) {
      return res.status(400).json({ 
        error: 'SerpAPI not configured',
        message: 'Please add SERPAPI_KEY to your .env file'
      });
    }
    res.json(info);
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to fetch account info',
      message: err.message
    });
  }
});

// Cache management endpoints
app.get('/api/cache/stats', (req, res) => {
  res.json({
    keys: cache.keys().length,
    stats: cache.getStats()
  });
});

app.delete('/api/cache/clear', (req, res) => {
  cache.flushAll();
  res.json({ message: 'Cache cleared successfully' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const port = Number(process.env.PORT) || 4000;
app.listen(port, async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🛒 ShopMate Backend Started Successfully!');
  console.log('='.repeat(60));
  console.log(`📡 Server:        http://localhost:${port}`);
  console.log(`💚 Health Check:  http://localhost:${port}/api/health`);
  console.log(`🔍 Search:        http://localhost:${port}/api/products?q=laptop`);
  console.log('='.repeat(60));
  console.log(`🌐 SerpAPI:       ${isSerpAPIConfigured ? '✓ Configured' : '✗ Not configured'}`);
  
  if (isSerpAPIConfigured) {
    const info = await getAccountInfo();
    if (info) {
      console.log(`   Plan:          ${info.plan}`);
      console.log(`   Searches Left: ${info.searchesLeft}`);
      console.log(`   Used This Month: ${info.searchesUsed}`);
    }
  } else {
    console.log('   Get free API key: https://serpapi.com/users/sign_up');
  }
  
  console.log(`🤖 OpenAI:        ${isOpenAIConfigured ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`🧠 Gemini:        ${isGeminiConfigured ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`💾 Cache TTL:     ${cacheTtl} seconds`);
  console.log('='.repeat(60) + '\n');
});