/**
 * RecommendationEngine.ts
 * 
 * Contains all size recommendation calculation logic.
 * Separated from content script for better maintainability and testability.
 */

import { SizeRow, UserProfile, SizeRecommendation, GarmentCategory } from '../stores/types';

/**
 * Convert centimeters to inches (for WxL format)
 * Rounds to nearest whole number
 */
function cmToInches(cm: number): number {
  return Math.round(cm / 2.54);
}

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
  fitHint?: string,
  textMeasurement?: { isAnkleLength?: boolean },
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
      return calculateTopRecommendation(userProfile, sizeData);
    } else if (category === 'bottom') {
      return calculateBottomRecommendation(userProfile, sizeData, textMeasurement, dropdownSizes, fitHint);
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
 * Also checks inseam length and provides intelligent warnings for ankle-length pants
 * PRIORITY: If dropdown has WxL format (32x34), match waist and inseam directly
 */
function calculateBottomRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  textData?: { isAnkleLength?: boolean; lengthType?: string; stretch?: number },
  dropdownSizes?: string[],
  fitHint?: string
): SizeRecommendation | null {
  let userWaist = parseInt(userProfile.waist);
  let userHip = parseInt(userProfile.hip);
  const userInseam = userProfile.inseam ? parseInt(userProfile.inseam) : null;

  if (isNaN(userWaist) || userWaist <= 0) {
    console.error("PerFit: Invalid waist measurement:", userProfile.waist);
    return null;
  }

  if (isNaN(userHip) || userHip <= 0) {
    console.error("PerFit: Invalid hip measurement:", userProfile.hip);
    return null;
  }

  // Juster målene basert på fit hint
  let sizeAdjustmentNote = '';
  const originalWaist = userWaist;
  
  if (fitHint?.toLowerCase().includes('liten')) {
    userWaist += 2; // Gå opp en størrelse
    userHip += 2;
    sizeAdjustmentNote = '✨ Vi har valgt en størrelse opp fordi varen er liten i størrelsen';
    console.log(`PerFit [BOTTOM]: Item runs SMALL - adjusting waist from ${originalWaist}cm to ${userWaist}cm`);
  } else if (fitHint?.toLowerCase().includes('stor')) {
    userWaist -= 2; // Gå ned en størrelse
    userHip -= 2;
    sizeAdjustmentNote = '✨ Vi har valgt en størrelse ned fordi varen er stor i størrelsen';
    console.log(`PerFit [BOTTOM]: Item runs LARGE - adjusting waist from ${originalWaist}cm to ${userWaist}cm`);
  }

  // 1. PRIORITET: Sjekk WxL-format i dropdown (f.eks. 32x34, 32×34, 32/34)
  if (dropdownSizes && dropdownSizes.length > 0 && userInseam) {
    const hasWxL = dropdownSizes.some(s => /\d+\s*[x×X/]\s*\d+/.test(s));
    if (hasWxL) {
      const targetW = cmToInches(userWaist);
      const targetL = cmToInches(userInseam);
      
      console.log(`PerFit [BOTTOM WxL]: Søker etter ${targetW}x${targetL} (fra ${userWaist}cm midje × ${userInseam}cm innerben)`);
      console.log(`PerFit [BOTTOM WxL]: Tilgjengelige størrelser:`, dropdownSizes);
      
      // Forsøk eksakt match først
      const wxlMatch = dropdownSizes.find(s => {
        const match = s.match(/(\d+)\s*[x×X/]\s*(\d+)/);
        if (match) {
          const w = parseInt(match[1]);
          const l = parseInt(match[2]);
          return w === targetW && l === targetL;
        }
        return false;
      });
      
      if (wxlMatch) {
        console.log(`PerFit [BOTTOM WxL]: ✓ Eksakt match funnet: ${wxlMatch}`);
        let fitNote = '✨ Eksakt match på tommer (WxL)';
        if (sizeAdjustmentNote) {
          fitNote = sizeAdjustmentNote + ' • ' + fitNote;
        }
        return {
          size: wxlMatch,
          confidence: 1.0,
          category: 'bottom',
          userChest: originalWaist,
          targetChest: userWaist,
          buffer: 0,
          fitNote: fitNote
        };
      }
      
      // Hvis ingen eksakt match, finn nærmeste
      console.log(`PerFit [BOTTOM WxL]: Ingen eksakt match, søker etter nærmeste...`);
      
      let bestSize = '';
      let bestWaistDiff = Infinity;
      let bestInseamDiff = Infinity;
      
      dropdownSizes.forEach(s => {
        const sizeMatch = s.match(/(\d+)\s*[x×X/]\s*(\d+)/);
        if (sizeMatch) {
          const w = parseInt(sizeMatch[1]);
          const l = parseInt(sizeMatch[2]);
          const waistDiff = Math.abs(w - targetW);
          const inseamDiff = Math.abs(l - targetL);
          
          console.log(`PerFit [BOTTOM WxL]: Sjekker ${s} (W:${w}, L:${l}) - avvik: midje ${waistDiff}", innerben ${inseamDiff}"`);
          
          // Prioriter midje først, deretter innerben
          if (waistDiff < bestWaistDiff || 
              (waistDiff === bestWaistDiff && inseamDiff < bestInseamDiff)) {
            bestSize = s;
            bestWaistDiff = waistDiff;
            bestInseamDiff = inseamDiff;
          }
        }
      });
      
      // Returner nærmeste match hvis forskjellen er akseptabel (≤2 tommer i midje eller innerben)
      if (bestSize && (bestWaistDiff <= 2 || bestInseamDiff <= 2)) {
        console.log(`PerFit [BOTTOM WxL]: ✓ Nærmeste match funnet: ${bestSize} (midje ±${bestWaistDiff}", innerben ±${bestInseamDiff}")`);
        
        let fitNote = '📏 Nærmeste match i WxL-format';
        if (bestWaistDiff > 0) {
          fitNote += ` (midje ${bestWaistDiff}" forskjell)`;
        }
        if (bestInseamDiff > 0) {
          fitNote += ` (lengde ${bestInseamDiff}" forskjell)`;
        }
        if (sizeAdjustmentNote) {
          fitNote = sizeAdjustmentNote + ' • ' + fitNote;
        }
        
        return {
          size: bestSize,
          confidence: 0.9,
          category: 'bottom',
          userChest: originalWaist,
          targetChest: userWaist,
          buffer: 0,
          fitNote: fitNote.trim()
        };
      }
      
      console.log(`PerFit [BOTTOM WxL]: Ingen passende WxL-match funnet, faller tilbake til tabellstørrelser...`);
    }
  }

  // 2. PRIORITET: Standard tabell-matching (INT-størrelser)
  console.log(`PerFit [BOTTOM]: Looking for size with waist >= ${userWaist}cm and hip >= ${userHip}cm`);
  
  for (const size of sizeData) {
    const waistFits = size.waist >= userWaist;
    const hipFits = size.hip >= userHip;

    if (waistFits && hipFits) {
      console.log(`PerFit [BOTTOM]: ✓ Match found! Size ${size.intSize}`);
      let fitNote = '';
      
      // Inseam/Lengde-logikk
      if (userInseam && size.inseam) {
        const diff = size.inseam - userInseam;
        if (textData?.isAnkleLength) {
          fitNote = '✨ Designet for å slutte ved ankelen';
        } else if (diff < -3) {
          fitNote = '⚠️ Denne kan bli litt kort i beina';
        } else if (diff > 5) {
          fitNote = '📏 Buksen er lang, men kan legges opp';
        }
      }

      // Stretch-advarsel
      if (textData?.stretch === 0 && size.waist === userWaist) {
        fitNote += ' (Ingen stretch - kan føles trang)';
      }

      // Legg til size adjustment note hvis det finnes
      if (sizeAdjustmentNote) {
        fitNote = sizeAdjustmentNote + (fitNote ? ' • ' + fitNote : '');
      }

      return {
        size: size.intSize,
        confidence: 1.0,
        category: 'bottom',
        userChest: originalWaist,
        targetChest: size.waist,
        buffer: 0,
        matchedRow: size,
        fitNote: fitNote.trim()
      };
    }
  }
  
  console.warn(`PerFit [BOTTOM]: No size found for waist ${userWaist}cm AND hip ${userHip}cm`);
  return null;
}

