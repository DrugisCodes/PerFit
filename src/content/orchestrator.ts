/**
 * PerFit Content Script - Orchestrator Module
 * 
 * Main execution function that coordinates:
 * - Provider detection
 * - Size data scraping
 * - Recommendation calculation
 * - UI display
 */

import { detectProvider } from '../stores';
import { UserProfile, SizeRecommendation } from '../stores/types';
import { calculateRecommendation, calculateTextBasedRecommendation } from '../engine';
import { analyzeLengthFit } from './analysis';
import { showRecommendation, removeActionMenu } from './ui-manager';

/**
 * Main execution function - Runs size recommendation logic
 * 
 * @param _getCachedRecommendation - Reference to cached recommendation getter (reserved for future use)
 * @param setCachedRecommendation - Callback to update cached recommendation
 * @param manualOverride - Optional manual stretch override
 */
export async function runPerFit(
  _getCachedRecommendation: () => SizeRecommendation | null,
  setCachedRecommendation: (rec: SizeRecommendation | null) => void,
  manualOverride?: boolean
): Promise<void> {
  try {
    console.log("PerFit: Running recommendation...", manualOverride ? `(Manual override: ${manualOverride})` : '');

    const provider = detectProvider();
    if (!provider) {
      console.log("PerFit: Provider not detected");
      removeActionMenu();
      return;
    }

    // Fetch user profile
    const result = await chrome.storage.local.get(["userProfile"]);
    const userProfile: UserProfile = result.userProfile;

    if (!userProfile) {
      console.log("PerFit: No user profile found");
      removeActionMenu();
      return;
    }

    console.log("PerFit: User profile loaded");

    // Open size guide
    const opened = await provider.openSizeGuide();
    if (!opened) {
      console.error("PerFit: Failed to open size guide");
      removeActionMenu();
      return;
    }
    
    // Get fit hint early (needed for text-based fallback)
    let fitHint: string | undefined;
    if ('getFitHint' in provider && typeof provider.getFitHint === 'function') {
      fitHint = (provider as any).getFitHint() || undefined;
    }
    
    // Scrape size data
    const sizeData = await provider.scrapeTableData();
    if (sizeData.length === 0) {
      console.log("PerFit: No table data found, checking for text-based measurements...");
      
      // Check if provider has text measurements (Zalando-specific)
      if ('textMeasurement' in provider && (provider as any).textMeasurement) {
        const textData = (provider as any).textMeasurement;
        console.log("PerFit: Using text-based measurements", textData);
        
        // Calculate text-based recommendation
        const recommendation = calculateTextBasedRecommendation(userProfile, textData);
        
        if (recommendation) {
          // Add length/height analysis
          const lengthWarning = analyzeLengthFit(userProfile, textData, recommendation.size);
          if (lengthWarning) {
            recommendation.lengthNote = lengthWarning;
            console.log("PerFit: Length warning added:", lengthWarning);
          }
          
          setCachedRecommendation(recommendation); // Cache text-based result
          removeActionMenu(); // Remove menu before showing recommendation
          showRecommendation(recommendation);
          return;
        }
      }
      
      console.error("PerFit: No size data or text measurements available");
      removeActionMenu();
      return;
    }

    // Detect category
    const category = provider.getTableCategory();
    console.log(`PerFit: Category: ${category}`);
    
    // Store category in sessionStorage for popup access
    sessionStorage.setItem('perfit-category', category);

    // === CRITICAL: Read moccasin flag from sessionStorage (set by detector.ts) ===
    const detectedIsMoccasin = sessionStorage.getItem('perfit-isMoccasin') === 'true';
    if (detectedIsMoccasin) {
      console.log('PerFit: Moccasin flag detected from sessionStorage');
    }
    
    // === Read leather boot flag from sessionStorage (set by detector.ts) ===
    const detectedIsLeatherBoot = sessionStorage.getItem('perfit-isLeatherBoot') === 'true';
    if (detectedIsLeatherBoot) {
      console.log('PerFit: Leather boot flag detected from sessionStorage');
    }
    
    // === Read hasLaces flag from sessionStorage (set by detector.ts) ===
    const detectedHasLaces = sessionStorage.getItem('perfit-hasLaces') === 'true';
    if (detectedIsLeatherBoot) {
      console.log(`PerFit: Boot has laces: ${detectedHasLaces}`);
    }

    // Get text measurements if available (for ankle length detection AND manual override)
    let textMeasurement = ('textMeasurement' in provider && (provider as any).textMeasurement) 
      ? { ...(provider as any).textMeasurement }
      : {};
    
    // === CRITICAL: Apply moccasin flag from detection OR manual override ===
    textMeasurement.isMoccasin = detectedIsMoccasin || manualOverride || false;
    
    // === Apply leather boot flag from detection ===
    textMeasurement.isLeatherBoot = detectedIsLeatherBoot;
    
    // === Apply hasLaces flag from detection ===
    textMeasurement.hasLaces = detectedHasLaces;
    
    // Add manual override flag if provided
    if (manualOverride !== undefined) {
      textMeasurement.manualOverride = manualOverride;
    }

    // Get dropdown sizes if available (for WxL format detection)
    const dropdownSizes = ('dropdownSizes' in provider && (provider as any).dropdownSizes) 
      ? (provider as any).dropdownSizes 
      : undefined;

    // Calculate recommendation (pass textMeasurement for ankle length detection and dropdownSizes for WxL format)
    const recommendation = calculateRecommendation(userProfile, sizeData, category, fitHint, textMeasurement, dropdownSizes);
    if (!recommendation) {
      console.error("PerFit: Failed to calculate recommendation");
      removeActionMenu();
      return;
    }

    // Add length/height analysis (check if provider has text measurements and category is not shoes)
    if (category !== 'shoes' && textMeasurement) {
      const lengthWarning = analyzeLengthFit(userProfile, textMeasurement, recommendation.size);
      if (lengthWarning) {
        recommendation.lengthNote = lengthWarning;
        console.log("PerFit: Length warning added:", lengthWarning);
      }
    }

    // Highlight row
    if (recommendation.matchedRow && recommendation.matchedRow.rowIndex !== undefined) {
      let rowIndexToHighlight = recommendation.matchedRow.rowIndex;
      
      // If rowIndex is -1 (no exact match, interpolated size), find nearest row in ORIGINAL table
      if (rowIndexToHighlight === -1 && sizeData.length > 0) {
        console.log("PerFit: No exact match found (interpolated size), finding nearest row in original table for size:", recommendation.size);
        
        // Extract numeric value from recommended size (e.g., "43 1/3" -> 43.333)
        const recommendedValue = parseFloat(recommendation.size.replace(/\s+\d+\/\d+/, (match: string) => {
          const parts = match.trim().split(/\s+/);
          if (parts.length > 1) {
            const fraction = parts[1].split('/');
            return ' ' + (parseInt(fraction[0]) / parseInt(fraction[1])).toString();
          }
          return match;
        }));
        
        // Find row with closest size value that has a VALID rowIndex (from original table)
        // Filter out interpolated rows (they might have rowIndex -1 or invalid indices)
        let minDiff = Infinity;
        let nearestRowIndex = -1;
        let nearestRowSize = '';
        
        sizeData.forEach((row) => {
          // Only consider rows that exist in the original table (rowIndex >= 0)
          if (row.rowIndex >= 0 && row.intSize) {
            const rowValue = parseFloat(row.intSize.replace(/\s+\d+\/\d+/, (match: string) => {
              const parts = match.trim().split(/\s+/);
              if (parts.length > 1) {
                const fraction = parts[1].split('/');
                return ' ' + (parseInt(fraction[0]) / parseInt(fraction[1])).toString();
              }
              return match;
            }));
            
            const diff = Math.abs(rowValue - recommendedValue);
            if (diff < minDiff) {
              minDiff = diff;
              nearestRowIndex = row.rowIndex;
              nearestRowSize = row.intSize;
            }
          }
        });
        
        if (nearestRowIndex >= 0) {
          console.log(`PerFit: Found nearest original table row at index ${nearestRowIndex} (size: ${nearestRowSize})`);
          rowIndexToHighlight = nearestRowIndex;
        }
      }
      
      // Only highlight if we have a valid index
      if (rowIndexToHighlight >= 0) {
        provider.highlightRow(rowIndexToHighlight, recommendation.fitNote);
      }
    }

    // Cache the recommendation for Resume State
    setCachedRecommendation(recommendation);

    // Show recommendation
    console.log(`PerFit: ✅ Recommendation: ${recommendation.size}`);
    removeActionMenu(); // Remove menu before showing recommendation
    showRecommendation(recommendation);

  } catch (error) {
    console.error("PerFit: Error:", error);
    removeActionMenu(); // Always clean up on error
  }
}
