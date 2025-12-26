/**
 * Top garments calculation logic
 * Handles shirts, t-shirts, sweaters, jackets, etc.
 */

import { SizeRow, UserProfile, SizeRecommendation } from '../stores/types';

/**
 * Calculate recommendation for tops (shirts, t-shirts, sweaters)
 * Matches user chest against table's BRYSTVIDDE column with intelligent flexibility
 * 
 * FLEXIBILITY FEATURES:
 * - Leeway: Allows up to 1.5cm over table chest if fit hint is 'stor' or model height is similar
 * - FitHint integration: 'stor' reduces effective user chest by 2.5cm before comparison
 * - Model similarity: If user height is within 5cm of model height, prioritizes model's size
 * - Modern fit priority: Always chooses smallest size that's "close enough" to avoid tent effect
 * 
 * @param userProfile - User's measurements including chest and height
 * @param sizeData - Size table data
 * @param fitHint - 'liten' or 'stor' (optional)
 * @param textMeasurement - Model info including height (optional)
 */
export function calculateTopRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  fitHint?: string,
  textMeasurement?: { isAnkleLength?: boolean; modelHeight?: number; modelSize?: string }
): SizeRecommendation | null {
  const userChest = parseInt(userProfile.chest);
  const userHeight = userProfile.height ? parseInt(userProfile.height) : null;
  
  if (isNaN(userChest) || userChest <= 0) {
    console.error("PerFit: Invalid chest measurement:", userProfile.chest);
    return null;
  }

  console.log(`PerFit [TOP]: User chest: ${userChest}cm, Height: ${userHeight}cm, Fit hint: ${fitHint || 'none'}, Model height: ${textMeasurement?.modelHeight || 'none'}`);

  // === STEP 1: Calculate effective chest measurement ===
  let effectiveChest = userChest;
  let fitNote = '';
  
  if (fitHint?.toLowerCase().includes('stor')) {
    effectiveChest = userChest - 2.5; // Item runs large - reduce effective chest
    console.log(`PerFit [TOP]: Item runs LARGE - reducing effective chest from ${userChest}cm to ${effectiveChest}cm`);
  } else if (fitHint?.toLowerCase().includes('liten')) {
    effectiveChest = userChest + 2.5; // Item runs small - increase effective chest
    console.log(`PerFit [TOP]: Item runs SMALL - increasing effective chest from ${userChest}cm to ${effectiveChest}cm`);
  }

  // === STEP 2: Check for model similarity ===
  let modelSimilarity = false;
  let heightDiff = Infinity;
  
  if (textMeasurement?.modelHeight && userHeight) {
    heightDiff = Math.abs(userHeight - textMeasurement.modelHeight);
    modelSimilarity = heightDiff <= 5;
    
    if (modelSimilarity) {
      console.log(`PerFit [TOP]: ✅ Model similarity detected - user ${userHeight}cm vs model ${textMeasurement.modelHeight}cm (diff: ${heightDiff}cm)`);
    }
  }

  // === STEP 3: Define leeway based on conditions ===
  const STANDARD_LEEWAY = 1.5; // cm
  let allowedLeeway = 0;
  
  if (fitHint?.toLowerCase().includes('stor') || modelSimilarity) {
    allowedLeeway = STANDARD_LEEWAY;
    console.log(`PerFit [TOP]: Applying ${STANDARD_LEEWAY}cm leeway (fit hint: ${fitHint || 'none'}, model similarity: ${modelSimilarity})`);
  }

  // === STEP 4: Find best matching size (prioritize smallest that fits) ===
  console.log(`PerFit [TOP]: Looking for smallest size with chest >= ${effectiveChest - allowedLeeway}cm (effective: ${effectiveChest}cm, leeway: ${allowedLeeway}cm)`);

  let bestMatch: SizeRow | null = null;
  let usedLeeway = false;
  
  for (const size of sizeData) {
    // Direct match: table chest >= effective chest
    if (size.chest >= effectiveChest) {
      console.log(`PerFit [TOP]: ✓ Direct match! Size ${size.intSize} (table: ${size.chest}cm >= effective: ${effectiveChest}cm)`);
      bestMatch = size;
      break;
    }
    
    // Leeway match: table chest is within leeway range
    if (allowedLeeway > 0 && size.chest >= effectiveChest - allowedLeeway) {
      const gap = effectiveChest - size.chest;
      console.log(`PerFit [TOP]: ⚡ Leeway match! Size ${size.intSize} (table: ${size.chest}cm, gap: ${gap.toFixed(1)}cm within ${allowedLeeway}cm leeway)`);
      bestMatch = size;
      usedLeeway = true;
      break;
    }
  }

  if (!bestMatch) {
    console.warn(`PerFit [TOP]: No size found for chest ${effectiveChest}cm (original: ${userChest}cm). Largest available: ${sizeData[sizeData.length - 1]?.chest}cm`);
    return null;
  }

  // === STEP 5: Build fitNote ===
  if (usedLeeway) {
    const gap = effectiveChest - bestMatch.chest;
    fitNote = `✨ Valgt ${bestMatch.intSize} pga. marginal differanse (${gap.toFixed(1)}cm)`;
    
    if (modelSimilarity && textMeasurement?.modelSize) {
      fitNote += ` og modell-likhet (høyde ±${heightDiff}cm)`;
    } else if (fitHint?.toLowerCase().includes('stor')) {
      fitNote += ` og fordi varen er stor i størrelsen`;
    }
  } else if (fitHint?.toLowerCase().includes('stor')) {
    fitNote = `Justert ned pga. 'varen er stor' (${userChest}cm → ${effectiveChest}cm effektiv)`;
  } else if (fitHint?.toLowerCase().includes('liten')) {
    fitNote = `Justert opp pga. 'varen er liten' (${userChest}cm → ${effectiveChest}cm effektiv)`;
  }

  console.log(`PerFit [TOP]: ✅ Final recommendation: Size ${bestMatch.intSize} (table: ${bestMatch.chest}cm, user: ${userChest}cm, effective: ${effectiveChest}cm, leeway used: ${usedLeeway})`);

  return {
    size: bestMatch.intSize,
    confidence: usedLeeway ? 0.95 : 1.0, // Slightly lower confidence when using leeway
    category: 'top',
    userChest: userChest,
    targetChest: bestMatch.chest,
    buffer: 0,
    matchedRow: bestMatch,
    fitNote: fitNote || undefined
  };
}

