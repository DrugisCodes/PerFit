// Table-based (S/M/L/EU) logic for bottoms - Clean Orchestrator
import { SizeRow, UserProfile, SizeRecommendation } from '../../stores/types';
import { calculateModelAdjustments } from './model-analyzer';
import { generateInseamAnchorNote } from './note-generator';
import { handleRelaxedFitMatch } from './relaxed-logic';
import { applyDropdownPrioritization } from './dropdown-logic';
import { calculateCalculatedWaistFallback } from './universal-fallback';

/**
 * Table-based (S/M/L/EU) logic for bottoms
 * Clean orchestrator that delegates to specialized functions
 */
export function calculateTableRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  textData?: {
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
  availableSizes?: string[]
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
  
  // Extract product inseam for later use
  const productInseam = textData?.inseamLength;
  const productInseamSize = textData?.inseamLengthSize;
  const hasModelData = textData?.modelHeight !== undefined;
  const isRelaxedFit = textData?.fit?.toLowerCase() === 'relaxed' || textData?.fit?.toLowerCase() === 'regular';
  
  // Generate inseam anchor note
  const inseamAnchorNote = generateInseamAnchorNote(
    textData?.inseamLength,
    textData?.inseamLengthSize,
    userInseam
  );
  
  // === DYNAMIC HIP FILTERING ===
  const smallestHip = Math.min(...sizeData.map(s => s.hip));
  const shouldIgnoreHip = originalHip < smallestHip;
  
  if (shouldIgnoreHip) {
    console.log(`PerFit [BOTTOMS]: ✅ Dynamic Hip Filtering ACTIVE`);
    console.log(`PerFit [BOTTOMS]: User hip (${originalHip}cm) < Table min (${smallestHip}cm)`);
  }
  
  // === UNIVERSAL BRAND SIZE SUGGESTION (INDEX-SHIFTING) ===
  const brandSuggestion = textData?.brandSizeSuggestion || 0;
  const modelAnalysis = calculateModelAdjustments(
    userProfile,
    textData,
    sizeData,
    brandSuggestion,
    userWaist,
    shouldIgnoreHip
  );
  
  let baseIndexOffset = modelAnalysis.baseIndexOffset;
  let brandFitNote = modelAnalysis.brandFitNote;
  let brandSecondaryNote = modelAnalysis.brandSecondaryNote;
  
  // Collect matching sizes
  let matchingSizes: SizeRow[] = [];
  let baseMatchIndex = -1;
  
  // Table-matching logic
  for (let i = 0; i < sizeData.length; i++) {
    const size = sizeData[i];
    const waistFits = size.waist >= userWaist;
    const hipFits = shouldIgnoreHip || size.hip >= userHip;
    
    if (waistFits && hipFits) {
      if (baseMatchIndex === -1) {
        baseMatchIndex = i;
      }
      
      if (isRelaxedFit) {
        matchingSizes.push(size);
      } else {
        // Standard logic: Apply brand index shift
        const targetIndex = Math.max(0, Math.min(sizeData.length - 1, baseMatchIndex + baseIndexOffset));
        const targetSize = sizeData[targetIndex];
        const alternativeSize = baseMatchIndex >= 0 && baseMatchIndex < sizeData.length ? sizeData[baseMatchIndex] : null;
        
        let fitNote = brandFitNote || '';
        let isDual = false;
        let secondarySize: string | undefined = undefined;
        
        if (baseIndexOffset !== 0 && alternativeSize && targetIndex !== baseMatchIndex) {
          isDual = true;
          secondarySize = alternativeSize.intSize;
        }
        
        if (!fitNote && !hasModelData) {
          fitNote = `Recommended ${targetSize.intSize} based on ${textData?.fit || 'fit type'} and your ${originalWaist}cm waist`;
        }
        
        if (shouldIgnoreHip && !brandFitNote) {
          fitNote += (fitNote ? ' • ' : '') + 'Hip measurement ignored (smaller than size chart)';
        }
        
        // Apply dropdown prioritization
        const dropdownResult = applyDropdownPrioritization(
          targetSize,
          secondarySize,
          isDual,
          availableSizes,
          originalWaist
        );
        
        return {
          size: dropdownResult.displaySize,
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
          isDual: dropdownResult.isDual || undefined,
          secondarySize: dropdownResult.secondaryDisplaySize,
          secondarySizeNote: dropdownResult.secondarySizeNote
        };
      }
    }
  }
  
  // Relaxed Fit: Delegate to specialized function
  if (isRelaxedFit && matchingSizes.length > 0) {
    const relaxedResult = handleRelaxedFitMatch(
      matchingSizes,
      userProfile,
      textData,
      sizeData,
      brandFitNote,
      brandSecondaryNote,
      baseIndexOffset,
      shouldIgnoreHip,
      userInseam,
      originalWaist,
      originalHip,
      inseamAnchorNote,
      availableSizes
    );
    
    if (relaxedResult) {
      // Apply dropdown prioritization
      const dropdownResult = applyDropdownPrioritization(
        relaxedResult.matchedRow!,
        relaxedResult.secondarySize,
        relaxedResult.isDual || false,
        availableSizes,
        originalWaist
      );
      
      return {
        ...relaxedResult,
        size: dropdownResult.displaySize,
        secondarySize: dropdownResult.secondaryDisplaySize,
        isDual: dropdownResult.isDual || undefined,
        secondarySizeNote: dropdownResult.secondarySizeNote
      };
    }
  }
  
  // === EMERGENCY FALLBACK (LAST RESORT) ===
  if (baseMatchIndex === -1 && !hasModelData) {
    const fallbackResult = calculateCalculatedWaistFallback(
      userWaist,
      userHip,
      userInseam,
      userProfile.height ? parseInt(userProfile.height) : undefined,
      productInseam,
      productInseamSize,
      availableSizes
    );
    
    if (fallbackResult) {
      return fallbackResult;
    }
    
    console.error(`PerFit [BOTTOMS]: ❌ INGEN MATCH FUNNET - Brukerens mål er utenfor størrelsesområdet`);
    console.error(`PerFit [BOTTOMS]: Tabell range: ${sizeData[0]?.waist}-${sizeData[sizeData.length - 1]?.waist}cm midje`);
    console.error(`PerFit [BOTTOMS]: Bruker: ${userWaist}cm midje, ${userHip}cm hofte`);
  }
  
  return null;
}
