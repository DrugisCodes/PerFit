/**
 * Shoe size calculation logic
 * Handles footwear including special cases like moccasins/loafers
 */

import { SizeRow, UserProfile, SizeRecommendation } from '../stores/types';

/**
 * Interface for shoe size with interpolation support
 */
interface ShoeSize {
  size: string;
  footLength: number;
  isInterpolated: boolean;
  rowIndex?: number;
}

/**
 * Clean shoe size string to handle half sizes and fractions
 * Converts "43 1/3" to "43.33", "43,5" to "43.5"
 * 
 * @param sizeStr - Raw size string from table or dropdown
 * @returns Cleaned decimal string representation
 */
export function cleanShoeSize(sizeStr: string): string {
  sizeStr = sizeStr.trim();
  
  // Handle fractions like "43 1/3"
  const fractionMatch = sizeStr.match(/(\d+)\s+(\d+)\/(\d+)/);
  if (fractionMatch) {
    const whole = parseInt(fractionMatch[1]);
    const numerator = parseInt(fractionMatch[2]);
    const denominator = parseInt(fractionMatch[3]);
    const decimal = (whole + numerator / denominator).toFixed(2);
    return decimal;
  }
  
  // Replace comma with period (European notation)
  return sizeStr.replace(',', '.');
}

/**
 * Interpolate foot length for intermediate sizes
 * 
 * Example: If table shows:
 * - 43 → 27.0cm
 * - 44 → 27.7cm
 * 
 * And dropdown has 43 1/3, calculate:
 * 43 1/3 ≈ 27.0 + (27.7 - 27.0) * (1/3) = 27.23cm
 * 
 * @param size - The size to interpolate (e.g., "43.33" for 43 1/3)
 * @param tableSizes - Array of sizes from the table with known foot lengths
 * @returns Interpolated foot length in cm, or null if cannot interpolate
 */
export function interpolateFootLength(size: string, tableSizes: ShoeSize[]): number | null {
  const sizeNum = parseFloat(size.replace(',', '.').replace(/\s+/g, ''));
  
  if (isNaN(sizeNum) || tableSizes.length < 2) {
    return null;
  }

  // Find the two surrounding whole sizes in the table
  let lowerSize: ShoeSize | null = null;
  let upperSize: ShoeSize | null = null;

  for (let i = 0; i < tableSizes.length - 1; i++) {
    const currentNum = parseFloat(tableSizes[i].size.replace(',', '.'));
    const nextNum = parseFloat(tableSizes[i + 1].size.replace(',', '.'));
    
    if (currentNum <= sizeNum && sizeNum <= nextNum) {
      lowerSize = tableSizes[i];
      upperSize = tableSizes[i + 1];
      break;
    }
  }

  if (!lowerSize || !upperSize) {
    return null;
  }

  // Linear interpolation
  const lowerNum = parseFloat(lowerSize.size.replace(',', '.'));
  const upperNum = parseFloat(upperSize.size.replace(',', '.'));
  const ratio = (sizeNum - lowerNum) / (upperNum - lowerNum);
  const interpolated = lowerSize.footLength + (upperSize.footLength - lowerSize.footLength) * ratio;
  
  console.log(`PerFit [SHOES]: Interpolated size ${size} → ${interpolated.toFixed(2)}cm (between ${lowerSize.size}=${lowerSize.footLength}cm and ${upperSize.size}=${upperSize.footLength}cm)`);
  
  return Math.round(interpolated * 100) / 100; // Round to 2 decimals
}

/**
 * Build complete size list with interpolated intermediate sizes
 * 
 * @param tableSizeData - Raw SizeRow data from table scraping
 * @param dropdownSizes - Array of sizes available in dropdown (may include half sizes)
 * @returns Complete array of ShoeSize including interpolated entries
 */
