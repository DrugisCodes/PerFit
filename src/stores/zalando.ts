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
import { 
  extractFitHint, 
  scrapeTextMeasurements, 
  detectFitType, 
  extractModelSize,
  extractBrandSizeSuggestion
} from './zalando-parser';

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
          // Initial wait for dropdown to render
          await delay(400);
        }
        
        // Polling: Check every 250ms for up to 2.5 seconds for sizes to appear
        const sizes = await new Promise<string[]>((resolve) => {
          let attempts = 0;
          const maxAttempts = 10; // 10 * 250ms = 2500ms
          
          const interval = setInterval(() => {
            attempts++;
            
            // STRATEGY 1: Find dropdown container globally (React Portal can be anywhere)
            const dropdownContainer = document.querySelector('[data-testid="pdp-size-picker-dropdown"]') ||
                                      document.querySelector('[class*="SizePickerDropdown"]') ||
                                      document.querySelector('[class*="size-picker-dropdown"]') ||
                                      document.querySelector('[id*="size-picker"]') ||
                                      document.querySelector('[role="listbox"]');
            
            if (!dropdownContainer && attempts < maxAttempts) {
              console.log(`PerFit [Zalando]: Polling ${attempts}/${maxAttempts} - waiting for dropdown container...`);
              return;
            }
            
            if (!dropdownContainer) {
              clearInterval(interval);
              console.warn('PerFit [Zalando]: ⚠️ Dropdown container not found after 2.5s');
              resolve([]);
              return;
            }
            
            console.log(`PerFit [Zalando]: ✅ Container found (attempt ${attempts}):`, dropdownContainer.className || dropdownContainer.id);
            
            // STRATEGY 2: Find ALL interactive elements within container
            // Use multiple selector strategies to catch different Zalando layouts
            const itemSelectors = [
              // Common patterns
              '[data-testid*="size-picker"] button',
              '[data-testid*="size-picker"] li',
              '[data-testid="pdp-size-item"]',
              '[data-testid="size-handler-item"]',
              // Role-based
              '[role="option"]',
              '[role="radio"]',
              // Class-based (Zalando's obfuscated classes)
              'button[class*="_9"]',  // Common pattern in Zalando class names
              'li[class*="Size"]',
              // Broad fallback
              'button',
              'li',
              'label'
            ];
            
            // Try selectors in order until we find elements
            let items: NodeListOf<Element> | null = null;
            for (const selector of itemSelectors) {
              const found = dropdownContainer.querySelectorAll(selector);
              if (found.length > 0) {
                items = found;
                console.log(`PerFit [Zalando]: Found ${found.length} items with selector: "${selector}"`);
                break;
              }
            }
            
            if (!items || items.length === 0) {
              // Try one more time with direct children
              items = dropdownContainer.querySelectorAll('*');
              console.log(`PerFit [Zalando]: Fallback to all children: ${items.length} elements`);
            }
            
            console.log(`PerFit [Zalando]: Total elements to scan: ${items.length}`);
            
            // Extract sizes from ALL elements
            const extractedSizes: string[] = [];
            const seenSizes = new Set<string>();
            let debugCount = 0;
            
            items.forEach(el => {
              const text = el.textContent?.trim() || '';
              
              // DEBUGGING: Log first 10 elements to diagnose
              if (debugCount < 10) {
                console.log(`PerFit [Zalando]: Scanning element [${debugCount}]: "${text}" (tag: ${el.tagName})`);
                debugCount++;
              }
              
              // Skip empty, navigation, or header text
              if (!text || 
                  text.length === 0 || 
                  text.includes('Velg') || 
                  text.toLowerCase().includes('størrelse') ||
                  text.toLowerCase().includes('size') && text.length > 15) {
                return;
              }
              
              // MATCH 1: WxL format (32/32, 32x32)
              const wxlMatch = text.match(/(\d{2})\s*[x\/×]\s*(\d{2})/i);
              if (wxlMatch) {
                const size = `${wxlMatch[1]}/${wxlMatch[2]}`;
                if (!seenSizes.has(size)) {
                  extractedSizes.push(size);
                  seenSizes.add(size);
                  console.log(`PerFit [Zalando]: ✓ Matched WxL: ${size}`);
                }
                return;
              }
              
              // MATCH 2: Pure numbers (30, 31, 32) - MOST COMMON for jeans
              const pureNumberMatch = text.match(/^\d{2,3}$/);
              if (pureNumberMatch) {
                if (!seenSizes.has(text)) {
                  extractedSizes.push(text);
                  seenSizes.add(text);
                  console.log(`PerFit [Zalando]: ✓ Matched number: ${text}`);
                }
                return;
              }
              
              // MATCH 3: Numbers with stock status ("32 - 3 left")
              const numberWithStockMatch = text.match(/^(\d{2,3})\s*[-–—]/);
              if (numberWithStockMatch) {
                const size = numberWithStockMatch[1];
                if (!seenSizes.has(size)) {
                  extractedSizes.push(size);
                  seenSizes.add(size);
                  console.log(`PerFit [Zalando]: ✓ Matched with stock: ${size}`);
                }
                return;
              }
              
              // MATCH 4: Letter sizes (S, M, L, XL)
              const letterMatch = text.match(/^(XXS|XS|S|M|L|XL|XXL|XXXL)$/i);
              if (letterMatch) {
                const size = letterMatch[1].toUpperCase();
                if (!seenSizes.has(size)) {
                  extractedSizes.push(size);
                  seenSizes.add(size);
                  console.log(`PerFit [Zalando]: ✓ Matched letter: ${size}`);
                }
                return;
              }
              
              // MATCH 5: Numbers embedded in text (but avoid measurements)
              if (text.length < 20 && !text.includes('cm') && !text.includes('kr') && !text.includes('NOK')) {
                const numberMatch = text.match(/\b(\d{2,3})\b/);
                if (numberMatch) {
                  const size = numberMatch[1];
                  const num = parseInt(size);
                  // Reasonable jeans size range
                  if (num >= 28 && num <= 42 && !seenSizes.has(size)) {
                    extractedSizes.push(size);
                    seenSizes.add(size);
                    console.log(`PerFit [Zalando]: ✓ Matched embedded number: ${size}`);
                  }
                }
              }
            });
            
            console.log(`PerFit [Zalando]: 📦 Extracted ${extractedSizes.length} sizes:`, extractedSizes);
            
            // Success if we found sizes, or timeout reached
            if (extractedSizes.length > 0 || attempts >= maxAttempts) {
              clearInterval(interval);
              resolve(extractedSizes);
            }
          }, 250);
        });
        
        allSizes.push(...sizes);
        console.log(`PerFit [Zalando]: Extracted ${sizes.length} sizes from dropdown`);

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
      // ULTRA-STRICT: Max 8 characters (eliminates all IDs, prices, descriptions)
      .filter(s => {
        const cleaned = s.trim();
        // First check: Must be max 8 characters (handles WxL like "32x32" and fractions like "42 2/3")
        if (cleaned.length > 8) return false;
        
        // Must contain either numbers OR valid letter sizes
        const hasNumbers = /\d/.test(cleaned);
        const isLetterSize = /^(XS|S|M|L|XL|XXL|XXXL)$/i.test(cleaned);
        
        if (!hasNumbers && !isLetterSize) return false;
        
        // Accept letter sizes: XS, S, M, L, XL, XXL, XXXL
        if (isLetterSize) return true;
        // Accept numeric sizes: 28-40 (common jeans waist range)
        const num = parseInt(cleaned);
        if (!isNaN(num) && num >= 28 && num <= 40) return true;
        // Accept WxL format: 32x32, 31x34, 32/30, etc. (both 'x' and '/' supported)
        if (/^\d{2}\s*[xX×\/]\s*\d{2}$/.test(cleaned)) return true;
        // Accept shoe sizes with fractions (e.g., "43 1/3")
        if (/^\d{2}\s+\d+\/\d+$/.test(cleaned)) return true;
        // Reject everything else
        return false;
      })
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
          // Add fit type detection
          textData.fit = detectFitType();
          console.log(`PerFit [Zalando]: Detected fit type: ${textData.fit}`);
          
          // Add model size extraction
          textData.modelSize = extractModelSize() || undefined;
          if (textData.modelSize) {
            console.log(`PerFit [Zalando]: Model wears size: ${textData.modelSize}`);
          }
          
          // Add brand size suggestion
          textData.brandSizeSuggestion = extractBrandSizeSuggestion();
          if (textData.brandSizeSuggestion !== 0) {
            console.log(`PerFit [Zalando]: Brand suggests ${textData.brandSizeSuggestion > 0 ? 'sizing UP' : 'sizing DOWN'}`);
          }
          
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
      if (detectedCategory !== 'shoes' && !this.textMeasurement) {
        console.log("PerFit [Zalando]: Scraping text measurements for length analysis...");
        const textData = this.scrapeTextMeasurements();
        if (textData) {
          // Add fit type detection
          textData.fit = detectFitType();
          console.log(`PerFit [Zalando]: Detected fit type: ${textData.fit}`);
          
          // Add model size extraction
          textData.modelSize = extractModelSize() || undefined;
          if (textData.modelSize) {
            console.log(`PerFit [Zalando]: Model wears size: ${textData.modelSize}`);
          }
          
          // Add brand size suggestion (single call, avoid duplicate)
          textData.brandSizeSuggestion = extractBrandSizeSuggestion();
          if (textData.brandSizeSuggestion !== 0) {
            console.log(`PerFit [Zalando]: Brand suggests ${textData.brandSizeSuggestion > 0 ? 'sizing UP' : 'sizing DOWN'}`);
          }
          
          this.textMeasurement = textData;
          console.log("PerFit [Zalando]: ✅ Model info extracted for length analysis:", textData);
        }
      } else if (detectedCategory === 'shoes') {
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
      
      // FALLBACK: If dropdown scraping failed, extract sizes from size guide table
      if (this.dropdownSizes.length === 0 && bodyMeasureTable) {
        console.log("PerFit [Zalando]: 🔄 Dropdown empty - extracting sizes from size guide table as fallback");
        const fallbackSizes: string[] = [];
        
        // Get first column (size column) from table
        const rows = bodyMeasureTable.querySelectorAll('tr');
        rows.forEach((row, index) => {
          if (index === 0) return; // Skip header
          const firstCell = row.querySelector('td');
          if (firstCell) {
            const sizeText = firstCell.textContent?.trim() || '';
            if (sizeText) {
              // Extract WxL format (32/32)
              const wxlMatch = sizeText.match(/(\d{2})\s*[\/x×]\s*(\d{2})/i);
              if (wxlMatch) {
                fallbackSizes.push(`${wxlMatch[1]}/${wxlMatch[2]}`);
              }
              // Extract pure numbers (32)
              else if (/^\d{2,3}$/.test(sizeText)) {
                fallbackSizes.push(sizeText);
              }
              // Extract letter sizes (M, L)
              else if (/^(XXS|XS|S|M|L|XL|XXL|XXXL)$/i.test(sizeText)) {
                fallbackSizes.push(sizeText.toUpperCase());
              }
            }
          }
        });
        
        if (fallbackSizes.length > 0) {
          this.dropdownSizes = fallbackSizes;
          console.log(`PerFit [Zalando]: ✅ Fallback successful - extracted ${fallbackSizes.length} sizes from table:`, fallbackSizes);
        } else {
          console.warn("PerFit [Zalando]: ⚠️ Both dropdown and table fallback failed to extract sizes");
        }
      }

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
