import { elizaLogger, Memory, IAgentRuntime, IDatabaseAdapter } from "@elizaos/core";
import { getCryptoByIdOrSymbol } from "./service";
import { v4 as uuidv4 } from "uuid";

// Ensure a valid UUID format
function ensureUUID(
    value: string
): `${string}-${string}-${string}-${string}-${string}` {
    return value.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
        ? (value as `${string}-${string}-${string}-${string}-${string}`)
        : (uuidv4() as `${string}-${string}-${string}-${string}-${string}`);
}

export interface PortfolioItem {
    coinId: string;       // Coin identifier (e.g., "bitcoin")
    symbol: string;       // Coin symbol (e.g., "BTC")
    name: string;         // Coin name (e.g., "Bitcoin")
    quantity: number;     // Amount held
    purchasePrice: number; // Price paid per unit
    purchaseDate: number;  // Timestamp of purchase
}

interface PortfolioContent {
    action: string;
    userId: string;       // Store userId in content to filter by it
    items: PortfolioItem[];
    lastUpdated: number;
}

/**
 * Service to manage cryptocurrency portfolios using the database adapter
 */
export const portfolioService = {
    /**
     * Add an item to a user's portfolio
     */
    async addToPortfolio(
        runtime: IAgentRuntime,
        userId: string,
        coinId: string,
        quantity: number,
        purchasePrice: number
    ): Promise<PortfolioItem | null> {
        try {
            const db = runtime.databaseAdapter;
            
            // Validate and normalize the coin ID
            const coin = await getCryptoByIdOrSymbol(coinId);
            if (!coin) {
                elizaLogger.error(`[PortfolioService] Couldn't find coin: ${coinId}`);
                return null;
            }
            
            // Get existing portfolio or create a new one
            const portfolioMemory = await this.getPortfolioMemory(runtime, userId);
            
            let portfolio: PortfolioItem[] = [];
            if (portfolioMemory) {
                // Extract existing portfolio items
                const content = typeof portfolioMemory.content === "string"
                    ? JSON.parse(portfolioMemory.content)
                    : portfolioMemory.content;
                    
                portfolio = content.items || [];
            }
            
            // Create the new portfolio item
            const newItem: PortfolioItem = {
                coinId: coin.id,
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                quantity,
                purchasePrice,
                purchaseDate: Date.now()
            };

            // Check if the user already owns this coin
            const existingItemIndex = portfolio.findIndex(item => item.coinId === coin.id);
            
            if (existingItemIndex >= 0) {
                // Update existing position with average price
                const existingItem = portfolio[existingItemIndex];
                const totalQuantity = existingItem.quantity + quantity;
                const totalValue = (existingItem.quantity * existingItem.purchasePrice) + 
                                    (quantity * purchasePrice);
                
                // Calculate new average price
                const newAveragePrice = totalValue / totalQuantity;
                
                // Update the item
                portfolio[existingItemIndex] = {
                    ...existingItem,
                    quantity: totalQuantity,
                    purchasePrice: newAveragePrice,
                    purchaseDate: Date.now() // Update to latest purchase date
                };
                
                elizaLogger.debug(`[PortfolioService] Updated existing position for ${coin.name}`);
            } else {
                // Add new position
                portfolio.push(newItem);
                elizaLogger.debug(`[PortfolioService] Added new position for ${coin.name}`);
            }
            
            // Store the updated portfolio in the database
            await this.savePortfolio(runtime, userId, portfolio);
            
            // Return the new/updated item
            return existingItemIndex >= 0 ? portfolio[existingItemIndex] : newItem;
        } catch (error) {
            elizaLogger.error(`[PortfolioService] Error adding to portfolio: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    },

    /**
     * Get a user's portfolio with current market prices
     */
    async getPortfolio(
        runtime: IAgentRuntime,
        userId: string
    ): Promise<{ items: Array<PortfolioItem & { currentPrice?: number, priceChange24h?: number }>, lastUpdated: number } | null> {
        try {
            const portfolioMemory = await this.getPortfolioMemory(runtime, userId);
            
            if (!portfolioMemory) {
                return null;
            }
            
            // Extract portfolio data
            const content = typeof portfolioMemory.content === "string"
                ? JSON.parse(portfolioMemory.content)
                : portfolioMemory.content;
                
            const portfolio = content.items || [];
            
            if (portfolio.length === 0) {
                return null;
            }
            
            // Create result with current timestamp
            const result = {
                items: [...portfolio],
                lastUpdated: Date.now()
            };
            
            // Update current prices
            for (let i = 0; i < result.items.length; i++) {
                const item = result.items[i];
                try {
                    const coin = await getCryptoByIdOrSymbol(item.coinId);
                    if (coin) {
                        // Add current price data
                        result.items[i] = {
                            ...item,
                            currentPrice: coin.current_price,
                            priceChange24h: coin.price_change_percentage_24h
                        };
                    }
                } catch (error) {
                    elizaLogger.error(`[PortfolioService] Error updating price for ${item.name}: ${error instanceof Error ? error.message : String(error)}`);
                    // Keep the item without current price if we can't fetch it
                }
            }
            
            return result;
        } catch (error) {
            elizaLogger.error(`[PortfolioService] Error getting portfolio: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    },

    /**
     * Check if a user has a portfolio
     */
    async hasPortfolio(runtime: IAgentRuntime, userId: string): Promise<boolean> {
        try {
            const portfolioMemory = await this.getPortfolioMemory(runtime, userId);
            
            if (!portfolioMemory) {
                return false;
            }
            
            // Extract portfolio data
            const content = typeof portfolioMemory.content === "string"
                ? JSON.parse(portfolioMemory.content)
                : portfolioMemory.content;
                
            const portfolio = content.items || [];
            
            return portfolio.length > 0;
        } catch (error) {
            elizaLogger.error(`[PortfolioService] Error checking portfolio existence: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    },

    /**
     * Get the memory object that contains the portfolio
     */
    async getPortfolioMemory(runtime: IAgentRuntime, userId: string): Promise<Memory | null> {
        try {
            const db = runtime.databaseAdapter;
            const roomId = ensureUUID(userId); // Use userId as roomId for filtering
            
            // Get memories filtered by roomId instead of userId
            const memories = await db.getMemories({
                roomId: roomId,
                tableName: "memories",
                count: 100,
                agentId: "b850bc30-45f8-0041-a00a-83df46d8555d",
            });
            
            // Filter memories to find portfolio data with matching userId in content
            const portfolioMemories = memories.filter(memory => {
                try {
                    const content = typeof memory.content === "string"
                        ? JSON.parse(memory.content)
                        : memory.content;
                    
                    return content.action === "CRYPTO_PORTFOLIO" && content.userId === userId;
                } catch (error) {
                    return false;
                }
            }).sort((a, b) => b.createdAt - a.createdAt);
            
            return portfolioMemories.length > 0 ? portfolioMemories[0] : null;
        } catch (error) {
            elizaLogger.error(`[PortfolioService] Error getting portfolio memory: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    },

    /**
     * Save the portfolio to the database
     */
    async savePortfolio(runtime: IAgentRuntime, userId: string, portfolio: PortfolioItem[]): Promise<void> {
        try {
            const db = runtime.databaseAdapter;
            const roomId = ensureUUID(userId); // Use userId as roomId for storing
            
            // Get existing portfolio memory
            const existingMemory = await this.getPortfolioMemory(runtime, userId);
            
            if (existingMemory) {
                // Update existing memory
                const content = typeof existingMemory.content === "string"
                    ? JSON.parse(existingMemory.content)
                    : existingMemory.content;
                
                const updatedMemory: Memory = {
                    ...existingMemory,
                    content: {
                        ...content,
                        userId, // Ensure userId is in content
                        items: portfolio,
                        lastUpdated: Date.now()
                    },
                    embedding: undefined // Clear embedding when updating
                };
                
                await db.updateMemory(existingMemory.id, updatedMemory, "memories");
                elizaLogger.debug(`[PortfolioService] Updated portfolio in memory: ${existingMemory.id}`);
            } else {
                // Create new memory
                const portfolioMemory: Memory = {
                    id: ensureUUID(uuidv4()),
                    userId: "b850bc30-45f8-0041-a00a-83df46d8555d",
                    roomId,
                    agentId: runtime.agentId,
                    content: {
                        action: "CRYPTO_PORTFOLIO",
                        userId, // Store userId in content for filtering
                        items: portfolio,
                        lastUpdated: Date.now(),
                        text: ""
                    },
                    createdAt: Date.now(),
                    unique: true,
                };
                
                await db.createMemory(portfolioMemory, "memories");
                elizaLogger.debug(`[PortfolioService] Created new portfolio memory: ${portfolioMemory.id}`);
            }
        } catch (error) {
            elizaLogger.error(`[PortfolioService] Error saving portfolio: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    },

    /**
     * Clear a user's portfolio (for testing)
     */
    // async clearPortfolio(runtime: IAgentRuntime, userId: string): Promise<void> {
    //     try {
    //         const portfolioMemory = await this.getPortfolioMemory(runtime, userId);
            
    //         if (portfolioMemory) {
    //             const db = runtime.databaseAdapter;
    //             await db.deleteMemory(portfolioMemory.id, "memories");
    //             elizaLogger.debug(`[PortfolioService] Cleared portfolio for user: ${userId}`);
    //         }
    //     } catch (error) {
    //         elizaLogger.error(`[PortfolioService] Error clearing portfolio: ${error instanceof Error ? error.message : String(error)}`);
    //     }
    // }
};