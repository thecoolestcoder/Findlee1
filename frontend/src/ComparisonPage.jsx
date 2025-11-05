import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Zap, Clock, CheckCircle, TrendingUp, Shield, 
  Sparkles, X, Loader2, ArrowRight, Home, Target, ArrowDown, Check, Info, Moon, Sun
} from 'lucide-react';

// --- NEW/REFACTORED FUNCTION: Parse and format the AI text into a structured object for side-by-side display ---
const parseComparisonResult = (text, isDarkMode) => {
  if (!text) return { overallSummary: 'No comparison analysis available.', product1: null, product2: null };

  // Define dynamic colors for use in the formatted HTML
  const textColor = isDarkMode ? 'text-gray-200' : 'text-gray-700';
  const headingColor = isDarkMode ? 'text-pink-400' : 'text-purple-700';
  const dividerColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const generalTextColor = isDarkMode ? 'text-gray-300' : 'text-gray-600';

  // Helper function to format internal product content (Pros, Cons, etc.)
  const formatProductContent = (content, isDarkMode) => {
    if (!content) return '';
    
    // 1. Replace **bold** with <strong>
    let formattedContent = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    let html = '';
    // Split by double newline to process paragraphs/sections
    const blocks = formattedContent.split('\n\n').filter(line => line.trim() !== '');
    
    blocks.forEach(block => {
      block = block.trim();
      
      // Detect heading and content split (e.g., **Pros:** content)
      if (block.includes('<strong>') && block.includes(':</strong>')) {
          const parts = block.split(':</strong>');
          const heading = parts[0].replace(/<\/?strong>/g, '').trim();
          const contentBody = parts.slice(1).join(':').trim();
          
          let IconSvg, iconColor, listBg, borderColor;
          const lowerHeading = heading.toLowerCase();

          // Determine list style based on heading
          if (lowerHeading.includes('pro') || lowerHeading.includes('good') || lowerHeading.includes('benefit')) {
              iconColor = 'text-green-500';
              listBg = isDarkMode ? 'bg-gray-800/50' : 'bg-green-50/50';
              borderColor = isDarkMode ? 'border-green-600/50' : 'border-green-300/50';
              IconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ${iconColor} flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          } else if (lowerHeading.includes('con') || lowerHeading.includes('issue') || lowerHeading.includes('drawback') || lowerHeading.includes('weakness')) {
              iconColor = 'text-red-500';
              listBg = isDarkMode ? 'bg-gray-800/50' : 'bg-red-50/50';
              borderColor = isDarkMode ? 'border-red-600/50' : 'border-red-300/50';
              IconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ${iconColor} flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
          } else {
              iconColor = 'text-blue-400';
              listBg = isDarkMode ? 'bg-gray-800/50' : 'bg-blue-50/50';
              borderColor = isDarkMode ? 'border-blue-600/50' : 'border-blue-300/50';
              IconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ${iconColor} flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
          }

          html += `<div class="mt-6 mb-4">`;
          // Sub-Heading Style: Clear, prominent, with an underline
          html += `<h4 class="text-xl font-extrabold ${headingColor} mb-3 border-b border-dashed ${dividerColor} pb-1">
                      ${heading}
                  </h4>`;
          
          // Convert bullet points (lines starting with *, - or just a new line) to a list
          if (contentBody.includes('\n') || contentBody.includes('*') || contentBody.includes('-')) {
              html += `<ul class="space-y-3 list-none pl-0 p-4 rounded-xl ${listBg} border ${borderColor} shadow-sm">`;
              // Split by new line, removing any list characters
              contentBody.split(/[\n*\-•]/).filter(item => item.trim() !== '').forEach(item => {
                  html += `<li class="flex items-start gap-3 ${textColor} font-medium leading-relaxed">${IconSvg}<span>${item.trim()}</span></li>`;
              });
              html += `</ul>`;
          } else {
              // Regular paragraph content
              html += `<p class="${textColor} leading-relaxed mt-2">${contentBody}</p>`;
          }
          html += `</div>`;
      } else {
          // Regular paragraph content
          html += `<p class="${generalTextColor} leading-relaxed mt-4">${block}</p>`;
      }
    });
    
    return html;
  };


  // 2. Parse the main structure
  const productRegex = /(\*\*Product [12]:(.*?)\*\*)/g;
  const parts = text.split(productRegex).filter(part => part && part.trim());

  let overallSummary = parts[0] || 'Detailed comparison below.';
  let product1 = { title: 'Product 1', contentHtml: '' };
  let product2 = { title: 'Product 2', contentHtml: '' };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.startsWith('**Product 1:')) {
      product1.title = parts[i+1].trim(); // Title is the next element in the split array
      product1.contentHtml = formatProductContent(parts[i+2], isDarkMode);
      i += 2; // Skip the title and content parts
    } else if (part.startsWith('**Product 2:')) {
      product2.title = parts[i+1].trim();
      product2.contentHtml = formatProductContent(parts[i+2], isDarkMode);
      i += 2; // Skip the title and content parts
    }
  }

  // Final sanity check for titles (remove trailing bold tags if any)
  product1.title = product1.title.replace(/\*\*/g, '').trim();
  product2.title = product2.title.replace(/\*\*/g, '').trim();
  
  return { overallSummary: overallSummary, product1, product2 };
};


