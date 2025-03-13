import { elizaLogger } from "@elizaos/core";

// Types for cryptocurrency data
export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d?: number;
  price_change_percentage_30d?: number;
  high_24h: number;
  low_24h: number;
  last_updated: string;
}

export interface CryptoDetails {
  id: string;
  symbol: string;
  name: string;
  description: { en: string };
  market_data: {
    current_price: { [currency: string]: number };
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    market_cap: { [currency: string]: number };
    total_volume: { [currency: string]: number };
  };
}

// Base URL for CoinGecko API
const API_BASE_URL = 'https://api.coingecko.com/api/v3';

// Cache to minimize API calls
const cache: { [endpoint: string]: { data: any; timestamp: number } } = {};
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Make API request with caching
 */
async function apiRequest<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const now = Date.now();

  // Check cache first
  if (cache[endpoint] && now - cache[endpoint].timestamp < CACHE_DURATION) {
    elizaLogger.debug(`[CryptoService] Using cached data for ${endpoint}`);
    return cache[endpoint].data as T;
  }

  try {
    elizaLogger.debug(`[CryptoService] Fetching ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Update cache
    cache[endpoint] = { data, timestamp: now };
    
    return data as T;
  } catch (error) {
    elizaLogger.error(`[CryptoService] API request failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Get top cryptocurrencies by market cap
 */
export async function getTopCryptos(count = 10, currency = 'usd'): Promise<CryptoPrice[]> {
  const endpoint = `/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=${count}&page=1&sparkline=false`;
  return apiRequest<CryptoPrice[]>(endpoint);
}

/**
 * Get specific cryptocurrency by ID or symbol
 */
export async function getCryptoByIdOrSymbol(idOrSymbol: string, currency = 'usd'): Promise<CryptoPrice | null> {
  const normalized = idOrSymbol.toLowerCase();
  
  try {
    // Try to find by ID or symbol in top 100 coins (most common ones)
    const topCoins = await getTopCryptos(100, currency);
    
    const coin = topCoins.find(
      c => c.id === normalized || c.symbol.toLowerCase() === normalized
    );
    
    return coin || null;
  } catch (error) {
    elizaLogger.error(`[CryptoService] Failed to get crypto: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get detailed information about a specific cryptocurrency
 */
export async function getCryptoDetails(id: string): Promise<CryptoDetails | null> {
  try {
    const endpoint = `/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
    return apiRequest<CryptoDetails>(endpoint);
  } catch (error) {
    elizaLogger.error(`[CryptoService] Failed to get crypto details: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Format price change with proper sign and percentage
 */
export function formatPriceChange(change: number | undefined): string {
  if (change === undefined || change === null) return 'unknown';
  
  const sign = change >= 0 ? '↑' : '↓';
  const color = change >= 0 ? 'green' : 'red';
  return `${sign} ${Math.abs(change).toFixed(2)}%`;
}

/**
 * Format large numbers for better readability
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  }
  return `$${num.toFixed(2)}`;
}

/**
 * Format a cryptocurrency price summary
 */
export function formatCryptoSummary(crypto: CryptoPrice): string {
  return `${crypto.name} (${crypto.symbol.toUpperCase()})
Price: $${crypto.current_price.toFixed(2)} USD
24h Change: ${formatPriceChange(crypto.price_change_percentage_24h)}
Market Cap: ${formatLargeNumber(crypto.market_cap)}
Rank: #${crypto.market_cap_rank}
24h High: $${crypto.high_24h.toFixed(2)}
24h Low: $${crypto.low_24h.toFixed(2)}`;
}

/**
 * Format a cryptocurrency detailed summary
 */
export function formatCryptoDetailedSummary(crypto: CryptoDetails): string {
  const price = crypto.market_data.current_price.usd;
  const marketCap = crypto.market_data.market_cap.usd;
  const volume = crypto.market_data.total_volume.usd;

  return `${crypto.name} (${crypto.symbol.toUpperCase()})

Current Price: $${price.toFixed(2)} USD
Price Changes:
  • 24h: ${formatPriceChange(crypto.market_data.price_change_percentage_24h)}
  • 7d:  ${formatPriceChange(crypto.market_data.price_change_percentage_7d)}
  • 30d: ${formatPriceChange(crypto.market_data.price_change_percentage_30d)}

Market Cap: ${formatLargeNumber(marketCap)}
24h Trading Volume: ${formatLargeNumber(volume)}

Description:
${crypto.description.en.split('.')[0]}.`;
}