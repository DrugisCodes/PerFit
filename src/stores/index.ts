/**
 * Store Provider Registry
 * 
 * Central registry for all store providers.
 * Add new providers here to enable support for new online stores.
 */

import { StoreProvider } from './types';
import { zalandoProvider } from './zalando';

/**
 * List of all available store providers
 * 
 * To add a new store:
 * 1. Create a new provider class in src/stores/[storeName].ts
 * 2. Import it here
 * 3. Add to the providers array
 */
export const providers: StoreProvider[] = [
  zalandoProvider,
  // Add more providers here:
  // asosProvider,
  // hMProvider,
  // nikProvider,
];

/**
 * Detect which store provider can handle the current page
 * 
 * @returns The first provider that can handle the current page, or null
 */
export function detectProvider(): StoreProvider | null {
  for (const provider of providers) {
    if (provider.canHandle()) {
      console.log(`PerFit: Detected store provider: ${provider.name}`);
      return provider;
    }
  }
  
  console.log("PerFit: No matching store provider found for this page");
  return null;
}
