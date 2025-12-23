/**
 * Zalando Store Provider
 * 
 * Implements Zalando-specific integration.
 * Generic table scraping logic is in BaseStoreProvider.
 */

import { SizeRow } from './types';
import { BaseStoreProvider } from './BaseStoreProvider';
import { delay, findElementByText } from '../utils/dom';

/**
 * Text-based measurement data (fallback when tables are missing)
 */
interface TextMeasurement {
  modelHeight?: number;      // Model's height in cm (e.g., 189)
  modelSize: string;         // Size the model is wearing (e.g., "M")
  itemLength?: number;       // Item length in cm (e.g., 69)
  itemLengthSize?: string;   // Size for which length is specified (e.g., "M")
}

/**
 * ZalandoProvider - Handles Zalando.no integration
 */
export class ZalandoProvider extends BaseStoreProvider {
  name = "Zalando";
  private fitHint: string | null = null;
  public textMeasurement: TextMeasurement | null = null;

  /**
   * Extract fit hint from Zalando page
   * Looks for text like "Varen er liten" or "Varen er stor"
   */
  private extractFitHint(): string | null {
    try {
      // Look for fit hint in the "Passform" section
      const passformSection = document.body.textContent || '';
      
      if (passformSection.includes('Varen er liten') || passformSection.includes('liten i størrelsen')) {
        console.log("PerFit [Zalando]: Fit hint detected - Item runs SMALL");
        return 'liten';
      }
      
      if (passformSection.includes('Varen er stor') || passformSection.includes('stor i størrelsen')) {
        console.log("PerFit [Zalando]: Fit hint detected - Item runs LARGE");
        return 'stor';
      }
      
      console.log("PerFit [Zalando]: No specific fit hint found (true to size assumed)");
      return null;
    } catch (error) {
      console.error("PerFit [Zalando]: Error extracting fit hint:", error);
      return null;
    }
  }

  /**
   * Scrape text-based measurements from 'Passform' section
   * Fallback when size tables are not available
   * 
   * UPGRADED: More robust DOM search and flexible regex patterns
   */
  private scrapeTextMeasurements(): TextMeasurement | null {
    try {
      console.log("PerFit [Zalando]: Attempting text-based measurement extraction...");
      
      let text = '';
      
      // Strategy 1: Try Passform accordion (most specific)
      const passformSection = document.querySelector('[data-testid="pdp-accordion-passform"]');
      if (passformSection) {
        text = passformSection.textContent || '';
        console.log("PerFit [Zalando]: Found Passform section");
      }
      
      // Strategy 2: Fallback to broader product description area
      if (!text || text.length < 50) {
        console.log("PerFit [Zalando]: Passform section empty/missing, searching product details...");
        const productDetails = document.querySelector('[data-testid="pdp-product-description"]') ||
                              document.querySelector('.pdp-description') ||
                              document.querySelector('#product-detail');
        
        if (productDetails) {
          text = productDetails.textContent || '';
          console.log("PerFit [Zalando]: Using product details section");
        }
      }
      
      // Strategy 3: Last resort - search document body (first 2000 chars for performance)
      if (!text || text.length < 50) {
        console.log("PerFit [Zalando]: Searching entire page body (first 2000 chars)...");
        text = (document.body.innerText || document.body.textContent || '').substring(0, 2000);
      }
      
      // Log text sample for debugging
      const textSample = text.substring(0, 300).replace(/\s+/g, ' ');
      console.log("PerFit [Zalando]: Analyzing text for model info:", textSample);
      
      const measurement: Partial<TextMeasurement> = { modelSize: '' };
      
      // UPGRADED REGEX: Extract model height with flexible pattern
      // Handles: "Modellhøyde: 187 cm", "Modellen er 189 cm", "Model: 185cm", etc.
      const heightMatch = text.match(/(?:Modell(?:høyde|en)?|Høyde|Model)[:\s]*(?:er)?[\s\w]*?(\d{3})\s*cm/i);
      if (heightMatch) {
        measurement.modelHeight = parseInt(heightMatch[1]);
        console.log(`PerFit [Zalando]: ✅ Model height extracted: ${measurement.modelHeight}cm`);
      } else {
        console.warn("PerFit [Zalando]: ⚠️ Could not extract model height from text");
      }
      
      // UPGRADED REGEX: Extract model size with more flexible pattern
      // Handles: "størrelse M", "Size M", "str. L", etc.
      const sizeMatch = text.match(/(?:størrelse|size|str\.?)\s+([A-Z0-9]{1,3})/i);
      if (sizeMatch) {
        measurement.modelSize = sizeMatch[1].toUpperCase();
        console.log(`PerFit [Zalando]: ✅ Model size extracted: ${measurement.modelSize}`);
      } else {
        console.warn("PerFit [Zalando]: ⚠️ Could not extract model size from text");
      }
      
      // UPGRADED REGEX: Extract item length with flexible pattern
      // Handles: "Totallengde: 69 cm i størrelse M", "Length: 70cm size L", etc.
      const lengthMatch = text.match(/(?:Total)?(?:lengde|length)[:\s]+(\d{2,3})\s*cm\s+(?:i\s+)?(?:størrelse|size)\s+([A-Z0-9]{1,3})/i);
      if (lengthMatch) {
        measurement.itemLength = parseInt(lengthMatch[1]);
        measurement.itemLengthSize = lengthMatch[2].toUpperCase();
        console.log(`PerFit [Zalando]: ✅ Item length extracted: ${measurement.itemLength}cm in size ${measurement.itemLengthSize}`);
      }
      
      // Require at least model size for valid measurement
      if (!measurement.modelSize) {
        console.warn("PerFit [Zalando]: ❌ Could not extract model size - aborting text-based measurement");
        return null;
      }
      
      console.log("PerFit [Zalando]: ✅ Text measurement extraction complete:", measurement);
      return measurement as TextMeasurement;
    } catch (error) {
      console.error("PerFit [Zalando]: Error scraping text measurements:", error);
      return null;
    }
  }

