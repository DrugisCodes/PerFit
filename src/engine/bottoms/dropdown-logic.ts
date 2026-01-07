// Dropdown prioritization logic for bottoms
import { SizeRow } from '../../stores/types';
import { translateLetterToNumericSize } from './size-helpers';

/**
 * Apply dropdown prioritization
 * Converts table recommendation to actual dropdown format
 */
export function applyDropdownPrioritization(
  smallestMatch: SizeRow,
  secondarySize: string | undefined,
  isDual: boolean,
  availableSizes: string[] | undefined,
  userWaist: number
): {
  displaySize: string;
  secondaryDisplaySize: string | undefined;
  isDual: boolean;
  secondarySizeNote: string | undefined;
} {
  let displaySize = smallestMatch.intSize;
  let secondaryDisplaySize = secondarySize;
  let secondarySizeNote: string | undefined = undefined;
  
  console.log(`PerFit [BOTTOMS]: 🔍 DROPDOWN CHECK - availableSizes:`, availableSizes);
  
  if (availableSizes && availableSizes.length > 0) {
    console.log("PerFit [BOTTOMS]: 📋 DROPDOWN-PRIORITERING AKTIVERT");
    console.log(`PerFit [BOTTOMS]: Tabell-anbefaling: "${smallestMatch.intSize}" (${smallestMatch.waist}cm midje)`);
    console.log(`PerFit [BOTTOMS]: Brukerens midje: ${userWaist}cm`);
    console.log(`PerFit [BOTTOMS]: Dropdown inneholder ${availableSizes.length} størrelser:`, availableSizes);
    
    // Identifiser dropdown-format
    const numericDropdownSizes = availableSizes
      .map(s => {
        const parsed = parseInt(s.replace(/\D/g, ''));
        return parsed;
      })
      .filter(n => !isNaN(n) && n >= 28 && n <= 42);
    
    const letterDropdownSizes = availableSizes
      .filter(s => /^(XXS|XS|S|M|L|XL|XXL|XXXL)$/i.test(s));

    // SCENARIO 1: Dropdown bruker TALL (30, 31, 32...)
    if (numericDropdownSizes.length > 0) {
      console.log(`PerFit [BOTTOMS]: ✅ Dropdown bruker TALLSTØRRELSER (${numericDropdownSizes.length} funnet)`);
      console.log(`PerFit [BOTTOMS]: → ALLTID vis tallstørrelse fra dropdown (aldri bokstaver)`);
      
      // Finn tallet i dropdown som er nærmest brukerens midje
      const bestNumericMatch = numericDropdownSizes.reduce((prev, curr) => {
        const currWaistCm = curr * 2.54;
        const prevWaistCm = prev * 2.54;
        return (Math.abs(currWaistCm - userWaist) < Math.abs(prevWaistCm - userWaist) ? curr : prev);
      });

      displaySize = bestNumericMatch.toString();
      console.log(`PerFit [BOTTOMS]: 🎯 Primary: "${bestNumericMatch}" (${(bestNumericMatch * 2.54).toFixed(1)}cm ≈ ${userWaist}cm bruker)`);
      
      // Finn secondary size fra dropdown
      if (secondarySize && isDual) {
        const sortedDropdown = [...numericDropdownSizes].sort((a, b) => a - b);
        const currentIndex = sortedDropdown.indexOf(bestNumericMatch);
        
        if (currentIndex >= 0 && currentIndex < sortedDropdown.length - 1) {
          secondaryDisplaySize = sortedDropdown[currentIndex + 1].toString();
          console.log(`PerFit [BOTTOMS]: 🎯 Secondary: "${secondaryDisplaySize}" (neste størrelse i dropdown)`);
        } else {
          isDual = false;
          secondaryDisplaySize = undefined;
          secondarySizeNote = undefined;
          console.log(`PerFit [BOTTOMS]: ⚠️ Ingen neste størrelse tilgjengelig - kansellerer dual`);
        }
      }
      
      // Duplicate prevention
      if (secondaryDisplaySize && displaySize === secondaryDisplaySize) {
        console.log(`PerFit [BOTTOMS]: ⚠️ Duplicate sizes - kansellerer dual`);
        isDual = false;
        secondaryDisplaySize = undefined;
        secondarySizeNote = undefined;
      }
      
      return { displaySize, secondaryDisplaySize, isDual, secondarySizeNote };
    }
    
    // SCENARIO 2: Dropdown bruker BOKSTAVER (S, M, L, XL...)
    else if (letterDropdownSizes.length > 0) {
      console.log(`PerFit [BOTTOMS]: ✅ Dropdown bruker BOKSTAVSTØRRELSER (${letterDropdownSizes.length} funnet)`);
      console.log(`PerFit [BOTTOMS]: → Konverterer tabell-anbefaling til bokstavformat`);
      
      const tableWaist = smallestMatch.waist;
      
      const waistToLetterMap: Record<string, [number, number]> = {
        'XS': [0, 76],
        'S': [77, 81],
        'M': [82, 86],
        'L': [87, 91],
        'XL': [92, 100],
        'XXL': [101, 110]
      };
      
      let bestLetterMatch: string | null = null;
      
      for (const [letter, range] of Object.entries(waistToLetterMap)) {
        if (tableWaist >= range[0] && tableWaist <= range[1]) {
          if (letterDropdownSizes.includes(letter)) {
            bestLetterMatch = letter;
            break;
          }
        }
      }
      
      if (bestLetterMatch) {
        displaySize = bestLetterMatch;
        console.log(`PerFit [BOTTOMS]: 🎯 Primary: "${bestLetterMatch}" (${tableWaist}cm midje → bokstav)`);
        
        if (secondarySize && isDual) {
          const secondaryWaist = smallestMatch.waist; // Would need sizeData lookup for actual value
          let secondaryLetterMatch: string | null = null;
          
          for (const [letter, range] of Object.entries(waistToLetterMap)) {
            if (secondaryWaist >= range[0] && secondaryWaist <= range[1]) {
              if (letterDropdownSizes.includes(letter)) {
                secondaryLetterMatch = letter;
                break;
              }
            }
          }
          
          if (secondaryLetterMatch && secondaryLetterMatch !== bestLetterMatch) {
            secondaryDisplaySize = secondaryLetterMatch;
            console.log(`PerFit [BOTTOMS]: 🎯 Secondary: "${secondaryLetterMatch}"`);
          } else {
            isDual = false;
            secondaryDisplaySize = undefined;
            secondarySizeNote = undefined;
          }
        }
      } else {
        console.log(`PerFit [BOTTOMS]: ⚠️ Kunne ikke finne matchende bokstavstørrelse - beholder "${displaySize}"`);
      }
    }
    
    // SCENARIO 3: Dropdown har andre formater (WxL, etc) - behold standard logikk
    else {
      console.log(`PerFit [BOTTOMS]: ℹ️ Dropdown bruker annet format - kjører standard oversettelse`);
    }
  }
  
  // === STANDARD TRANSLATION (FALLBACK NÅR INGEN DROPDOWN) ===
  if (!availableSizes || availableSizes.length === 0) {
    console.log(`PerFit [BOTTOMS]: ⚠️ SIKKERHETSNETT - Ingen dropdown funnet`);
    
    const isLetterSize = /^(XXS|XS|S|M|L|XL|XXL|XXXL)$/i.test(smallestMatch.intSize);
    const isWaistSize = /(W\d+|Waist|L\d+)/i.test(smallestMatch.intSize);
    
    if (isLetterSize) {
      console.log(`PerFit [BOTTOMS]: Tabell-størrelse "${smallestMatch.intSize}" er bokstav - tvinger konvertering til tall`);
      displaySize = translateLetterToNumericSize(smallestMatch.intSize, userWaist, []);
      console.log(`PerFit [BOTTOMS]: 🔄 Konvertert "${smallestMatch.intSize}" → "${displaySize}" (kategori: bottom)`);
    } else if (isWaistSize && !isLetterSize) {
      displaySize = translateLetterToNumericSize(smallestMatch.intSize, userWaist, []);
    } else {
      displaySize = smallestMatch.intSize;
    }
    
    if (secondarySize) {
      const isSecondaryLetterSize = /^(XXS|XS|S|M|L|XL|XXL|XXXL)$/i.test(secondarySize);
      const isSecondaryWaistSize = /(W\d+|Waist|L\d+)/i.test(secondarySize);
      
      if (isSecondaryWaistSize && !isSecondaryLetterSize) {
        secondaryDisplaySize = translateLetterToNumericSize(secondarySize, userWaist, availableSizes);
      } else if (isSecondaryLetterSize && !isSecondaryWaistSize) {
        secondaryDisplaySize = secondarySize;
      } else if (isSecondaryLetterSize && availableSizes) {
        secondaryDisplaySize = translateLetterToNumericSize(secondarySize, userWaist, availableSizes);
      }
    }
  }
  
  // === DUPLICATE PREVENTION (FORBEDRET) ===
  if (secondaryDisplaySize && displaySize === secondaryDisplaySize) {
    console.log(`PerFit [BOTTOMS]: ⚠️ Duplicate sizes detected after translation (${displaySize})`);
    console.log(`PerFit [BOTTOMS]: Primary: ${smallestMatch.intSize}, Secondary: ${secondarySize}`);
    
    if (smallestMatch.intSize === secondarySize) {
      console.log(`PerFit [BOTTOMS]: → Samme bokstav detektert - kansellerer dual (viser kun ${displaySize})`);
      isDual = false;
      secondaryDisplaySize = undefined;
      secondarySizeNote = undefined;
    } else {
      console.log(`PerFit [BOTTOMS]: → Forskjellige bokstaver (${smallestMatch.intSize} vs ${secondarySize}), beholder originale`);
      displaySize = smallestMatch.intSize;
      secondaryDisplaySize = secondarySize;
      
      if (displaySize === secondaryDisplaySize) {
        console.log(`PerFit [BOTTOMS]: → Fortsatt duplikat - kansellerer dual`);
        isDual = false;
        secondaryDisplaySize = undefined;
        secondarySizeNote = undefined;
      }
    }
  }
  
  return { displaySize, secondaryDisplaySize, isDual, secondarySizeNote };
}
