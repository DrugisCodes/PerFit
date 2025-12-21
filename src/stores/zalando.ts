/**
 * Zalando Store Provider
 * 
 * Implements the StoreProvider interface for Zalando.no
 * Handles size guide automation and table scraping for Zalando.
 */

import { StoreProvider, SizeRow } from './types';

/**
 * Helper function to wait/delay execution
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Find DOM elements by text content using XPath
 * This is more robust than class-based selectors that can change
 */
function findElementByText(tag: string, text: string): HTMLElement | null {
  const xpath = `//${tag}[contains(text(), '${text}')]`;
  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  return result.singleNodeValue as HTMLElement;
}

/**
 * ZalandoProvider - Handles Zalando.no integration
 */
export class ZalandoProvider implements StoreProvider {
  name = "Zalando";
  private activeTable: HTMLTableElement | null = null;

  /**
   * Check if current page is a Zalando product page
   */
  canHandle(): boolean {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    // Match zalando domains and product page pattern (.html extension)
    return (
      (hostname.includes('zalando.no') || hostname.includes('zalando.com')) &&
      pathname.endsWith('.html')
    );
  }

  /**
   * Open Zalando's size guide
   * 
   * Steps:
   * 1. Find and click "Passform" accordion button
   * 2. Wait for accordion to expand
   * 3. Find and click "Åpne størrelsestabell" button
   * 4. Wait for modal to open
   */
  async openSizeGuide(): Promise<boolean> {
    try {
      console.log("PerFit [Zalando]: Attempting to open size guide...");

      // --- STEP 1: Find and click "Passform" ---
      const passformSpan = findElementByText("span", "Passform");

      if (!passformSpan) {
        console.error("PerFit [Zalando]: Could not find 'Passform' button");
        return false;
      }

      // Click the button (or closest clickable parent)
      const passformButton = passformSpan.closest("button") || passformSpan;
      
      // Check if already expanded
      const isExpanded = passformButton.getAttribute('aria-expanded') === 'true';
      
      if (!isExpanded) {
        console.log("PerFit [Zalando]: Clicking 'Passform' to expand accordion...");
        (passformButton as HTMLElement).click();
        await delay(1500); // Wait for accordion animation
      } else {
        console.log("PerFit [Zalando]: 'Passform' already expanded");
      }

      // --- STEP 2: Find and click "Åpne størrelsestabell" ---
      const openTableSpan = findElementByText("span", "Åpne størrelsestabell");

      if (!openTableSpan) {
        console.error("PerFit [Zalando]: Could not find 'Åpne størrelsestabell' button");
        return false;
      }

      console.log("PerFit [Zalando]: Clicking 'Åpne størrelsestabell' to open modal...");
      const openTableButton = openTableSpan.closest("button") || openTableSpan;
      (openTableButton as HTMLElement).click();

      // Wait for modal to open and render
      await delay(2500);

      console.log("PerFit [Zalando]: Size guide should now be open!");
      return true;

    } catch (error) {
      console.error("PerFit [Zalando]: Error opening size guide:", error);
      return false;
    }
  }

  /**
   * Detect garment category based on table headers
   * 
   * @param headers - Array of header text content
   * @returns Category type: 'top' | 'bottom' | 'shoes' | 'unknown'
   */
  detectCategory(headers: string[]): 'top' | 'bottom' | 'shoes' | 'unknown' {
    const h = headers.join(' ').toLowerCase();
    
    // Shoes: Look for foot length or shoe size
    if (h.includes('fotlengde') || h.includes('skostørrelse') || h.includes('foot length')) {
      return 'shoes';
    }
    
    // Bottoms: Look for inseam or waist-dominant measurements
    if (h.includes('innerbenslengde') || h.includes('inseam') || 
        (h.includes('midjevidde') && !h.includes('brystvidde'))) {
      return 'bottom';
    }
    
    // Tops: Look for chest measurements
    if (h.includes('brystvidde') || h.includes('chest') || h.includes('bust')) {
      return 'top';
    }
    
    return 'unknown';
  }

