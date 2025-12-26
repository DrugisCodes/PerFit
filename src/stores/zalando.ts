/**
 * Zalando Store Provider
 * 
 * Implements Zalando-specific integration.
 * Generic table scraping logic is in BaseStoreProvider.
 * Text parsing logic is in zalando-parser.ts.
 */

import { SizeRow, TextMeasurement } from './types';
import { BaseStoreProvider } from './BaseStoreProvider';
import { delay, findElementByText } from '../utils/dom';
import { extractFitHint, scrapeTextMeasurements } from './zalando-parser';

/**
 * ZalandoProvider - Handles Zalando.no integration
 */
export class ZalandoProvider extends BaseStoreProvider {
  name = "Zalando";
  private fitHint: string | null = null;
  public textMeasurement: TextMeasurement | null = null;
  public dropdownSizes: string[] = []; // Store available sizes from dropdown

  /**
   * Extract fit hint from Zalando page (delegates to parser)
   */
  private extractFitHint(): string | null {
    return extractFitHint();
  }

  /**
   * Scrape text-based measurements from 'Passform' section (delegates to parser)
   * Fallback when size tables are not available
   */
  private scrapeTextMeasurements(): TextMeasurement | null {
    return scrapeTextMeasurements();
  }

  /**
   * Scrape all available sizes from Zalando's size selector dropdown
   * Enhanced scraping with select element fallback
   */
  private async scrapeDropdownSizes(): Promise<string[]> {
    const allSizes: string[] = [];
    
    // === METHOD 1: Standard size picker trigger (most common) ===
    const trigger = document.querySelector('[data-testid="pdp-size-picker-trigger"]') as HTMLElement;
    
    if (trigger) {
      try {
        console.log("PerFit [Zalando]: Scraping dropdown sizes via trigger...");
        
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
                .filter(t => t && (/^\d+/.test(t) || /^\d+x\d+$/.test(t)));
              
              resolve(found);
            }
            attempts++;
          }, 100);
        });
        
        allSizes.push(...sizes);
        console.log(`PerFit [Zalando]: Extracted ${sizes.length} sizes from trigger`);

        // Close dropdown if we opened it
        if (!isExpanded) {
          trigger.click();
          await delay(200);
        }
      } catch (error) {
        console.error("PerFit [Zalando]: Error scraping trigger dropdown:", error);
      }
    }

    // === METHOD 2: Fallback to <select> elements ===
    const selectElements = document.querySelectorAll('select');
    if (selectElements.length > 0) {
      console.log(`PerFit [Zalando]: Checking ${selectElements.length} select elements...`);
      
      selectElements.forEach(select => {
        const options = select.querySelectorAll('option');
        options.forEach(option => {
          const value = option.value?.trim() || '';
          const text = option.textContent?.trim() || '';
          
          // Extract numeric sizes from either value or text
          if (value && /^\d+/.test(value)) {
            allSizes.push(value);
          } else if (text && /^\d+/.test(text)) {
            // Extract just the numeric part (e.g., "43 1/3" from "43 1/3 - Varsle meg")
            const match = text.match(/(\d+(?:\s+\d+\/\d+)?)/);
            if (match) {
              allSizes.push(match[1].trim());
            }
          }
        });
      });
    }

    // === METHOD 3: Fallback to size buttons ===
    const sizeButtons = document.querySelectorAll('[data-testid*="size"], [class*="size"], button[aria-label*="størrelse"]');
    sizeButtons.forEach(button => {
      const sizeText = button.textContent?.trim() || '';
      if (sizeText && /^\d+/.test(sizeText)) {
        // Extract just the numeric part
        const match = sizeText.match(/(\d+(?:\s+\d+\/\d+)?)/);
        if (match) {
          allSizes.push(match[1].trim());
        }
      }
    });

    // === CLEANUP: Deduplicate, filter, and sort ===
    const uniqueSizes = Array.from(new Set(allSizes))
      // Filter out notification texts
      .filter(s => !s.toLowerCase().includes('varsle') && !s.toLowerCase().includes('påminnelse'))
      // Sort numerically
      .sort((a, b) => {
        const aNum = parseFloat(a.replace(',', '.').replace(/\s+\d+\/\d+/, ''));
        const bNum = parseFloat(b.replace(',', '.').replace(/\s+\d+\/\d+/, ''));
        return aNum - bNum;
      });

    console.log(`PerFit [Zalando]: Final extracted sizes (${uniqueSizes.length}):`, uniqueSizes);
    return uniqueSizes;
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
