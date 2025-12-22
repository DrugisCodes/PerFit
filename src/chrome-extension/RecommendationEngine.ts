/**
 * RecommendationEngine.ts
 * 
 * Contains all size recommendation calculation logic.
 * Separated from content script for better maintainability and testability.
 */

import { SizeRow, UserProfile, SizeRecommendation, GarmentCategory } from '../stores/types';
import { parseSizeToNumber } from '../utils/math';

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
 * - Shoes: Smart foot length matching with optional fit hint buffer
 * 
 * @param userProfile - User's body measurements and preferences
 * @param sizeData - Array of size data from the store's size table
 * @param category - Type of garment (top, bottom, shoes)
 * @param fitHint - Optional fit hint from store (e.g., "Varen er liten")
 * @returns Size recommendation object or null if no match found
 */
export function calculateRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  category: GarmentCategory,
  fitHint?: string
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
      return calculateShoeRecommendation(userProfile, sizeData, fitHint);
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
/**
 * Calculate recommendation for shoes with smart interpolation
 * 
 * New features:
 * 1. Uses foot length for precise matching
 * 2. Applies 0.2cm buffer if item is marked as "small"
 * 3. Finds best match using absolute smallest difference
 * 4. Supports intermediate sizes through interpolation
 * 
 * Priority order:
 * 1. Foot length matching (most accurate)
 * 2. EU size exact match (if foot length not available)
 * 3. EU size numeric match with tolerance
 */
function calculateShoeRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  fitHint?: string
): SizeRecommendation | null {
  const userShoeSize = userProfile.shoeSize.trim();
  const userFootLength = userProfile.footLength ? parseFloat(userProfile.footLength) : null;
  
  if (!userShoeSize && !userFootLength) {
    console.error("PerFit: No shoe size or foot length provided in user profile");
    return null;
  }

  console.log(`PerFit [SHOES]: User shoe size: ${userShoeSize}, foot length: ${userFootLength}cm`);
  console.log(`PerFit [SHOES]: Fit hint: ${fitHint || 'none'}`);
  console.log(`PerFit [SHOES]: Available sizes in table: ${sizeData.length}`);
  console.log("PerFit [SHOES]: Table data:", sizeData.map(row => `${row.intSize} (${row.footLength}cm)`));
  
  // PRIORITY 1: Foot length matching (most accurate)
  if (userFootLength && sizeData.some(row => row.footLength !== undefined && row.footLength > 0)) {
    console.log(`PerFit [SHOES]: Using foot length matching (${userFootLength}cm)...`);
    
    // Apply buffer if item is small
    const buffer = (fitHint && fitHint.toLowerCase().includes('liten')) ? 0.2 : 0;
    const targetFootLength = userFootLength + buffer;
    
    if (buffer > 0) {
      console.log(`PerFit [SHOES]: Item marked as 'small', adding ${buffer}cm buffer → target: ${targetFootLength}cm`);
    }
    
    // Find size with smallest absolute difference to target foot length
    let bestMatch: SizeRow | null = null;
    let smallestDiff = Infinity;
    
    for (const row of sizeData) {
      if (row.footLength !== undefined && row.footLength > 0) {
        const diff = Math.abs(row.footLength - targetFootLength);
        console.log(`PerFit [SHOES]: Size ${row.intSize} (${row.footLength}cm) - diff: ${diff.toFixed(2)}cm`);
        
        if (diff < smallestDiff) {
          smallestDiff = diff;
          bestMatch = row;
        }
      }
    }
    
    if (bestMatch !== null) {
      console.log(`PerFit [SHOES]: ✅ Best foot length match - Size ${bestMatch.intSize} (${bestMatch.footLength}cm, diff: ${smallestDiff.toFixed(2)}cm)`);
      
      // Calculate fit difference and category for user education
      const diff = bestMatch.footLength! - userFootLength;
      let fitCategory: string;
      
      if (diff < 0.4) {
        fitCategory = "TETTSITTENDE";
      } else if (diff <= 0.9) {
        fitCategory = "IDEELL";
      } else {
        fitCategory = "ROMSLIG";
      }
      
      const fitNote = `${fitCategory} (+${diff.toFixed(1)} cm plass)`;
      console.log(`PerFit [SHOES]: Fit note: ${fitNote}`);
      
      return {
        size: bestMatch.intSize,
        confidence: 0.95,
        category: 'shoes',
        userChest: userFootLength,
        targetChest: bestMatch.footLength || 0,
        buffer: buffer,
        matchedRow: bestMatch,
        fitNote: fitNote
      };
    } else {
      console.warn(`PerFit [SHOES]: No valid foot length data in table. Falling back to EU size matching.`);
    }
  }
  
  // PRIORITY 2: EU size exact match (if foot length not available)
  if (userShoeSize) {
    console.log(`PerFit [SHOES]: Trying EU size exact match for "${userShoeSize}"...`);
    const exactMatch = sizeData.find(row => {
      const tableSize = row.intSize.trim();
      const userSize = userShoeSize.trim();
      
      // Direct string match (handles "43 1/3" === "43 1/3")
      if (tableSize === userSize) {
        return true;
      }
      
      // Numeric match with decimal conversion
      const tableNum = parseSizeToNumber(tableSize);
      const userNum = parseSizeToNumber(userSize);
      return Math.abs(tableNum - userNum) < 0.01; // Allow tiny rounding error
    });

    if (exactMatch) {
      console.log(`PerFit [SHOES]: ✅ Exact EU size match: ${exactMatch.intSize}`);
      return {
        size: exactMatch.intSize,
        confidence: 1.0,
        category: 'shoes',
        userChest: parseSizeToNumber(userShoeSize),
        targetChest: parseSizeToNumber(exactMatch.intSize),
        buffer: 0,
        matchedRow: exactMatch
      };
    }
    
    // PRIORITY 3: Numeric comparison with tolerance (handles half sizes)
    console.log("PerFit [SHOES]: Trying numeric comparison with 0.5 tolerance...");
    const userSizeNum = parseSizeToNumber(userShoeSize);
    if (!isNaN(userSizeNum)) {
      const numericMatch = sizeData.find(row => {
        const tableNum = parseSizeToNumber(row.intSize);
        const diff = Math.abs(tableNum - userSizeNum);
        if (diff < 0.5) {
          console.log(`PerFit [SHOES]: Checking ${row.intSize} (${tableNum}) vs ${userShoeSize} (${userSizeNum}) - diff: ${diff}`);
        }
        return !isNaN(tableNum) && diff < 0.5;
      });
      
      if (numericMatch) {
        console.log(`PerFit [SHOES]: ✅ Numeric match: ${numericMatch.intSize}`);
        return {
          size: numericMatch.intSize,
          confidence: 0.85,
          category: 'shoes',
          userChest: userSizeNum,
          targetChest: parseSizeToNumber(numericMatch.intSize),
          buffer: 0,
          matchedRow: numericMatch
        };
      }
    }
  }
  
  console.error(`PerFit [SHOES]: No match found for shoe size ${userShoeSize} or foot length ${userFootLength}cm`);
  return null;
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

/**
 * Calculate recommendation based on text measurements (when tables are missing)
 * 
 * Logic:
 * - Compare user height with model height
 * - Assuming ~6cm height difference ≈ 1 size difference
 * - Apply fit preference adjustment
 * 
 * Example: Model is 189cm wearing size M, user is 175cm (14cm shorter)
 * → -14cm / 6 = -2.33 → Recommend S (2 sizes down from M)
 * → If user prefers loose fit, adjust to M
 */
export function calculateTextBasedRecommendation(
  userProfile: UserProfile,
  textData: { modelHeight?: number; modelSize: string; itemLength?: number; itemLengthSize?: string }
): SizeRecommendation | null {
  try {
    const userHeight = parseInt(userProfile.height);
    
    if (!textData.modelHeight || isNaN(userHeight) || userHeight <= 0) {
      console.warn("PerFit [Text]: Insufficient data for text-based recommendation");
      console.log(`PerFit [Text]: User height: ${userHeight}, Model height: ${textData.modelHeight}`);
      return null;
    }
    
    console.log(`PerFit [Text]: User height: ${userHeight}cm, Model height: ${textData.modelHeight}cm wearing size ${textData.modelSize}`);
    
    const heightDiff = userHeight - textData.modelHeight;
    const sizeScale = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const modelSizeIndex = sizeScale.indexOf(textData.modelSize.toUpperCase());
    
    if (modelSizeIndex === -1) {
      console.warn(`PerFit [Text]: Unknown model size: ${textData.modelSize}`);
      return null;
    }
    
    // Heuristic: ~6cm height difference ≈ 1 size difference
    const sizeDiff = Math.round(heightDiff / 6);
    let recommendedIndex = modelSizeIndex + sizeDiff;
    
    // Apply fit preference adjustment
    const fitPreference = userProfile.fitPreference || 5;
    if (fitPreference <= 3) {
      recommendedIndex -= 1; // Tight fit: go down a size
      console.log(`PerFit [Text]: Tight fit preference (${fitPreference}) - going down 1 size`);
    } else if (fitPreference >= 7) {
      recommendedIndex += 1; // Loose fit: go up a size
      console.log(`PerFit [Text]: Loose fit preference (${fitPreference}) - going up 1 size`);
    }
    
    // Clamp to valid range
    recommendedIndex = Math.max(0, Math.min(sizeScale.length - 1, recommendedIndex));
    
    const recommendedSize = sizeScale[recommendedIndex];
    
    console.log(`PerFit [Text]: ✅ Recommended size ${recommendedSize} (height diff: ${heightDiff}cm, size diff: ${sizeDiff}, fit pref: ${fitPreference})`);
    
    return {
      size: recommendedSize,
      confidence: 0.7, // Lower confidence for text-based
      category: 'top',
      userChest: userHeight, // Using height as proxy
      targetChest: userHeight,
      buffer: 0,
      fitNote: 'Basert på modellens mål' // "Based on model's measurements"
    };
  } catch (error) {
    console.error("PerFit [Text]: Error calculating text-based recommendation:", error);
    return null;
  }
}
