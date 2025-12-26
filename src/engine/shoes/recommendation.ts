/**
 * Main shoe size recommendation logic
 * Handles different shoe constructions: Chelsea boots, loafers/moccasins, laced footwear
 */

import { SizeRow, UserProfile, SizeRecommendation } from '../../stores/types';
import { ShoeSize, ShoeContext } from './types';
import { buildCompleteSizeList } from './interpolation';

/**
 * Calculate recommendation for shoes
 * Handles moccasins/loafers with stretch factor
 * 
 * PRIORITY ORDER:
 * 1. Store recommendation (if within max buffer)
 * 2. Expert recommendation from text (e.g., "vi anbefaler størrelse 43")
 * 3. Construction-based calculation
 * 
 * CONSTRUCTION RULES:
 * - Chelsea boots: 0.0cm adjustment (high shaft holds foot), max buffer 0.4cm
 * - Loafers/Moccasins: -0.3cm adjustment (must be snug), max buffer 0.2cm
 * - Laced footwear: 0.0cm adjustment, max buffer 0.4cm
 * 
 * @param userProfile - User's foot length
 * @param sizeData - Size table data
 * @param fitHint - 'liten' or 'stor' (optional)
 * @param textMeasurement - Material and construction info
 * @param dropdownSizes - Available sizes from dropdown (for interpolation)
 */
