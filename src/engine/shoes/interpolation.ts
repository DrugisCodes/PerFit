/**
 * Size interpolation functions for calculating intermediate shoe sizes
 */

import { SizeRow } from '../../stores/types';
import { ShoeSize } from './types';
import { cleanShoeSize } from './utils';

/**
 * Interpolate foot length for intermediate sizes
 * 
 * Example: If table shows:
 * - 43 → 27.0cm
 * - 44 → 27.7cm
 * 
 * And dropdown has 43 1/3, calculate:
 * 43 1/3 ≈ 27.0 + (27.7 - 27.0) * (1/3) = 27.23cm
 * 
 * @param size - The size to interpolate (e.g., "43.33" for 43 1/3)
 * @param tableSizes - Array of sizes from the table with known foot lengths
 * @returns Interpolated foot length in cm, or null if cannot interpolate
 */
export function interpolateFootLength(size: string, tableSizes: ShoeSize[]): number | null {
  const sizeNum = parseFloat(size.replace(',', '.').replace(/\s+/g, ''));
  
  if (isNaN(sizeNum) || tableSizes.length < 2) {
    return null;
  }

  // Find the two surrounding whole sizes in the table
  let lowerSize: ShoeSize | null = null;
  let upperSize: ShoeSize | null = null;

  for (let i = 0; i < tableSizes.length - 1; i++) {
    const currentNum = parseFloat(tableSizes[i].size.replace(',', '.'));
    const nextNum = parseFloat(tableSizes[i + 1].size.replace(',', '.'));
    
    if (currentNum <= sizeNum && sizeNum <= nextNum) {
      lowerSize = tableSizes[i];
      upperSize = tableSizes[i + 1];
      break;
    }
  }

  if (!lowerSize || !upperSize) {
    return null;
  }

  // Linear interpolation
  const lowerNum = parseFloat(lowerSize.size.replace(',', '.'));
  const upperNum = parseFloat(upperSize.size.replace(',', '.'));
  const ratio = (sizeNum - lowerNum) / (upperNum - lowerNum);
  const interpolated = lowerSize.footLength + (upperSize.footLength - lowerSize.footLength) * ratio;
  
  console.log(`PerFit [SHOES]: Interpolated size ${size} → ${interpolated.toFixed(2)}cm (between ${lowerSize.size}=${lowerSize.footLength}cm and ${upperSize.size}=${upperSize.footLength}cm)`);
  
  return Math.round(interpolated * 100) / 100; // Round to 2 decimals
}

/**
 * Build complete size list with interpolated intermediate sizes
 * 
 * @param tableSizeData - Raw SizeRow data from table scraping
 * @param dropdownSizes - Array of sizes available in dropdown (may include half sizes)
 * @returns Complete array of ShoeSize including interpolated entries
 */
export function buildCompleteSizeList(tableSizeData: SizeRow[], dropdownSizes: string[]): ShoeSize[] {
  // Convert table data to ShoeSize format
  const tableSizes: ShoeSize[] = tableSizeData
    .filter(row => row.footLength && row.footLength > 0)
    .map(row => ({
      size: cleanShoeSize(row.intSize),
      footLength: row.footLength!,
      isInterpolated: false,
      rowIndex: row.rowIndex
    }));

  if (dropdownSizes.length === 0) {
    return tableSizes;
  }

  console.log("PerFit [SHOES]: Checking for intermediate sizes to interpolate...");
  const allSizes: ShoeSize[] = [...tableSizes];

  dropdownSizes.forEach(dropdownSize => {
    const cleanDropdownSize = cleanShoeSize(dropdownSize);
    const alreadyInTable = tableSizes.some(s => s.size === cleanDropdownSize);
    
    if (!alreadyInTable) {
      const interpolatedLength = interpolateFootLength(cleanDropdownSize, tableSizes);
      
      if (interpolatedLength) {
        allSizes.push({
          size: cleanDropdownSize,
          footLength: interpolatedLength,
          isInterpolated: true,
          rowIndex: -1 // Interpolated rows don't exist in original table
        });
        console.log(`PerFit [SHOES]: ✨ Added interpolated size ${cleanDropdownSize} with foot length ${interpolatedLength}cm`);
      }
    }
  });

  // Sort by size number
  allSizes.sort((a, b) => {
    const aNum = parseFloat(a.size.replace(',', '.'));
    const bNum = parseFloat(b.size.replace(',', '.'));
    return aNum - bNum;
  });

  console.log(`PerFit [SHOES]: Total ${allSizes.length} sizes available (${allSizes.filter(s => s.isInterpolated).length} interpolated)`);
  return allSizes;
}