  /**
   * Get category from the active table
   */
  getTableCategory(): 'top' | 'bottom' | 'shoes' | 'unknown' {
    if (!this.activeTable) return 'unknown';
    
    const headers = Array.from(this.activeTable.querySelectorAll('thead th'))
      .map(th => th.textContent?.trim() || '');
    
    return this.detectCategory(headers);
  }

  /**
   * Scrape size data from Zalando's "Kroppsmål" table
   * 
   * Zalando typically has multiple tables:
   * - Table 1: Garment measurements (Plaggets mål)
   * - Table 2: Body measurements (Kroppsmål) ← We want this one
   * 
   * Table structure varies by garment type:
   * Tops:    | EU | INT | Brystvidde | Midjevidde | Hoftemål |
   * Bottoms: | EU | INT | Midjevidde | Hoftemål | Innerbenslengde |
   */
  scrapeTableData(): SizeRow[] {
    try {
      console.log("PerFit [Zalando]: Starting to scrape 'Kroppsmål' table...");

      // Find all tables on the page
      const tables = document.querySelectorAll('table');
      let bodyMeasureTable: HTMLTableElement | undefined;

      // Find the table that contains "Kroppsmål" (body measurements)
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i] as HTMLTableElement;
        if (table.textContent?.includes("Kroppsmål")) {
          bodyMeasureTable = table;
          this.activeTable = table; // Store reference for highlighting
          console.log(`PerFit [Zalando]: Found 'Kroppsmål' table (table ${i + 1}/${tables.length})`);
          
          // Log detected category
          const category = this.getTableCategory();
          console.log(`PerFit [Zalando]: Detected category: ${category}`);
          break;
        }
      }

      if (!bodyMeasureTable) {
        console.error("PerFit [Zalando]: Could not find 'Kroppsmål' table");
        return [];
      }

      // Dynamically identify column indices by reading headers
      const headerCells = bodyMeasureTable.querySelectorAll('thead th');
      const headers: string[] = [];
      headerCells.forEach(th => {
        headers.push(th.textContent?.trim().toLowerCase() || '');
      });

      console.log("PerFit [Zalando]: Table headers:", headers);

      // Find column indices (case-insensitive)
      let intSizeIndex = -1;
      let chestIndex = -1;
      let waistIndex = -1;
      let hipIndex = -1;

      headers.forEach((header, index) => {
        // INT size column (S, M, L, XL, etc.)
        if (header === 'int' || header.includes('størrelse')) {
          intSizeIndex = index;
        }
        // Chest column
        else if (header.includes('brystvidde') || header.includes('chest') || header.includes('bust')) {
          chestIndex = index;
        }
        // Waist column (multiple possible names)
        else if (header.includes('midjevidde') || header.includes('livvidde') || header.includes('waist')) {
          waistIndex = index;
        }
        // Hip column (multiple possible names)
        else if (header.includes('hoftemål') || header.includes('hoftevidde') || 
                 header.includes('setevidde') || header.includes('hip')) {
          hipIndex = index;
        }
      });

      console.log(`PerFit [Zalando]: Column mapping - INT:${intSizeIndex}, Chest:${chestIndex}, Waist:${waistIndex}, Hip:${hipIndex}`);

      // Validate that we found the essential columns
      if (intSizeIndex === -1) {
        console.error("PerFit [Zalando]: Could not find INT size column");
        return [];
      }

      // Parse table rows
      const rows = bodyMeasureTable.querySelectorAll('tbody tr');
      const sizeData: SizeRow[] = [];

