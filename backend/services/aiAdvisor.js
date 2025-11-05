// Use native fetch for Gemini API calls
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

// FIX: Use stable model for consistency
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Generates AI-powered product recommendation summary using Gemini API
 */
async function aiVerdict(products, crsFailureMessage = '') {
  // Check if GEMINI_API_KEY is configured
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.log('⚠️ Gemini API not configured - using fallback summary');
    return generateFallbackSummary(products, crsFailureMessage);
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    // FIX: Use the stable model variable
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    // Format products for AI analysis
    const productLines = products
      .slice(0, 5)
      .map((p, i) => {
        const details = [];
        if (p.rating > 0) details.push(`⭐ ${p.rating}`);
        if (p.discount > 0) details.push(`💰 ${p.discount}% off`);
        if (p.reviews > 0) details.push(`📝 ${p.reviews.toLocaleString()} reviews`);

        const detailsStr = details.length > 0 ? `(${details.join(', ')})` : '';
        return `${i + 1}. ${p.title}\n   ₹${p.price.toLocaleString()} - ${p.store} ${detailsStr}`;
      })
      .join('\n\n');

    // System instruction for comprehensive analysis
    const systemInstruction = `You are ShopMate, a friendly AI shopping assistant. Provide a detailed and enthusiastic recommendation in a single substantial paragraph (8-10 sentences). Clearly highlight key features, superior value, and specific reasons why the recommended product is better than competing listings. Focus on value and savings. Use emojis sparingly.`;

    // User prompt
    const userPrompt = `Analyze these top 5 products and provide a concise, enthusiastic recommendation. Give a whole paragraph highlighting the key features of the product over other products.

Focus on:
1. Identify the BEST VALUE product (consider price, discount, rating)
2. Clearly justify your choice with specific feature comparisons
3. Be friendly and encouraging

${crsFailureMessage ? `Note: ${crsFailureMessage}\n\n` : ''}Products:\n${productLines}

Provide your recommendation:`;

    // Use proper Gemini REST API format
    const requestBody = {
      contents: [{
        parts: [{
          text: userPrompt
        }]
      }],
      systemInstruction: {
        parts: [{
          text: systemInstruction
        }]
      },
      generationConfig: {
        temperature: 0.7,
        // FIX: Increase max tokens to prevent the MAX_TOKENS crash error
        maxOutputTokens: 1024, 
        topP: 0.95,
        topK: 40
      }
    };

    console.log('📤 Sending request to Gemini API...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Properly extract text from Gemini API response structure
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('❌ Unexpected Gemini API response structure:', JSON.stringify(data));
      throw new Error('Invalid response structure from Gemini API');
    }

    const candidate = data.candidates[0];
    
    // Check for safety blocks or MAX_TOKENS cutoff
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION' || candidate.finishReason === 'MAX_TOKENS') {
      console.warn('⚠️ Gemini response blocked or cut off:', candidate.finishReason);
      return generateFallbackSummary(products, crsFailureMessage);
    }

    // Extract text from parts
    const parts = candidate.content.parts;
    if (!parts || parts.length === 0 || !parts[0].text) {
      console.error('❌ No text in Gemini response parts:', JSON.stringify(candidate));
      throw new Error('No text content in Gemini response');
    }

    const verdict = parts[0].text.trim();
    
    if (!verdict) {
      console.warn('⚠️ Empty verdict from Gemini, using fallback');
      return generateFallbackSummary(products, crsFailureMessage);
    }

    console.log('✓ AI verdict generated successfully');
    return verdict;

  } catch (error) {
    console.error('❌ Gemini API error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return generateFallbackSummary(products, crsFailureMessage);
  }
}

/**
 * Generates a more detailed fallback summary when AI is unavailable
 */
function generateFallbackSummary(products, note) {
  if (products.length === 0) {
    return 'No products available to analyze.';
  }

  const best = products[0];
  const hasDiscount = best.discount > 0;
  const hasRating = best.rating > 0;
  const hasReviews = best.reviews > 0;
  const otherProductsCount = products.length - 1;

  // Start with a strong statement about the best deal
  let summary = `Our top recommendation is the **${best.title}** from ${best.store} for ₹${best.price.toLocaleString()}.`;

  // Add details about discount and rating
  if (hasDiscount) {
    summary += ` This fantastic deal includes a huge **${best.discount}% off** the original price, making it an excellent value choice.`;
  } else {
    summary += ` It stands out as the best choice based on its competitive price and overall value.`;
  }
  
  if (hasRating) {
    summary += ` Customers love this product, giving it a high rating of **⭐ ${best.rating}/5**.`;
    if (hasReviews) {
      summary += ` With ${best.reviews.toLocaleString()} verified reviews, you can shop with confidence.`;
    }
  } else if (hasReviews) {
    summary += ` This product has been widely purchased and reviewed by ${best.reviews.toLocaleString()} customers.`;
  }

  // Add comparative savings
  if (products.length > 1) {
    const mostExpensive = products.reduce((max, p) => p.price > max.price ? p : max, products[0]);
    const savings = mostExpensive.price - best.price;
    
    if (savings > 0 && otherProductsCount > 0) {
      summary += ` Considering the ${otherProductsCount} other option${otherProductsCount > 1 ? 's' : ''} we found, choosing this deal allows you to **save up to ₹${savings.toLocaleString()}!**`;
    }
  }
  
  // Add optional note
  if (note) {
    summary += ` ${note}`;
  }

  return summary;
}

module.exports = { aiVerdict };