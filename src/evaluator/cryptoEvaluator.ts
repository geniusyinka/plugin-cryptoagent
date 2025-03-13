import {
    Evaluator,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger
  } from "@elizaos/core";
  import {
    getCryptoByIdOrSymbol,
    formatCryptoSummary
  } from "../service";
  
  export const cryptoEvaluator: Evaluator = {
    name: "CRYPTO_MENTION_EVAL",
    alwaysRun: true,
    similes: ["EVALUATE CRYPTO MENTIONS", "CHECK FOR CRYPTO"],
    description: "Detects cryptocurrency mentions in conversation and provides relevant data",
    
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
      // Log that the evaluator is being called
      console.log(`[CryptoEvaluator] validate() called with message: "${message.content.text}"`);
      
      // Only process user messages, not Eliza's own messages
      if (message.userId === runtime.agentId) {
        console.log(`[CryptoEvaluator] Skipping - message is from the agent itself`);
        return false;
      }
      
      const text = message.content.text || "";
      
      // Skip processing if text is too short
      if (text.length < 3) {
        console.log(`[CryptoEvaluator] Skipping - message too short: ${text.length} chars`);
        return false;
      }
      
      // Check for cryptocurrency mentions
      const hasCryptoMention = detectCryptoMention(text);
      
      console.log(`[CryptoEvaluator] Crypto mention detected: ${hasCryptoMention}`);
      if (hasCryptoMention) {
        // Log which crypto terms were found
        const detectedTerms = findDetectedTerms(text);
        console.log(`[CryptoEvaluator] Detected terms: ${detectedTerms.join(', ')}`);
      }
      
      return hasCryptoMention;
    },
    
    handler: async (runtime: IAgentRuntime, message: Memory, state: State) => {
      try {
        console.log(`[CryptoEvaluator] handler() called`);
        
        const text = message.content.text || "";
        const detectedCoins = extractCryptoMentions(text);
        
        console.log(`[CryptoEvaluator] Extracted coins: ${detectedCoins.join(', ')}`);
        
        if (detectedCoins.length === 0) {
          console.log(`[CryptoEvaluator] No specific cryptocurrency was detected`);
          return {
            score: 0,
            reason: "No specific cryptocurrency was detected."
          };
        }
        
        // Get info for the first detected coin
        const coinId = detectedCoins[0];
        console.log(`[CryptoEvaluator] Fetching data for: ${coinId}`);
        
        const coin = await getCryptoByIdOrSymbol(coinId);
        
        if (!coin) {
          console.log(`[CryptoEvaluator] Couldn't find data for: ${coinId}`);
          return {
            score: 0,
            reason: `Couldn't find data for detected cryptocurrency: ${coinId}`
          };
        }
        
        console.log(`[CryptoEvaluator] Successfully found data for: ${coin.name} - Price: $${coin.current_price}`);
        
        return {
          score: 0.7, // Medium priority
          reason: `Detected cryptocurrency mention: ${coin.name}`,
          response: {
            text: `I notice you mentioned ${coin.name}. Currently, it's trading at $${coin.current_price.toFixed(2)}, which is ${coin.price_change_percentage_24h >= 0 ? 'up' : 'down'} ${Math.abs(coin.price_change_percentage_24h).toFixed(2)}% in the last 24 hours.`
          }
        };
      } catch (error) {
        console.error(`[CryptoEvaluator] Error:`, error);
        elizaLogger.error(`[CryptoEvaluator] Error: ${error instanceof Error ? error.message : String(error)}`);
        return {
          score: 0,
          reason: "Error processing cryptocurrency mentions"
        };
      }
    },
    
    examples: []
  };
  
  // Helper function to detect if text contains cryptocurrency mentions
  function detectCryptoMention(text: string): boolean {
    const normalizedText = text.toLowerCase();
    
    // Common cryptocurrency terms
    const cryptoTerms = [
      "bitcoin", "btc", 
      "ethereum", "eth", 
      "binance", "bnb",
      "xrp", "ripple",
      "cardano", "ada",
      "solana", "sol",
      "dogecoin", "doge",
      "polkadot", "dot",
      "polygon", "matic",
      "crypto", "cryptocurrency",
      "token", "blockchain", 
      "altcoin", "defi"
    ];
    
    return cryptoTerms.some(term => normalizedText.includes(term));
  }
  
  // Helper function to find which crypto terms were detected (for logging)
  function findDetectedTerms(text: string): string[] {
    const normalizedText = text.toLowerCase();
    
    const cryptoTerms = [
      "bitcoin", "btc", 
      "ethereum", "eth", 
      "binance", "bnb",
      "xrp", "ripple",
      "cardano", "ada",
      "solana", "sol",
      "dogecoin", "doge",
      "polkadot", "dot",
      "polygon", "matic",
      "crypto", "cryptocurrency",
      "token", "blockchain", 
      "altcoin", "defi"
    ];
    
    return cryptoTerms.filter(term => normalizedText.includes(term));
  }
  
  // Helper function to extract specific cryptocurrencies from text
  function extractCryptoMentions(text: string): string[] {
    const normalizedText = text.toLowerCase();
    const words = normalizedText.split(/\W+/);
    
    // Map of common crypto mentions
    const cryptoMap: Record<string, string> = {
      "bitcoin": "bitcoin",
      "btc": "bitcoin",
      "ethereum": "ethereum",
      "eth": "ethereum",
      "binance": "binancecoin",
      "bnb": "binancecoin",
      "xrp": "ripple",
      "ripple": "ripple",
      "cardano": "cardano",
      "ada": "cardano",
      "solana": "solana",
      "sol": "solana",
      "dogecoin": "dogecoin",
      "doge": "dogecoin",
      "polkadot": "polkadot",
      "dot": "polkadot",
      "polygon": "polygon",
      "matic": "polygon",
      "litecoin": "litecoin",
      "ltc": "litecoin",
      "tether": "tether",
      "usdt": "tether",
      "shiba": "shiba-inu",
      "shib": "shiba-inu"
    };
    
    const detectedCoins = new Set<string>();
    
    for (const word of words) {
      if (cryptoMap[word]) {
        detectedCoins.add(cryptoMap[word]);
      }
    }
    
    return Array.from(detectedCoins);
  }