      rows.forEach((row: Element, rowIndex: number) => {
        const cells = row.querySelectorAll('td');
        
        if (cells.length > intSizeIndex) {
          const intSize = cells[intSizeIndex].textContent?.trim() || "";
          
          // Extract measurements (default to 0 if column not found)
          const chestValue = chestIndex !== -1 ? 
            parseInt(cells[chestIndex].textContent?.trim() || "0") : 0;
          const waistValue = waistIndex !== -1 ? 
            parseInt(cells[waistIndex].textContent?.trim() || "0") : 0;
          const hipValue = hipIndex !== -1 ? 
            parseInt(cells[hipIndex].textContent?.trim() || "0") : 0;

          // Validation: Check if hip is suspiciously smaller than waist
          if (hipValue > 0 && waistValue > 0 && hipValue < waistValue - 10) {
            console.warn(`PerFit [Zalando]: Row ${rowIndex} - Hip (${hipValue}cm) is significantly smaller than waist (${waistValue}cm). Possible column misalignment!`);
          }

          // For bottoms (no chest measurement), we need at least waist
          // For tops, we need at least chest
          const hasValidData = (chestValue > 0) || (waistValue > 0);

          if (intSize && hasValidData) {
            sizeData.push({
              intSize,
              chest: chestValue,
              waist: waistValue,
              hip: hipValue,
              rowIndex: rowIndex
            });
          }
        }
      });

      console.log(`PerFit [Zalando]: Scraped ${sizeData.length} size entries:`, sizeData);

      // Additional validation: Check first entry for sanity
      if (sizeData.length > 0) {
        const first = sizeData[0];
        if (first.hip > 0 && first.waist > 0 && first.hip < first.waist - 10) {
          console.warn("PerFit [Zalando]: ⚠️ WARNING - Hip measurements appear smaller than waist across the table. Column headers may be incorrectly mapped!");
        }
      }

      if (sizeData.length === 0) {
        console.warn("PerFit [Zalando]: No valid size data found in table");
      }

      return sizeData;

    } catch (error) {
      console.error("PerFit [Zalando]: Error scraping table data:", error);
      return [];
    }
  }

  /**
   * Highlight recommended size row in Zalando's size table
   * 
   * Adds visual styling to the recommended size:
   * - Light purple background
   * - Purple left border
   * - "PerFit Match" badge
   * - Smooth scroll to row
   * 
   * @param rowIndex - The index of the row to highlight
   */
  highlightRow(rowIndex: number): void {
    if (!this.activeTable) {
      console.warn("PerFit [Zalando]: No active table to highlight");
      return;
    }

    console.log(`PerFit [Zalando]: Highlighting row index ${rowIndex} in table...`);

    const rows = this.activeTable.querySelectorAll('tbody tr');
    
    if (rowIndex < 0 || rowIndex >= rows.length) {
      console.warn(`PerFit [Zalando]: Invalid row index ${rowIndex}. Table has ${rows.length} rows.`);
      return;
    }

    // Remove highlighting from all rows first
    rows.forEach((row) => {
      (row as HTMLElement).style.backgroundColor = "";
      (row as HTMLElement).style.borderLeft = "";
    });

    // Highlight the specific row
    const targetRow = rows[rowIndex] as HTMLElement;
    const cells = targetRow.querySelectorAll('td');

    // Apply styling
    targetRow.style.backgroundColor = "rgba(124, 58, 237, 0.2)"; // Light purple
    targetRow.style.borderLeft = "6px solid #7c3aed"; // Purple border (6px as requested)
    targetRow.style.transition = "all 0.3s ease";
    
    // Scroll to the highlighted row
    targetRow.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
    
    // Add "PerFit Match" badge if not already present
    if (cells.length > 1) {
      const existingBadge = cells[1].querySelector('.perfit-badge');
      if (!existingBadge) {
        const badge = document.createElement('div');
        badge.className = 'perfit-badge';
        badge.textContent = " PERFIT MATCH";
        badge.style.cssText = `
          font-size: 9px; 
          color: #7c3aed; 
          font-weight: bold; 
          margin-top: 2px;
          letter-spacing: 0.5px;
        `;
        cells[1].appendChild(badge);
      }
    }

    console.log(`PerFit [Zalando]: Successfully highlighted row ${rowIndex}`);
  }
}

/**
 * Create and export a singleton instance
 */
export const zalandoProvider = new ZalandoProvider();