/**
 * Calculate recommendation based on text measurements (when tables are missing)
 * 
 * Logic:
 * - CHEST ANCHOR: Use userProfile.chest as primary size determinant (101cm = M/L boundary)
 * - FIT HINT INTEGRATION: 'stor' adjusts down, 'liten' adjusts up from chest baseline
 * - HEIGHT VALIDATION: Confirms size choice (shorter user + large item = stay with smaller size)
 * - SAFEGUARD: Never recommend size < M if chest ≥ 101cm
 * 
 * Example: User 179cm, chest 101cm, model 189cm wearing L, fitHint 'stor'
 * → Base (101cm chest) = M, Adjustment (stor) = stay M (relaxed fit), Height (-10cm) confirms M
 */
export function calculateTextBasedRecommendation(
  userProfile: UserProfile,
  textData: { modelHeight?: number; modelSize: string; itemLength?: number; itemLengthSize?: string; fitHint?: string }
): SizeRecommendation | null {
  try {
    const userHeight = parseInt(userProfile.height);
    const userTorso = userProfile.torsoLength ? parseInt(userProfile.torsoLength) : null;
    const userChest = userProfile.chest ? parseInt(userProfile.chest) : null;
    const fitHint = textData.fitHint;
    
    console.log(`PerFit [Text]: User height: ${userHeight}cm, User torso: ${userTorso}cm, User chest: ${userChest}cm, Model height: ${textData.modelHeight}cm, Model size: ${textData.modelSize}, Item length: ${textData.itemLength}cm, Fit hint: ${fitHint || 'none'}`);
    
    const sizeScale = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    let modelSizeIndex = sizeScale.indexOf(textData.modelSize.toUpperCase());
    let recommendedIndex = modelSizeIndex;
    let fitNote = '';
    let chestBasedStart = false;
    
    // === STRATEGY 1: CHEST-BASED ANCHOR (PRIMARY for tops) ===
    if (userChest && modelSizeIndex === -1) {
      console.log(`PerFit [Text]: Using CHEST-BASED fallback (user chest: ${userChest}cm)`);
      chestBasedStart = true;
      
      // Chest-based size mapping (conservative estimates)
      if (userChest < 90) {
        recommendedIndex = sizeScale.indexOf('S');
        console.log(`PerFit [Text]: Chest < 90cm → Base size S`);
      } else if (userChest < 100) {
        recommendedIndex = sizeScale.indexOf('M');
        console.log(`PerFit [Text]: Chest 90-99cm → Base size M`);
      } else if (userChest < 106) {
        // 101cm is M/L boundary - be conservative and start with M
        recommendedIndex = sizeScale.indexOf('M');
        console.log(`PerFit [Text]: Chest 100-105cm → Base size M (M/L boundary)`);
      } else if (userChest < 110) {
        recommendedIndex = sizeScale.indexOf('L');
        console.log(`PerFit [Text]: Chest 106-109cm → Base size L`);
      } else {
        recommendedIndex = sizeScale.indexOf('XL');
        console.log(`PerFit [Text]: Chest ≥110cm → Base size XL`);
      }
    } else if (modelSizeIndex === -1) {
      console.error(`PerFit [Text]: Cannot proceed - no valid model size and no chest measurement`);
      return null;
    }
    
    // === STRATEGY 2: FIT HINT ADJUSTMENT ===
    if (fitHint) {
      console.log(`PerFit [Text]: Applying fit hint adjustment: ${fitHint}`);
      
      if (fitHint === 'stor' && recommendedIndex < sizeScale.length - 1) {
        // Item runs large - would normally go down, but check chest first
        const currentSize = sizeScale[recommendedIndex];
        console.log(`PerFit [Text]: Item runs LARGE - considering size adjustment from ${currentSize}`);
        
        // If chest is at M/L boundary (100-105cm), stay at M for relaxed fit
        if (userChest && userChest >= 100 && userChest < 106 && recommendedIndex === sizeScale.indexOf('M')) {
          console.log(`PerFit [Text]: Staying at M despite 'stor' hint - chest ${userChest}cm needs M for relaxed fit`);
          fitNote = `Valgt Medium pga. brystmål (${userChest}cm) og fordi varen er stor i størrelsen (vil sitte Relaxed)`;
        } else if (recommendedIndex > sizeScale.indexOf('M')) {
          // Can safely go down if we're above M
          recommendedIndex -= 1;
          console.log(`PerFit [Text]: Going down 1 size due to 'stor' hint → ${sizeScale[recommendedIndex]}`);
          fitNote = `Valgt ${sizeScale[recommendedIndex]} fordi varen er stor i størrelsen`;
        }
      } else if (fitHint === 'liten' && recommendedIndex > 0) {
        // Item runs small - go up a size
        recommendedIndex += 1;
        console.log(`PerFit [Text]: Item runs SMALL - going up 1 size → ${sizeScale[recommendedIndex]}`);
        fitNote = `Valgt ${sizeScale[recommendedIndex]} fordi varen er liten i størrelsen`;
      }
    }
    
    // === STRATEGY 3: HEIGHT VALIDATION (confirms size choice) ===
    if (textData.modelHeight && userHeight && userHeight > 0 && !fitNote) {
      const heightDiff = userHeight - textData.modelHeight;
      console.log(`PerFit [Text]: Height validation - User ${userHeight}cm vs Model ${textData.modelHeight}cm (diff: ${heightDiff}cm)`);
      
      // Height difference confirms or challenges chest-based choice
      if (heightDiff < -10 && recommendedIndex > sizeScale.indexOf('S')) {
        console.log(`PerFit [Text]: User significantly shorter (${heightDiff}cm) - confirms smaller size to avoid length issues`);
        // Don't adjust further if chest already determined size, just note it
        if (chestBasedStart && !fitNote) {
          fitNote = `Valgt ${sizeScale[recommendedIndex]} pga. brystmål (${userChest}cm). Høydeforskjell på ${Math.abs(heightDiff)}cm bekrefter valget`;
        }
      } else if (heightDiff > 10 && recommendedIndex < sizeScale.length - 1) {
        console.log(`PerFit [Text]: User significantly taller (+${heightDiff}cm) - may need to consider size up`);
        // Only suggest if chest doesn't prevent it
        if (!chestBasedStart && !fitNote) {
          fitNote = `Basert på høydeforskjell (+${heightDiff}cm)`;
        }
      }
    }
    
    // === STRATEGY 4: TORSO LENGTH ANALYSIS (for length fit) ===
    if (userTorso && textData.itemLength && !fitNote) {
      console.log(`PerFit [Text]: Using torsoLength-based length analysis`);
      
      const idealGarmentLength = userTorso + 20; // Middle of range (15-25cm)
      const lengthDiff = textData.itemLength - idealGarmentLength;
      
      console.log(`PerFit [Text]: Ideal garment length: ${idealGarmentLength}cm, Actual: ${textData.itemLength}cm, Diff: ${lengthDiff}cm`);
      
      if (Math.abs(lengthDiff) > 8) {
        fitNote = `Basert på totallengde ${textData.itemLength}cm vs din torso ${userTorso}cm`;
      }
    }
    
    // Apply fit preference adjustment (optional)
    const fitPreference = userProfile.fitPreference || 5;
    if (fitPreference <= 3 && recommendedIndex > 0) {
      recommendedIndex -= 1;
      console.log(`PerFit [Text]: Tight fit preference (${fitPreference}) - going down 1 size`);
    } else if (fitPreference >= 7 && recommendedIndex < sizeScale.length - 1) {
      recommendedIndex += 1;
      console.log(`PerFit [Text]: Loose fit preference (${fitPreference}) - going up 1 size`);
    }
    
    // === FINAL CHEST SAFEGUARD ===
    if (userChest && userChest >= 101) {
      const minSizeIndex = sizeScale.indexOf('M');
      
      if (recommendedIndex < minSizeIndex) {
        console.log(`PerFit [Text]: 🛡️ CHEST SAFEGUARD - User chest ${userChest}cm requires minimum M`);
        recommendedIndex = minSizeIndex;
        
        const heightDiff = textData.modelHeight && userHeight ? Math.abs(textData.modelHeight - userHeight) : 0;
        if (heightDiff > 0 && !fitNote) {
          fitNote = `Anbefalt Medium pga. brystmål (${userChest}cm), til tross for høydeforskjell på ${heightDiff}cm`;
        } else if (!fitNote) {
          fitNote = `Anbefalt Medium for å sikre god passform over skuldre og bryst (${userChest}cm)`;
        }
      }
    }
    
    // Clamp to valid range
    recommendedIndex = Math.max(0, Math.min(sizeScale.length - 1, recommendedIndex));
    
    const recommendedSize = sizeScale[recommendedIndex];
    
    console.log(`PerFit [Text]: ✅ Recommended size ${recommendedSize} (chest-based: ${chestBasedStart}, fit hint: ${fitHint || 'none'})`);
    
    return {
      size: recommendedSize,
      confidence: chestBasedStart ? 0.85 : (userTorso && textData.itemLength ? 0.8 : 0.7),
      category: 'top',
      userChest: userChest || userHeight,
      targetChest: userChest || userHeight,
      buffer: 0,
      fitNote: fitNote || `Basert på brystmål (${userChest}cm)`
    };
  } catch (error) {
    console.error("PerFit [Text]: Error calculating text-based recommendation:", error);
    return null;
  }
}
