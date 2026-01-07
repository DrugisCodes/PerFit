// Model hierarchy and anchor logic for bottoms sizing
import { SizeRow, UserProfile } from '../../stores/types';
import { compareSizes } from './size-helpers';

export interface ModelAnalysisResult {
  baseIndexOffset: number;
  brandFitNote: string;
  brandSecondaryNote: string;
  shouldApplyBrandAdjustment: boolean;
}

/**
 * Calculate model-based adjustments to sizing recommendation
 * Analyzes model height, size, and user measurements to determine if brand size suggestion should be applied
 * 
 * @param userProfile - User's measurements (waist, hip, height)
 * @param textData - Product text data including model info and brand suggestions
 * @param sizeData - Size table data
 * @param brandSuggestion - Brand's sizing suggestion (+1 for "runs small", -1 for "runs large")
 * @param userWaist - User's waist measurement in cm
 * @param shouldIgnoreHip - Whether hip measurement should be ignored
 * @returns Model analysis result with index offset and fit notes
 */
export function calculateModelAdjustments(
  userProfile: UserProfile,
  textData: {
    modelHeight?: number;
    modelSize?: string;
    fit?: string;
  } | undefined,
  sizeData: SizeRow[],
  brandSuggestion: number,
  userWaist: number,
  shouldIgnoreHip: boolean
): ModelAnalysisResult {
  let baseIndexOffset = 0;
  let brandFitNote = '';
  let brandSecondaryNote = '';
  
  if (brandSuggestion === 0) {
    return { baseIndexOffset: 0, brandFitNote: '', brandSecondaryNote: '', shouldApplyBrandAdjustment: false };
  }
  
  baseIndexOffset = brandSuggestion; // +1 for "liten", -1 for "stor"
  
  // === MODELL-HIERARKI (PRIORITY 1) ===
  // Hvis modelldata finnes, skal dette være hoveddriveren for anbefalingen
  if (textData?.modelHeight && textData?.modelSize) {
    const userHeight = userProfile.height ? parseInt(userProfile.height) : null;
    const modelHeight = textData.modelHeight;
    const modelSize = textData.modelSize;
    
    if (userHeight) {
      const heightDiff = Math.abs(modelHeight - userHeight);
      
      console.log(`PerFit [BOTTOMS]: 📏 MODELL-HIERARKI AKTIVERT`);
      console.log(`PerFit [BOTTOMS]: Modell: ${modelHeight}cm i størrelse ${modelSize}`);
      console.log(`PerFit [BOTTOMS]: Bruker: ${userHeight}cm, høydeforskjell: ${heightDiff}cm`);
      
      // REGEL 1: Hvis høydeforskjell <= 6cm, modellen har høy relevans
      if (heightDiff <= 6) {
        console.log(`PerFit [BOTTOMS]: ✅ Høydeforskjell <= 6cm - modellen er MEGET RELEVANT`);
        
        // Finn modellens størrelse i tabellen
        const modelRow = sizeData.find(row => row.intSize === modelSize);
        
        if (modelRow) {
          // Sjekk om brukerens midjevi dde passer innenfor modellens størrelse
          const waistMargin = modelRow.waist - userWaist;
          console.log(`PerFit [BOTTOMS]: Modellens størrelse ${modelSize} har ${modelRow.waist}cm midje`);
          console.log(`PerFit [BOTTOMS]: Brukerens midje: ${userWaist}cm, margin: ${waistMargin.toFixed(1)}cm`);
          
          // Hvis brukerens mål er innenfor eller tært under modellens størrelse
          if (waistMargin >= -2) {
            console.log(`PerFit [BOTTOMS]: ⭐ MODELL-MATCH - Bruker passer i samme størrelse som modellen`);
            console.log(`PerFit [BOTTOMS]: → Ignorerer "varen er liten" varsel`);
            baseIndexOffset = 0; // Nullstill brand adjustment
            brandFitNote = `Modellen (${modelHeight}cm) bruker ${modelSize} - perfekt match for deg`;
            brandSecondaryNote = '';
            return { baseIndexOffset, brandFitNote, brandSecondaryNote, shouldApplyBrandAdjustment: false };
          } else {
            console.log(`PerFit [BOTTOMS]: ⚠️ Brukerens midje er ${Math.abs(waistMargin).toFixed(1)}cm større enn modellens størrelse - brand adjustment kan være relevant`);
          }
        }
      } else if (heightDiff <= 10 && modelHeight > userHeight) {
        // REGEL 2: Hvis modellen er 6-10cm høyere, vær konservativ
        console.log(`PerFit [BOTTOMS]: 👀 Modellen er ${heightDiff}cm høyere - vurderer konservativ tilnærming`);
        
        // Finn brukerens naturlige match
        let naturalMatchSize: string | null = null;
        for (const size of sizeData) {
          if (size.waist >= userWaist && (shouldIgnoreHip || size.hip >= userWaist)) {
            naturalMatchSize = size.intSize;
            break;
          }
        }
        
        if (naturalMatchSize && compareSizes(naturalMatchSize, modelSize) <= 0) {
          console.log(`PerFit [BOTTOMS]: ✓ Naturlig match (${naturalMatchSize}) <= modellens størrelse (${modelSize})`);
          console.log(`PerFit [BOTTOMS]: → Beholder naturlig match, ignorerer "liten" varsel`);
          baseIndexOffset = 0;
          brandFitNote = `Modellen (${modelHeight}cm) bruker ${modelSize} - din ${naturalMatchSize} passer`;
          brandSecondaryNote = '';
          return { baseIndexOffset, brandFitNote, brandSecondaryNote, shouldApplyBrandAdjustment: false };
        }
      }
    }
  }
  
  // === SMART BRAND-ADJUSTMENT ===
  // Kun aktiver hvis: 1) Ikke modell-match, ELLER 2) Bruker i øverste 20% av størrelsesintervall
  if (brandSuggestion > 0 && baseIndexOffset > 0) {
    // Sjekk om bruker er i øverste 20% av nåværende størrelse
    let shouldApplyUpsize = true;
    
    // Finn naturlig match-rad
    for (const size of sizeData) {
      if (size.waist >= userWaist && (shouldIgnoreHip || size.hip >= userWaist)) {
        const nextSize = sizeData[sizeData.indexOf(size) + 1];
        if (nextSize) {
          const range = nextSize.waist - size.waist;
          const userPosition = userWaist - size.waist;
          const percentile = (userPosition / range) * 100;
          
          console.log(`PerFit [BOTTOMS]: 📊 Bruker er ${percentile.toFixed(0)}% oppe i intervallet ${size.intSize} (${size.waist}cm - ${nextSize.waist}cm)`);
          
          // Kun oppjuster hvis bruker er i øverste 20%
          if (percentile < 80) {
            shouldApplyUpsize = false;
            console.log(`PerFit [BOTTOMS]: → Bruker er IKKE i øverste 20% - ignorerer "liten" varsel`);
            baseIndexOffset = 0;
            brandFitNote = '';
          }
        }
        break;
      }
    }
    
    if (shouldApplyUpsize) {
      // Varen er LITEN (og vi tvinger fortsatt oppjustering)
      brandFitNote = 'Siden varen er liten, sikrer denne at plagget er komfortabelt';
      brandSecondaryNote = 'Tight Fit - Sitter helt tett';
      console.log(`PerFit [BOTTOMS]: ↑ Oppjusterer til neste størrelse (bruker i øverste 20%)`);
    }
  } else if (brandSuggestion < 0) {
    // Varen er STOR
    brandFitNote = 'Siden varen er stor, vil denne sitte som din normale størrelse';
    brandSecondaryNote = 'Relaxed Fit - Litt romsligere enn målene dine';
  }
  
  if (baseIndexOffset !== 0) {
    console.log(`PerFit [BOTTOMS]: 🏷️ BRAND ADJUSTMENT: ${baseIndexOffset > 0 ? '+1 (liten)' : '-1 (stor)'} - will shift index by ${baseIndexOffset}`);
  }
  
  return { 
    baseIndexOffset, 
    brandFitNote, 
    brandSecondaryNote, 
    shouldApplyBrandAdjustment: baseIndexOffset !== 0 
  };
}