// --- Component for Staged Loading (Unchanged) ---
// ... (StageLoader component remains unchanged)
const StageLoader = ({ onComplete }) => {
    const stages = [
        { id: 1, text: 'Stage 1: Collecting up-to-date product data...', icon: ShoppingCart },
        { id: 2, text: 'Stage 2: Analyzing features, reviews, and value...', icon: TrendingUp },
        { id: 3, text: 'Stage 3: Generating the final structured comparison...', icon: Sparkles },
    ];
    const [currentStage, setCurrentStage] = useState(0);

    useEffect(() => {
        if (currentStage < stages.length) {
            const timer = setTimeout(() => {
                setCurrentStage(currentStage + 1);
            }, 1500); 
            return () => clearTimeout(timer);
        } else if (currentStage === stages.length) {
            const finalTimer = setTimeout(onComplete, 500); 
            return () => clearTimeout(finalTimer);
        }
    }, [currentStage, stages.length, onComplete]);

    return (
        <div className="flex flex-col items-center justify-center p-16 bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 text-white shadow-2xl min-h-[400px] animate-fade-in max-w-4xl mx-auto">
            <Zap className="w-20 h-20 text-yellow-400 mb-6 animate-pulse" />
            <h3 className="text-4xl font-black mb-10 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                AI Comparison in Progress...
            </h3>
            
            <div className="w-full max-w-lg space-y-6">
                {stages.map((stage, index) => {
                    const isActive = currentStage === index;
                    const isCompleted = currentStage > index;
                    const IconComponent = stage.icon;
                    
                    return (
                        <div key={stage.id} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                                isCompleted ? 'bg-green-500' : isActive ? 'bg-pink-500 ring-4 ring-pink-300' : 'bg-white/20'
                            }`}>
                                {isCompleted ? <Check className="w-4 h-4 text-white" /> : <IconComponent className={`w-4 h-4 ${isActive ? 'text-white animate-pulse' : 'text-white/70'}`} />}
                            </div>
                            <p className={`text-lg font-semibold transition-colors duration-500 ${isCompleted ? 'text-green-300' : isActive ? 'text-white' : 'text-white/50'}`}>
                                {stage.text}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- Component for Result Modal (UPDATED) ---
const ResultModal = ({ result, onClose, isMainDarkMode }) => {
    
    // Parse the result to get structured data
    const parsedData = parseComparisonResult(result, isMainDarkMode);
    
    // Conditional styling based on main page mode (using isMainDarkMode prop)
    const isDarkMode = isMainDarkMode;
    const modalBg = isDarkMode ? 'bg-gray-900' : 'bg-white';
    const headerBorder = isDarkMode ? 'border-gray-700' : 'border-gray-100';
    const mainText = isDarkMode ? 'text-white' : 'text-gray-800';
    const subText = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const iconBg = isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200';
    const closeBtnText = isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500';
    const productCardBg = isDarkMode ? 'bg-gray-800 border-gray-700/50' : 'bg-gray-50 border-gray-200';
    const productCardTitleBg = isDarkMode ? 'bg-purple-800' : 'bg-purple-600';
    const summaryCardBg = isDarkMode ? 'bg-gray-800 border-yellow-500/50' : 'bg-yellow-50 border-yellow-300/50';

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className={`${modalBg} rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto p-10 transform transition-colors duration-300`}>
                
                {/* Header */}
                <div className={`flex justify-between items-start border-b ${headerBorder} pb-4 mb-6 sticky top-0 ${modalBg} z-10 transition-colors duration-300`}>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 border border-gray-200">
                            <Sparkles className="w-7 h-7 text-purple-600" />
                        </div>
                        <div>
                            <h3 className={`text-3xl font-black ${mainText} mb-1 transition-colors duration-300`}>AI Comparison Complete!</h3>
                            <p className={subText}>Your detailed analysis, structured for clarity.</p>
                        </div>
                    </div>
                    
                    {/* Close Button */}
                    <button 
                        onClick={onClose} 
                        className={`p-3 rounded-full ${iconBg} ${closeBtnText} transition-colors focus:outline-none focus:ring-4 focus:ring-purple-200`}
                        title="Close"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Main Content Area */}
                <div className="space-y-8">
                    
                    {/* Overall Summary and Recommendation */}
                    <div className={`${summaryCardBg} rounded-2xl p-6 border-2 transition-colors duration-300`}>
                        <div className="flex items-center gap-3 mb-4">
                            <Info className="w-6 h-6 text-yellow-500" />
                            <h4 className={`text-xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-gray-800'}`}>Overall Verdict</h4>
                        </div>
                        {/* Remove any remaining strong tags from the summary before rendering */}
                        <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'} dangerouslySetInnerHTML={{ __html: parsedData.overallSummary.replace(/\*\*/g, '<strong>').replace(/<\/?strong>/g, '</strong>') }} />
                    </div>

                    {/* Side-by-Side Comparison Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* Product 1 Details */}
                        {parsedData.product1.contentHtml && (
                            <div className={`${productCardBg} rounded-2xl shadow-lg border transition-colors duration-300`}>
                                <div className={`p-4 rounded-t-xl ${productCardTitleBg} text-white font-black text-xl text-center shadow-md`}>
                                    {parsedData.product1.title}
                                </div>
                                <div className="p-6">
                                    <div dangerouslySetInnerHTML={{ __html: parsedData.product1.contentHtml }} />
                                </div>
                            </div>
                        )}
                        
                        {/* Product 2 Details */}
                        {parsedData.product2.contentHtml && (
                            <div className={`${productCardBg} rounded-2xl shadow-lg border transition-colors duration-300`}>
                                <div className={`p-4 rounded-t-xl ${productCardTitleBg} text-white font-black text-xl text-center shadow-md`}>
                                    {parsedData.product2.title}
                                </div>
                                <div className="p-6">
                                    <div dangerouslySetInnerHTML={{ __html: parsedData.product2.contentHtml }} />
                                </div>
                            </div>
                        )}

                        {/* Fallback if parsing failed or only one product was found (unlikely for comparison mode) */}
                        {!parsedData.product1.contentHtml && !parsedData.product2.contentHtml && (
                            <div className="lg:col-span-2 text-center p-10">
                                <p className={subText}>Could not generate a structured side-by-side comparison. Displaying raw text:</p>
                                <pre className={`${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-700'} p-4 mt-4 rounded-lg overflow-auto text-sm`}>
                                    {result}
                                </pre>
                            </div>
                        )}

                    </div>
                </div>
                
                <div className={`mt-10 pt-4 border-t ${headerBorder} text-center transition-colors duration-300`}>
                    <p className={subText}>Analysis provided by Findlee AI. Always verify details with the retailer before purchasing.</p>
                </div>
            </div>
        </div>
    );
};


const ComparisonPage = () => {
    const [comparisonMode, setComparisonMode] = useState('prompt'); 
    const [promptText, setPromptText] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([null, null]);
    const [loading, setLoading] = useState(false);
    const [comparisonResult, setComparisonResult] = useState(null);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [showResultModal, setShowResultModal] = useState(false); 

    // Dark Mode State
    const [isDarkMode, setIsDarkMode] = useState(false); 

    useEffect(() => {
        const storedProducts = localStorage.getItem('shopmate_products');
        if (storedProducts) {
          try {
            const products = JSON.parse(storedProducts);
            setAvailableProducts(products);
          } catch (e) {
            console.error('Error parsing stored products:', e);
          }
        }
    }, []);

    const scrollToCompare = () => {
        const compareSection = document.getElementById("compare");
        compareSection?.scrollIntoView({ behavior: "smooth" });
    };

    const startComparison = (result) => {
        setLoading(false);
        setComparisonResult(result);
        setShowResultModal(true); 
    };

    const handlePromptCompare = async () => {
        if (!promptText.trim()) return;
        
        setComparisonResult(null); 
        setLoading(true); 

        try {
            // Note: I have to use a placeholder key here as I don't have a real API key.
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=AIzaSyABd_eC26bx8Wl5WVsw8XGcS_jKCFhESmI', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            // Crucial: Requesting structure for easy parsing later
                            text: `Compare these products or options: ${promptText}. Provide a CONCISE summary, key pros and cons for each option, and a clear, single best recommendation. 
                            
                            STRUCTURE MUST BE:
                            [OVERALL SUMMARY AND RECOMMENDATION]
                            **Product 1: [Product Name 1]**
                            **Pros:**
                            * Point 1
                            * Point 2
                            **Cons:**
                            * Point 1
                            * Point 2
                            **Features:**
                            * Point 1
                            
                            **Product 2: [Product Name 2]**
                            **Pros:**
                            * Point 1
                            * Point 2
                            **Cons:**
                            * Point 1
                            
                            The first paragraph must be the general summary/recommendation. Use a clear, bold title for the product and bold headings for sections like **Pros:** and **Cons:**.`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2000,
                    }
                })
            });

            const data = await response.json();
            const result = data.candidates[0]?.content.parts[0]?.text || 'No detailed comparison found. Try another prompt.';
            
            // Delay to allow the StageLoader to finish its animation (approx 4.5s)
            setTimeout(() => startComparison(result), 4500); 

        } catch (error) {
            console.error('Error:', error);
            setLoading(false);
            alert('Failed to generate comparison. Please try again.');
        } 
    };
    
    const handleProductSelect = (product, index) => {
        const newSelected = [...selectedProducts];
        newSelected[index] = product;
        setSelectedProducts(newSelected);
    };

    const handleProductCompare = async () => {
        if (!selectedProducts[0] || !selectedProducts[1]) return;
        
        setComparisonResult(null); 
        setLoading(true); 

        try {
            // Note: I have to use a placeholder key here as I don't have a real API key.
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=AIzaSyDkxF57Vjkx3soMWLvLAnZC_t4MIsvxd8Q', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                             // Crucial: Requesting structure for easy parsing later
                            text: `Compare these two products in detail and provide a CONCISE breakdown:
                            
                            Product 1: ${selectedProducts[0].title}
                            Price: ₹${selectedProducts[0].price}
                            Store: ${selectedProducts[0].store}
                            Rating: ${selectedProducts[0].rating}/5

                            Product 2: ${selectedProducts[1].title}
                            Price: ₹${selectedProducts[1].price}
                            Store: ${selectedProducts[1].store}
                            Rating: ₹${selectedProducts[1].rating}/5
                            
                            STRUCTURE MUST BE:
                            [OVERALL SUMMARY AND RECOMMENDATION]
                            **Product 1: ${selectedProducts[0].title}**
                            **Pros:**
                            * Point 1
                            * Point 2
                            **Cons:**
                            * Point 1
                            * Point 2
                            **Features:**
                            * Point 1
                            
                            **Product 2: ${selectedProducts[1].title}**
                            **Pros:**
                            * Point 1
                            * Point 2
                            **Cons:**
                            * Point 1

                            The first paragraph must be the general summary/recommendation. Use a clear, bold title for the product and bold headings for sections like **Pros:** and **Cons:**.`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2000,
                    }
                })
            });

            const data = await response.json();
            const result = data.candidates[0]?.content.parts[0]?.text || 'No detailed comparison found. Try another pair of products.';
            
            // Delay to allow the StageLoader to finish its animation (approx 4.5s)
            setTimeout(() => startComparison(result), 4500); 

        } catch (error) {
            console.error('Error:', error);
            setLoading(false);
            alert('Failed to generate comparison. Please try again.');
        }
    };

    const goToMainPage = () => {
        window.location.href = './index.html';
    };
    
    const handlePromptKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            handlePromptCompare();
        }
    };
    
    // Dark Mode Toggle
    const toggleDarkMode = () => {
        setIsDarkMode(prev => !prev);
    };

    // Conditional Styling Variables
    const mainBg = isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500';
    const headerBg = isDarkMode ? 'bg-gray-900/90 border-gray-700' : 'bg-white/10 border-white/20';
    const heroCardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50' : 'bg-white/10 border-white/20 hover:bg-white/20';
    const compareCardBg = isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/10 border-white/20';
    const inputBg = isDarkMode ? 'bg-gray-700/90 text-white placeholder-gray-400' : 'bg-white/90 text-gray-800';
    const ToggleIcon = isDarkMode ? Sun : Moon;
    const footerBg = isDarkMode ? 'bg-gray-900/90 border-gray-700' : 'bg-white/10 border-white/20';


  return (
    // APPLY MAIN BACKGROUND CLASS
    <div className={`min-h-screen ${mainBg} transition-colors duration-500`}>
      
      {/* Header (Taskbar) */}
      <header className={`${headerBg} backdrop-blur-lg border-b sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo Button */}
            <button 
              onClick={goToMainPage} 
              className="flex items-center gap-3 cursor-pointer group focus:outline-none"
            >
              <img 
  src="/logoicon.png" 
  alt="Shopping Cart" 
  className="w-10 h-10 group-hover:scale-110 transition-transform" 
/>
              <h1 className="text-3xl font-bold text-white group-hover:text-pink-300 transition-colors">Findlee</h1>
            </button>
            
            <div className="flex items-center gap-4">
              <button
                onClick={goToMainPage}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-lg text-white rounded-xl font-semibold hover:bg-white/30 transition-all"
              >
                <Home className="w-5 h-5" />
                Go to Main Page
              </button>
               {/* Dark Mode Toggle */}
              <button 
                onClick={toggleDarkMode} 
                className={`p-2 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-purple-200 ${isDarkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-white/20 text-white hover:bg-white/30'}`}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                <ToggleIcon className="w-6 h-6" />
              </button>
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 backdrop-blur-lg rounded-xl font-semibold transition-all text-white">💰Save time, Save Money💸</div>
            </div>
          </div>
        </div>
      </header>
      {/* End Header */}

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Animated mesh gradient background (adjusted for dark mode) */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br from-transparent via-transparent ${isDarkMode ? 'to-gray-900/90' : 'to-transparent/90'}`} />
          <div className={`absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse ${isDarkMode ? 'bg-purple-900/30' : 'bg-white/10'}`} />
          <div className={`absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse ${isDarkMode ? 'bg-pink-900/40' : 'bg-white/15'}`} style={{ animationDelay: "1.5s" }} />
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[140px] animate-pulse ${isDarkMode ? 'bg-indigo-900/20' : 'bg-white/5'}`} style={{ animationDelay: "3s" }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto text-center space-y-16">
          <div className="space-y-6">
            <h1 className="text-7xl md:text-8xl font-black text-white mb-4 tracking-tight">
              Compare
            </h1>
            
            <p className="text-3xl text-white/90 max-w-4xl mx-auto leading-relaxed font-bold">
              Smart AI-Powered Comparisons
            </p>
            
            <p className="text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
              Get instant, intelligent comparisons using advanced AI. Choose your comparison method below.
            </p>
          </div>

          {/* Feature cards (adjusted for dark mode background) */}
          <div className="grid grid-cols-4 gap-6 mt-20">
            <div className={`${heroCardBg} p-8 rounded-3xl transition-all duration-500 hover:scale-105 hover:-translate-y-2`}>
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-lg">
                <Target className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Accurate Results</h3>
              <p className="text-white/70">AI-powered comparisons that understand what you really need</p>
            </div>

            <div className={`${heroCardBg} p-8 rounded-3xl transition-all duration-500 hover:scale-105 hover:-translate-y-2`}>
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-3xl flex items-center justify-center shadow-lg">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Smart Search</h3>
              <p className="text-white/70">Intelligent analysis of products and options</p>
            </div>

            <div className={`${heroCardBg} p-8 rounded-3xl transition-all duration-500 hover:scale-105 hover:-translate-y-2`}>
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-400 to-teal-500 rounded-3xl flex items-center justify-center shadow-lg">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Save Time</h3>
              <p className="text-white/70">Get instant comparisons instead of hours of research</p>
            </div>

            <div className={`${heroCardBg} p-8 rounded-3xl transition-all duration-500 hover:scale-105 hover:-translate-y-2`}>
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-pink-400 to-red-500 rounded-3xl flex items-center justify-center shadow-lg">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Best Choices</h3>
              <p className="text-white/70">Clear recommendations to help you decide confidently</p>
            </div>
          </div>
          
          {/* Trust indicators (adjusted for dark mode background) */}
          <div className="flex justify-center gap-6 mt-16">
            <div className={`${heroCardBg} px-6 py-3 rounded-full flex items-center gap-2`}>
              <Shield className="w-5 h-5 text-green-300" />
              <span className="text-white font-medium">100% Unbiased</span>
            </div>
            <div className={`${heroCardBg} px-6 py-3 rounded-full flex items-center gap-2`}>
              <TrendingUp className="w-5 h-5 text-blue-300" />
              <span className="text-white font-medium">Real-Time Data</span>
            </div>
            <div className={`${heroCardBg} px-6 py-3 rounded-full flex items-center gap-2`}>
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-white font-medium">AI-Powered</span>
            </div>
          </div>

          <button 
            onClick={scrollToCompare}
            className="mt-16 h-20 px-16 text-xl font-bold bg-white text-purple-600 rounded-2xl hover:shadow-2xl transition-all duration-500 hover:scale-110 flex items-center gap-3 mx-auto"
          >
            <span>Start Comparing Now</span>
            <ArrowDown className="h-6 w-6" />
          </button>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="compare" className="min-h-screen p-8 relative">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl font-bold text-white text-center mb-12">Choose Your Comparison Method</h2>

          {/* Conditional rendering based on loading state */}
          {loading ? (
             <StageLoader onComplete={() => {}} /> 
          ) : (
            <>
              {/* Mode Selection (adjusted for dark mode) */}
              <div className="flex justify-center gap-4 mb-12">
                <button
                  onClick={() => setComparisonMode('prompt')}
                  className={`px-8 py-4 rounded-2xl font-semibold transition-all ${
                    comparisonMode === 'prompt'
                      ? 'bg-white text-purple-600 shadow-2xl scale-105' // Active mode stands out with white background
                      : isDarkMode
                        ? 'bg-gray-800 text-white hover:bg-gray-700'
                        : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Compare by Description
                </button>
                <button
                  onClick={() => setComparisonMode('select')}
                  className={`px-8 py-4 rounded-2xl font-semibold transition-all ${
                    comparisonMode === 'select'
                      ? 'bg-white text-purple-600 shadow-2xl scale-105' // Active mode stands out with white background
                      : isDarkMode
                        ? 'bg-gray-800 text-white hover:bg-gray-700'
                        : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Select Products to Compare
                </button>
              </div>

              {/* Prompt Mode */}
              {comparisonMode === 'prompt' && (
                <div className={`${compareCardBg} backdrop-blur-lg rounded-3xl p-8 max-w-3xl mx-auto`}>
                  <h3 className="text-2xl font-bold text-white mb-4">Enter Products to Compare</h3>
                  <p className="text-white/70 mb-6">Describe the products or options you want to compare (e.g., "iPhone 15 Pro vs Samsung Galaxy S24"). <strong className="text-yellow-300"> Press Enter to Compare.</strong> Use Shift+Enter for a new line.</p>
                  
                  <div className="space-y-4">
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      onKeyDown={handlePromptKeyPress} 
                      placeholder="e.g., iPhone 15 Pro vs Samsung Galaxy S24 Ultra..."
                      className={`w-full p-4 rounded-xl min-h-32 focus:outline-none focus:ring-4 focus:ring-purple-300 ${inputBg}`}
                    />
                    
                    <button
                      onClick={handlePromptCompare}
                      disabled={loading || !promptText.trim()}
                      className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Zap className="w-5 h-5" />
                      Compare Now
                    </button>
                  </div>
                </div>
              )}

              {/* Select Mode */}
              {comparisonMode === 'select' && (
                 <div className="space-y-8">
                    <div className={`${compareCardBg} backdrop-blur-lg rounded-3xl p-8`}>
                        <h3 className="text-2xl font-bold text-white mb-6">Select Two Products to Compare</h3>
                
                        <div className="grid grid-cols-2 gap-6 mb-6">
                            {/* Product Slot 1 (Adjusted inner container border/bg) */}
                            <div className={`${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white/5 border-white/30'} rounded-2xl p-6 border-2 border-dashed`}>
                                <h4 className="text-white font-semibold mb-4 text-center">Product 1</h4>
                                {selectedProducts[0] ? (
                                    <div className="bg-white rounded-xl p-4 relative">
                                        <button
                                            onClick={() => handleProductSelect(null, 0)}
                                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <img 
                                          src={selectedProducts[0].image || 'https://via.placeholder.com/150?text=No+Image'} 
                                          alt={selectedProducts[0].title} 
                                          className="w-full h-32 object-contain mb-3" 
                                          onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Image'; }}
                                        />
                                        <h5 className="font-semibold text-gray-800 mb-2 line-clamp-2 h-10">{selectedProducts[0].title}</h5>
                                        <p className="text-gray-600">₹{selectedProducts[0].price.toLocaleString()}</p>
                                        <p className="text-sm text-gray-500">{selectedProducts[0].store}</p>
                                    </div>
                                ) : (
                                    <div className="text-center text-white/50 py-12">
                                        Select a product below
                                    </div>
                                )}
                            </div>

                            {/* Product Slot 2 (Adjusted inner container border/bg) */}
                            <div className={`${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white/5 border-white/30'} rounded-2xl p-6 border-2 border-dashed`}>
                                <h4 className="text-white font-semibold mb-4 text-center">Product 2</h4>
                                {selectedProducts[1] ? (
                                    <div className="bg-white rounded-xl p-4 relative">
                                        <button
                                            onClick={() => handleProductSelect(null, 1)}
                                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <img 
                                          src={selectedProducts[1].image || 'https://via.placeholder.com/150?text=No+Image'} 
                                          alt={selectedProducts[1].title} 
                                          className="w-full h-32 object-contain mb-3" 
                                          onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Image'; }}
                                        />
                                        <h5 className="font-semibold text-gray-800 mb-2 line-clamp-2 h-10">{selectedProducts[1].title}</h5>
                                        <p className="text-gray-600">₹{selectedProducts[1].price.toLocaleString()}</p>
                                        <p className="text-sm text-gray-500">{selectedProducts[1].store}</p>
                                    </div>
                                ) : (
                                    <div className="text-center text-white/50 py-12">
                                        Select a product below
                                    </div>
                                )}
                            </div>
                        </div>


                        <button
                            onClick={handleProductCompare}
                            disabled={loading || !selectedProducts[0] || !selectedProducts[1]}
                            className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <ArrowRight className="w-5 h-5" />
                            Compare Selected Products
                        </button>
                    </div>

                    {/* Available Products */}
                    <div>
                        <h4 className="text-2xl font-bold text-white mb-6">
                            {availableProducts.length > 0 ? 'Available Products' : 'No Products Available'}
                        </h4>
                        {availableProducts.length === 0 ? (
                            <div className={`${compareCardBg} backdrop-blur-lg rounded-2xl p-12 text-center`}>
                                <div className="text-6xl mb-4">🔍</div>
                                <h5 className="text-2xl font-bold text-white mb-3">No Products to Compare</h5>
                                <p className="text-white/70 mb-6">Search for products on the main page first to enable comparison</p>
                                <a
                                href="./index.html"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-xl font-semibold hover:shadow-2xl transition-all"
                                >
                                <Home className="w-5 h-5" />
                                Go to Main Page
                                </a>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {availableProducts.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => {
                                    const firstEmpty = selectedProducts[0] === null ? 0 : selectedProducts[1] === null ? 1 : null;
                                    if (firstEmpty !== null) {
                                        handleProductSelect(product, firstEmpty);
                                    }
                                    }}
                                    disabled={selectedProducts.some(p => p?.id === product.id)}
                                    // Product cards remain white for contrast
                                    className="bg-white rounded-xl p-4 hover:shadow-2xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                                >
                                    <img 
                                    src={product.image || 'https://via.placeholder.com/150?text=No+Image'} 
                                    alt={product.title} 
                                    className="w-full h-32 object-contain mb-3" 
                                    onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Image'; }}
                                    />
                                    <h5 className="font-semibold text-gray-800 mb-2 text-sm line-clamp-2 h-10">{product.title}</h5>
                                    <p className="text-gray-600 font-bold">₹{product.price.toLocaleString()}</p>
                                    <div className="flex items-center justify-between mt-2">
                                    <p className="text-xs text-gray-500">{product.store}</p>
                                    {product.rating > 0 && (
                                        <p className="text-xs text-yellow-600">★ {product.rating}</p>
                                    )}
                                    </div>
                                </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Comparison Result Modal (UPDATED PROP) */}
      {showResultModal && comparisonResult && (
        <ResultModal 
          result={comparisonResult} 
          onClose={() => setShowResultModal(false)} 
          isMainDarkMode={isDarkMode} // Pass main page state to modal
        />
      )}

      {/* Footer (adjusted for dark mode background) */}
      <footer className={`${footerBg} backdrop-blur-lg border-t py-6`}>
        <div className="max-w-7xl mx-auto px-4 text-center text-white/80 text-sm">
          <p>© 2025 Findlee - Save Time, Save Money | Powered by AI</p>
        </div>
      </footer>
    </div>
  );
};

export default ComparisonPage;