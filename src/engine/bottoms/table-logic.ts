// Table-based (S/M/L/EU) logic for bottoms
import { SizeRow, UserProfile, SizeRecommendation } from '../../stores/types';
import { MENS_JEANS_WAIST_MAPPING } from '../constants';

/**
 * Size Map: Translate letter sizes to numeric equivalents
 * Returns array of possible numeric sizes for each letter size
 */
function getSizeMap(): Record<string, string[]> {
  return {
    'XS': ['28'],
    'S': ['29', '30'],
    'M': ['31', '32'],
    'L': ['33', '34'],
    'XL': ['36', '38'],
    'XXL': ['40', '42']
  };
}

/**
 * Translate letter size (M, L) to numeric waist size (31, 32) based on waist measurement
 * Uses intelligent mapping to find best match from available sizes
 * @param letterSize - Letter size from table (e.g., 'M', 'L')
 * @param waistCm - User's waist measurement in cm
 * @param availableSizes - Available sizes from dropdown (optional, for validation)
 */
function translateLetterToNumericSize(
  letterSize: string, 
  waistCm: number, 
  availableSizes?: string[]
): string {
  const sizeMap = getSizeMap();
  const sizeUpper = letterSize.toUpperCase();
  const possibleSizes = sizeMap[sizeUpper];
  
  if (!possibleSizes || possibleSizes.length === 0) {
    console.log(`PerFit: No mapping found for ${letterSize}, returning original`);
    return letterSize;
  }
  
  // If availableSizes provided, filter to only available options
  const candidateSizes = availableSizes 
    ? possibleSizes.filter(size => availableSizes.includes(size))
    : possibleSizes;
  
  if (candidateSizes.length === 0) {
    console.log(`PerFit: No available sizes match ${letterSize}, using first from map: ${possibleSizes[0]}`);
    return possibleSizes[0];
  }
  
  // Find closest numeric size based on waist measurement
  let closestSize = candidateSizes[0];
  let minDiff = Infinity;
  
  candidateSizes.forEach(numSize => {
    const sizeNum = parseInt(numSize);
    const sizeWaistCm = MENS_JEANS_WAIST_MAPPING[sizeNum] || sizeNum * 2.54;
    const diff = Math.abs(sizeWaistCm - waistCm);
    if (diff < minDiff) {
      minDiff = diff;
      closestSize = numSize;
    }
  });
  
  console.log(`PerFit: Translated ${letterSize} → ${closestSize} for ${waistCm}cm waist (options: [${candidateSizes.join(', ')}])`);
  return closestSize;
}

/**
 * Table-based (S/M/L/EU) logic for bottoms
 * Standard table-matching (waist >= userWaist && hip >= userHip)
 */
