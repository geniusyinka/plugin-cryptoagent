import {
    elizaLogger,
    Action,
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State
} from "@elizaos/core";
import {
  getTopCryptos,
  getCryptoByIdOrSymbol,
  getCryptoDetails,
  formatCryptoSummary,
  formatCryptoDetailedSummary
} from "../service";
import { getCryptoExamples } from "../examples";

// Define a type for our crypto data in state
interface CryptoStateData {
    coins: Array<{
        name: string;
        symbol: string;
        price: string;
        change_24h: number;
        market_cap: string;
        direction: 'up' | 'down';
        change_abs: string;
    }>;
    contextType: 'informational' | 'direct_request' | 'recommendation';
    timestamp: number;
}

// Extend the State type to include our crypto data
interface CryptoState extends State {
    cryptoData?: CryptoStateData;
}

export const cryptoAction: Action = {
    name: "CRYPTO_PRICE",
    similes: [
        "CRYPTO", 
        "CRYPTOCURRENCY", 
        "COIN", 
        "BITCOIN", 
        "ETHEREUM", 
        "BTC", 
        "ETH"
    ],
    description: "Get cryptocurrency prices and information or respond to cryptocurrency mentions",
    
    validate: async (_runtime: IAgentRuntime) => true,
    
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: CryptoState,
        _options: { [key: string]: unknown },
        callback: HandlerCallback
    ) => {
        try {
            const input = message.content.text || "";
            console.log(`[CryptoAction] Processing: ${input}`);
            
            // Handle "top N cryptocurrencies" request
            if (input.match(/top\s+(\d+)\s+cryptocurrencies/i) || input.match(/top\s+(\d+)\s+crypto/i)) {
                const match = input.match(/top\s+(\d+)/i);
                const count = match ? parseInt(match[1]) : 5;
                
                try {
                    const topCoins = await getTopCryptos(count);
                    
                    if (!topCoins || topCoins.length === 0) {
                        callback({
                            text: "I couldn't fetch the cryptocurrency data right now. The service might be experiencing issues."
                        });
                        return false;
                    }
                    
                    // Create a formatted list
                    let response = `📊 Top ${count} Cryptocurrencies by Market Cap:\n\n`;
                    
                    topCoins.forEach((coin, index) => {
                        response += `${index + 1}. ${coin.name} (${coin.symbol.toUpperCase()})
   Price: $${coin.current_price.toFixed(2)}
   24h: ${coin.price_change_percentage_24h >= 0 ? '↑' : '↓'} ${Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
   Market Cap: $${(coin.market_cap / 1_000_000_000).toFixed(2)}B\n\n`;
                    });
                    
                    callback({ text: response });
                    return true;
                } catch (error: any) {
                    elizaLogger.error(`[CryptoAction] Error fetching top cryptos: ${error.message}`);
                    callback({
                        text: "Sorry, I couldn't fetch the cryptocurrency rankings right now. The API might be experiencing high traffic. Please try again in a moment."
                    });
                    return false;
                }
            }
            
            // Check if our provider added crypto data to the state
            if (state.cryptoData) {
                console.log(`[CryptoAction] Found crypto data in state: ${state.cryptoData.contextType}`);
                
                // For recommendation requests
                if (state.cryptoData.contextType === 'recommendation') {
                    const coin = state.cryptoData.coins[0]; // Use the first detected coin
                    callback({
                        text: `I understand you're asking about ${coin.name} as an investment. While I can't provide financial advice, I can tell you that ${coin.name} is currently trading at $${coin.price}, which is ${coin.direction} ${coin.change_abs}% in the last 24 hours. Any investment decisions should be based on your own research and risk tolerance. Cryptocurrency markets are highly volatile, and what works for one person may not work for another.`
                    });
                    return true;
                }
                
                // For direct price requests
                if (state.cryptoData.contextType === 'direct_request') {
                    // Extract which cryptocurrency was mentioned
                    const detectedCoins = extractCryptoMentions(input);
                    
                    if (detectedCoins.length > 0) {
                        const coinId = detectedCoins[0];
                        try {
                            // Get detailed information
                            const coin = await getCryptoByIdOrSymbol(coinId);
                            
                            if (!coin) {
                                callback({
                                    text: `I couldn't find information for the cryptocurrency "${coinId}". It might not be listed on major exchanges or you might need to use its full name or ticker symbol.`
                                });
                                return false;
                            }
                            
                            const details = await getCryptoDetails(coin.id);
                            
                            if (details) {
                                callback({
                                    text: formatCryptoDetailedSummary(details)
                                });
                            } else {
                                callback({
                                    text: formatCryptoSummary(coin)
                                });
                            }
                            
                            return true;
                        } catch (error: any) {
                            elizaLogger.error(`[CryptoAction] Error fetching crypto details: ${error.message}`);
                            callback({
                                text: "Sorry, I couldn't fetch the detailed cryptocurrency information right now. The API might be experiencing high traffic. Please try again in a moment."
                            });
                            return false;
                        }
                    }
                }
                
                // For casual mentions (informational context)
                if (state.cryptoData.contextType === 'informational') {
                    const coin = state.cryptoData.coins[0]; // Use the first detected coin
                    callback({
                        text: `I notice you mentioned ${coin.name}. Currently, it's trading at $${coin.price}, which is ${coin.direction} ${coin.change_abs}% in the last 24 hours.`
                    });
                    return true;
                }
            }
            
            // Check if this is crypto-related but no provider data
            const cryptoMentions = extractCryptoMentions(input);
            
            if (cryptoMentions.length > 0) {
                // This is crypto-related but no provider data available
                // Try to get info directly
                const coinId = cryptoMentions[0];
                
                try {
                    const coin = await getCryptoByIdOrSymbol(coinId);
                    
                    if (!coin) {
                        callback({
                            text: `I couldn't find information for the cryptocurrency "${coinId}". It might not be listed on major exchanges or you might need to use its full name or ticker symbol.`
                        });
                        return false;
                    }
                    
                    // Default response if we can't determine context type
                    callback({
                        text: formatCryptoSummary(coin)
                    });
                    return true;
                } catch (error: any) {
                    callback({
                        text: "I can provide cryptocurrency information. Try asking about specific coins like Bitcoin or Ethereum, or ask for the top cryptocurrencies by market cap."
                    });
                    return true;
                }
            }
            
            // Not crypto-related, let other actions handle it
            return false;
            
        } catch (error: any) {
            elizaLogger.error(`[CryptoAction] Error: ${error.message}`);
            callback({
                text: "Sorry, I couldn't fetch cryptocurrency data at the moment. The service might be experiencing high traffic. Please try again later.",
                content: { error: error.message },
            });
            return false;
        }
    },
    
    examples: getCryptoExamples as ActionExample[][],
} as Action;

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