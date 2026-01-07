// Relaxed Fit matching logic for bottoms
import { SizeRow, UserProfile, SizeRecommendation } from '../../stores/types';
import { compareSizes, translateLetterToNumericSize } from './size-helpers';

/**
 * Handle Relaxed Fit matching
 * Chooses smallest matching size with dual recommendation
 */
export function handleRelaxedFitMatch(
  matchingSizes: SizeRow[],
  userProfile: UserProfile,
  textData: {
    isAnkleLength?: boolean;
    lengthType?: string;
    stretch?: number;
    modelHeight?: number;
    modelSize?: string;
    inseamLength?: number;
    inseamLengthSize?: string;
    fit?: string;
    brandSizeSuggestion?: number;
  },
  sizeData: SizeRow[],
  brandFitNote: string,
  brandSecondaryNote: string,
  baseIndexOffset: number,
  shouldIgnoreHip: boolean,
  userInseam: number | null,
  originalWaist: number,
  originalHip: number,
  inseamAnchorNote: string,
  availableSizes?: string[]
): SizeRecommendation | null {
  const isRelaxedFit = textData?.fit?.toLowerCase() === 'relaxed' || textData?.fit?.toLowerCase() === 'regular';
  
  // === RELAXED FIT: ALLTID PRIORITER MINSTE STØRRELSE ===
  console.log(`PerFit [BOTTOMS]: 👖 RELAXED FIT - Prioriterer minste størrelse`);
  
  // For Relaxed Fit, ignorer brand adjustment hvis det ville gjøre størrelsen større
  let targetIndex = 0; // Alltid første (minste) match
  
  // Kun tillat brand shift NEDOVER (til enda mindre) for Relaxed Fit
  if (baseIndexOffset < 0) {
    targetIndex = Math.max(0, baseIndexOffset); // Kan gå til index -1 = ingen match = fallback
    console.log(`PerFit [BOTTOMS]: Brand shift NEDOVER tillatt for Relaxed Fit ("varen er stor")`);
  } else if (baseIndexOffset > 0) {
    console.log(`PerFit [BOTTOMS]: ⚠️ Brand shift OPPOVER ignorert for Relaxed Fit - beholder minste størrelse`);
    baseIndexOffset = 0; // Reset brand adjustment for Relaxed
  }
  
  let smallestMatch = matchingSizes[targetIndex];
  let fitNote = brandFitNote || '';
  let secondarySize: string | undefined = undefined;
  let secondarySizeNote: string | undefined = brandSecondaryNote;
  let isDual = false;
  
  // Tilby neste størrelse som alternativ hvis det er mer enn 1 match
  if (matchingSizes.length > 1) {
    isDual = true;
    secondarySize = matchingSizes[1].intSize; // Neste størrelse opp
    secondarySizeNote = 'Romsligere - En størrelse opp';
    console.log(`PerFit [BOTTOMS]: Dual anbefaling - Primary: ${smallestMatch.intSize} (minste), Secondary: ${secondarySize} (neste størrelse)`);
  }
  
  // === MODEL ANCHOR (PRIORITET 1 FOR RELAXED FIT) ===
  const waistTolerance = isRelaxedFit ? 3.5 : 1.5;
  const anchorUserHeight = userProfile.height ? parseInt(userProfile.height) : 0;
  const anchorModelHeight = textData?.modelHeight || 0;
  const modelSizeStr = textData?.modelSize;
  
  if (modelSizeStr && anchorModelHeight > 0 && anchorUserHeight > 0) {
    const heightDiff = anchorModelHeight - anchorUserHeight;
    
    console.log(`PerFit [BOTTOMS]: ⚓ MODEL ANCHOR CHECK`);
    console.log(`PerFit [BOTTOMS]: Bruker: ${anchorUserHeight}cm (${originalWaist}cm midje), Modell: ${anchorModelHeight}cm i ${modelSizeStr}`);
    console.log(`PerFit [BOTTOMS]: Høydediff: ${heightDiff}cm, Toleranse: ${waistTolerance}cm`);
    
    if (heightDiff >= -2) {
      const modelRow = sizeData.find(s => s.intSize === modelSizeStr);
      
      if (modelRow) {
        const waistGap = originalWaist - modelRow.waist;
        
        console.log(`PerFit [BOTTOMS]: Modellens ${modelSizeStr} har ${modelRow.waist}cm midje`);
        console.log(`PerFit [BOTTOMS]: Brukerens midjegap: ${waistGap.toFixed(1)}cm (toleranse: ${waistTolerance}cm)`);
        
        if (waistGap <= waistTolerance && waistGap >= -2) {
          console.log(`PerFit [BOTTOMS]: 🎯 MODELL-ANKER AKTIVERT`);
          
          const isLetterSize = /^(XXS|XS|S|M|L|XL|XXL|XXXL)$/i.test(modelSizeStr);
          const isWaistSize = /(W\d+|Waist|L\d+)/i.test(modelSizeStr);
          
          let displaySize = modelSizeStr;
          if (isWaistSize && !isLetterSize) {
            displaySize = translateLetterToNumericSize(modelSizeStr, originalWaist, availableSizes);
          } else if (isLetterSize && !isWaistSize) {
            displaySize = modelSizeStr;
          } else if (isLetterSize && availableSizes) {
            displaySize = translateLetterToNumericSize(modelSizeStr, originalWaist, availableSizes);
          }
          
          let anchorFitNote = '';
          if (waistGap > 0) {
            anchorFitNote = `Vi anbefaler ${modelSizeStr} fordi modellen er høyere enn deg (${anchorModelHeight}cm) og bruker denne. Siden buksen er 'Relaxed', vil midjen sitte godt selv om den er ${waistGap.toFixed(1)}cm smalere enn dine mål.`;
          } else {
            anchorFitNote = `Vi anbefaler ${modelSizeStr} basert på modellens høyde (${anchorModelHeight}cm). Perfekt match for både lengde og midje.`;
          }
          
          let anchorIsDual = false;
          let anchorSecondarySize: string | undefined = undefined;
          let anchorSecondaryNote: string | undefined = undefined;
          
          if (smallestMatch.intSize !== modelSizeStr) {
            anchorIsDual = true;
            anchorSecondarySize = smallestMatch.intSize;
            anchorSecondaryNote = `Romsligere i midjen (${smallestMatch.waist}cm), men kan være litt lang`;
          }
          
          return {
            size: displaySize,
            confidence: 0.98,
            category: 'bottom',
            userChest: originalWaist,
            targetChest: modelRow.waist,
            buffer: 0,
            matchedRow: modelRow,
            fitNote: anchorFitNote,
            userWaist: originalWaist,
            userHip: originalHip,
            userInseam: userInseam || undefined,
            userHeight: anchorUserHeight,
            inseamLength: textData.inseamLength,
            inseamLengthSize: textData.inseamLengthSize,
            isDual: anchorIsDual || undefined,
            secondarySize: anchorSecondarySize,
            secondarySizeNote: anchorSecondaryNote
          };
        } else if (waistGap > waistTolerance) {
          console.log(`PerFit [BOTTOMS]: ⚠️ Midjegap (${waistGap.toFixed(1)}cm) er over toleranse`);
        }
      }
    } else {
      console.log(`PerFit [BOTTOMS]: Bruker er ${Math.abs(heightDiff)}cm høyere enn modellen`);
    }
  }
  
  // === MODEL MATCH OVER TABLE (PRIORITY 1) ===
  let modelSize: string | null = null;
  let modelHeight: number | null = null;
  let heightDiff: number | null = null;
  
  if (textData?.modelSize) {
    modelSize = textData.modelSize;
    modelHeight = textData.modelHeight || null;
    const userHeight = userProfile.height ? parseInt(userProfile.height) : null;
    heightDiff = modelHeight && userHeight ? modelHeight - userHeight : null;
    
    console.log(`PerFit [BOTTOMS]: 📏 MODEL ANALYSIS - Model (${modelHeight || '?'}cm) bruker ${modelSize}`);
    console.log(`PerFit [BOTTOMS]: Bruker (${userHeight || '?'}cm), beregnet størrelse: ${smallestMatch.intSize}`);
    
    if (heightDiff !== null && heightDiff > 0) {
      const modelRow = sizeData.find(row => row.intSize === modelSize);
      
      if (modelRow && compareSizes(modelSize, smallestMatch.intSize) < 0) {
        const waistDiffFromModel = originalWaist - modelRow.waist;
        
        console.log(`PerFit [BOTTOMS]: 👀 Modellen (${heightDiff}cm høyere) bruker MINDRE størrelse`);
        console.log(`PerFit [BOTTOMS]: Midjegap: ${waistDiffFromModel.toFixed(1)}cm`);
        
        if (waistDiffFromModel <= 3 && waistDiffFromModel >= -2) {
          console.log(`PerFit [BOTTOMS]: ⭐ MODEL MATCH OVER TABLE`);
          
          const originalRecommendation = smallestMatch;
          smallestMatch = modelRow;
          
          if (waistDiffFromModel > 0) {
            fitNote = `Siden modellen er høyere enn deg (${modelHeight}cm) og bruker ${modelSize}, vil denne passe i lengden. Midjen er noe smalere (${modelRow.waist}cm vs ${originalWaist}cm), men fungerer pga. Relaxed fit.`;
          } else {
            fitNote = `Modellen (${modelHeight}cm) bruker ${modelSize} - perfekt match for din høyde. God passform i både lengde og midje.`;
          }
          
          isDual = true;
          secondarySize = originalRecommendation.intSize;
          secondarySizeNote = `Romsligere i midjen (${originalRecommendation.waist}cm), men kan være litt lang`;
          
        } else if (waistDiffFromModel > 3) {
          console.log(`PerFit [BOTTOMS]: ⚠️ Midje diff (${waistDiffFromModel.toFixed(1)}cm) er for stor`);
          fitNote = `Vi anbefaler ${smallestMatch.intSize} for riktig passform i midjen (${smallestMatch.waist}cm). Modellen (${modelHeight}cm) bruker ${modelSize}, men du trenger større for komfort.`;
          
          if (waistDiffFromModel <= 5) {
            isDual = true;
            secondarySize = modelSize;
            secondarySizeNote = `Som modellen - bedre lengde, men strammere i midjen`;
          }
        }
      } else if (modelRow && compareSizes(modelSize, smallestMatch.intSize) > 0) {
        console.log(`PerFit [BOTTOMS]: 👀 Modellen bruker STØRRE størrelse - trolig pga høyde`);
        fitNote = `Beregnet størrelse ${smallestMatch.intSize} passer din midje. Modellen (${modelHeight}cm høyere) bruker ${modelSize} for ekstra lengde.`;
      }
    }
  }
  
  // === INTELLIGENT FIT ADJUSTMENT ===
  if (matchingSizes.length > 1) {
    const primaryMatch = matchingSizes[0];
    const secondMatch = matchingSizes[1];
    const waistDiff1 = Math.abs(primaryMatch.waist - originalWaist);
    const waistDiff2 = Math.abs(secondMatch.waist - originalWaist);
    
    console.log(`PerFit [BOTTOMS]: User ${originalWaist}cm between ${primaryMatch.intSize} (${primaryMatch.waist}cm) and ${secondMatch.intSize} (${secondMatch.waist}cm)`);
    
    if (Math.abs(primaryMatch.waist - secondMatch.waist) <= 3) {
      isDual = true;
      secondarySize = secondMatch.intSize;
      
      if (waistDiff2 < waistDiff1) {
        fitNote = modelSize ? `Best Fit - Justert etter modellens størrelse` : `Best Fit - Basert på ${textData?.fit || 'passform'}`;
        secondarySizeNote = `Loose Fit - Basert på tabellmål`;
        console.log(`PerFit [BOTTOMS]: → Dual Match: ${primaryMatch.intSize} (Best Fit) | ${secondMatch.intSize} (Loose Fit, closer match)`);
      } else {
        fitNote = modelSize ? `Best Fit - Justert etter modellens størrelse` : `Best Fit - Basert på ${textData?.fit || 'passform'}`;
        secondarySizeNote = `Loose Fit - Basert på tabellmål`;
        console.log(`PerFit [BOTTOMS]: → Dual Match: ${primaryMatch.intSize} (Best Fit, closer) | ${secondMatch.intSize} (Loose Fit)`);
      }
    }
    
    smallestMatch = matchingSizes[0];
  }
  
  // Build primary fit note
  const hasModelData = textData?.modelHeight !== undefined;
  if (!hasModelData) {
    fitNote = isDual 
      ? `Best Fit (${textData?.fit || 'Relaxed'})` 
      : `No model data available for this item. Recommended ${smallestMatch.intSize} based on ${textData?.fit || 'Relaxed'} Fit and your ${originalWaist}cm waist`;
  } else {
    fitNote = isDual
      ? `Best Fit - Clean look without being baggy`
      : `Recommended ${smallestMatch.intSize} based on ${textData?.fit || 'Relaxed'} Fit. Provides a clean look for your ${originalWaist}cm waist without being too baggy`;
  }
  
  // === BELTE-LOGIKK ===
  if (smallestMatch.waist > originalWaist + 2) {
    const waistDiff = smallestMatch.waist - originalWaist;
    fitNote = `Vi har valgt ${smallestMatch.intSize} for å sikre at lengden blir riktig for deg. Midjen kan være ${waistDiff.toFixed(1)}cm romsligere, så du må kanskje bruke belte, men da unngår du at buksen ser for kort ut.`;
    console.log(`PerFit [BOTTOMS]: 👖 BELTE-LOGIKK: Valgt større size for lengde, midjen ${waistDiff.toFixed(1)}cm romslig`);
  }
  
  // Add inseam information
  if (inseamAnchorNote) {
    fitNote += ' • ' + inseamAnchorNote;
  } else if (userInseam && smallestMatch.inseam) {
    const diff = smallestMatch.inseam - userInseam;
    if (textData?.isAnkleLength) {
      fitNote += ' • Designed to end at the ankle';
    } else if (diff > 4) {
      fitNote += ` • Warning: Inseam is ${diff.toFixed(1)}cm longer than your ${userInseam}cm legs - may need hemming`;
    } else if (diff < -3) {
      fitNote += ' • May be slightly short in the legs';
    } else if (diff > 2) {
      fitNote += ` • Pants are ${diff.toFixed(1)}cm longer, can be hemmed if needed`;
    }
  }
  
  if (textData?.stretch === 0 && smallestMatch.waist === originalWaist) {
    fitNote += ' (No stretch - may feel tight)';
  }
  
  if (shouldIgnoreHip) {
    fitNote += ' • Hip measurement ignored (smaller than standard size chart)';
  }
  
  const productInseam = textData?.inseamLength;
  const productInseamSize = textData?.inseamLengthSize;
  
  return {
    size: smallestMatch.intSize,
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
    secondarySize: secondarySize,
    secondarySizeNote: secondarySizeNote
  };
}
