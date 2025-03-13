import { Plugin } from "@elizaos/core";
import { cryptoAction } from './actions/cryptoaction';
import { cryptoEvaluator } from './evaluator/cryptoevaluator';
import { cryptoProvider } from "./provider/cryptoProvider";

export const cryptoPlugin: Plugin = {
  name: "crypto-price-plugin",
  description: "A cryptocurrency information plugin that provides real-time price data and market information",
  actions: [
    cryptoAction
  ],
  evaluators: [
    // cryptoEvaluator
  ],
  providers: [cryptoProvider]
};

export default cryptoPlugin;