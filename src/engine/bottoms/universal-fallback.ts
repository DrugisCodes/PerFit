// Universal fallback logic for bottoms when both size tables and model data are missing
import { UserProfile, SizeRecommendation } from '../../stores/types';
import { MENS_UNIVERSAL_FALLBACK, FallbackSize } from '../constants/fallback-tables';

/**
 * Universal fallback recommendation for bottoms
 * Triggered when:
 * - sizeData is empty/null
 * - textData has no modelHeight or inseamLength
 * 
 * Uses industry-standard measurements (Dale of Norway)
 */
export function calculateUniversalBottomFallback(
  userProfile: UserProfile,
  fitPreference?: 'relaxed' | 'slim' | 'regular'
): SizeRecommendation | null {
  const userWaist = parseInt(userProfile.waist);
  const userHip = parseInt(userProfile.hip);
  
  if (isNaN(userWaist) || userWaist <= 0) {
    console.error("PerFit: Invalid waist measurement for universal fallback:", userProfile.waist);
    return null;
  }
  
  // Use men's table as default (can be extended with gender detection)
  const fallbackTable = MENS_UNIVERSAL_FALLBACK;
  
  // Find matching size based on waist
  let matchedSize: FallbackSize | null = null;
  let isBetweenSizes = false;
  
  for (let i = 0; i < fallbackTable.length; i++) {
    const size = fallbackTable[i];
    
    if (!size.waist) continue;
    
    // Exact match or user is smaller than this size
    if (userWaist <= size.waist) {
      // Check if user is between this size and previous size
      if (i > 0 && userWaist > fallbackTable[i - 1].waist!) {
        isBetweenSizes = true;
        
        // For Relaxed/Comfort fit: choose larger size
        // For Slim fit: choose smaller size
        if (fitPreference === 'slim') {
          matchedSize = fallbackTable[i - 1];
        } else {
          // Default to larger size for comfort (relaxed/regular)
          matchedSize = size;
        }
      } else {
        matchedSize = size;
      }
      break;
    }
  }
  
  // If user is larger than largest size, use XL
  if (!matchedSize && userWaist > fallbackTable[fallbackTable.length - 1].waist!) {
    matchedSize = fallbackTable[fallbackTable.length - 1];
  }
  
  if (!matchedSize) {
    return null;
  }
  
  // Check hip tolerance: ignore hip if user is >5cm smaller than table minimum
  const smallesthip = Math.min(...fallbackTable.map(s => s.hip || Infinity));
  const shouldIgnoreHip = !isNaN(userHip) && (smallesthip - userHip) > 5;
  
  // Validate hip fit (if applicable)
  if (!shouldIgnoreHip && !isNaN(userHip) && matchedSize.hip && userHip > matchedSize.hip) {
    // Find next larger size
    const currentIndex = fallbackTable.indexOf(matchedSize);
    if (currentIndex < fallbackTable.length - 1) {
      matchedSize = fallbackTable[currentIndex + 1];
    }
  }
  
  // Build fit note
  let fitNote = `Universal Match: Recommended based on general industry standards for your ${userWaist}cm waist`;
  
  if (isBetweenSizes) {
    if (fitPreference === 'slim') {
      fitNote += ` • Sized down for slimmer fit`;
    } else {
      fitNote += ` • Sized up for comfort fit`;
    }
  }
  
  if (shouldIgnoreHip) {
    fitNote += ` • Hip measurement ignored (smaller than standard)`;
  }
  
  return {
    size: matchedSize.size,
    confidence: 0.6, // Lower confidence for universal fallback
    category: 'bottom',
    userChest: userWaist,
    targetChest: matchedSize.waist || userWaist,
    buffer: 0,
    fitNote: fitNote,
    userWaist: userWaist,
    userHip: !isNaN(userHip) ? userHip : undefined,
    userInseam: userProfile.inseam ? parseInt(userProfile.inseam) : undefined,
    userHeight: userProfile.height ? parseInt(userProfile.height) : undefined
  };
}
