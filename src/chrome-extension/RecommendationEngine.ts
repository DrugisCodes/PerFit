/**
 * RecommendationEngine.ts
 * 
 * Contains all size recommendation calculation logic.
 * Separated from content script for better maintainability and testability.
 */

import { SizeRow, UserProfile, SizeRecommendation, GarmentCategory } from '../stores/types';

/**
 * Calculate buffer (extra cm) to add based on fit preference
 * 
 * NOTE: This function is currently COMMENTED OUT per user request.
 * We are using exact measurements without buffer for initial testing.
 * 
 * Fit Preference Scale (1-10):
 * 1-2:   Tight       - Sits completely against skin (0-2cm)
 * 3-4:   Fitted      - Shows body shape, comfortable (3-5cm)
 * 5-6:   Regular Fit - Standard fit, most common (6-9cm)
 * 7-8:   Loose       - Relaxed style, noticeably roomy (10-14cm)
 * 9-10:  Oversized   - Clearly "baggy" style (16-20cm)
 * 
 * Example: User with 105cm chest + Preference 5 (Regular) → 105 + 6 = 111cm target
 * 
 * @param preference - User's fit preference (1-10)
 * @returns Buffer in centimeters to add to measurements
 */
// export function getBufferInCm(preference: number): number {
//   const buffers: Record<number, number> = {
//     1: 0,   // Tight: Sits completely against skin
//     2: 2,   // Tight: Minimal ease
//     3: 3,   // Fitted: Shows body shape
//     4: 5,   // Fitted: Close to body, comfortable
//     5: 6,   // Regular: Standard fit (default)
//     6: 9,   // Regular: Standard comfort
//     7: 10,  // Loose: Relaxed style
//     8: 14,  // Loose: Noticeably roomy
//     9: 16,  // Oversized: Baggy style
//     10: 20  // Oversized: Very baggy
//   };
//   return buffers[preference] || 6; // Default to Regular (6cm)
// }

/**
 * Calculate size recommendation based on user profile and size data
 * 
 * Algorithm (using exact measurements, no buffer):
 * - Tops: Match user chest against table's BRYSTVIDDE (chest) column
 * - Bottoms: Match BOTH user waist AND hip - size must accommodate both measurements
 * - Shoes: Direct shoe size match
 * 
 * @param userProfile - User's body measurements and preferences
 * @param sizeData - Array of size data from the store's size table
 * @param category - Type of garment (top, bottom, shoes)
 * @returns Size recommendation object or null if no match found
 */
export function calculateRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  category: GarmentCategory
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
      return calculateTopRecommendation(userProfile, sizeData);
    } else if (category === 'bottom') {
      return calculateBottomRecommendation(userProfile, sizeData);
    } else if (category === 'shoes') {
      return calculateShoeRecommendation(userProfile);
    } else {
      return calculateUnknownCategoryRecommendation(userProfile, sizeData);
    }

  } catch (error) {
    console.error("PerFit: Error calculating recommendation:", error);
    return null;
  }
}

/**
 * Calculate recommendation for tops (shirts, t-shirts, sweaters)
 * Matches user chest against table's BRYSTVIDDE column
 */
function calculateTopRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[]
): SizeRecommendation | null {
  const userChest = parseInt(userProfile.chest);
  
  if (isNaN(userChest) || userChest <= 0) {
    console.error("PerFit: Invalid chest measurement:", userProfile.chest);
    return null;
  }

  console.log(`PerFit [TOP]: Looking for chest >= ${userChest}cm (exact measurement, no buffer)`);

  // Find first size where table chest >= user chest
  for (const size of sizeData) {
    if (size.chest >= userChest) {
      console.log(`PerFit [TOP]: ✓ Match found! Size ${size.intSize} (table chest: ${size.chest}cm >= user: ${userChest}cm)`);
      return {
        size: size.intSize,
        confidence: 1.0,
        category: 'top',
        userChest: userChest,
        targetChest: userChest,
        buffer: 0,
        matchedRow: size
      };
    }
  }

  console.warn(`PerFit [TOP]: No size found for chest ${userChest}cm. Largest available: ${sizeData[sizeData.length - 1]?.chest}cm`);
  return null;
}

