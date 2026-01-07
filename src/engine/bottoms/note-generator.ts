// Fit note generation utilities for bottoms sizing
import { SizeRow } from '../../stores/types';

export interface FitNoteParams {
  userInseam: number | null;
  productInseam?: number;
  productInseamSize?: string;
  isAnkleLength?: boolean;
  hasModelData: boolean;
  fit?: string;
  shouldIgnoreHip: boolean;
  originalWaist: number;
  targetSize: SizeRow;
  brandFitNote: string;
  stretch?: number;
}

export interface FitNotes {
  inseamAnchorNote: string;
  primaryFitNote: string;
  beltLogicNote: string;
}

/**
 * Generate inseam anchor note based on product and user inseam measurements
 */
export function generateInseamAnchorNote(
  productInseam: number | undefined,
  productInseamSize: string | undefined,
  userInseam: number | null
): string {
  if (!productInseam || !userInseam) {
    return '';
  }
  
  const inseamDiff = Math.abs(productInseam - userInseam);
  
  if (inseamDiff <= 1.5 && productInseamSize) {
    const lockedLength = productInseamSize.match(/L(\d{2})$/i)?.[1] || 
                        productInseamSize.split('X')[1] || 
                        productInseamSize.split('/')[1] || 
                        productInseamSize.split(' ')[1];
    return `Size ${lockedLength} is a confirmed ${productInseam}cm match for your legs based on product details`;
  } else if (inseamDiff <= 3) {
    return `Your inseam: ${userInseam}cm • Item inseam: ${productInseam}cm → Good fit`;
  } else if (productInseam > userInseam) {
    return `Your inseam: ${userInseam}cm • Item inseam: ${productInseam}cm → May need hemming`;
  } else {
    return `Your inseam: ${userInseam}cm • Item inseam: ${productInseam}cm → May be short`;
  }
}

/**
 * Generate belt logic note when size is chosen for length but waist is loose
 */
export function generateBeltLogicNote(
  targetWaist: number,
  originalWaist: number
): string {
  if (targetWaist <= originalWaist + 2) {
    return '';
  }
  
  const waistDiff = targetWaist - originalWaist;
  return `Vi har valgt denne for å sikre at lengden blir riktig for deg. Midjen kan være ${waistDiff.toFixed(1)}cm romsligere, så du må kanskje bruke belte, men da unngår du at buksen ser for kort ut.`;
}

/**
 * Generate complete fit notes for size recommendation
 */
export function generateFitNotes(params: FitNoteParams): FitNotes {
  const {
    userInseam,
    productInseam,
    productInseamSize,
    isAnkleLength,
    hasModelData,
    fit,
    shouldIgnoreHip,
    originalWaist,
    targetSize,
    brandFitNote,
    stretch
  } = params;
  
  // Generate inseam anchor note
  const inseamAnchorNote = generateInseamAnchorNote(productInseam, productInseamSize, userInseam);
  
  // Generate belt logic note
  const beltLogicNote = generateBeltLogicNote(targetSize.waist, originalWaist);
  
  // Build primary fit note
  let primaryFitNote = '';
  
  // Priority 1: Brand fit note (from model analysis)
  if (brandFitNote) {
    primaryFitNote = brandFitNote;
  }
  // Priority 2: Inseam anchor note (strong match)
  else if (inseamAnchorNote && !brandFitNote) {
    primaryFitNote = inseamAnchorNote;
  }
  // Priority 3: Belt logic (size chosen for length)
  else if (beltLogicNote) {
    primaryFitNote = beltLogicNote;
  }
  // Priority 4: Inseam comparison for standard cases
  else if (userInseam && targetSize.inseam && !brandFitNote && !beltLogicNote) {
    const diff = targetSize.inseam - userInseam;
    if (isAnkleLength) {
      primaryFitNote = 'Designed to end at the ankle';
    } else if (diff > 4) {
      primaryFitNote = `Warning: Inseam is ${diff.toFixed(1)}cm longer than your ${userInseam}cm legs - may need hemming`;
    } else if (diff < -3) {
      primaryFitNote = 'May be slightly short in the legs';
    } else if (diff > 2) {
      primaryFitNote = `Pants are ${diff.toFixed(1)}cm longer, can be hemmed if needed`;
    }
  }
  // Priority 5: Generic fit note
  else if (!hasModelData && !beltLogicNote) {
    primaryFitNote = `Recommended ${targetSize.intSize} based on ${fit || 'fit type'} and your ${originalWaist}cm waist`;
  }
  
  // Add stretch warning if applicable
  if (stretch === 0 && targetSize.waist === originalWaist) {
    primaryFitNote += (primaryFitNote ? ' • ' : '') + '(No stretch - may feel tight)';
  }
  
  // Add hip filtering note if applicable
  if (shouldIgnoreHip && !brandFitNote) {
    primaryFitNote += (primaryFitNote ? ' • ' : '') + 'Hip measurement ignored (smaller than size chart)';
  }
  
  // Add inseam info if not already included and belt logic was used
  if (beltLogicNote && inseamAnchorNote && primaryFitNote === beltLogicNote) {
    primaryFitNote += ' • ' + inseamAnchorNote;
  } else if (beltLogicNote && userInseam && targetSize.inseam && primaryFitNote === beltLogicNote) {
    const diff = targetSize.inseam - userInseam;
    if (isAnkleLength) {
      primaryFitNote += ' • Designed to end at the ankle';
    } else if (diff > 4) {
      primaryFitNote += ` • Warning: Inseam is ${diff.toFixed(1)}cm longer than your ${userInseam}cm legs - may need hemming`;
    } else if (diff < -3) {
      primaryFitNote += ' • May be slightly short in the legs';
    } else if (diff > 2) {
      primaryFitNote += ` • Pants are ${diff.toFixed(1)}cm longer, can be hemmed if needed`;
    }
  }
  
  return {
    inseamAnchorNote,
    primaryFitNote: primaryFitNote.trim(),
    beltLogicNote
  };
}

/**
 * Generate contextual fit note for dual recommendations
 */
export function generateDualFitNote(
  hasModelData: boolean,
  fit: string | undefined
): string {
  if (hasModelData) {
    return 'Best Fit - Clean look without being baggy';
  }
  return `Best Fit (${fit || 'Relaxed'})`;
}

/**
 * Generate secondary size note for dual recommendations
 */
export function generateSecondaryNote(
  secondaryWaist: number
): string {
  return `Romsligere i midjen (${secondaryWaist}cm), men kan være litt lang`;
}