export function calculateShoeRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  fitHint?: string,
  textMeasurement?: ShoeContext,
  dropdownSizes?: string[]
): SizeRecommendation | null {
  const userFoot = userProfile.footLength ? parseFloat(userProfile.footLength) : null;
  if (!userFoot) return null;

  // Build complete size list with interpolated intermediate sizes
  const completeSizeList = buildCompleteSizeList(sizeData, dropdownSizes || []);
  
  if (completeSizeList.length === 0) {
    console.warn("PerFit [SHOES]: No valid shoe sizes found");
    return null;
  }

  // Extract context values
  const needsStretchAdjustment = textMeasurement?.isMoccasin || textMeasurement?.manualOverride;
  const isLeatherBoot = textMeasurement?.isLeatherBoot || false;
  const hasLaces = textMeasurement?.hasLaces || false;
  const materialInfo = textMeasurement?.materialInfo || 'leather';
  const recommendedSizeFromText = textMeasurement?.recommendedSizeFromText;
  const storeRecommendation = textMeasurement?.storeRecommendation;
  const isStor = fitHint?.toLowerCase().includes('stor') || false;
  
  // Boot without laces (Chelsea) - high shaft provides security
  const isLacelessBoot = isLeatherBoot && !hasLaces;
  
  console.log(`PerFit [SHOES]: User foot length: ${userFoot}cm, Fit hint: ${fitHint || 'none'}, Moccasin: ${textMeasurement?.isMoccasin || false}, Leather boot: ${isLeatherBoot}, Has laces: ${hasLaces}, Store recommendation: ${storeRecommendation || 'none'}, Manual override: ${textMeasurement?.manualOverride || false}, Material: ${materialInfo || 'none'}`);

  // === SHOE FIT LOGIC FRAMEWORK ===
  let stretchAdjustment = 0;
  let isBorderCase = false;
  let technicalSize: string | null = null;
  let maxAllowedBuffer = 0.4;
  let minAllowedBuffer = -0.2;
  let constructionNote = '';
  
  // === CONSTRUCTION-BASED FIT RULES ===
  const isLacedFootwear = hasLaces || (!isLeatherBoot && !needsStretchAdjustment && !isLacelessBoot);
  
  if (isLacelessBoot) {
    // === CHELSEA BOOTS ===
    // High shaft provides ankle support and keeps foot in place
    // No stretch adjustment needed - shaft does the work
    stretchAdjustment = 0.0;
    maxAllowedBuffer = 0.4; // Same as laced - shaft provides security
    minAllowedBuffer = -0.3; // Accept down to 0.3cm under foot
    constructionNote = 'Chelsea boot (high shaft provides secure fit)';
    console.log(`PerFit [SHOES]: 🥾 CHELSEA BOOT detected - Target: ${userFoot}cm, Buffer range: ${minAllowedBuffer}cm to +${maxAllowedBuffer}cm`);
  } else if (needsStretchAdjustment) {
    // === LOAFERS/MOCCASINS ===
    // Must fit snugly to prevent heel slippage - no shaft to hold foot
    stretchAdjustment = -0.3;
    maxAllowedBuffer = 0.2; // Never accept more than 0.2cm over foot length
    minAllowedBuffer = -0.5; // Absolute limit for low-cut slip-ons
    constructionNote = 'Loafer/Moccasin (must fit snugly to prevent heel slip)';
    console.log(`PerFit [SHOES]: 👟 LOAFER/MOCCASIN detected - Target: ${(userFoot + stretchAdjustment).toFixed(1)}cm, Buffer range: ${minAllowedBuffer}cm to +${maxAllowedBuffer}cm`);
  } else if (isLacedFootwear) {
    // === LACED FOOTWEAR ===
    // Laces provide locking - foot stays in place
    stretchAdjustment = 0;
    maxAllowedBuffer = 0.4;
    minAllowedBuffer = -0.2;
    constructionNote = 'Laced (laces provide secure fit)';
    console.log(`PerFit [SHOES]: 👢 LACED footwear - Target: ${userFoot}cm, Buffer range: ${minAllowedBuffer}cm to +${maxAllowedBuffer}cm`);
  }
  
  // === FIT HINT OVERRIDE ===
  if (isStor) {
    stretchAdjustment -= 0.3;
    console.log(`PerFit [SHOES]: ⚠️ 'Stor' hint - additional -0.3cm adjustment applied`);
  } else if (fitHint?.toLowerCase().includes('liten')) {
    stretchAdjustment += 0.2;
    console.log(`PerFit [SHOES]: ⚠️ 'Liten' hint - additional +0.2cm adjustment applied`);
  }

  const target = userFoot + stretchAdjustment;
  console.log(`PerFit [SHOES]: 🎯 Final target: ${target.toFixed(1)}cm (foot: ${userFoot}cm, adjustment: ${stretchAdjustment}cm)`);
  console.log(`PerFit [SHOES]: 📏 Construction: ${constructionNote}`);

  // === PRIORITY 1: CHECK STORE RECOMMENDATION FIRST ===
  let expertOverride = false;
  let storeRecommendationNote = '';
  
  if (storeRecommendation) {
    const storeSize = completeSizeList.find(s => s.size === storeRecommendation);
    if (storeSize) {
      const storeBuffer = storeSize.footLength - userFoot;
      
      console.log(`PerFit [SHOES]: 🔍 STORE CHECK - Store recommends: ${storeRecommendation} (${storeSize.footLength}cm), Buffer: +${storeBuffer.toFixed(2)}cm, Max allowed: +${maxAllowedBuffer}cm`);
      
      // If store recommendation is within acceptable buffer range, use it
      if (storeBuffer <= maxAllowedBuffer && storeBuffer >= minAllowedBuffer) {
        console.log(`PerFit [SHOES]: ✅ Store recommendation is within acceptable range - prioritizing!`);
        expertOverride = true;
        storeRecommendationNote = `Store recommendation (${storeRecommendation}) is safe`;
      } else if (storeBuffer > maxAllowedBuffer) {
        storeRecommendationNote = `Store suggests ${storeRecommendation}, but it's TOO LARGE (+${storeBuffer.toFixed(1)}cm buffer exceeds max ${maxAllowedBuffer}cm)`;
        console.log(`PerFit [SHOES]: ⚠️ Store recommendation exceeds max buffer - will calculate alternative`);
      } else {
        storeRecommendationNote = `Store suggests ${storeRecommendation}, but it may be too small (${storeBuffer.toFixed(1)}cm buffer)`;
        console.log(`PerFit [SHOES]: ⚠️ Store recommendation below min buffer - will calculate alternative`);
      }
    }
  }

  // === FIND BEST MATCH (with construction constraints) ===
  let bestMatch: ShoeSize | null = null;
  let secondBestMatch: ShoeSize | null = null;
  let smallestDiff = Infinity;
  let secondSmallestDiff = Infinity;

  // If store recommendation is valid, use it directly
  if (expertOverride && storeRecommendation) {
    bestMatch = completeSizeList.find(s => s.size === storeRecommendation) || null;
    if (bestMatch) {
      // Find second best for dual view
      for (const shoeSize of completeSizeList) {
        if (shoeSize.size === bestMatch.size) continue;
        const diff = Math.abs(shoeSize.footLength - target);
        if (diff < secondSmallestDiff) {
          secondSmallestDiff = diff;
          secondBestMatch = shoeSize;
        }
      }
      smallestDiff = Math.abs(bestMatch.footLength - target);
    }
  }

  // If no store recommendation or it was invalid, calculate best match
  if (!bestMatch) {
    for (const shoeSize of completeSizeList) {
      const diff = Math.abs(shoeSize.footLength - target);
      const bufferOverFoot = shoeSize.footLength - userFoot;
      
      // Reject sizes outside acceptable buffer range
      if (bufferOverFoot > maxAllowedBuffer) {
        console.log(`PerFit [SHOES]: ❌ Size ${shoeSize.size} (${shoeSize.footLength}cm) rejected - buffer ${bufferOverFoot.toFixed(1)}cm exceeds max ${maxAllowedBuffer}cm`);
        continue;
      }
      if (bufferOverFoot < minAllowedBuffer) {
        console.log(`PerFit [SHOES]: ❌ Size ${shoeSize.size} (${shoeSize.footLength}cm) rejected - buffer ${bufferOverFoot.toFixed(1)}cm below min ${minAllowedBuffer}cm (too small)`);
        continue;
      }
      
      if (diff < smallestDiff) {
        secondSmallestDiff = smallestDiff;
        secondBestMatch = bestMatch;
        smallestDiff = diff;
        bestMatch = shoeSize;
      } else if (diff < secondSmallestDiff) {
        secondSmallestDiff = diff;
        secondBestMatch = shoeSize;
      }
    }
  }

  if (!bestMatch) {
    // Fallback: if all sizes rejected, find closest match ignoring constraints
    console.warn(`PerFit [SHOES]: All sizes exceeded buffer constraints - falling back to closest match`);
    for (const shoeSize of completeSizeList) {
      const diff = Math.abs(shoeSize.footLength - target);
      if (diff < smallestDiff) {
        secondSmallestDiff = smallestDiff;
        secondBestMatch = bestMatch;
        smallestDiff = diff;
        bestMatch = shoeSize;
      }
    }
  }

  if (!bestMatch) {
    console.warn(`PerFit [SHOES]: No match found for foot ${userFoot}cm`);
    return null;
  }
  
  // === BUFFER WARNING CHECK ===
  const finalBuffer = bestMatch.footLength - userFoot;
  let bufferWarning = '';
  if (finalBuffer > maxAllowedBuffer) {
    bufferWarning = `WARNING: Buffer of +${finalBuffer.toFixed(1)}cm exceeds recommended max (${maxAllowedBuffer}cm)`;
    console.log(`PerFit [SHOES]: ${bufferWarning}`);
  } else if (finalBuffer < minAllowedBuffer) {
    bufferWarning = `WARNING: Size ${bestMatch.size} may be too small (${finalBuffer.toFixed(1)}cm under foot length, min: ${minAllowedBuffer}cm)`;
    console.log(`PerFit [SHOES]: ${bufferWarning}`);
  }
  
  // === PRIORITY 2: EXPERT RECOMMENDATION FROM TEXT ===
  // If text contains "vi anbefaler størrelse X", consider it (if store recommendation wasn't already used)
  if (!expertOverride && recommendedSizeFromText) {
    const expertSize = completeSizeList.find(s => s.size === recommendedSizeFromText);
    if (expertSize) {
      const expertDiff = Math.abs(expertSize.footLength - userFoot);
      if (expertDiff <= 1.0) {
        console.log(`PerFit [SHOES]: 🎯 Expert recommendation "${recommendedSizeFromText}" found and within 1.0cm of user's foot - prioritizing!`);
        technicalSize = bestMatch.size;
        bestMatch = expertSize;
        expertOverride = true;
      } else {
        console.log(`PerFit [SHOES]: Expert recommendation "${recommendedSizeFromText}" is ${expertDiff.toFixed(1)}cm away - too far, ignoring`);
      }
    }
  }

  // === BORDER CASE: Choose smaller size for loafers/moccasins ONLY ===
  // Chelsea boots don't need this - high shaft keeps foot secure
  // Skip if store/expert recommendation was already accepted
  if (!expertOverride && needsStretchAdjustment && secondBestMatch && Math.abs(smallestDiff - secondSmallestDiff) < 0.3) {
    isBorderCase = true;
    
    if (bestMatch.footLength > secondBestMatch.footLength) {
      console.log(`PerFit [SHOES]: Border case (loafer/moccasin) - swapping to smaller size ${secondBestMatch.size} (${secondBestMatch.footLength}cm) instead of ${bestMatch.size} (${bestMatch.footLength}cm)`);
      bestMatch = secondBestMatch;
    } else {
      console.log(`PerFit [SHOES]: Border case (loafer/moccasin) - keeping smaller size ${bestMatch.size} (${bestMatch.footLength}cm)`);
    }
  } else if (!expertOverride && needsStretchAdjustment && secondBestMatch) {
    const smallerSize = bestMatch.footLength < secondBestMatch.footLength ? bestMatch : secondBestMatch;
    const smallerDiff = Math.abs(smallerSize.footLength - target);
    
    if (smallerDiff < 0.5 && smallerSize !== bestMatch) {
      console.log(`PerFit [SHOES]: Loafer/moccasin snug fit - choosing smaller size ${smallerSize.size} (${smallerSize.footLength}cm) with diff ${smallerDiff.toFixed(2)}cm to avoid slipping`);
      bestMatch = smallerSize;
      isBorderCase = true;
    }
  } else if (expertOverride) {
    console.log(`PerFit [SHOES]: Skipping border case logic - store/expert recommendation takes priority`);
  }

  console.log(`PerFit [SHOES]: ✅ Best match - Size ${bestMatch.size} (${bestMatch.footLength}cm)${bestMatch.isInterpolated ? ' [interpolated]' : ''}`);

  // === DUAL RECOMMENDATION CHECK ===
  // For moccasins/loafers, show both 'Snug Fit' and 'Comfort Fit' options
  let isDual = false;
  let snugSize: ShoeSize | null = null;
  let comfortSize: ShoeSize | null = null;
  let isStorAdjusted = false;
  
  // Dual view for 'stor' items
  if (isStor && !technicalSize && secondBestMatch) {
    const largerSize = bestMatch.footLength > secondBestMatch.footLength ? bestMatch : secondBestMatch;
    const smallerSize = bestMatch.footLength < secondBestMatch.footLength ? bestMatch : secondBestMatch;
    
    technicalSize = largerSize.size;
    bestMatch = smallerSize;
    isDual = true;
    isStorAdjusted = true;
    snugSize = smallerSize;
    comfortSize = largerSize;
    console.log(`PerFit [SHOES]: 🎯 'Stor' dual view - Technical: ${technicalSize}, Recommended: ${bestMatch.size}`);
  } else if (needsStretchAdjustment && secondBestMatch) {
    // Slip-on dual logic - show Snug Fit and Comfort Fit
    const largerSize = bestMatch.footLength > secondBestMatch.footLength ? bestMatch : secondBestMatch;
    const smallerSize = bestMatch.footLength < secondBestMatch.footLength ? bestMatch : secondBestMatch;
    const footLengthDiff = largerSize.footLength - smallerSize.footLength;
    
    const largerBuffer = largerSize.footLength - userFoot;
    const smallerBuffer = smallerSize.footLength - userFoot;
    
    // Trigger dual recommendation if gap between sizes is significant
    if (footLengthDiff > 0.5 && largerBuffer <= 0.5 && largerBuffer >= -0.3) {
      isDual = true;
      comfortSize = largerSize;  // Comfort Fit - closer to target
      snugSize = smallerSize;    // Snug Fit - tighter, prevents heel slip
      bestMatch = snugSize;      // Recommend snug as primary for slip-ons
      
      console.log(`PerFit [SHOES]: 🎯 Slip-on dual recommendation - Comfort Fit: ${comfortSize.size} (${comfortSize.footLength}cm, +${largerBuffer.toFixed(2)}cm), Snug Fit: ${snugSize.size} (${snugSize.footLength}cm, ${smallerBuffer.toFixed(2)}cm), gap: ${footLengthDiff.toFixed(2)}cm`);
    }
  }

  // === BUILD FIT NOTE ===
  let fitNote = '';
  
  if (expertOverride && storeRecommendation) {
    fitNote = `Following store recommendation: size ${storeRecommendation}`;
  } else if (expertOverride && recommendedSizeFromText) {
    fitNote = `Following expert recommendation: size ${recommendedSizeFromText}`;
  } else if (isStorAdjusted && technicalSize) {
    fitNote = `Item runs large - recommending ${bestMatch.size} (technical match: ${technicalSize})`;
  } else if (isLacelessBoot) {
    // Chelsea boot specific fit messages based on buffer
    if (finalBuffer >= -0.1) {
      fitNote = `${constructionNote} - size ${bestMatch.size}`;
    } else if (finalBuffer >= -0.3) {
      fitNote = `Slightly snug, ideal for leather boots that will shape to your foot`;
    } else {
      fitNote = `Warning: May be very tight during break-in period`;
    }
  } else if (isDual && snugSize && comfortSize) {
    fitNote = `Slip-on ${materialInfo} stretches over time`;
  } else if (needsStretchAdjustment) {
    if (fitHint?.toLowerCase().includes('stor')) {
      fitNote = `Recommending ${bestMatch.size} as slip-on ${materialInfo} stretches significantly. Since item also runs large, ${parseInt(bestMatch.size) + 1} will quickly become too loose`;
    } else if (isBorderCase) {
      fitNote = `Chose ${bestMatch.size} as slip-on ${materialInfo} stretches and would otherwise cause heel slip`;
    } else {
      fitNote = `Chose ${bestMatch.size} as slip-on ${materialInfo} stretches and would otherwise cause heel slip`;
    }
  } else if (fitHint?.toLowerCase().includes('stor')) {
    fitNote = 'Item runs large - sized down accordingly';
  } else if (isLacedFootwear) {
    const actualBuffer = bestMatch.footLength - userFoot;
    fitNote = `${constructionNote} - ${actualBuffer <= 0.2 ? 'PERFECT' : actualBuffer <= 0.4 ? 'IDEAL' : 'ROOMY'} fit (+${actualBuffer.toFixed(1)}cm)`;
  } else {
    const actualDiff = bestMatch.footLength - userFoot;
    const cat = actualDiff < 0.4 ? "SNUG FIT" : actualDiff <= 0.9 ? "IDEAL FIT" : "ROOMY FIT";
    fitNote = `${cat} (+${actualDiff.toFixed(1)}cm room)`;
  }
  
  // Add buffer warning to fitNote if applicable
  if (bufferWarning) {
    fitNote = bufferWarning + '\n' + fitNote;
  }

  // Convert ShoeSize back to SizeRow for matchedRow
  const matchedRow: SizeRow = {
    intSize: bestMatch.size,
    chest: 0,
    waist: 0,
    hip: 0,
    footLength: bestMatch.footLength,
    rowIndex: bestMatch.rowIndex ?? -1
  };

  // === BUILD RETURN OBJECT ===
  const recommendation: SizeRecommendation = {
    size: isDual && snugSize ? snugSize.size : bestMatch.size,
    confidence: needsStretchAdjustment ? 0.90 : 0.95,
    category: 'shoes',
    userChest: userFoot,
    targetChest: bestMatch.footLength,
    buffer: stretchAdjustment,
    matchedRow: matchedRow,
    fitNote: fitNote,
    userFootLength: userFoot
  };
  
  // Add dual recommendation fields if applicable
  if (isDual && snugSize && comfortSize) {
    recommendation.isDual = true;
    recommendation.secondarySize = comfortSize.size;
  }
  
  // Add 'stor' adjustment fields
  if (isStorAdjusted && technicalSize) {
    recommendation.technicalSize = technicalSize;
    recommendation.isStorAdjusted = true;
  }
  
  // Add store recommendation cross-check
  if (storeRecommendation) {
    recommendation.storeRecommendation = storeRecommendation;
    recommendation.storeRecommendationNote = storeRecommendationNote;
  }
  
  return recommendation;
}