export function calculateTableRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  textData?: {
    isAnkleLength?: boolean;
    lengthType?: string;
    stretch?: number;
    modelHeight?: number;
    modelSize?: string;  // Add modelSize property
    inseamLength?: number;
    inseamLengthSize?: string;
    fit?: string;  // 'Relaxed', 'Slim', 'Regular', etc.
    brandSizeSuggestion?: number;  // +1, -1, or 0
  },
  availableSizes?: string[]  // Available sizes from dropdown (for translation validation)
): SizeRecommendation | null {
  let userWaist = parseInt(userProfile.waist);
  let userHip = parseInt(userProfile.hip);
  const userInseam = userProfile.inseam ? parseInt(userProfile.inseam) : null;
  const originalWaist = userWaist;
  const originalHip = userHip;
  
  if (isNaN(userWaist) || userWaist <= 0) {
    console.error("PerFit: Invalid waist measurement:", userProfile.waist);
    return null;
  }
  if (isNaN(userHip) || userHip <= 0) {
    console.error("PerFit: Invalid hip measurement:", userProfile.hip);
    return null;
  }
  
  // Check if model data is available
  const hasModelData = textData?.modelHeight !== undefined;

  // Inseam anchor note (for fitNote)
  const productInseam = textData?.inseamLength;
  const productInseamSize = textData?.inseamLengthSize;
  let inseamAnchorNote = '';
  if (productInseam && userInseam) {
    const inseamDiff = Math.abs(productInseam - userInseam);
    if (inseamDiff <= 1.5 && productInseamSize) {
      const lockedLength = productInseamSize.match(/L(\d{2})$/i)?.[1] || productInseamSize.split('X')[1] || productInseamSize.split('/')[1] || productInseamSize.split(' ')[1];
      inseamAnchorNote = `Size ${lockedLength} is a confirmed ${productInseam}cm match for your legs based on product details`;
    } else if (inseamDiff <= 3) {
      inseamAnchorNote = `Your inseam: ${userInseam}cm • Item inseam: ${productInseam}cm → Good fit`;
    } else if (productInseam > userInseam) {
      inseamAnchorNote = `Your inseam: ${userInseam}cm • Item inseam: ${productInseam}cm → May need hemming`;
    } else {
      inseamAnchorNote = `Your inseam: ${userInseam}cm • Item inseam: ${productInseam}cm → May be short`;
    }
  }

  // Fit hint adjustment - REMOVED to prevent double-adjustment
  // brandSizeSuggestion handles all sizing changes (+1/-1 size)
  let sizeAdjustmentNote = '';
  const isRelaxedFit = textData?.fit?.toLowerCase() === 'relaxed' || textData?.fit?.toLowerCase() === 'regular';
  
  console.log(`PerFit [BOTTOMS]: Fit hint removed - using only brandSizeSuggestion to prevent double-adjustment`);
  
  // === UNIVERSAL BRAND SIZE SUGGESTION (INDEX-SHIFTING) ===
  // Apply BEFORE table matching to shift the entire recommendation
  const brandSuggestion = textData?.brandSizeSuggestion || 0;
  let baseIndexOffset = 0; // How many indices to shift from natural match
  let brandFitNote = '';
  let brandSecondaryNote = '';
  
  if (brandSuggestion !== 0) {
    baseIndexOffset = brandSuggestion; // +1 for "liten", -1 for "stor"
    
    if (brandSuggestion > 0) {
      // Varen er LITEN
      brandFitNote = 'Siden varen er liten, sikrer denne at plagget er komfortabelt';
      brandSecondaryNote = 'Tight Fit - Sitter helt tett';
    } else if (brandSuggestion < 0) {
      // Varen er STOR
      brandFitNote = 'Siden varen er stor, vil denne sitte som din normale størrelse';
      brandSecondaryNote = 'Relaxed Fit - Litt romsligere enn målene dine';
    }
    
    console.log(`PerFit [BOTTOMS]: 🏷️ BRAND ADJUSTMENT: ${brandSuggestion > 0 ? '+1 (liten)' : '-1 (stor)'} - will shift index by ${baseIndexOffset}`);
  }
  
  // === DYNAMIC HIP FILTERING ===
  // Find smallest hip measurement in size table
  const smallestHip = Math.min(...sizeData.map(s => s.hip));
  // If user's hip is smaller than table minimum, ignore hip completely in calculations
  const shouldIgnoreHip = originalHip < smallestHip;
  
  if (shouldIgnoreHip) {
    console.log(`PerFit [BOTTOMS]: ✅ Dynamic Hip Filtering ACTIVE`);
    console.log(`PerFit [BOTTOMS]: User hip (${originalHip}cm) < Table min (${smallestHip}cm)`);
    console.log(`PerFit [BOTTOMS]: → Hip parameter will be IGNORED, using waist only`);
  } else {
    console.log(`PerFit [BOTTOMS]: Hip filtering NOT needed (user: ${originalHip}cm >= table min: ${smallestHip}cm)`);
  }
  
  // For Relaxed Fit: collect matching sizes and choose smallest
  let matchingSizes: SizeRow[] = [];

  // Table-matching logic with brand index shifting
  let baseMatchIndex = -1; // Index of first natural match
  
  for (let i = 0; i < sizeData.length; i++) {
    const size = sizeData[i];
    const waistFits = size.waist >= userWaist;
    const hipFits = shouldIgnoreHip || size.hip >= userHip;
    
    if (waistFits && hipFits) {
      if (baseMatchIndex === -1) {
        baseMatchIndex = i; // Record first match
      }
      
      if (isRelaxedFit) {
        // For Relaxed Fit: collect all matching sizes
        matchingSizes.push(size);
      } else {
        // Standard logic: Apply brand index shift
        const targetIndex = Math.max(0, Math.min(sizeData.length - 1, baseMatchIndex + baseIndexOffset));
        const targetSize = sizeData[targetIndex];
        const alternativeIndex = baseMatchIndex; // Original natural match becomes alternative
        const alternativeSize = baseMatchIndex >= 0 && baseMatchIndex < sizeData.length ? sizeData[alternativeIndex] : null;
        
        let fitNote = brandFitNote || '';
        let isDual = false;
        let secondarySize: string | undefined = undefined;
        let secondarySizeNote: string | undefined = undefined;
        
        // Add dual recommendation if brand adjustment was applied
        if (baseIndexOffset !== 0 && alternativeSize && targetIndex !== alternativeIndex) {
          isDual = true;
          secondarySize = alternativeSize.intSize;
          secondarySizeNote = brandSecondaryNote;
          console.log(`PerFit [BOTTOMS]: Brand shift applied - Best: ${targetSize.intSize} (index ${targetIndex}), Alt: ${secondarySize} (index ${alternativeIndex})`);
        }
        
        // Add inseam info to fitNote if available
        if (!fitNote && !hasModelData) {
          fitNote = `Recommended ${targetSize.intSize} based on ${textData?.fit || 'fit type'} and your ${originalWaist}cm waist`;
        } else if (inseamAnchorNote && !brandFitNote) {
          fitNote = inseamAnchorNote;
        } else if (userInseam && targetSize.inseam && !brandFitNote) {
          const diff = targetSize.inseam - userInseam;
          if (textData?.isAnkleLength) {
            fitNote = 'Designed to end at the ankle';
          } else if (diff > 4) {
            fitNote = `Warning: Inseam is ${diff.toFixed(1)}cm longer than your ${userInseam}cm legs - may need hemming`;
          } else if (diff < -3) {
            fitNote = 'May be slightly short in the legs';
          } else if (diff > 2) {
            fitNote = `Pants are ${diff.toFixed(1)}cm longer, can be hemmed if needed`;
          }
        }
        
        if (shouldIgnoreHip && !brandFitNote) {
          fitNote += (fitNote ? ' • ' : '') + 'Hip measurement ignored (smaller than size chart)';
        }
        
        // Translate letter size to numeric if needed
        const displaySize = /^[A-Z]+$/.test(targetSize.intSize)
          ? translateLetterToNumericSize(targetSize.intSize, originalWaist, availableSizes)
          : targetSize.intSize;
        
        const secondaryDisplaySize = secondarySize && /^[A-Z]+$/.test(secondarySize)
          ? translateLetterToNumericSize(secondarySize, originalWaist, availableSizes)
          : secondarySize;
        
        return {
          size: displaySize,
          confidence: 1.0,
          category: 'bottom',
          userChest: originalWaist,
          targetChest: targetSize.waist,
          buffer: 0,
          matchedRow: targetSize,
          fitNote: fitNote.trim(),
          userWaist: originalWaist,
          userHip: originalHip,
          userInseam: userInseam || undefined,
          userHeight: userProfile.height ? parseInt(userProfile.height) : undefined,
          inseamLength: productInseam,
          inseamLengthSize: productInseamSize,
          isDual: isDual || undefined,
          secondarySize: secondaryDisplaySize,
          secondarySizeNote: secondarySizeNote
        };
      }
    }
  }
  
  // Relaxed Fit: Choose smallest matching size with dual recommendation
  if (isRelaxedFit && matchingSizes.length > 0) {
    // Apply brand index shift to Relaxed Fit as well
    const naturalIndex = 0; // First match in matchingSizes (smallest)
    const targetIndex = Math.max(0, Math.min(matchingSizes.length - 1, naturalIndex + baseIndexOffset));
    const alternativeIndex = naturalIndex; // Original smallest match
    
    let smallestMatch = matchingSizes[targetIndex];
    let fitNote = brandFitNote || '';
    let secondarySize: string | undefined = undefined;
    let secondarySizeNote: string | undefined = brandSecondaryNote;
    let isDual = false;
    
    // Add dual recommendation if brand adjustment was applied
    if (baseIndexOffset !== 0 && targetIndex !== alternativeIndex) {
      isDual = true;
      secondarySize = matchingSizes[alternativeIndex].intSize;
      console.log(`PerFit [BOTTOMS]: Relaxed Fit with brand shift - Best: ${smallestMatch.intSize} (index ${targetIndex}), Alt: ${secondarySize} (index ${alternativeIndex})`);
    } else {
      console.log(`PerFit [BOTTOMS]: Relaxed/Regular Fit detected - prioritizing smaller size`);
    }
    
    // === MODEL COMPARISON: "Grain of Salt" + "Model-Match" Logic ===
    // If model size is available and recommendation is 2+ sizes larger, reconsider
    let modelSize: string | null = null;
    let modelHeight: number | null = null;
    let heightDiff: number | null = null;
    
    if (textData?.modelSize) {
      modelSize = textData.modelSize;
      modelHeight = textData.modelHeight || null;
      heightDiff = modelHeight && userProfile.height ? modelHeight - parseInt(userProfile.height) : null;
      
      const modelSizeNum = parseInt(modelSize || '');
      const recommendedSizeNum = parseInt(smallestMatch.intSize);
      
      if (!isNaN(modelSizeNum) && !isNaN(recommendedSizeNum)) {
        const sizeDiff = recommendedSizeNum - modelSizeNum;
        console.log(`PerFit [BOTTOMS]: Model (${modelHeight || '?'}cm) wears ${modelSize}, system recommends ${smallestMatch.intSize} (diff: ${sizeDiff} sizes)`);
        console.log(`PerFit [BOTTOMS]: User height: ${userProfile.height || '?'}cm, heightDiff: ${heightDiff !== null ? heightDiff + 'cm' : 'unknown'}`);
        
        // AGGRESSIVE: If user is between sizes and within 2cm of smaller size, force to smaller on Regular/Relaxed
        if (sizeDiff >= 1 && (textData.fit === 'Regular' || textData.fit === 'Relaxed')) {
          // MODEL-MATCH RULE: If user is SHORTER than model and would jump 2+ sizes, prioritize middle size
          if (heightDiff !== null && heightDiff > 0 && sizeDiff >= 2) {
            console.log(`PerFit [BOTTOMS]: 🎯 MODEL-MATCH - User is ${heightDiff}cm SHORTER than model but 2+ sizes larger`);
            // Find middle size between model and table recommendation
            const middleSizeNum = modelSizeNum + 1; // One size up from model
            const middleRow = sizeData.find(row => parseInt(row.intSize) === middleSizeNum);
            if (middleRow && middleRow.waist >= originalWaist - 2) {
              console.log(`PerFit [BOTTOMS]: ✅ Prioritizing middle size ${middleRow.intSize} (between model ${modelSize} and table ${smallestMatch.intSize})`);
              // Force to middle size as primary
              matchingSizes = [middleRow, smallestMatch];
              smallestMatch = middleRow;
            }
          }
          
          // Check if there's a smaller size in the table that user is close to
          const smallerSizes = sizeData.filter(row => parseInt(row.intSize) < recommendedSizeNum);
          if (smallerSizes.length > 0) {
            const closestSmaller = smallerSizes[smallerSizes.length - 1]; // Last one (closest to user)
            const waistOverhang = originalWaist - closestSmaller.waist;
            console.log(`PerFit [BOTTOMS]: Checking smaller size ${closestSmaller.intSize} - user overhang: ${waistOverhang.toFixed(1)}cm`);
            
            // If user is within 2cm of smaller size, force to it
            if (waistOverhang >= 0 && waistOverhang <= 2) {
              console.log(`PerFit [BOTTOMS]: ✅ GRAIN OF SALT - Forcing to smaller size ${closestSmaller.intSize} (user only ${waistOverhang.toFixed(1)}cm over)`);
              // Override smallestMatch
              const originalSmallest = smallestMatch;
              matchingSizes.unshift(closestSmaller); // Add to front
              matchingSizes = [closestSmaller, originalSmallest]; // Force dual with smaller as primary
            }
          }
        }
        
        // If recommendation is 2+ sizes larger than model AND product is Regular/Relaxed
        if (sizeDiff >= 2 && (textData.fit === 'Regular' || textData.fit === 'Relaxed')) {
          console.log(`PerFit [BOTTOMS]: ⚠️ GRAIN OF SALT - Recommendation too large compared to model`);
          
          // Force to model's size if user measurements are within reasonable range (+/- 2-3cm)
          const modelRow = sizeData.find(row => row.intSize === modelSize);
          if (modelRow) {
            const waistDiffFromModel = Math.abs(modelRow.waist - originalWaist);
            if (waistDiffFromModel <= 3) {
              console.log(`PerFit [BOTTOMS]: ✅ Forcing to model size ${modelSize} (waist diff: ${waistDiffFromModel.toFixed(1)}cm)`);
              // Offer dual: model size as primary, table size as secondary
              isDual = true;
              secondarySize = smallestMatch.intSize;
              secondarySizeNote = `Based on body measurements (${smallestMatch.waist}cm waist)`;
              // Override primary to model size
              const adjustedMatch = modelRow;
              fitNote = `Adjusted to model's size. `;
              if (heightDiff && Math.abs(heightDiff) > 5) {
                fitNote += `Model is ${Math.abs(heightDiff)}cm ${heightDiff > 0 ? 'taller' : 'shorter'} than you and wears size ${modelSize}. `;
              } else {
                fitNote += `Model wears size ${modelSize}. `;
              }
              fitNote += `We adjusted your recommendation to avoid oversizing.`;
              
              // Return model size as primary recommendation
              const displaySize = /^[A-Z]+$/.test(adjustedMatch.intSize)
                ? translateLetterToNumericSize(adjustedMatch.intSize, originalWaist)
                : adjustedMatch.intSize;
              const secondaryDisplaySize = /^[A-Z]+$/.test(secondarySize)
                ? translateLetterToNumericSize(secondarySize, originalWaist)
                : secondarySize;
              
              return {
                size: displaySize,
                confidence: 0.95,
                category: 'bottom',
                userChest: originalWaist,
                targetChest: adjustedMatch.waist,
                buffer: 0,
                matchedRow: adjustedMatch,
                fitNote: fitNote.trim(),
                userWaist: originalWaist,
                userHip: originalHip,
                isDual: true,
                secondarySize: secondaryDisplaySize,
                secondarySizeNote: secondarySizeNote
              };
            }
          }
        }
      }
    }
    
    // === INTELLIGENT FIT ADJUSTMENT ===
    // Check if user is less than 2cm over the boundary for a smaller size
    if (matchingSizes.length > 1) {
      // Re-assign in case model logic modified matchingSizes
      const primaryMatch = matchingSizes[0];
      const secondMatch = matchingSizes[1];
      const waistDiff1 = Math.abs(primaryMatch.waist - originalWaist);
      const waistDiff2 = Math.abs(secondMatch.waist - originalWaist);
      
      console.log(`PerFit [BOTTOMS]: User ${originalWaist}cm between ${primaryMatch.intSize} (${primaryMatch.waist}cm) and ${secondMatch.intSize} (${secondMatch.waist}cm)`);
      console.log(`PerFit [BOTTOMS]: Diffs: ${primaryMatch.intSize}=${waistDiff1.toFixed(1)}cm, ${secondMatch.intSize}=${waistDiff2.toFixed(1)}cm`);
      
      // Offer dual recommendation if sizes are close (within 3cm of each other)
      if (Math.abs(primaryMatch.waist - secondMatch.waist) <= 3) {
        isDual = true;
        secondarySize = secondMatch.intSize;
        
        // Build contextual notes for dual presentation (NORWEGIAN TEXT)
        if (waistDiff2 < waistDiff1) {
          // Secondary is closer mathematically
          fitNote = modelSize ? `Best Fit - Justert etter modellens størrelse` : `Best Fit - Basert på ${textData?.fit || 'passform'}`;
          secondarySizeNote = `Loose Fit - Basert på tabellmål`;
          console.log(`PerFit [BOTTOMS]: → Dual Match: ${primaryMatch.intSize} (Best Fit) | ${secondMatch.intSize} (Loose Fit, closer match)`);
        } else {
          // Primary is closer
          fitNote = modelSize ? `Best Fit - Justert etter modellens størrelse` : `Best Fit - Basert på ${textData?.fit || 'passform'}`;
          secondarySizeNote = `Loose Fit - Basert på tabellmål`;
          console.log(`PerFit [BOTTOMS]: → Dual Match: ${primaryMatch.intSize} (Best Fit, closer) | ${secondMatch.intSize} (Loose Fit)`);
        }
      }
      
      // Update smallestMatch reference after potential model logic changes
      smallestMatch = matchingSizes[0];
    }
    
    // Build primary fit note (optimized for dual display)
    if (!hasModelData) {
      fitNote = isDual 
        ? `Best Fit (${textData?.fit || 'Relaxed'})` 
        : `No model data available for this item. Recommended ${smallestMatch.intSize} based on ${textData?.fit || 'Relaxed'} Fit and your ${originalWaist}cm waist`;
    } else {
      fitNote = isDual
        ? `Best Fit - Clean look without being baggy`
        : `Recommended ${smallestMatch.intSize} based on ${textData?.fit || 'Relaxed'} Fit. Provides a clean look for your ${originalWaist}cm waist without being too baggy`;
      
      // Add inseam information
      if (inseamAnchorNote) {
        fitNote += ' • ' + inseamAnchorNote;
      } else if (userInseam && smallestMatch.inseam) {
        const diff = smallestMatch.inseam - userInseam;
        if (textData?.isAnkleLength) {
          fitNote += ' • Designed to end at the ankle';
        } else if (diff > 4) {
          // Warning if inseam is more than 4cm longer
          fitNote += ` • Warning: Inseam is ${diff.toFixed(1)}cm longer than your ${userInseam}cm legs - may need hemming`;
        } else if (diff < -3) {
          fitNote += ' • May be slightly short in the legs';
        } else if (diff > 2) {
          fitNote += ` • Pants are ${diff.toFixed(1)}cm longer, can be hemmed if needed`;
        }
      }
    }
    
    if (textData?.stretch === 0 && smallestMatch.waist === userWaist) {
      fitNote += ' (No stretch - may feel tight)';
    }
    if (sizeAdjustmentNote) {
      fitNote = sizeAdjustmentNote + ' • ' + fitNote;
    }
    if (shouldIgnoreHip) {
      fitNote += ' • Hip measurement ignored (smaller than standard size chart)';
    }
    
    // Translate letter size to numeric if needed (e.g., M → 31 for dropdown compatibility)
    const displaySize = /^[A-Z]+$/.test(smallestMatch.intSize) 
      ? translateLetterToNumericSize(smallestMatch.intSize, originalWaist, availableSizes)
      : smallestMatch.intSize;
    
    let secondaryDisplaySize = secondarySize && /^[A-Z]+$/.test(secondarySize)
      ? translateLetterToNumericSize(secondarySize, originalWaist, availableSizes)
      : secondarySize;
    
    // DUPLICATE PREVENTION: If both sizes translate to same number, force looseMatch to next available
    if (secondaryDisplaySize && displaySize === secondaryDisplaySize) {
      console.log(`PerFit [BOTTOMS]: ⚠️ Duplicate sizes detected after translation (${displaySize})`);
      
      // Find next available size in dropdown
      if (availableSizes && availableSizes.length > 0) {
        const numericSizes = availableSizes.filter(s => /^\d+$/.test(s)).map(s => parseInt(s)).sort((a, b) => a - b);
        const currentNum = parseInt(displaySize);
        const nextSize = numericSizes.find(s => s > currentNum);
        
        if (nextSize) {
          secondaryDisplaySize = nextSize.toString();
          secondarySizeNote = `Loose Fit - Basert på tabellmål (justert til neste størrelse)`;
          console.log(`PerFit [BOTTOMS]: ✅ Forced looseMatch to next available size: ${secondaryDisplaySize}`);
        } else {
          // No larger size available - cancel dual recommendation
          console.log(`PerFit [BOTTOMS]: No larger size available, canceling dual recommendation`);
          isDual = false;
          secondaryDisplaySize = undefined;
          secondarySizeNote = undefined;
        }
      }
    }
    
    // Brand adjustment already applied via index-shifting at top of function
    // No additional adjustment needed here
    
    return {
      size: displaySize,
      confidence: 1.0,
      category: 'bottom',
      userChest: originalWaist,
      targetChest: smallestMatch.waist,
      buffer: 0,
      matchedRow: smallestMatch,
      fitNote: fitNote.trim(),
      userWaist: originalWaist,
      userHip: originalHip,
      userInseam: userInseam || undefined,
      userHeight: userProfile.height ? parseInt(userProfile.height) : undefined,
      inseamLength: productInseam,
      inseamLengthSize: productInseamSize,
      isDual: isDual || undefined,
      secondarySize: secondaryDisplaySize,
      secondarySizeNote: secondarySizeNote
    };
  }
  
  return null;
}
