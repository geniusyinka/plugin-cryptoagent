import {
    elizaLogger,
    type AgentRuntime as IAgentRuntime,
} from "@elizaos/core";
import type { Memory, Provider, State } from "@elizaos/core";
import {
    getCryptoByIdOrSymbol,
    getCryptoDetails,
    getTopCryptos
} from "../service";

const cryptoProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const text = message.content.text || "";
            
            // Skip if message is from the agent itself
            if (message.userId === runtime.agentId) {
                return "";
            }
            
            // Detect crypto mentions
            const detectedCoins = extractCryptoMentions(text);
            
            if (detectedCoins.length === 0) {
                return ""; // No crypto context to add
            }
            
            console.log(`[CryptoProvider] Detected coins: ${detectedCoins.join(', ')}`);
            
            // Fetch data for detected coins (up to 3 to avoid overloading context)
            const coinData = [];
            for (const coinId of detectedCoins.slice(0, 3)) {
                try {
                    const coin = await getCryptoByIdOrSymbol(coinId);
                    if (coin) {
                        coinData.push({
                            name: coin.name,
                            symbol: coin.symbol.toUpperCase(),
                            price: coin.current_price.toFixed(2),
                            change_24h: coin.price_change_percentage_24h,
                            market_cap: (coin.market_cap / 1_000_000_000).toFixed(2),
                            direction: coin.price_change_percentage_24h >= 0 ? 'up' : 'down',
                            change_abs: Math.abs(coin.price_change_percentage_24h).toFixed(2)
                        });
                    }
                } catch (error) {
                    console.error(`[CryptoProvider] Error fetching data for ${coinId}:`, error);
                    elizaLogger.error(`[CryptoProvider] Error fetching data for ${coinId}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            
            if (coinData.length === 0) {
                return ""; // No valid data found
            }
            
            // Store coin data in state (if available)
            if (state && typeof state === 'object') {
                // We'll add the data to state so the action can access it
                if (!state.cryptoData) {
                    state.cryptoData = {};
                }
                
                // Detect message intent
                const isDirectRequest = detectDirectCryptoRequest(text);
                const isRecommendationRequest = detectRecommendationRequest(text);
                
                let contextType = "informational";
                if (isRecommendationRequest) {
                    contextType = "recommendation";
                } else if (isDirectRequest) {
                    contextType = "direct_request";
                }
                
                // Update state with coin data and context type
                state.cryptoData = {
                    coins: coinData,
                    contextType: contextType,
                    timestamp: Date.now()
                };
            }
            
            // Format contextual information for the LLM
            let contextInfo = `Current cryptocurrency information:\n`;
            
            // Add current data
            coinData.forEach(coin => {
                contextInfo += `- ${coin.name} (${coin.symbol}): $${coin.price}, ${coin.direction} ${coin.change_abs}% in last 24h, Market Cap: $${coin.market_cap}B\n`;
            });
            
            // Add intent-specific guidance for the LLM
            const isRecommendationRequest = detectRecommendationRequest(text);
            if (isRecommendationRequest) {
                contextInfo += "\nThe user seems to be asking for investment advice. You should not provide specific investment recommendations but can provide factual market information. Mention that cryptocurrency investments carry significant risk and that the user should do their own research.\n";
            }
            
            console.log(`[CryptoProvider] Adding context: ${contextInfo}`);
            return contextInfo;
        } catch (error) {
            console.error("[CryptoProvider] Error:", error);
            elizaLogger.error(`[CryptoProvider] Error: ${error instanceof Error ? error.message : String(error)}`);
            return ""; // Return empty string on error
        }
    },
};

// Helper function to detect if this is a direct request about cryptocurrency
function detectDirectCryptoRequest(text: string): boolean {
    const normalizedText = text.toLowerCase();
    return !!normalizedText.match(/(?:price|value|worth|how much|what is|tell me about)/i);
}

// Helper function to detect if this is an investment/recommendation request
function detectRecommendationRequest(text: string): boolean {
    const normalizedText = text.toLowerCase();
    // Looking for phrases that suggest seeking investment advice
    return !!normalizedText.match(/(?:should i|would you recommend|good investment|buy|invest|worth buying|good time)/i);
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

export { cryptoProvider };