/**
 * Calculate recommendation for bottoms (pants, jeans, skirts)
 * Matches BOTH user waist AND hip - size must accommodate both measurements
 */
function calculateBottomRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[]
): SizeRecommendation | null {
  const userWaist = parseInt(userProfile.waist);
  const userHip = parseInt(userProfile.hip);

  if (isNaN(userWaist) || userWaist <= 0) {
    console.error("PerFit: Invalid waist measurement:", userProfile.waist);
    return null;
  }

  if (isNaN(userHip) || userHip <= 0) {
    console.error("PerFit: Invalid hip measurement:", userProfile.hip);
    return null;
  }

  console.log(`PerFit [BOTTOM]: Looking for size with:`);
  console.log(`  - Waist (LIVVIDDE) >= ${userWaist}cm`);
  console.log(`  - Hip (HOFTEMÅL) >= ${userHip}cm`);
  console.log(`  (Both conditions must be satisfied)`);

  // Find first size where BOTH waist AND hip are >= user measurements
  for (const size of sizeData) {
    const waistFits = size.waist >= userWaist;
    const hipFits = size.hip >= userHip;

    console.log(`PerFit [BOTTOM]: Checking size ${size.intSize}: waist ${size.waist}cm (${waistFits ? '✓' : '✗'}), hip ${size.hip}cm (${hipFits ? '✓' : '✗'})`);

    if (waistFits && hipFits) {
      console.log(`PerFit [BOTTOM]: ✓ Match found! Size ${size.intSize} accommodates both measurements`);
      return {
        size: size.intSize,
        confidence: 1.0,
        category: 'bottom',
        userChest: userWaist, // Store waist in userChest field for consistency
        targetChest: userWaist,
        buffer: 0,
        matchedRow: size
      };
    }
  }

  console.warn(`PerFit [BOTTOM]: No size found for waist ${userWaist}cm AND hip ${userHip}cm`);
  console.warn(`PerFit [BOTTOM]: Largest available - waist: ${sizeData[sizeData.length - 1]?.waist}cm, hip: ${sizeData[sizeData.length - 1]?.hip}cm`);
  return null;
}

/**
 * Calculate recommendation for shoes
 * Direct shoe size match, no buffer needed
 */
function calculateShoeRecommendation(
  userProfile: UserProfile
): SizeRecommendation | null {
  const shoeSize = parseFloat(userProfile.shoeSize);
  
  if (isNaN(shoeSize) || shoeSize <= 0) {
    console.error("PerFit: Invalid shoe size:", userProfile.shoeSize);
    return null;
  }

  console.log(`PerFit [SHOES]: Looking for shoe size ${shoeSize}`);
  
  return {
    size: userProfile.shoeSize,
    confidence: 0.8,
    category: 'shoes',
    userChest: shoeSize,
    targetChest: shoeSize,
    buffer: 0
  };
}

/**
 * Calculate recommendation for unknown category
 * Defaults to chest measurement as fallback
 */
function calculateUnknownCategoryRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[]
): SizeRecommendation | null {
  console.warn("PerFit: Unknown category, defaulting to chest measurement");
  
  const userChest = parseInt(userProfile.chest);
  
  if (isNaN(userChest) || userChest <= 0) {
    console.error("PerFit: Invalid chest measurement for unknown category");
    return null;
  }

  for (const size of sizeData) {
    if (size.chest >= userChest) {
      console.log(`PerFit [UNKNOWN]: Match found! Size ${size.intSize}`);
      return {
        size: size.intSize,
        confidence: 0.5,
        category: 'unknown',
        userChest: userChest,
        targetChest: userChest,
        buffer: 0,
        matchedRow: size
      };
    }
  }

  return null;
}
