/**
 * BaseStoreProvider
 * 
 * Abstract base class for all store providers.
 * Contains generic table scraping, column mapping, and category detection logic.
 */

import { StoreProvider, SizeRow, GarmentCategory } from './types';
import { cleanShoeSize, interpolateFootLength, parseSizeToNumber } from '../utils/math';

export abstract class BaseStoreProvider implements StoreProvider {
  abstract name: string;
  protected activeTable: HTMLTableElement | null = null;

  /**
   * Check if this provider can handle the current page
   * Must be implemented by each store provider
   */
  abstract canHandle(): boolean;

  /**
   * Open the store's size guide/table
   * Must be implemented by each store provider
   */
  abstract openSizeGuide(): Promise<boolean>;

  /**
   * Detect garment category based on table headers
   * 
   * @param headers - Array of header text content (lowercase)
   * @returns Category type: 'top' | 'bottom' | 'shoes' | 'unknown'
   */
  detectCategory(headers: string[]): GarmentCategory {
    const h = headers.join(' ').toLowerCase();
    
    // Shoes: Look for foot length or shoe size
    if (h.includes('fotlengde') || h.includes('skostørrelse') || 
        h.includes('foot length') || h.includes('shoe size')) {
      return 'shoes';
    }
    
    // Bottoms: Look for inseam or waist-dominant measurements
    if (h.includes('innerbenslengde') || h.includes('inseam') || 
        (h.includes('midjevidde') && !h.includes('brystvidde')) ||
        (h.includes('waist') && !h.includes('chest'))) {
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
  getTableCategory(): GarmentCategory {
    if (!this.activeTable) return 'unknown';
    
    const headers = Array.from(this.activeTable.querySelectorAll('thead th'))
      .map(th => th.textContent?.trim().toLowerCase() || '');
    
    return this.detectCategory(headers);
  }

  /**
   * Scrape shoe size table with smart interpolation
   * 
   * @param table - The HTML table element to scrape
   * @param headers - Array of lowercase header names
   * @param dropdownSizes - Optional array of sizes from dropdown for interpolation
   * @returns Array of SizeRow objects with shoe size data
   */
  protected scrapeShoeSizeTable(
    table: HTMLTableElement, 
    headers: string[],
    dropdownSizes: string[] = []
  ): SizeRow[] {
    console.log(`PerFit [${this.name}]: Scraping shoe size table...`);

    // Find column indices for shoe sizes
    let euSizeIndex = -1;
    let footLengthIndex = -1;
    let isFootLengthInMm = false;

    headers.forEach((header, index) => {
      const h = header.toLowerCase();
      if (h === 'eu' || h === 'eur' || h.includes('størrelse') || h.includes('size')) {
        euSizeIndex = index;
        console.log(`PerFit [${this.name}]: Found EU/Size column at index ${index}`);
      } else if (h.includes('fotlengde') || h.includes('foot length') || 
                 h.includes('cm') || h.includes('mm')) {
        footLengthIndex = index;
        isFootLengthInMm = h.includes('mm') || h.includes('(mm)');
        console.log(`PerFit [${this.name}]: Found foot length column at index ${index}, unit: ${isFootLengthInMm ? 'mm' : 'cm'}`);
      }
    });

    if (euSizeIndex === -1) {
      console.error(`PerFit [${this.name}]: Could not find EU size column`);
      return [];
    }

    // Parse table rows
    const rows = table.querySelectorAll('tbody tr');
    const tableSizeData: SizeRow[] = [];

    rows.forEach((row: Element, rowIndex: number) => {
      const cells = row.querySelectorAll('td');
      
      if (cells.length > euSizeIndex) {
        const euSizeRaw = cells[euSizeIndex].textContent?.trim() || "";
        const euSize = cleanShoeSize(euSizeRaw);
        
        let footLengthCm = 0;
        if (footLengthIndex !== -1 && cells.length > footLengthIndex) {
          const footLengthRaw = cells[footLengthIndex].textContent?.trim() || "0";
          const footLengthValue = parseFloat(footLengthRaw.replace(',', '.'));
          
          // Convert to cm if the table uses mm
          footLengthCm = isFootLengthInMm ? footLengthValue / 10 : footLengthValue;
          footLengthCm = Math.round(footLengthCm * 100) / 100;
        }

        if (euSize) {
          tableSizeData.push({
            intSize: euSize,
            chest: 0,
            waist: 0,
            hip: 0,
            footLength: footLengthCm > 0 ? footLengthCm : undefined,
            rowIndex: rowIndex
          });
        }
      }
    });

    console.log(`PerFit [${this.name}]: Scraped ${tableSizeData.length} shoe sizes from table`);

    // Smart interpolation if dropdown sizes provided
    const finalSizeData = this.interpolateIntermediateSizes(tableSizeData, dropdownSizes, footLengthIndex !== -1);

    return finalSizeData;
  }

  /**
   * Interpolate intermediate sizes from dropdown
   * 
   * @param tableSizes - Sizes scraped from table
   * @param dropdownSizes - Sizes found in dropdown
   * @param hasFootLength - Whether table has foot length data
   * @returns Combined array with interpolated sizes
   */
  protected interpolateIntermediateSizes(
    tableSizes: SizeRow[],
    dropdownSizes: string[],
    hasFootLength: boolean
  ): SizeRow[] {
    if (dropdownSizes.length === 0 || !hasFootLength) {
      return tableSizes;
    }

    console.log(`PerFit [${this.name}]: Checking for intermediate sizes to interpolate...`);
    
    const finalSizeData: SizeRow[] = [...tableSizes];
    const tableSizesForInterpolation = tableSizes
      .filter(s => s.footLength !== undefined)
      .map(s => ({ size: s.intSize, footLength: s.footLength! }));

    dropdownSizes.forEach(dropdownSize => {
      const cleanDropdownSize = cleanShoeSize(dropdownSize);
      const alreadyInTable = tableSizes.some(row => row.intSize === cleanDropdownSize);
      
      if (!alreadyInTable) {
        const interpolatedLength = interpolateFootLength(cleanDropdownSize, tableSizesForInterpolation);
        
        if (interpolatedLength) {
          finalSizeData.push({
            intSize: cleanDropdownSize,
            chest: 0,
            waist: 0,
            hip: 0,
            footLength: interpolatedLength,
            rowIndex: -1 // Mark as interpolated
          });
          console.log(`PerFit [${this.name}]: ✨ Added interpolated size ${cleanDropdownSize} with foot length ${interpolatedLength}cm`);
        }
      }
    });

    // Sort by size number (handle fractions properly)
    finalSizeData.sort((a, b) => {
      const aNum = parseSizeToNumber(a.intSize);
      const bNum = parseSizeToNumber(b.intSize);
      return aNum - bNum;
    });

    console.log(`PerFit [${this.name}]: Final size data: ${finalSizeData.length} sizes (${finalSizeData.length - tableSizes.length} interpolated)`);

    return finalSizeData;
  }

  /**
   * Scrape clothing size table (tops/bottoms)
   * 
   * @param table - The HTML table element to scrape
   * @param headers - Array of lowercase header names
   * @returns Array of SizeRow objects with body measurements
   */
  protected scrapeClothingSizeTable(table: HTMLTableElement, headers: string[]): SizeRow[] {
    console.log(`PerFit [${this.name}]: Scraping clothing size table...`);

    // Find column indices
    let intSizeIndex = -1;
    let chestIndex = -1;
    let waistIndex = -1;
    let hipIndex = -1;

    headers.forEach((header, index) => {
      const h = header.toLowerCase();
      if (h === 'int' || h.includes('størrelse') || h.includes('size')) {
        intSizeIndex = index;
      } else if (h.includes('brystvidde') || h.includes('chest') || h.includes('bust')) {
        chestIndex = index;
      } else if (h.includes('midjevidde') || h.includes('livvidde') || h.includes('waist')) {
        waistIndex = index;
      } else if (h.includes('hoftemål') || h.includes('hoftevidde') || 
                 h.includes('setevidde') || h.includes('hip')) {
        hipIndex = index;
      }
    });

    console.log(`PerFit [${this.name}]: Column mapping - INT:${intSizeIndex}, Chest:${chestIndex}, Waist:${waistIndex}, Hip:${hipIndex}`);

    if (intSizeIndex === -1) {
      console.error(`PerFit [${this.name}]: Could not find INT size column`);
      return [];
    }

    // Parse table rows
    const rows = table.querySelectorAll('tbody tr');
    const sizeData: SizeRow[] = [];

    rows.forEach((row: Element, rowIndex: number) => {
      const cells = row.querySelectorAll('td');
      
      if (cells.length > intSizeIndex) {
        const intSize = cells[intSizeIndex].textContent?.trim() || "";
        
        const chestValue = chestIndex !== -1 && cells.length > chestIndex ? 
          parseInt(cells[chestIndex].textContent?.trim() || "0") : 0;
        const waistValue = waistIndex !== -1 && cells.length > waistIndex ? 
          parseInt(cells[waistIndex].textContent?.trim() || "0") : 0;
        const hipValue = hipIndex !== -1 && cells.length > hipIndex ? 
          parseInt(cells[hipIndex].textContent?.trim() || "0") : 0;

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

    console.log(`PerFit [${this.name}]: Scraped ${sizeData.length} clothing sizes`);
    return sizeData;
  }

  /**
   * Highlight recommended size row using CSS injection (React-safe)
   * Does not modify DOM elements directly - uses nth-child CSS selectors
   */
  highlightRow(rowIndex: number, _fitNote?: string): void {
    if (!this.activeTable) {
      console.warn(`PerFit [${this.name}]: No active table to highlight`);
      return;
    }

    console.log(`PerFit [${this.name}]: Highlighting row ${rowIndex} using CSS injection`);

    const styleId = 'perfit-highlight-rules';
    
    // 1. Remove old styling
    const oldStyle = document.getElementById(styleId);
    if (oldStyle) oldStyle.remove();

    // 2. Create new style tag
    const style = document.createElement('style');
    style.id = styleId;
    
    // We use a very specific selector for Zalando's table.
    // By using !important we override Zalando without changing the node.
    style.textContent = `
      /* Highlight row in size table */
      [class*="size-guide-modal"] table tbody tr:nth-child(${rowIndex + 1}),
      [class*="Modal"] table tbody tr:nth-child(${rowIndex + 1}),
      table tbody tr:nth-child(${rowIndex + 1}) {
        background-color: #fef3c7 !important;
        outline: 2px solid #f59e0b !important;
        outline-offset: -2px;
        transition: background-color 0.3s ease;
      }

      /* Add star icon before first cell */
      [class*="Modal"] table tbody tr:nth-child(${rowIndex + 1}) td:first-child::before,
      table tbody tr:nth-child(${rowIndex + 1}) td:first-child::before {
        content: '⭐ ';
        font-size: 12px;
      }
    `;

    // 3. Inject into documentElement (safer than body for React apps)
    document.documentElement.appendChild(style);
    
    // Scroll to row
    const rows = this.activeTable.querySelectorAll('tbody tr');
    const targetRow = rows[rowIndex] as HTMLTableRowElement;
    if (targetRow) {
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    console.log(`PerFit [${this.name}]: CSS highlight injected for row ${rowIndex}`);
  }

  /**
   * Abstract method to scrape table data
   * Must be implemented by each store provider
   */
  abstract scrapeTableData(): Promise<SizeRow[]> | SizeRow[];
}
