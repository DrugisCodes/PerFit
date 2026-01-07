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

/**
 * Emergency fallback for bottoms - Calculated waist conversion
 * Triggered when:
 * - No match found in size table
 * - No model data available
 * - Dropdown has numeric waist sizes
 * 
 * Converts user waist (cm) to inches and finds closest dropdown size
 */
export function calculateCalculatedWaistFallback(
  userWaist: number,
  userHip: number,
  userInseam: number | null,
  userHeight: number | undefined,
  productInseam: number | undefined,
  productInseamSize: string | undefined,
  availableSizes?: string[]
): SizeRecommendation | null {
  console.log(`PerFit [BOTTOMS]: ⚠️ INGEN MATCH I TABELL - Aktiverer nødsfallback`);
  console.log(`PerFit [BOTTOMS]: Brukerens midje: ${userWaist}cm, hoftemål: ${userHip}cm`);
  
  if (!availableSizes || availableSizes.length === 0) {
    console.log(`PerFit [BOTTOMS]: ⚠️ Ingen dropdown-størrelser tilgjengelig for fallback`);
    return null;
  }
  
  console.log(`PerFit [BOTTOMS]: 🔍 Analyserer dropdown for beregnet match...`);
  
  // Extract numeric waist sizes from dropdown
  const numericWaistSizes: number[] = [];
  availableSizes.forEach(size => {
    // Match pure numbers (30, 31, 32)
    const pureMatch = size.match(/^\d{2,3}$/);
    if (pureMatch) {
      numericWaistSizes.push(parseInt(size));
      return;
    }
    
    // Match W-format (W32, W34)
    const wMatch = size.match(/^W(\d{2,3})$/i);
    if (wMatch) {
      numericWaistSizes.push(parseInt(wMatch[1]));
      return;
    }
    
    // Match WxL format - extract waist (32x32, 32/32)
    const wxlMatch = size.match(/^(\d{2,3})[x\/×](\d{2,3})$/i);
    if (wxlMatch) {
      numericWaistSizes.push(parseInt(wxlMatch[1]));
    }
  });
  
  if (numericWaistSizes.length === 0) {
    console.log(`PerFit [BOTTOMS]: ⚠️ Dropdown inneholder ingen numeriske midjestørrelser`);
    return null;
  }
  
  console.log(`PerFit [BOTTOMS]: Fant ${numericWaistSizes.length} numeriske midjer i dropdown:`, numericWaistSizes);
  
  // Convert user waist from cm to inches
  const userWaistInches = userWaist / 2.54;
  console.log(`PerFit [BOTTOMS]: Brukerens midje i tommer: ${userWaistInches.toFixed(1)}"`);
  
  // Find closest match
  let closestSize = numericWaistSizes[0];
  let minDiff = Math.abs(closestSize - userWaistInches);
  
  numericWaistSizes.forEach(size => {
    const diff = Math.abs(size - userWaistInches);
    if (diff < minDiff) {
      minDiff = diff;
      closestSize = size;
    }
  });
  
  console.log(`PerFit [BOTTOMS]: Nærmeste match: ${closestSize}" (diff: ${minDiff.toFixed(1)}")`);
  
  // Validate: Accept if within +/- 1.5 inches
  if (minDiff <= 1.5) {
    console.log(`PerFit [BOTTOMS]: ✅ BEREGNET MATCH AKSEPTERT (innenfor 1.5" toleranse)`);
    
    const fallbackNote = `Vi fant ingen direkte match i størrelsestabellen, men basert på din livvidde (${userWaist}cm) tilsvarer dette ca. str ${Math.round(userWaistInches)} i tommer, som er det vi anbefaler.`;
    
    return {
      size: closestSize.toString(),
      confidence: 0.7,
      category: 'bottom',
      userChest: userWaist,
      targetChest: closestSize * 2.54, // Convert back to cm for reference
      buffer: 0,
      fitNote: fallbackNote,
      userWaist: userWaist,
      userHip: userHip,
      userInseam: userInseam || undefined,
      userHeight: userHeight,
      inseamLength: productInseam,
      inseamLengthSize: productInseamSize
    };
  } else {
    console.log(`PerFit [BOTTOMS]: ⚠️ Diff (${minDiff.toFixed(1)}") er over 1.5" toleranse - for usikker for anbefaling`);
    return null;
  }
}
