/**
 * Bottom garments calculation logic
 * Handles pants, jeans, skirts, shorts, etc.
 */

import { SizeRow, UserProfile, SizeRecommendation } from '../stores/types';
import { cmToInches } from './utils';

/**
 * Calculate recommendation for bottoms (pants, jeans, skirts)
 * Matches BOTH user waist AND hip - size must accommodate both measurements
 * Also checks inseam length and provides intelligent warnings for ankle-length pants
 * PRIORITY: If dropdown has WxL format (32x34), match waist and inseam directly
 */
export function calculateBottomRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  textData?: { isAnkleLength?: boolean; lengthType?: string; stretch?: number },
  dropdownSizes?: string[],
  fitHint?: string
): SizeRecommendation | null {
  let userWaist = parseInt(userProfile.waist);
  let userHip = parseInt(userProfile.hip);
  const userInseam = userProfile.inseam ? parseInt(userProfile.inseam) : null;

  if (isNaN(userWaist) || userWaist <= 0) {
    console.error("PerFit: Invalid waist measurement:", userProfile.waist);
    return null;
  }

  if (isNaN(userHip) || userHip <= 0) {
    console.error("PerFit: Invalid hip measurement:", userProfile.hip);
    return null;
  }

  // Juster målene basert på fit hint
  let sizeAdjustmentNote = '';
  const originalWaist = userWaist;
  
  if (fitHint?.toLowerCase().includes('liten')) {
    userWaist += 2; // Gå opp en størrelse
    userHip += 2;
    sizeAdjustmentNote = 'Sized up because item runs small';
    console.log(`PerFit [BOTTOM]: Item runs SMALL - adjusting waist from ${originalWaist}cm to ${userWaist}cm`);
  } else if (fitHint?.toLowerCase().includes('stor')) {
    userWaist -= 2; // Gå ned en størrelse
    userHip -= 2;
    sizeAdjustmentNote = 'Sized down because item runs large';
    console.log(`PerFit [BOTTOM]: Item runs LARGE - adjusting waist from ${originalWaist}cm to ${userWaist}cm`);
  }

  // 1. PRIORITET: Sjekk WxL-format i dropdown (f.eks. 32x34, 32×34, 32/34)
  if (dropdownSizes && dropdownSizes.length > 0 && userInseam) {
    const hasWxL = dropdownSizes.some(s => /\d+\s*[x×X/]\s*\d+/.test(s));
    if (hasWxL) {
      const targetW = cmToInches(userWaist);
      const targetL = cmToInches(userInseam);
      
      console.log(`PerFit [BOTTOM WxL]: Søker etter ${targetW}x${targetL} (fra ${userWaist}cm midje × ${userInseam}cm innerben)`);
      console.log(`PerFit [BOTTOM WxL]: Tilgjengelige størrelser:`, dropdownSizes);
      
      // Forsøk eksakt match først
      const wxlMatch = dropdownSizes.find(s => {
        const match = s.match(/(\d+)\s*[x×X/]\s*(\d+)/);
        if (match) {
          const w = parseInt(match[1]);
          const l = parseInt(match[2]);
          return w === targetW && l === targetL;
        }
        return false;
      });
      
      if (wxlMatch) {
        console.log(`PerFit [BOTTOM WxL]: ✓ Eksakt match funnet: ${wxlMatch}`);
        let fitNote = 'Exact inch match (WxL)';
        if (sizeAdjustmentNote) {
          fitNote = sizeAdjustmentNote + ' • ' + fitNote;
        }
        return {
          size: wxlMatch,
          confidence: 1.0,
          category: 'bottom',
          userChest: originalWaist,
          targetChest: userWaist,
          buffer: 0,
          fitNote: fitNote
        };
      }
      
      // Hvis ingen eksakt match, finn nærmeste
      console.log(`PerFit [BOTTOM WxL]: Ingen eksakt match, søker etter nærmeste...`);
      
      let bestSize = '';
      let bestWaistDiff = Infinity;
      let bestInseamDiff = Infinity;
      
      dropdownSizes.forEach(s => {
        const sizeMatch = s.match(/(\d+)\s*[x×X/]\s*(\d+)/);
        if (sizeMatch) {
          const w = parseInt(sizeMatch[1]);
          const l = parseInt(sizeMatch[2]);
          const waistDiff = Math.abs(w - targetW);
          const inseamDiff = Math.abs(l - targetL);
          
          console.log(`PerFit [BOTTOM WxL]: Sjekker ${s} (W:${w}, L:${l}) - avvik: midje ${waistDiff}", innerben ${inseamDiff}"`);
          
          // Prioriter midje først, deretter innerben
          if (waistDiff < bestWaistDiff || 
              (waistDiff === bestWaistDiff && inseamDiff < bestInseamDiff)) {
            bestSize = s;
            bestWaistDiff = waistDiff;
            bestInseamDiff = inseamDiff;
          }
        }
      });
      
      // Returner nærmeste match hvis forskjellen er akseptabel (≤2 tommer i midje eller innerben)
      if (bestSize && (bestWaistDiff <= 2 || bestInseamDiff <= 2)) {
        console.log(`PerFit [BOTTOM WxL]: ✓ Nærmeste match funnet: ${bestSize} (midje ±${bestWaistDiff}", innerben ±${bestInseamDiff}")`);
        
        let fitNote = 'Closest WxL match';
        if (bestWaistDiff > 0) {
          fitNote += ` (waist ${bestWaistDiff}" difference)`;
        }
        if (bestInseamDiff > 0) {
          fitNote += ` (length ${bestInseamDiff}" difference)`;
        }
        if (sizeAdjustmentNote) {
          fitNote = sizeAdjustmentNote + ' • ' + fitNote;
        }
        
        return {
          size: bestSize,
          confidence: 0.9,
          category: 'bottom',
          userChest: originalWaist,
          targetChest: userWaist,
          buffer: 0,
          fitNote: fitNote.trim()
        };
      }
      
      console.log(`PerFit [BOTTOM WxL]: Ingen passende WxL-match funnet, faller tilbake til tabellstørrelser...`);
    }
  }

  // 2. PRIORITET: Standard tabell-matching (INT-størrelser)
  console.log(`PerFit [BOTTOM]: Looking for size with waist >= ${userWaist}cm and hip >= ${userHip}cm`);
  
  for (const size of sizeData) {
    const waistFits = size.waist >= userWaist;
    const hipFits = size.hip >= userHip;

    if (waistFits && hipFits) {
      console.log(`PerFit [BOTTOM]: ✓ Match found! Size ${size.intSize}`);
      let fitNote = '';
      
      // Inseam/Lengde-logikk
      if (userInseam && size.inseam) {
        const diff = size.inseam - userInseam;
        if (textData?.isAnkleLength) {
          fitNote = 'Designed to end at the ankle';
        } else if (diff < -3) {
          fitNote = 'May be slightly short in the legs';
        } else if (diff > 5) {
          fitNote = 'Pants are long, can be hemmed';
        }
      }

      // Stretch-advarsel
      if (textData?.stretch === 0 && size.waist === userWaist) {
        fitNote += ' (No stretch - may feel tight)';
      }

      // Legg til size adjustment note hvis det finnes
      if (sizeAdjustmentNote) {
        fitNote = sizeAdjustmentNote + (fitNote ? ' • ' + fitNote : '');
      }

      return {
        size: size.intSize,
        confidence: 1.0,
        category: 'bottom',
        userChest: originalWaist,
        targetChest: size.waist,
        buffer: 0,
        matchedRow: size,
        fitNote: fitNote.trim()
      };
    }
  }
  
  console.warn(`PerFit [BOTTOM]: No size found for waist ${userWaist}cm AND hip ${userHip}cm`);
  return null;
}
