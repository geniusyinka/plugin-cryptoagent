import { ActionExample } from "@elizaos/core";

export const getCryptoExamples: ActionExample[][] = [
    [
        {
            user: "{{user1}}",
            content: {
                text: "What's the price of Bitcoin right now?",
            },
        },
        {
            user: "{{agent}}",
            content: {
                text: "Let me check the current Bitcoin price for you.",
                action: "CRYPTO_PRICE",
            },
        }
    ],
    [
        {
            user: "{{user1}}",
            content: {
                text: "I wonder how Ethereum is doing today",
            },
        },
        {
            user: "{{agent}}",
            content: {
                text: "Let me get you the latest Ethereum market information.",
                action: "CRYPTO_PRICE",
            },
        }
    ],
    [
        {
            user: "{{user1}}",
            content: {
                text: "Show me the top 5 cryptocurrencies",
            },
        },
        {
            user: "{{agent}}",
            content: {
                text: "I'll fetch the top 5 cryptocurrencies by market cap for you.",
                action: "CRYPTO_PRICE",
            },
        }
    ],
    [
        {
            user: "{{user1}}",
            content: {
                text: "I'm interested in crypto investments.",
            },
        },
        {
            user: "{{agent}}",
            content: {
                text: "Would you like to see the current market leaders in cryptocurrency?",
            },
        },
        {
            user: "{{user1}}",
            content: {
                text: "yes",
            },
        },
        {
            user: "{{agent}}",
            content: {
                text: "Here are the top cryptocurrencies by market cap.",
                action: "CRYPTO_PRICE",
            },
        }
    ],
    [
        {
            user: "{{user1}}",
            content: {
                text: "What's happening with Dogecoin?",
            },
        },
        {
            user: "{{agent}}",
            content: {
                text: "Let me check the current Dogecoin market data for you.",
                action: "CRYPTO_PRICE",
            },
        }
    ],
    [
        {
            user: "{{user1}}",
            content: {
                text: "I've been thinking about buying some BTC.",
            },
        },
        {
            user: "{{agent}}",
            content: {
                text: "Would you like to see the current Bitcoin market information?",
            },
        },
        {
            user: "{{user1}}",
            content: {
                text: "That would be helpful.",
            },
        },
        {
            user: "{{agent}}",
            content: {
                text: "Here's the latest data on Bitcoin (BTC).",
                action: "CRYPTO_PRICE",
            },
        }
    ]
];