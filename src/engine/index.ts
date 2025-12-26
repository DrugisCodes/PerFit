/**
 * RecommendationEngine - Main Entry Point
 * 
 * Delegates size recommendation calculations to category-specific modules.
 * Separated into modular files for better maintainability and testability.
 */

import { SizeRow, UserProfile, SizeRecommendation, GarmentCategory } from '../stores/types';
import { calculateTopRecommendation, calculateTextBasedRecommendation } from './tops';
import { calculateBottomRecommendation } from './bottoms';
import { calculateShoeRecommendation } from './shoes';

/**
 * Calculate size recommendation based on user profile and size data
 * 
 * Algorithm (using exact measurements, no buffer):
 * - Tops: Match user chest against table's BRYSTVIDDE (chest) column
 * - Bottoms: Match BOTH user waist AND hip - size must accommodate both measurements
 * - Shoes: Smart foot length matching with optional fit hint buffer
 * 
 * @param userProfile - User's body measurements and preferences
 * @param sizeData - Array of size data from the store's size table
 * @param category - Type of garment (top, bottom, shoes)
 * @param fitHint - Optional fit hint from store (e.g., "Varen er liten")
 * @param textMeasurement - Optional text-based measurement data
 * @param dropdownSizes - Optional available sizes from dropdown (for WxL matching)
 * @returns Size recommendation object or null if no match found
 */
export function calculateRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  category: GarmentCategory,
  fitHint?: string,
  textMeasurement?: { isAnkleLength?: boolean; isMoccasin?: boolean; materialInfo?: string },
  dropdownSizes?: string[]
): SizeRecommendation | null {
  try {
    // Validate inputs
    if (!userProfile) {
      console.error("PerFit: No user profile provided");
      return null;
    }

    if (!sizeData || sizeData.length === 0) {
      console.error("PerFit: No size data provided");
      return null;
    }

    console.log(`PerFit: Calculating recommendation for category: ${category}`);

    // Category-specific matching logic
    if (category === 'top') {
      return calculateTopRecommendation(userProfile, sizeData, fitHint, textMeasurement);
    } else if (category === 'bottom') {
      return calculateBottomRecommendation(userProfile, sizeData, textMeasurement, dropdownSizes, fitHint);
    } else if (category === 'shoes') {
      // Pass dropdownSizes to shoe calculation for proper size matching
      return calculateShoeRecommendation(userProfile, sizeData, fitHint, textMeasurement, dropdownSizes);
    } else {
      return calculateUnknownCategoryRecommendation(userProfile, sizeData);
    }

  } catch (error) {
    console.error("PerFit: Error calculating recommendation:", error);
    return null;
  }
}

/**
 * Fallback recommendation for unknown category
 * Uses chest measurement as best guess
 */
function calculateUnknownCategoryRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[]
): SizeRecommendation | null {
  const userChest = parseInt(userProfile.chest);
  for (const size of sizeData) {
    if (size.chest >= userChest) {
      return {
        size: size.intSize,
        confidence: 0.5,
        category: 'unknown',
        userChest: userChest,
        targetChest: size.chest,
        buffer: 0,
        matchedRow: size
      };
    }
  }
  return null;
}

// Re-export text-based recommendation for use in content scripts
export { calculateTextBasedRecommendation };
