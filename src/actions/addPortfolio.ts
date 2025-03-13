import {
    elizaLogger,
    Action,
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State
} from "@elizaos/core";
import { portfolioService } from "../portfolio.ts";
import { getCryptoPortfolioExamples } from "../examples.ts";

export const addToPortfolioAction: Action = {
    name: "ADD_TO_PORTFOLIO",
    similes: [
        "ADD_CRYPTO", 
        "PORTFOLIO_ADD", 
        "TRACK_INVESTMENT",
        "LOG_PURCHASE"
    ],
    description: "Add a cryptocurrency purchase to the user's portfolio",
    
    validate: async (_runtime: IAgentRuntime) => true,
    
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state: State,
        _options: { [key: string]: unknown },
        callback: HandlerCallback
    ) => {
        try {
            const input = message.content.text || "";
            console.log(`[AddToPortfolioAction] Processing: ${input}`);
            
            // Check if the message is about adding to portfolio
            if (!detectPortfolioAddition(input)) {
                return false;
            }
            
            // Extract coin, quantity and price from the message
            const extractedData = extractCoinPurchaseData(input);
            
            if (!extractedData) {
                callback({
                    text: "I'd be happy to add that to your portfolio, but I need to know what cryptocurrency you bought, how much, and at what price. For example, 'I just bought 0.5 BTC at $50,000 each.'"
                });
                return true;
            }
            
            const { coinId, quantity, price } = extractedData;
            
            // Add to portfolio
            const result = await portfolioService.addToPortfolio(
                runtime,
                message.userId,
                coinId,
                quantity,
                price
            );
            
            if (!result) {
                callback({
                    text: `I couldn't find a cryptocurrency matching "${coinId}". Please check the name or symbol and try again.`
                });
                return true;
            }
            
            // Calculate total spent
            const totalSpent = quantity * price;
            
            callback({
                text: `Great! I've added ${quantity} ${result.symbol} (${result.name}) at $${price.toFixed(2)} per coin to your portfolio. Total investment: $${totalSpent.toFixed(2)}.`
            });
            
            return true;
        } catch (error: any) {
            elizaLogger.error(`[AddToPortfolioAction] Error: ${error.message}`);
            callback({
                text: "Sorry, I couldn't add that to your portfolio right now. Please try again with the format 'I bought X [crypto] at $Y each.'"
            });
            return false;
        }
    },
    
    examples: getCryptoPortfolioExamples as ActionExample[][],
} as Action;

/**
 * Detect if a message is about adding to a crypto portfolio
 */
function detectPortfolioAddition(text: string): boolean {
    const normalizedText = text.toLowerCase();
    
    // Patterns that suggest adding to portfolio
    const portfolioAddPatterns = [
        /(?:add|track|log|record).*(?:portfolio|holding|investment)/i,
        /(?:bought|purchased|got|acquired).*(?:bitcoin|btc|eth|ethereum|crypto|coin)/i,
        /(?:add|put|include).*(?:bitcoin|btc|eth|ethereum|crypto|coin).*(?:portfolio|holding|investment)/i
    ];
    
    return portfolioAddPatterns.some(pattern => pattern.test(normalizedText));
}

/**
 * Extract coin, quantity and price from a message
 */
function extractCoinPurchaseData(text: string): { coinId: string, quantity: number, price: number } | null {
    const normalizedText = text.toLowerCase();
    
    // Common cryptocurrency identifiers
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
        "dot": "polkadot"
    };
    
    // Extract the cryptocurrency
    let coinId = "";
    for (const [term, id] of Object.entries(cryptoMap)) {
        if (normalizedText.includes(term)) {
            coinId = id;
            break;
        }
    }
    
    if (!coinId) {
        return null;
    }
    
    // Extract quantity using regex patterns
    const quantityPatterns = [
        /(?:bought|purchased|got|acquired|add|have)\s+(\d+(?:\.\d+)?)\s+(?:bitcoin|btc|eth|ethereum|ada|sol|doge|xrp|bnb)/i,
        /(\d+(?:\.\d+)?)\s+(?:bitcoin|btc|eth|ethereum|ada|sol|doge|xrp|bnb)/i
    ];
    
    let quantity = 0;
    for (const pattern of quantityPatterns) {
        const match = normalizedText.match(pattern);
        if (match && match[1]) {
            quantity = parseFloat(match[1]);
            break;
        }
    }
    
    if (quantity <= 0) {
        return null;
    }
    
    // Extract price using regex patterns
    const pricePatterns = [
        /\$(\d+(?:,\d+)*(?:\.\d+)?)/i,           // $1,234.56
        /(\d+(?:,\d+)*(?:\.\d+)?)\s+(?:dollars|usd)/i,  // 1,234.56 dollars
        /at\s+(\d+(?:,\d+)*(?:\.\d+)?)/i,        // at 1,234.56
        /for\s+\$?(\d+(?:,\d+)*(?:\.\d+)?)/i,     // for $1,234.56
        /price\s+of\s+\$?(\d+(?:,\d+)*(?:\.\d+)?)/i  // price of $1,234.56
    ];
    
    let price = 0;
    for (const pattern of pricePatterns) {
        const match = normalizedText.match(pattern);
        if (match && match[1]) {
            // Remove commas before parsing
            price = parseFloat(match[1].replace(/,/g, ''));
            break;
        }
    }
    
    if (price <= 0) {
        return null;
    }
    
    return { coinId, quantity, price };
}