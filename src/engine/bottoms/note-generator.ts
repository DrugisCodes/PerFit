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
  _productInseamSize: string | undefined,
  userInseam: number | null
): string {
  if (!productInseam || !userInseam) {
    return '';
  }
  
  const inseamDiff = Math.abs(productInseam - userInseam);
  
  if (inseamDiff <= 1.5) {
    return '✓ Perfekt lengde';
  } else if (inseamDiff <= 3) {
    return '✓ God lengde';
  } else if (productInseam > userInseam) {
    return '⚠ Trenger korting';
  } else {
    return '⚠ Kan bli kort';
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
  
  return '⚠ Krever belte';
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
    originalWaist,
    targetSize,
    brandFitNote,
    stretch
  } = params;
  
  // Generate inseam anchor note
  const inseamAnchorNote = generateInseamAnchorNote(productInseam, productInseamSize, userInseam);
  
  // Generate belt logic note
  const beltLogicNote = generateBeltLogicNote(targetSize.waist, originalWaist);
  
  // Build primary fit note with concise tags
  let primaryFitNote = '';
  const notes: string[] = [];
  
  // Priority 1: Brand fit note (from model analysis)
  if (brandFitNote) {
    primaryFitNote = brandFitNote;
  }
  // Priority 2: Inseam anchor note (strong match)
  else if (inseamAnchorNote) {
    notes.push(inseamAnchorNote);
  }
  // Priority 3: Inseam comparison for standard cases
  else if (userInseam && targetSize.inseam) {
    const diff = targetSize.inseam - userInseam;
    if (isAnkleLength) {
      notes.push('✓ Ankellengde');
    } else if (diff > 4) {
      notes.push('⚠ Trenger korting');
    } else if (diff < -3) {
      notes.push('⚠ Kan bli kort');
    } else if (Math.abs(diff) <= 2) {
      notes.push('✓ God lengde');
    }
  }
  
  // Add belt logic if needed
  if (beltLogicNote) {
    notes.push(beltLogicNote);
  }
  
  // Add stretch warning if applicable
  if (stretch === 0 && targetSize.waist === originalWaist) {
    notes.push('⚠ Uten stretch');
  }
  
  // Combine notes if no brand note
  if (!primaryFitNote) {
    primaryFitNote = notes.join(' • ');
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
    return '✓ Perfekt passform';
  }
  return `✓ ${fit || 'Relaxed'}`;
}

/**
 * Generate secondary size note for dual recommendations
 */
export function generateSecondaryNote(
  _secondaryWaist: number
): string {
  return 'Romsligere passform';
}