/**
 * Calculate recommendation for shoes
 * Direct shoe size match, no buffer needed
 */
/**
 * Anbefaling for sko
 * Håndterer fotlengde, mellomstørrelser og fit-hints (liten/stor)
 */
function calculateShoeRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  fitHint?: string
): SizeRecommendation | null {
  const userFoot = userProfile.footLength ? parseFloat(userProfile.footLength) : null;
  if (!userFoot) return null;

  console.log(`PerFit [SHOES]: User foot length: ${userFoot}cm, Fit hint: ${fitHint || 'none'}`);

  // Juster mål basert på fit-hint
  let buffer = 0;
  let fitNote = '';
  if (fitHint?.toLowerCase().includes('liten')) {
    buffer = 0.2; // Gå litt opp
  } else if (fitHint?.toLowerCase().includes('stor')) {
    buffer = -0.3; // Gå litt ned
    fitNote = '✨ Basert på at varen er stor, har vi gått ned en størrelse';
  }

  const target = userFoot + buffer;
  let bestMatch: SizeRow | null = null;
  let smallestDiff = Infinity;

  for (const row of sizeData) {
    if (row.footLength) {
      const diff = Math.abs(row.footLength - target);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestMatch = row;
      }
    }
  }

  if (bestMatch) {
    console.log(`PerFit [SHOES]: ✅ Best match - Size ${bestMatch.intSize} (${bestMatch.footLength}cm)`);
    
    // Hvis det ikke er en "stor" vare, gi standard passform-info
    if (!fitNote) {
      const actualDiff = bestMatch.footLength! - userFoot;
      const cat = actualDiff < 0.4 ? "TETTSITTENDE" : actualDiff <= 0.9 ? "IDEELL" : "ROMSLIG";
      fitNote = `${cat} (+${actualDiff.toFixed(1)} cm plass)`;
    }

    return {
      size: bestMatch.intSize,
      confidence: 0.95,
      category: 'shoes',
      userChest: userFoot,
      targetChest: bestMatch.footLength || 0,
      buffer: buffer,
      matchedRow: bestMatch,
      fitNote: fitNote
    };
  }
  return null;
}

/**
 * Anbefaling for ukjent kategori (fallback)
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