  /**
   * Scrape all available sizes from Zalando's size selector dropdown
   * Simplified - just click, wait, scrape
   */
  private async scrapeDropdownSizes(): Promise<string[]> {
    const trigger = document.querySelector('[data-testid="pdp-size-picker-trigger"]') as HTMLElement;
    if (!trigger) {
      console.warn("PerFit [Zalando]: Could not find size picker trigger");
      return [];
    }

    try {
      console.log("PerFit [Zalando]: Scraping dropdown sizes...");
      
      // Check if menu is already open to avoid double-toggle
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      if (!isExpanded) {
        console.log("PerFit [Zalando]: Opening dropdown...");
        trigger.click();
      }
      
      // Polling: Check every 100ms for up to 2 seconds for React portal to appear
      const sizes = await new Promise<string[]>((resolve) => {
        let attempts = 0;
        const maxAttempts = 20; // 20 * 100ms = 2000ms
        
        const interval = setInterval(() => {
          // Search broadly for both test-id and ARIA roles
          const items = document.querySelectorAll('[data-testid="pdp-size-item"], [role="option"]');
          
          if (items.length > 0 || attempts >= maxAttempts) {
            clearInterval(interval);
            
            if (items.length > 0) {
              console.log(`PerFit [Zalando]: Found ${items.length} size options after ${(attempts + 1) * 100}ms`);
            } else {
              console.warn("PerFit [Zalando]: No size options found after polling");
            }
            
            const found = Array.from(items)
              .map(el => {
                const text = el.textContent?.trim() || "";
                // Extract size like "42", "42 2/3", "43 1/3"
                const match = text.match(/^(\d+(?:\s+\d+\/\d+)?)/);
                return match ? match[1] : text;
              })
              .filter(t => t && /^\d+/.test(t) && !t.includes('Varsle') && !t.includes('påminnelse'));
            
            resolve(found);
          }
          attempts++;
        }, 100);
      });
      
      console.log(`PerFit [Zalando]: Extracted sizes:`, sizes);

      // Close dropdown if we opened it
      if (!isExpanded) {
        trigger.click();
        await delay(200);
      }

      // Return unique sizes (deduplicate)
      return Array.from(new Set(sizes));
    } catch (error) {
      console.error("PerFit [Zalando]: Error scraping dropdown sizes:", error);
      return [];
    }
  }

  /**
   * Get fit hint for current product (Zalando-specific)
   */
  getFitHint(): string | null {
    if (this.fitHint === null) {
      this.fitHint = this.extractFitHint();
    }
    return this.fitHint;
  }

  /**
   * Check if current page is a Zalando product page
   */
  canHandle(): boolean {
    const url = window.location.href.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    
    // Sjekker om vi er på Zalando
    const isZalando = url.includes("zalando.no") || url.includes("zalando.com");
    
    // Sjekker om det faktisk er en vare:
    // 1. Må ende på .html
    // 2. Må ikke være forsiden (-home)
    // 3. Må ikke være en ren kategoriside (/herre, /dame, /barn)
    const isProductPage = path.endsWith(".html") && 
                          !path.includes("-home") && 
                          path.length > 20; // Produktsider har som regel lange navn

    return isZalando && isProductPage;
  }

