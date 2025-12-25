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
  isAnkleLength?: boolean;   // Whether item is designed as ankle length
  fitHint?: string;          // Fit hint: 'liten' or 'stor' (small/large)
}

/**
 * ZalandoProvider - Handles Zalando.no integration
 */
export class ZalandoProvider extends BaseStoreProvider {
  name = "Zalando";
  private fitHint: string | null = null;
  public textMeasurement: TextMeasurement | null = null;
  public dropdownSizes: string[] = []; // Store available sizes from dropdown

  /**
   * Extract fit hint from Zalando page
   * Looks for text like "Varen er liten" or "Varen er stor" with flexible regex matching
   * 
   * PRIORITY ORDER:
   * 1. Passform section (highest priority)
   * 2. Product description areas
   * 3. Body fallback (STRICT - must have context words very close to 'stor'/'liten')
   */
  private extractFitHint(): string | null {
    try {
      // 1. HØYESTE PRIORITET: Passform-seksjonen (accordion)
      const passformAccordion = document.querySelector('[data-testid="pdp-accordion-passform"]');
      if (passformAccordion) {
        const text = passformAccordion.textContent?.toLowerCase() || '';
        
        if (/(størrelsen|varen|modellen|anbefaler).*liten|liten.*(størrelsen|varen|størrelse|anbefal)/i.test(text)) {
          console.log(`PerFit [Zalando]: ✅ Fit hint detected (Passform section) - Item runs SMALL`);
          console.log(`PerFit [Zalando]: Funnet tekst: "${passformAccordion.textContent?.trim()}"`);
          return 'liten';
        }
        
        if (/(størrelsen|varen|modellen|anbefaler).*stor|stor.*(størrelsen|varen|størrelse|anbefal)/i.test(text)) {
          console.log(`PerFit [Zalando]: ✅ Fit hint detected (Passform section) - Item runs LARGE`);
          console.log(`PerFit [Zalando]: Funnet tekst: "${passformAccordion.textContent?.trim()}"`);
          return 'stor';
        }
      }
      
      // 2. SEKUNDÆR PRIORITET: Målrettede passform-elementer (klasse .HlZ_Tf)
      const passformElements = document.querySelectorAll('.HlZ_Tf, [class*="passform"], [class*="fit-hint"]');
      
      for (const element of passformElements) {
        const text = element.textContent?.toLowerCase() || '';
        
        if (/(størrelsen|varen|modellen|anbefaler).*liten|liten.*(størrelsen|varen|størrelse|anbefal)/i.test(text)) {
          console.log(`PerFit [Zalando]: ✅ Fit hint detected (fit element) - Item runs SMALL`);
          console.log(`PerFit [Zalando]: Funnet tekst: "${element.textContent?.trim()}"`);
          return 'liten';
        }
        
        if (/(størrelsen|varen|modellen|anbefaler).*stor|stor.*(størrelsen|varen|størrelse|anbefal)/i.test(text)) {
          console.log(`PerFit [Zalando]: ✅ Fit hint detected (fit element) - Item runs LARGE`);
          console.log(`PerFit [Zalando]: Funnet tekst: "${element.textContent?.trim()}"`);
          return 'stor';
        }
      }
      
      // 3. FALLBACK: Søk i hele document.body MED STRENG BEGRENSNING
      // Krever at 'stor'/'liten' står RETT ved siden av kontekstord (maks 15 tegn mellom)
      const bodyText = document.body.textContent?.toLowerCase() || '';
      
      // Streng regex: Maks 15 tegn mellom kontekstord og 'liten'
      if (/(størrelsen|varen|modellen|passform|anbefaler vi).{0,15}\bliten\b|\bliten\b.{0,15}(størrelsen|varen|størrelse|passform|anbefal)/i.test(bodyText)) {
        console.log("PerFit [Zalando]: ✅ Fit hint detected (body fallback - strict) - Item runs SMALL");
        return 'liten';
      }
      
      // Streng regex: Maks 15 tegn mellom kontekstord og 'stor'
      // Unngå 'stor' når det står alene uten passform-kontekst
      if (/(størrelsen|varen|modellen|passform|anbefaler vi).{0,15}\bstor\b|\bstor\b.{0,15}(størrelsen|varen|størrelse|passform|anbefal)/i.test(bodyText)) {
        console.log("PerFit [Zalando]: ✅ Fit hint detected (body fallback - strict) - Item runs LARGE");
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
        console.log("PerFit [Zalando]: No model height found in text (often not available)");
      }
      
      // UPGRADED REGEX: Extract model size with STRICT validation
      // Matches letters (S, M, L, XL) or numbers (48, 50) immediately after 'størrelse' or 'str'
      // Only accepts: S, M, L, XL, XXL, XXXL or numeric sizes (32, 48, 50)
      // REJECTS: LEG, FIT, TALL, and other non-size words
      const sizeMatch = text.match(/(?:størrelse|size|str\.?)\s*([A-Z]{1,4}|\d{2,3})(?:\s|\.|,|$)/i);
      if (sizeMatch) {
        const extractedSize = sizeMatch[1].toUpperCase();
        
        // Validate: Must be standard size (S/M/L/XL/XXL/XXXL) OR numeric (32, 48, etc.)
        const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
        const isValidSize = validSizes.includes(extractedSize) || /^\d{2,3}$/.test(extractedSize);
        
        // Reject common non-size words
        const invalidWords = ['LEG', 'FIT', 'TALL', 'SHORT', 'LANG', 'KORT', 'REGULAR', 'SLIM', 'WIDE'];
        const isInvalidWord = invalidWords.includes(extractedSize);
        
        if (isValidSize && !isInvalidWord) {
          measurement.modelSize = extractedSize;
          console.log(`PerFit [Zalando]: ✅ Model size extracted: ${measurement.modelSize}`);
        } else {
          console.warn(`PerFit [Zalando]: ⚠️ Rejected invalid size '${extractedSize}' - not a standard clothing size`);
          console.log(`PerFit [Zalando]: Valid sizes: ${validSizes.join(', ')}, or numeric (32-999)`);
        }
      } else {
        console.log("PerFit [Zalando]: ⚠️ Could not extract model size from text (will use fallback logic)");
      }
      
      // UPGRADED REGEX: Extract item length with flexible pattern
      // Handles: "Totallengde: 69 cm i størrelse M", "Length: 70cm size L", "Totallengde: 72 cm", etc.
      const lengthMatch = text.match(/(?:Total)?(?:lengde|length)[:\s]+(\d{2,3})\s*cm(?:\s+(?:i\s+)?(?:størrelse|size)\s+([A-Z0-9]{1,3}))?/i);
      if (lengthMatch) {
        measurement.itemLength = parseInt(lengthMatch[1]);
        // Size is optional - some products just say "Totallengde: 72 cm"
        if (lengthMatch[2]) {
          measurement.itemLengthSize = lengthMatch[2].toUpperCase();
          console.log(`PerFit [Zalando]: ✅ Item length extracted: ${measurement.itemLength}cm in size ${measurement.itemLengthSize}`);
        } else {
          console.log(`PerFit [Zalando]: ✅ Item length extracted: ${measurement.itemLength}cm (no specific size mentioned)`);
        }
      }
      
      // Detect ankle length items
      if (text.toLowerCase().includes('ankellengde') || text.toLowerCase().includes('ankle length')) {
        measurement.isAnkleLength = true;
        console.log("PerFit [Zalando]: ✅ Ankle length item detected");
      }
      
      // Extract fit hint if available (for text-based recommendations)
      const fitHint = this.extractFitHint();
      if (fitHint) {
        (measurement as any).fitHint = fitHint;
        const hintType = fitHint === 'liten' ? 'SMALL' : 'LARGE';
        console.log(`PerFit [Zalando]: ✅ Fit hint detected: ${hintType}`);
      }
      
      // CHANGED: No longer require modelSize - return if we have ANY useful data
      // This allows fallback logic in RecommendationEngine to use chest measurements
      const hasUsefulData = measurement.modelHeight || measurement.itemLength || measurement.modelSize;
      
      if (!hasUsefulData) {
        console.warn("PerFit [Zalando]: ❌ No useful measurement data found (no height, length, or size)");
        return null;
      }
      
      if (!measurement.modelSize) {
        console.log("PerFit [Zalando]: ⚠️ Model size missing, but returning other data (height/length) for fallback logic");
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
        // Increased wait time for React to render
        await delay(500);
      }
      
      // Polling: Check every 100ms for up to 3 seconds for React portal to appear
      const sizes = await new Promise<string[]>((resolve) => {
        let attempts = 0;
        const maxAttempts = 30; // 30 * 100ms = 3000ms (increased from 2s)
        
        const interval = setInterval(() => {
          // Expanded selectors for robustness
          const items = document.querySelectorAll(
            '[data-testid="pdp-size-item"], ' +
            '[data-testid="size-picker-list-item"], ' +
            '[role="option"], ' +
            'span.voFjEy, ' +
            'div._0xLoFW span, ' +
            'span[class*="size-label"]'
          );
          
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
                // Extract size - support WxL format (32x34), fractions (42 2/3), and regular sizes
                const wxlMatch = text.match(/(\d+)\s*x\s*(\d+)/);
                if (wxlMatch) {
                  return `${wxlMatch[1]}x${wxlMatch[2]}`; // Normalize to 32x34 format
                }
                // Extract size with improved regex for fractions (e.g., "42", "42 2/3", "43 1/3")
                const match = text.match(/(\d+(?:\s+\d+\/\d+)?)/);
                return match ? match[1].trim() : "";
              })
              .filter(t => t && (/^\d+/.test(t) || /^\d+x\d+$/.test(t)) && !t.includes('Varsle') && !t.includes('påminnelse'));
            
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
   * Returns true if Passform section exists (even if size table button is missing)
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
        console.log("PerFit [Zalando]: No size table button found - product likely uses text-based measurements only");
        // Return TRUE to allow text-based scraping to proceed
        return true;
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

      // If we didn't detect shoes from table content, check headers
      if (detectedCategory !== 'shoes') {
        detectedCategory = this.getTableCategory();
      }

      // ALWAYS scrape text measurements for model height (EXCEPT for shoes - not relevant)
      // This enables length/height analysis for clothing products
      if (detectedCategory !== 'shoes') {
        console.log("PerFit [Zalando]: Scraping text measurements for length analysis...");
        const textData = this.scrapeTextMeasurements();
        if (textData) {
          this.textMeasurement = textData;
          console.log("PerFit [Zalando]: ✅ Model info extracted for length analysis:", textData);
        }
      } else {
        console.log("PerFit [Zalando]: Skipping text measurements for shoes (not relevant)");
      }
      
      console.log(`PerFit [Zalando]: Detected category: ${detectedCategory}`);

      // Dynamically identify column indices by reading headers
      const headerCells = bodyMeasureTable.querySelectorAll('thead th');
      const headers: string[] = [];
      headerCells.forEach(th => {
        headers.push(th.textContent?.trim().toLowerCase() || '');
      });

      console.log("PerFit [Zalando]: Table headers:", headers);

      // Get dropdown sizes for all categories (needed for WxL format detection)
      this.dropdownSizes = await this.scrapeDropdownSizes();
      console.log("PerFit [Zalando]: Dropdown sizes:", this.dropdownSizes);

      // Use base class scraping methods
      if (detectedCategory === 'shoes') {
        return this.scrapeShoeSizeTable(bodyMeasureTable, headers, this.dropdownSizes);
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