export function buildCompleteSizeList(tableSizeData: SizeRow[], dropdownSizes: string[]): ShoeSize[] {
  // Convert table data to ShoeSize format
  const tableSizes: ShoeSize[] = tableSizeData
    .filter(row => row.footLength && row.footLength > 0)
    .map(row => ({
      size: cleanShoeSize(row.intSize),
      footLength: row.footLength!,
      isInterpolated: false,
      rowIndex: row.rowIndex
    }));

  if (dropdownSizes.length === 0) {
    return tableSizes;
  }

  console.log("PerFit [SHOES]: Checking for intermediate sizes to interpolate...");
  const allSizes: ShoeSize[] = [...tableSizes];

  dropdownSizes.forEach(dropdownSize => {
    const cleanDropdownSize = cleanShoeSize(dropdownSize);
    const alreadyInTable = tableSizes.some(s => s.size === cleanDropdownSize);
    
    if (!alreadyInTable) {
      const interpolatedLength = interpolateFootLength(cleanDropdownSize, tableSizes);
      
      if (interpolatedLength) {
        allSizes.push({
          size: cleanDropdownSize,
          footLength: interpolatedLength,
          isInterpolated: true,
          rowIndex: -1 // Interpolated rows don't exist in original table
        });
        console.log(`PerFit [SHOES]: ✨ Added interpolated size ${cleanDropdownSize} with foot length ${interpolatedLength}cm`);
      }
    }
  });

  // Sort by size number
  allSizes.sort((a, b) => {
    const aNum = parseFloat(a.size.replace(',', '.'));
    const bNum = parseFloat(b.size.replace(',', '.'));
    return aNum - bNum;
  });

  console.log(`PerFit [SHOES]: Total ${allSizes.length} sizes available (${allSizes.filter(s => s.isInterpolated).length} interpolated)`);
  return allSizes;
}

/**
 * Calculate recommendation for shoes
 * Handles moccasins/loafers with stretch factor
 * 
 * MOCCASIN LOGIC:
 * - Detects mokkasinsøm, semsket skinn, lær materials (from textMeasurement)
 * - Applies aggressive size-down for stretchy leather shoes
 * - If on border between two sizes + moccasin + 'stor' hint → always choose smaller
 * - Supports manual override from user (manualOverride flag)
 * 
 * @param userProfile - User's foot length
 * @param sizeData - Size table data
 * @param fitHint - 'liten' or 'stor' (optional)
 * @param textMeasurement - Material info (isMoccasin, isLeatherBoot, hasLaces, storeRecommendation, materialInfo, manualOverride)
 * @param dropdownSizes - Available sizes from dropdown (for interpolation)
 */
