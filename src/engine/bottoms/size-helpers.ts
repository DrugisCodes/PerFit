// Size conversion and comparison utilities for bottoms
import { MENS_JEANS_WAIST_MAPPING } from '../constants';

/**
 * Size Map: Translate letter sizes to numeric equivalents
 * Returns array of possible numeric sizes for each letter size
 */
export function getSizeMap(): Record<string, string[]> {
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
 * Compare two sizes (letter or numeric) to determine which is larger
 * @returns -1 if size1 < size2, 0 if equal, 1 if size1 > size2
 */
export function compareSizes(size1: string, size2: string): number {
  const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  
  const upper1 = size1.toUpperCase();
  const upper2 = size2.toUpperCase();
  
  // If both are letter sizes, use order array
  const idx1 = sizeOrder.indexOf(upper1);
  const idx2 = sizeOrder.indexOf(upper2);
  
  if (idx1 !== -1 && idx2 !== -1) {
    return idx1 < idx2 ? -1 : (idx1 > idx2 ? 1 : 0);
  }
  
  // If both are numeric, compare numerically
  const num1 = parseInt(size1);
  const num2 = parseInt(size2);
  
  if (!isNaN(num1) && !isNaN(num2)) {
    return num1 < num2 ? -1 : (num1 > num2 ? 1 : 0);
  }
  
  // Fallback: string comparison
  return size1.localeCompare(size2);
}

/**
 * Translate letter size (M, L) to numeric waist size (31, 32) based on waist measurement
 * Uses intelligent mapping to find best match from available sizes
 * @param letterSize - Letter size from table (e.g., 'M', 'L')
 * @param waistCm - User's waist measurement in cm
 * @param availableSizes - Available sizes from dropdown (optional, for validation)
 */
export function translateLetterToNumericSize(
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
