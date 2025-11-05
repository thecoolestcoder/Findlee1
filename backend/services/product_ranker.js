// Use native fetch (Node.js 18+) or fallback to node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

// Ranking weights
const W_R = 3;  // Weight for Relevance Score
const W_P = 1;  // Weight for Price Score
const W_IR = 5; // Weight for Irrelevance Penalty

// FIX: Use a stable, generally available model
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Ranks products using Gemini AI for relevance scoring
 * @param {string} query - The search query
 * @param {Array<Object>} productCandidates - Products to rank
 * @returns {Promise<Object>} - Ranked products and status
 */
async function rankProducts(query, productCandidates) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // Return unranked if no API key or no products
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || productCandidates.length === 0) {
    console.log('⚠️  Gemini API not configured - skipping AI ranking');
    return {
      rankedProducts: productCandidates,
      crsFailed: true
    };
  }

  try {
    // --- STAGE 1: Local P_Score Calculation ---
    const productsForAI = productCandidates.map((p, index) => {
      // FIX: Ensure stable, unique string ID for mapping across stages
      const id = String(p.id || index); 
      
      const price = p.price || 0;
      const titleLower = p.title ? p.title.toLowerCase() : '';

      // Simple heuristic for accessory detection (Added 'stand' for better coverage)
      const is_accessory = titleLower.includes('case') ||
        titleLower.includes('cable') ||
        titleLower.includes('protector') ||
        titleLower.includes('charger') ||
        titleLower.includes('adapter') ||
        titleLower.includes('cover') ||
        titleLower.includes('stand'); 

      // Reference price calculation: a simple heuristic to normalize price
      const reference_price = price > 10000 ? price * 1.15 : price * 2;
      // P_Score is normalized price-value score (closer to 1.0 is better)
      const p_score = Math.max(0, Math.min(1, 1 - (price / reference_price)));

      return {
        id,
        title: p.title,
        store: p.store,
        price: p.price,
        is_accessory,
        p_score
      };
    });

    // --- STAGE 2: AI Relevance Scoring ---
    const systemInstruction = `You are an E-commerce Relevance Engine analyzing product search results. Your goal is to score how well the product title matches the user's query.

TASK: For each product, calculate two scores:

1. **R_Score (Relevance Score)**: 0.0 to 1.0 (Higher is a better match to the query)
2. **Irrelevance_Penalty**: 0.0 or 0.9
   - Apply **0.9 penalty** if the product is clearly an **ACCESSORY** (e.g., case, charger, screen protector) AND the user query is for a **PRIMARY PRODUCT** (e.g., "phone", "laptop", "smartwatch").
   - Apply **0.0** otherwise (e.g., if the query is already for an accessory like "phone case").

Return ONLY valid JSON array format. Do not include any introductory or concluding text.`;

    const userQuery = `User Query: "${query}"

Products to analyze:
${JSON.stringify(productsForAI.map(p => ({ id: p.id, title: p.title, is_accessory: p.is_accessory })), null, 2)}`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        // Enforce JSON output for reliability
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING' },
              R_Score: { type: 'NUMBER' },
              Irrelevance_Penalty: { type: 'NUMBER' }
            },
            required: ['id', 'R_Score', 'Irrelevance_Penalty']
          }
        },
        // Set a low temperature for deterministic scoring
        temperature: 0.1
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      throw new Error(`Gemini API returned ${response.status}: ${errorDetail}`);
    }

    const result = await response.json();
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      throw new Error('No structured data returned from Gemini');
    }

    let aiScores;
    try {
        aiScores = JSON.parse(jsonText);
        if (!Array.isArray(aiScores)) {
            throw new Error('Parsed AI scores are not an array');
        }
    } catch (e) {
        // FIX: Improved error message on JSON parse failure
        throw new Error(`Failed to parse AI JSON response: ${e.message}. Raw text: ${jsonText.slice(0, 100)}...`);
    }

    // --- STAGE 3: Final CRS Calculation ---
    const rankedProducts = productCandidates.map((p, index) => {
      // FIX: Use the stable ID created in Stage 1
      const id = String(p.id || index);
      
      const productData = productsForAI.find(item => item.id === id);
      const aiData = aiScores.find(s => String(s.id) === id);

      // Robust fallback for AI scores: default to neutral R_Score and no penalty
      const R_Score = aiData?.R_Score ?? 0.5; 
      const Irrelevance_Penalty = aiData?.Irrelevance_Penalty ?? 0.0;
      const P_Score = productData?.p_score ?? 0.0;

      // Calculate Composite Ranking Score: CRS = (W_R * R_Score) + (W_P * P_Score) - (W_IR * Irrelevance_Penalty)
      const CRS = (W_R * R_Score) + (W_P * P_Score) - (W_IR * Irrelevance_Penalty);

      return {
        ...p,
        CRS: Math.max(0, CRS), // Ensure non-negative and store for inspection
        R_Score,
        P_Score,
        Irrelevance_Penalty
      };
    });

    // Sort by CRS descending
    rankedProducts.sort((a, b) => b.CRS - a.CRS);

    console.log('✓ AI ranking successful');
    return {
      rankedProducts,
      crsFailed: false
    };

  } catch (error) {
    // Log the detailed error
    console.error(`❌ Gemini ranking failed (${GEMINI_MODEL}):`, error.message);
    
    // Fallback to unranked list with failure flag
    return {
      rankedProducts: productCandidates,
      crsFailed: true
    };
  }
}

module.exports = { rankProducts };