  /**
   * Open Zalando's size guide - Simplified
   */
  async openSizeGuide(): Promise<boolean> {
    try {
      console.log("PerFit [Zalando]: Opening size guide...");

      // Find "Passform" button
      const passformSpan = findElementByText("span", "Passform");
      if (!passformSpan) {
        console.error("PerFit [Zalando]: Could not find 'Passform' button");
        return false;
      }

      const passformButton = passformSpan.closest("button") || passformSpan;
      const isExpanded = passformButton.getAttribute('aria-expanded') === 'true';
      
      if (!isExpanded) {
        console.log("PerFit [Zalando]: Clicking 'Passform'...");
        (passformButton as HTMLElement).click();
        await delay(1000);
      }

      // Find "Åpne størrelsestabell" button with fallbacks
      let openTableSpan = findElementByText("span", "Åpne størrelsestabell");
      
      // Fallback 1: Try "størrelsesguide"
      if (!openTableSpan) {
        console.log("PerFit [Zalando]: Trying fallback 'størrelsesguide'...");
        openTableSpan = findElementByText("span", "størrelsesguide");
      }
      
      // Fallback 2: Try just "tabell"
      if (!openTableSpan) {
        console.log("PerFit [Zalando]: Trying fallback 'tabell'...");
        openTableSpan = findElementByText("span", "tabell");
      }
      
      if (!openTableSpan) {
        console.error("PerFit [Zalando]: Could not find size guide button (tried: 'Åpne størrelsestabell', 'størrelsesguide', 'tabell')");
        return false;
      }

      console.log("PerFit [Zalando]: Found size guide button, clicking...");
      const openTableButton = openTableSpan.closest("button") || openTableSpan;
      (openTableButton as HTMLElement).click();

      await delay(1500);
      console.log("PerFit [Zalando]: Size guide opened");
      return true;

    } catch (error) {
      console.error("PerFit [Zalando]: Error opening size guide:", error);
      return false;
    }
  }

  /**
   * Scrape size data from Zalando's size table
   * 
   * Zalando-specific logic for finding the right table:
   * - Table 1: Garment measurements (Plaggets mål)
   * - Table 2: Body measurements (Kroppsmål) ← We want this one for clothing
   * - Shoe table: Size conversion table with EU, UK, US, Fotlengde
   */
  async scrapeTableData(): Promise<SizeRow[]> {
    try {
      console.log("PerFit [Zalando]: Starting to scrape size table...");

      // Find all tables on the page
      const tables = document.querySelectorAll('table');
      let bodyMeasureTable: HTMLTableElement | undefined;
      let detectedCategory: 'top' | 'bottom' | 'shoes' | 'unknown' = 'unknown';

      // For shoes, prioritize tables with "Fotlengde" or "Skostørrelse"
      // For clothing, look for "Kroppsmål"
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i] as HTMLTableElement;
        const tableText = table.textContent || '';
        
        // Check if this is a shoe table
        if (tableText.includes("Fotlengde") || tableText.includes("Skostørrelse")) {
          bodyMeasureTable = table;
          this.activeTable = table;
          detectedCategory = 'shoes';
          console.log(`PerFit [Zalando]: Found shoe size table (table ${i + 1}/${tables.length})`);
          break;
        }
        
        // Check if this is a clothing body measurements table
        if (tableText.includes("Kroppsmål")) {
          bodyMeasureTable = table;
          this.activeTable = table;
          console.log(`PerFit [Zalando]: Found 'Kroppsmål' table (table ${i + 1}/${tables.length})`);
          // Don't break yet - keep looking for shoe tables
        }
      }

      if (!bodyMeasureTable) {
        console.warn("PerFit [Zalando]: No size table found, trying text-based extraction...");
        const textData = this.scrapeTextMeasurements();
        
        if (textData) {
          // Store text data for recommendation engine
          this.textMeasurement = textData;
          console.log("PerFit [Zalando]: ✅ Text-based measurements extracted successfully");
          // Return empty array to signal text-based mode to recommendation engine
          return [];
        }
        
        console.error("PerFit [Zalando]: Could not find size table or extract text measurements");
        return [];
      }

      // ALWAYS scrape text measurements for model height (even when table exists)
      // This enables length/height analysis for ALL products
      console.log("PerFit [Zalando]: Scraping text measurements for length analysis...");
      const textData = this.scrapeTextMeasurements();
      if (textData) {
        this.textMeasurement = textData;
        console.log("PerFit [Zalando]: ✅ Model info extracted for length analysis:", textData);
      }

      // If we didn't detect shoes from table content, check headers
      if (detectedCategory !== 'shoes') {
        detectedCategory = this.getTableCategory();
      }
      
      console.log(`PerFit [Zalando]: Detected category: ${detectedCategory}`);

      // Dynamically identify column indices by reading headers
      const headerCells = bodyMeasureTable.querySelectorAll('thead th');
      const headers: string[] = [];
      headerCells.forEach(th => {
        headers.push(th.textContent?.trim().toLowerCase() || '');
      });

      console.log("PerFit [Zalando]: Table headers:", headers);

      // Use base class scraping methods
      if (detectedCategory === 'shoes') {
        // Get dropdown sizes for interpolation (now async)
        const dropdownSizes = await this.scrapeDropdownSizes();
        return this.scrapeShoeSizeTable(bodyMeasureTable, headers, dropdownSizes);
      }

      // For clothing, use base class method
      return this.scrapeClothingSizeTable(bodyMeasureTable, headers);

    } catch (error) {
      console.error("PerFit [Zalando]: Error scraping table data:", error);
      return [];
    }
  }
}

/**
 * Create and export a singleton instance
 */
export const zalandoProvider = new ZalandoProvider();