export function calculateShoeRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  fitHint?: string,
  textMeasurement?: { isAnkleLength?: boolean; isMoccasin?: boolean; isLeatherBoot?: boolean; hasLaces?: boolean; storeRecommendation?: string; recommendedSizeFromText?: string; materialInfo?: string; manualOverride?: boolean },
  dropdownSizes?: string[]
): SizeRecommendation | null {
  const userFoot = userProfile.footLength ? parseFloat(userProfile.footLength) : null;
  if (!userFoot) return null;

  // Get foot width preference
  const footWidth = userProfile.footWidth; // 'narrow' | 'average' | 'wide' | undefined
  const hasWideFoot = footWidth === 'wide';

  // Build complete size list with interpolated intermediate sizes
  const completeSizeList = buildCompleteSizeList(sizeData, dropdownSizes || []);
  
  if (completeSizeList.length === 0) {
    console.warn("PerFit [SHOES]: No valid shoe sizes found");
    return null;
  }

  // Aktiver buffer hvis enten skraperen fant det, eller brukeren valgte det manuelt
  const needsStretchAdjustment = textMeasurement?.isMoccasin || textMeasurement?.manualOverride;
  const isLeatherBoot = textMeasurement?.isLeatherBoot || false;
  const hasLaces = textMeasurement?.hasLaces || false;
  const materialInfo = textMeasurement?.materialInfo || 'skinn';
  const recommendedSizeFromText = textMeasurement?.recommendedSizeFromText;
  const storeRecommendation = textMeasurement?.storeRecommendation; // Butikkens egen anbefaling
  const isStor = fitHint?.toLowerCase().includes('stor') || false;
  
  // Boot without laces (Chelsea) needs snug fit like moccasins - must not slip
  const isLacelessBoot = isLeatherBoot && !hasLaces;
  
  console.log(`PerFit [SHOES]: User foot length: ${userFoot}cm, Foot width: ${footWidth || 'not set'}, Fit hint: ${fitHint || 'none'}, Moccasin: ${textMeasurement?.isMoccasin || false}, Leather boot: ${isLeatherBoot}, Has laces: ${hasLaces}, Store recommendation: ${storeRecommendation || 'none'}, Manual override: ${textMeasurement?.manualOverride || false}, Material: ${materialInfo || 'none'}`);

  // === SHOE FIT LOGIC FRAMEWORK ===
  // Based on construction type and fit requirements
  let stretchAdjustment = 0;
  let isBorderCase = false;
  let technicalSize: string | null = null; // For dual view when 'stor'
  let maxAllowedBuffer = 0.4; // Default max buffer (cm over foot length)
  let constructionNote = '';
  
  // === CONSTRUCTION-BASED FIT RULES ===
  // Priority 3: Construction determines acceptable fit range
  
  const isLacedFootwear = hasLaces || (!isLeatherBoot && !needsStretchAdjustment && !isLacelessBoot);
  const isSlipOn = needsStretchAdjustment || isLacelessBoot; // Loafers, moccasins, chelsea boots
  
  if (isSlipOn) {
    // === SLIP-ON SHOES (Loafers/Moccasins/Chelsea) ===
    // MUST fit snugly to prevent heel slippage
    // Accept table measurement that is EQUAL to or UP TO 0.2-0.4cm UNDER foot length
    // Leather stretches, so starting tight is correct
    stretchAdjustment = -0.3; // Target slightly under foot length
    maxAllowedBuffer = 0.2; // NEVER accept more than 0.2cm over foot length
    constructionNote = 'Slip-on (må sitte stramt for å unngå glippe)';
    console.log(`PerFit [SHOES]: 👟 SLIP-ON detected - Target: ${(userFoot + stretchAdjustment).toFixed(1)}cm, Max buffer: +${maxAllowedBuffer}cm`);
    
    // Special case: Wide feet on slip-ons (only exception for positive buffer)
    if (hasWideFoot) {
      stretchAdjustment = 0; // Neutral - need room for width
      maxAllowedBuffer = 0.3; // Slightly more buffer allowed for wide feet
      constructionNote = 'Slip-on + bred fot (trenger plass til bredden)';
      console.log(`PerFit [SHOES]: 👟 Slip-on + wide foot - accepting neutral fit`);
    }
  } else if (isLacedFootwear) {
    // === LACED FOOTWEAR (Boots/Sneakers/Oxford) ===
    // Laces provide "locking" - foot stays in place
    // Target: Close to foot length, but NEVER +0.5cm or more buffer
    stretchAdjustment = 0; // Target equals foot length
    maxAllowedBuffer = 0.4; // WARNING: Never exceed this!
    constructionNote = 'Med snøring (lisser gir sikker passform)';
    console.log(`PerFit [SHOES]: 👢 LACED footwear - Target: ${userFoot}cm, Max buffer: +${maxAllowedBuffer}cm`);
    
    // Wide feet: IGNORED for laced shoes - laces compensate
    if (hasWideFoot) {
      console.log(`PerFit [SHOES]: 👢 Wide foot ignored for laced footwear - laces provide adjustment`);
    }
  }
  
  // === FIT HINT OVERRIDE ===
  // Priority 1 adjustment: Store says item runs large/small
  if (isStor) {
    stretchAdjustment -= 0.3; // Additional reduction for 'stor' items
    console.log(`PerFit [SHOES]: ⚠️ 'Stor' hint - additional -0.3cm adjustment applied`);
  } else if (fitHint?.toLowerCase().includes('liten')) {
    stretchAdjustment += 0.2; // Size up for 'liten' items
    console.log(`PerFit [SHOES]: ⚠️ 'Liten' hint - additional +0.2cm adjustment applied`);
  }

  const target = userFoot + stretchAdjustment;
  console.log(`PerFit [SHOES]: 🎯 Final target: ${target.toFixed(1)}cm (foot: ${userFoot}cm, adjustment: ${stretchAdjustment}cm)`);
  console.log(`PerFit [SHOES]: 📏 Construction: ${constructionNote}`);

  // === FIND BEST MATCH (with construction constraints) ===
  let bestMatch: ShoeSize | null = null;
  let secondBestMatch: ShoeSize | null = null;
  let smallestDiff = Infinity;
  let secondSmallestDiff = Infinity;

  for (const shoeSize of completeSizeList) {
    const diff = Math.abs(shoeSize.footLength - target);
    const bufferOverFoot = shoeSize.footLength - userFoot; // Positive = larger than foot
    
    // === CONSTRUCTION CONSTRAINT CHECK ===
    // Reject sizes that exceed max allowed buffer
    if (bufferOverFoot > maxAllowedBuffer) {
      console.log(`PerFit [SHOES]: ❌ Size ${shoeSize.size} (${shoeSize.footLength}cm) rejected - buffer ${bufferOverFoot.toFixed(1)}cm exceeds max ${maxAllowedBuffer}cm`);
      continue; // Skip this size - too big!
    }
    
    if (diff < smallestDiff) {
      // New best match - demote old best to second best
      secondSmallestDiff = smallestDiff;
      secondBestMatch = bestMatch;
      
      smallestDiff = diff;
      bestMatch = shoeSize;
    } else if (diff < secondSmallestDiff) {
      // New second best
      secondSmallestDiff = diff;
      secondBestMatch = shoeSize;
    }
  }

  if (!bestMatch) {
    // If all sizes were rejected due to buffer constraint, fall back to closest match
    console.warn(`PerFit [SHOES]: All sizes exceeded buffer constraint - falling back to closest match`);
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
    bufferWarning = `⚠️ ADVARSEL: Buffer på +${finalBuffer.toFixed(1)}cm overskrider anbefalt maks (${maxAllowedBuffer}cm)`;
    console.log(`PerFit [SHOES]: ${bufferWarning}`);
  } else if (finalBuffer < -0.5) {
    bufferWarning = `⚠️ ADVARSEL: Størrelse ${bestMatch.size} kan være for liten (${finalBuffer.toFixed(1)}cm under fotlengde)`;
    console.log(`PerFit [SHOES]: ${bufferWarning}`);
  }
  
  // === STORE RECOMMENDATION CROSS-CHECK ===
  // Priority 1 & 2: Validate store's recommendation against table
  let storeRecommendationNote = '';
  if (storeRecommendation) {
    const storeSize = completeSizeList.find(s => s.size === storeRecommendation);
    if (storeSize) {
      const storeBuffer = storeSize.footLength - userFoot;
      const ourBuffer = bestMatch.footLength - userFoot;
      
      console.log(`PerFit [SHOES]: 🔍 KRYSSJEKK - Butikk anbefaler: ${storeRecommendation} (${storeSize.footLength}cm), Vårt valg: ${bestMatch.size} (${bestMatch.footLength}cm)`);
      console.log(`PerFit [SHOES]: Butikkens buffer: +${storeBuffer.toFixed(2)}cm, Vårt buffer: +${ourBuffer.toFixed(2)}cm, Max tillatt: +${maxAllowedBuffer}cm`);
      
      if (storeBuffer > maxAllowedBuffer) {
        storeRecommendationNote = `⚠️ Butikken foreslår ${storeRecommendation}, men denne er FOR STOR (+${storeBuffer.toFixed(1)}cm buffer). Gå ned til ${bestMatch.size}`;
        console.log(`PerFit [SHOES]: ⚠️ Butikkens anbefaling overskrider max buffer!`);
      } else if (Math.abs(storeBuffer - ourBuffer) <= 0.3) {
        storeRecommendationNote = `✅ Butikkens anbefaling (${storeRecommendation}) er trygg`;
        console.log(`PerFit [SHOES]: ✅ Butikkens anbefaling er trygg`);
      } else if (storeBuffer > ourBuffer) {
        storeRecommendationNote = `⚠️ Butikken foreslår ${storeRecommendation}, men ${bestMatch.size} gir bedre passform for ${constructionNote.toLowerCase()}`;
        console.log(`PerFit [SHOES]: ⚠️ Butikkens anbefaling er litt for stor`);
      } else {
        storeRecommendationNote = `✅ Butikkens anbefaling (${storeRecommendation}) er OK`;
        console.log(`PerFit [SHOES]: ✅ Butikkens anbefaling er akseptabel`);
      }
    }
  }
  
  // === EXPERT RECOMMENDATION PRIORITY ===
  // If text contains "vi anbefaler størrelse X", prioritize that size if within 1.0cm
  let expertOverride = false;
  if (recommendedSizeFromText) {
    const expertSize = completeSizeList.find(s => s.size === recommendedSizeFromText);
    if (expertSize) {
      const expertDiff = Math.abs(expertSize.footLength - userFoot);
      if (expertDiff <= 1.0) {
        console.log(`PerFit [SHOES]: 🎯 Expert recommendation "${recommendedSizeFromText}" found and within 1.0cm of user's foot - prioritizing!`);
        // Store technical match before overriding
        technicalSize = bestMatch.size;
        bestMatch = expertSize;
        expertOverride = true;
      } else {
        console.log(`PerFit [SHOES]: Expert recommendation "${recommendedSizeFromText}" is ${expertDiff.toFixed(1)}cm away - too far, ignoring`);
      }
    }
  }

  // === BORDER CASE: Choose smaller size for moccasins and laceless boots ===
  // If user is on the border between two sizes (diff < 0.3cm) and it's a moccasin or laceless boot
  // PRIORITER MINDRE STØRRELSE: Hvis moccasin/laceless boot og avvik til mindre størrelse < 0.5cm, velg mindre
  const needsSnugFit = needsStretchAdjustment || isLacelessBoot;
  if (needsSnugFit && secondBestMatch && Math.abs(smallestDiff - secondSmallestDiff) < 0.3) {
    isBorderCase = true;
    
    // Choose the SMALLER of the two sizes (lower foot length)
    if (bestMatch.footLength > secondBestMatch.footLength) {
      console.log(`PerFit [SHOES]: Border case - swapping to smaller size ${secondBestMatch.size} (${secondBestMatch.footLength}cm) instead of ${bestMatch.size} (${bestMatch.footLength}cm)`);
      bestMatch = secondBestMatch;
    } else {
      console.log(`PerFit [SHOES]: Border case - keeping smaller size ${bestMatch.size} (${bestMatch.footLength}cm)`);
    }
  } else if (needsSnugFit && secondBestMatch) {
    // EKSTRA LOGIKK: Hvis moccasin/laceless boot og avvik til mindre størrelse er < 0.5cm, velg mindre for "snug fit"
    const smallerSize = bestMatch.footLength < secondBestMatch.footLength ? bestMatch : secondBestMatch;
    const smallerDiff = Math.abs(smallerSize.footLength - target);
    
    if (smallerDiff < 0.5 && smallerSize !== bestMatch) {
      console.log(`PerFit [SHOES]: ${isLacelessBoot ? 'Laceless boot' : 'Moccasin'} snug fit - choosing smaller size ${smallerSize.size} (${smallerSize.footLength}cm) with diff ${smallerDiff.toFixed(2)}cm to avoid slipping`);
      bestMatch = smallerSize;
      isBorderCase = true;
    }
  }

  console.log(`PerFit [SHOES]: ✅ Best match - Size ${bestMatch.size} (${bestMatch.footLength}cm)${bestMatch.isInterpolated ? ' [interpolated]' : ''}`);

  // === WIDE FOOT OVERRIDE ===
  // ONLY apply for slip-on shoes (loafers/moccasins) - never for laced footwear
  let wideFootOverride = false;
  if (hasWideFoot && isSlipOn && secondBestMatch && !isLacelessBoot) {
    const largerSize = bestMatch.footLength > secondBestMatch.footLength ? bestMatch : secondBestMatch;
    if (largerSize !== bestMatch) {
      console.log(`PerFit [SHOES]: Wide foot override for slip-ons - choosing larger size ${largerSize.size} (${largerSize.footLength}cm) for comfort`);
      bestMatch = largerSize;
      wideFootOverride = true;
    }
  }

  // === DUAL RECOMMENDATION CHECK ===
  // For moccasins/loafers (but NOT wide feet), if there's a second size within range, offer both options
  // ALSO: For 'stor' items, always show both technical and adjusted size
  let isDual = false;
  let snugSize: ShoeSize | null = null;
  let comfortSize: ShoeSize | null = null;
  let isStorAdjusted = false;
  
  // Capture technical size for 'stor' dual view
  if (isStor && !technicalSize && secondBestMatch) {
    // Find the larger of the two as the "technical" size
    const largerSize = bestMatch.footLength > secondBestMatch.footLength ? bestMatch : secondBestMatch;
    const smallerSize = bestMatch.footLength < secondBestMatch.footLength ? bestMatch : secondBestMatch;
    
    // Technical = what we'd recommend without 'stor' adjustment
    // Recommended = smaller size due to 'stor'
    technicalSize = largerSize.size;
    bestMatch = smallerSize; // Recommend smaller for 'stor'
    isDual = true;
    isStorAdjusted = true;
    snugSize = smallerSize;
    comfortSize = largerSize;
    console.log(`PerFit [SHOES]: 🎯 'Stor' dual view - Technical: ${technicalSize}, Anbefalt: ${bestMatch.size}`);
  } else if (needsStretchAdjustment && secondBestMatch && !hasWideFoot) {
    // Original moccasin dual logic
    const footLengthDiff = Math.abs(bestMatch.footLength - secondBestMatch.footLength);
    
    // Trigger dual recommendation if sizes are close (within 0.5-1.2cm foot length difference)
    if (footLengthDiff >= 0.5 && footLengthDiff <= 1.2) {
      isDual = true;
      
      // Determine which is snug (smaller) and which is comfort (larger)
      if (bestMatch.footLength < secondBestMatch.footLength) {
        snugSize = bestMatch;
        comfortSize = secondBestMatch;
      } else {
        snugSize = secondBestMatch;
        comfortSize = bestMatch;
      }
      
      console.log(`PerFit [SHOES]: 🎯 Dual recommendation - Snug: ${snugSize.size} (${snugSize.footLength}cm), Comfort: ${comfortSize.size} (${comfortSize.footLength}cm), diff: ${footLengthDiff.toFixed(2)}cm`);
    }
  }

  // === BUILD FIT NOTE ===
  let fitNote = '';
  
  if (expertOverride && recommendedSizeFromText) {
    fitNote = `✨ Følger butikkens anbefaling: størrelse ${recommendedSizeFromText}`;
  } else if (isStorAdjusted && technicalSize) {
    fitNote = `✨ Varen er stor i størrelsen - anbefaler ${bestMatch.size} (teknisk match: ${technicalSize})`;
  } else if (isLacelessBoot) {
    fitNote = `✨ ${constructionNote} - størrelse ${bestMatch.size}`;
  } else if (wideFootOverride) {
    fitNote = `✨ Valgt ${bestMatch.size} pga. bred fot-profil`;
  } else if (isDual && snugSize && comfortSize) {
    fitNote = `✨ Mokkasiner i ${materialInfo} utvider seg over tid`;
  } else if (needsStretchAdjustment) {
    if (fitHint?.toLowerCase().includes('stor')) {
      fitNote = `✨ Anbefaler ${bestMatch.size} fordi mokkasiner i ${materialInfo} utvider seg mye. Siden varen også er stor i størrelsen, vil ${parseInt(bestMatch.size) + 1} raskt bli for løs`;
    } else if (isBorderCase) {
      fitNote = `✨ Valgt ${bestMatch.size} fordi mokkasiner i ${materialInfo} utvider seg og vil ellers glippe i hælen`;
    } else {
      fitNote = `✨ Valgt ${bestMatch.size} fordi mokkasiner i ${materialInfo} utvider seg og vil ellers glippe i hælen`;
    }
  } else if (fitHint?.toLowerCase().includes('stor')) {
    fitNote = '✨ Basert på at varen er stor, har vi gått ned en størrelse';
  } else if (isLacedFootwear) {
    const actualBuffer = bestMatch.footLength - userFoot;
    fitNote = `✨ ${constructionNote} - ${actualBuffer <= 0.2 ? 'PERFEKT' : actualBuffer <= 0.4 ? 'IDEELL' : 'ROMSLIG'} passform (+${actualBuffer.toFixed(1)}cm)`;
  } else {
    const actualDiff = bestMatch.footLength - userFoot;
    const cat = actualDiff < 0.4 ? "TETTSITTENDE" : actualDiff <= 0.9 ? "IDEELL" : "ROMSLIG";
    fitNote = `${cat} (+${actualDiff.toFixed(1)} cm plass)`;
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
    size: isDual && snugSize ? snugSize.size : bestMatch.size, // Primary is snug for moccasins
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
