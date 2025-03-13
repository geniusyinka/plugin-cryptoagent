import {
    elizaLogger,
    Action,
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State
} from "@elizaos/core";
import { portfolioService } from "../portfolio";
import { getViewPortfolioExamples } from "../examples";

export const viewPortfolioAction: Action = {
    name: "VIEW_PORTFOLIO",
    similes: [
        "PORTFOLIO", 
        "CRYPTO_HOLDINGS", 
        "MY_INVESTMENTS",
        "SHOW_PORTFOLIO"
    ],
    description: "View the user's cryptocurrency portfolio with current prices and performance",
    
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
            console.log(`[ViewPortfolioAction] Processing: ${input}`);
            
            // Check if the message is about viewing portfolio
            if (!detectPortfolioRequest(input)) {
                return false;
            }
            
            // Check if user has a portfolio
            const hasPortfolio = await portfolioService.hasPortfolio(runtime, message.userId);
            if (!hasPortfolio) {
                callback({
                    text: "You don't have any cryptocurrency in your portfolio yet. To add some, just let me know what you've purchased. For example, 'I bought 0.1 BTC at $50,000 each.'"
                });
                return true;
            }
            
            // Get the portfolio with current prices
            const portfolio = await portfolioService.getPortfolio(runtime, message.userId);
            
            if (!portfolio || portfolio.items.length === 0) {
                callback({
                    text: "I couldn't retrieve your portfolio right now. Please try again later."
                });
                return false;
            }
            
            // Format the portfolio for display - using a cleaner format
            let totalInvested = 0;
            let totalCurrentValue = 0;
            let response = "📊 **Your Cryptocurrency Portfolio**\n\n";
            
            // Format each asset on its own line
            for (const item of portfolio.items) {
                // Skip if we don't have current price data
                if (!('currentPrice' in item)) continue;
                
                const typedItem = item as typeof item & { currentPrice: number, priceChange24h: number };
                
                const invested = item.quantity * item.purchasePrice;
                const currentValue = item.quantity * typedItem.currentPrice;
                const profitLoss = currentValue - invested;
                const profitLossPercent = (profitLoss / invested) * 100;
                
                // Add to totals
                totalInvested += invested;
                totalCurrentValue += currentValue;
                
                // Format each asset as a clean line
                response += `${item.symbol} | ${item.quantity.toFixed(4)} | $${item.purchasePrice.toFixed(2)} | $${typedItem.currentPrice.toFixed(2)} | $${currentValue.toFixed(2)} | ${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(2)}%)\n`;
            }
            
            // Add a clear header line at the top
            response = response.replace("**Your Cryptocurrency Portfolio**\n\n", "");
            
            response = `📊 **Your Cryptocurrency Portfolio**\n\nAsset | Quantity | Avg. Purchase | Current Price | Value | P/L\n${'—'.repeat(70)}\n${response}`;
            
            // Add summary with clearer formatting
            const totalProfitLoss = totalCurrentValue - totalInvested;
            const totalProfitLossPercent = (totalProfitLoss / totalInvested) * 100;
            
            response += `\n${'—'.repeat(70)}\n**Summary**\n`;
            response += `Total Invested: $${totalInvested.toFixed(2)}\n`;
            response += `Current Value: $${totalCurrentValue.toFixed(2)}\n`;
            response += `Overall Profit/Loss: ${totalProfitLoss >= 0 ? '+' : ''}$${totalProfitLoss.toFixed(2)} (${totalProfitLossPercent.toFixed(2)}%)\n`;
            
            // Add last updated timestamp
            const updateTime = new Date(portfolio.lastUpdated).toLocaleString();
            response += `\n_Last updated: ${updateTime}_`;
            
            callback({ text: response });
            return true;
        } catch (error: any) {
            elizaLogger.error(`[ViewPortfolioAction] Error: ${error.message}`);
            callback({
                text: "I'm sorry, I couldn't retrieve your portfolio information at the moment. Please try again later."
            });
            return false;
        }
    },
    
    examples: getViewPortfolioExamples as ActionExample[][],
} as Action;

/**
 * Detect if a message is requesting to view a portfolio
 */
function detectPortfolioRequest(text: string): boolean {
    const normalizedText = text.toLowerCase();
    
    // Patterns that suggest wanting to view portfolio
    const portfolioViewPatterns = [
        /(?:show|view|check|see|display).*(?:portfolio|holding|investment)/i,
        /(?:my|portfolio|holding|investment).*(?:crypto|bitcoin|ethereum|coin)/i,
        /(?:how.*doing|performance|profit|loss)/i,
        /what.*(?:portfolio|holding|investment)/i
    ];
    
    return portfolioViewPatterns.some(pattern => pattern.test(normalizedText));
}