/**
 * Utility functions for shoe size handling
 */

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
 * formatSizeForDisplay(43.33)    // "43 1/3"
 * formatSizeForDisplay("43.67")  // "43 2/3"
 * formatSizeForDisplay(43.5)     // "43 1/2"
 * formatSizeForDisplay(43)       // "43"
 * formatSizeForDisplay("43 1/3") // "43 1/3" (passthrough)
 */
export function formatSizeForDisplay(size: string | number): string {
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
