/**
 * Mathematical Utility Functions
 * 
 * Common math operations for size calculations and conversions
 */

/**
 * Format a numeric shoe size for display with proper fraction notation
 * Converts decimal values back to human-readable fractions:
 * - .33/.34 → " 1/3" (e.g., 43.33 → "43 1/3")
 * - .66/.67 → " 2/3" (e.g., 43.67 → "43 2/3")
 * - .5 → " 1/2" (e.g., 43.5 → "43 1/2")
 * - integers → plain number (e.g., 43.0 → "43")
 * 
 * @param size - Numeric value or string representation of size
 * @returns Formatted string with proper fractions for display
 * 
 * @example
 * formatDisplaySize(43.33)    // "43 1/3"
 * formatDisplaySize("43.67")  // "43 2/3"
 * formatDisplaySize(43.5)     // "43 1/2"
 * formatDisplaySize(43)       // "43"
 * formatDisplaySize("43 1/3") // "43 1/3" (passthrough)
 */
export function formatDisplaySize(size: string | number): string {
  // If already a string with fraction notation, return as-is
  if (typeof size === 'string') {
    if (/\d+\s+\d+\/\d+/.test(size)) {
      return size; // Already formatted like "43 1/3"
    }
    size = parseFloat(size.replace(',', '.'));
  }
  
  if (isNaN(size)) {
    return String(size);
  }
  
  const wholeNumber = Math.floor(size);
  const decimal = size - wholeNumber;
  
  // Check for common fractions with tolerance
  if (Math.abs(decimal - 0.333) < 0.02 || Math.abs(decimal - 0.34) < 0.02) {
    return `${wholeNumber} 1/3`;
  }
  if (Math.abs(decimal - 0.667) < 0.02 || Math.abs(decimal - 0.66) < 0.02) {
    return `${wholeNumber} 2/3`;
  }
  if (Math.abs(decimal - 0.5) < 0.02) {
    return `${wholeNumber} 1/2`;
  }
  
  // No significant decimal - return whole number
  if (decimal < 0.02) {
    return String(wholeNumber);
  }
  
  // Unknown decimal - return with one decimal place
  return size.toFixed(1);
}

/**
 * Clean shoe size string to handle half sizes and fractions
 * Returns ORIGINAL format preserved for display (e.g., "43 1/3" stays "43 1/3")
 * Only converts comma to period for consistency
 * 
 * @param sizeStr - Raw size string from table or dropdown
 * @returns Normalized size string preserving fractions
 * 
 * @example
 * cleanShoeSize("43 1/3")  // "43 1/3"
 * cleanShoeSize("43,5")    // "43.5"
 * cleanShoeSize("43")      // "43"
 */
export function cleanShoeSize(sizeStr: string): string {
  sizeStr = sizeStr.trim();
  
  // Preserve fractions like "43 1/3" as-is (don't convert to decimal)
  // This is important for display and matching
  if (/\d+\s+\d+\/\d+/.test(sizeStr)) {
    return sizeStr;
  }
  
  // Replace comma with period for European decimal notation
  return sizeStr.replace(',', '.');
}

/**
 * Convert shoe size string to numeric value for comparison
 * Handles fractions like "43 1/3" → 43.333...
 * 
 * @param sizeStr - Size string (can contain fractions)
 * @returns Numeric value for mathematical comparison
 * 
 * @example
 * parseSizeToNumber("43 1/3")  // 43.333...
 * parseSizeToNumber("43.5")    // 43.5
 * parseSizeToNumber("43")      // 43.0
 */
export function parseSizeToNumber(sizeStr: string): number {
  sizeStr = sizeStr.trim();
  
  // Handle fractions like "43 1/3"
  const fractionMatch = sizeStr.match(/(\d+)\s+(\d+)\/(\d+)/);
  if (fractionMatch) {
    const whole = parseInt(fractionMatch[1]);
    const numerator = parseInt(fractionMatch[2]);
    const denominator = parseInt(fractionMatch[3]);
    return whole + (numerator / denominator);
  }
  
  // Handle regular decimal or integer
  return parseFloat(sizeStr.replace(',', '.'));
}

/**
 * Interpolate foot length for intermediate shoe sizes
 * 
 * Uses linear interpolation to estimate foot length for sizes not in the table.
 * Example: If table shows 43 → 27.0cm and 44 → 27.7cm, 
 * then 43 1/3 ≈ 27.0 + (27.7 - 27.0) * (1/3) = 27.23cm
 * 
 * @param size - The size to interpolate (e.g., "43 1/3" or "43.33")
 * @param tableSizes - Array of known sizes from the table with their foot lengths
 * @returns Interpolated foot length in cm, or undefined if interpolation not possible
 * 
 * @example
 * const tableSizes = [
 *   { size: "43", footLength: 27.0 },
 *   { size: "44", footLength: 27.7 }
 * ];
 * interpolateFootLength("43 1/3", tableSizes) // 27.23
 */
export function interpolateFootLength(
  size: string, 
  tableSizes: Array<{ size: string; footLength: number }>
): number | undefined {
  const sizeNum = parseSizeToNumber(size);
  
  if (isNaN(sizeNum) || tableSizes.length < 2) {
    return undefined;
  }

  // Find the two surrounding whole sizes in the table
  let lowerSize: { size: string; footLength: number } | null = null;
  let upperSize: { size: string; footLength: number } | null = null;

  for (let i = 0; i < tableSizes.length - 1; i++) {
    const currentNum = parseSizeToNumber(tableSizes[i].size);
    const nextNum = parseSizeToNumber(tableSizes[i + 1].size);
    
    if (currentNum <= sizeNum && sizeNum <= nextNum) {
      lowerSize = tableSizes[i];
      upperSize = tableSizes[i + 1];
      break;
    }
  }

  if (!lowerSize || !upperSize) {
    return undefined;
  }

  // Linear interpolation
  const lowerNum = parseSizeToNumber(lowerSize.size);
  const upperNum = parseSizeToNumber(upperSize.size);
  const ratio = (sizeNum - lowerNum) / (upperNum - lowerNum);
  const interpolated = lowerSize.footLength + (upperSize.footLength - lowerSize.footLength) * ratio;
  
  return Math.round(interpolated * 100) / 100; // Round to 2 decimals
}
