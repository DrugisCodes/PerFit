// Universal fallback logic for tops when both size tables and model data are missing
import { UserProfile, SizeRecommendation } from '../stores/types';
import { MENS_UNIVERSAL_FALLBACK, FallbackSize } from './constants/fallback-tables';

/**
 * Universal fallback recommendation for tops
 * Triggered when:
 * - sizeData is empty/null
 * - textData has no modelHeight
 * 
 * Uses industry-standard measurements (Dale of Norway)
 */
export function calculateUniversalTopFallback(
  userProfile: UserProfile,
  fitPreference?: 'relaxed' | 'slim' | 'regular'
): SizeRecommendation | null {
  const userChest = parseInt(userProfile.chest);
  
  if (isNaN(userChest) || userChest <= 0) {
    console.error("PerFit: Invalid chest measurement for universal fallback:", userProfile.chest);
    return null;
  }
  
  // Use men's table as default (can be extended with gender detection)
  const fallbackTable = MENS_UNIVERSAL_FALLBACK;
  
  // Find matching size based on chest
  let matchedSize: FallbackSize | null = null;
  let isBetweenSizes = false;
  
  for (let i = 0; i < fallbackTable.length; i++) {
    const size = fallbackTable[i];
    
    if (!size.chest) continue;
    
    // Exact match or user is smaller than this size
    if (userChest <= size.chest) {
      // Check if user is between this size and previous size
      if (i > 0 && userChest > fallbackTable[i - 1].chest!) {
        isBetweenSizes = true;
        
        // For Slim fit: choose smaller size
        // For Relaxed/Regular: choose larger size for comfort
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
  if (!matchedSize && userChest > fallbackTable[fallbackTable.length - 1].chest!) {
    matchedSize = fallbackTable[fallbackTable.length - 1];
  }
  
  if (!matchedSize) {
    return null;
  }
  
  // Build fit note
  let fitNote = `Universal Match: Recommended based on general industry standards for your ${userChest}cm chest`;
  
  if (isBetweenSizes) {
    if (fitPreference === 'slim') {
      fitNote += ` • Sized down for slimmer fit`;
    } else {
      fitNote += ` • Sized up for comfort fit`;
    }
  }
  
  return {
    size: matchedSize.size,
    confidence: 0.6, // Lower confidence for universal fallback
    category: 'top',
    userChest: userChest,
    targetChest: matchedSize.chest || userChest,
    buffer: 0,
    fitNote: fitNote
  };
}
