import { SizeRow, UserProfile, SizeRecommendation } from '../../stores/types';
import { MENS_JEANS_WAIST_MAPPING } from '../constants';

function normalizeSize(size: string): string {
  return size.replace(/[^0-9]/g, '').trim();
}

export function calculateWxLRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  textData?: {
    modelHeight?: number;
    inseamLength?: number;
    inseamLengthSize?: string;
    brandSizeSuggestion?: number; // +1 = liten, -1 = stor
  },
  dropdownSizes: string[] = []
): SizeRecommendation | null {
  const userWaist = parseInt(userProfile.waist);
  const userHeight = parseInt(userProfile.height || "0");
  const brandSuggestion = textData?.brandSizeSuggestion || 0;

  if (isNaN(userWaist) || userWaist <= 0) return null;

  console.log(`PerFit [WxL]: User waist ${userWaist}cm, height ${userHeight}cm, brand suggestion: ${brandSuggestion}`);

  // --- 1. BEREGN TARGET W (MIDJE) ---
  let targetW = 32;
  let minWdiff = Infinity;
  
  Object.keys(MENS_JEANS_WAIST_MAPPING).forEach(w => {
    const wNum = parseInt(w);
    const diff = Math.abs(MENS_JEANS_WAIST_MAPPING[wNum] - userWaist);
    if (diff < minWdiff) {
      minWdiff = diff;
      targetW = wNum;
    }
  });

  // VIKTIG: Juster for merket FØRST (Liten = gå opp)
  if (brandSuggestion > 0) {
    targetW += 1;
    console.log(`PerFit [WxL]: Adjusted UP due to brand suggestion: ${targetW - 1} -> ${targetW}`);
  }
  if (brandSuggestion < 0) {
    targetW -= 1;
    console.log(`PerFit [WxL]: Adjusted DOWN due to brand suggestion: ${targetW + 1} -> ${targetW}`);
  }

  // --- 2. BEREGN TARGET L (LENGDE) ---
  let targetL = 32; 
  const modelHeight = textData?.modelHeight || 185;
  const modelLMatch = textData?.inseamLengthSize?.match(/[xX\/](\d{2})/);
  const modelL = modelLMatch ? parseInt(modelLMatch[1]) : 32;
  
  if (userHeight > 0) {
    const heightDiff = userHeight - modelHeight;
    targetL = modelL + Math.round(heightDiff / 3);
    console.log(`PerFit [WxL]: Model ${modelHeight}cm L${modelL} -> User ${userHeight}cm L${targetL} (diff: ${heightDiff}cm)`);
  }

  // --- 3. MATCH MOT DROPDOWN (MED NORMALISERING) ---
  const normalizedTarget = `${targetW}${targetL}`;
  const normalizedLoose = `${targetW + 1}${targetL}`;
  
  let bestMatch: string | null = null;
  let looseMatch: string | null = null;

  console.log(`PerFit [WxL]: Looking for ${targetW}x${targetL} (normalized: ${normalizedTarget}) in ${dropdownSizes.length} sizes`);

  if (dropdownSizes && dropdownSizes.length > 0) {
    dropdownSizes.forEach(s => {
      const norm = normalizeSize(s);
      if (norm === normalizedTarget) {
        bestMatch = s;
        console.log(`PerFit [WxL]: ✓ Found exact match: ${s}`);
      }
      if (norm === normalizedLoose) {
        looseMatch = s;
        console.log(`PerFit [WxL]: ✓ Found loose match: ${s}`);
      }
    });

    // Hvis looseMatch ikke finnes, finn neste tilgjengelige størrelse
    if (!looseMatch && bestMatch) {
      const bestIdx = dropdownSizes.indexOf(bestMatch);
      if (bestIdx >= 0 && bestIdx < dropdownSizes.length - 1) {
        looseMatch = dropdownSizes[bestIdx + 1];
        console.log(`PerFit [WxL]: Using next available size for loose fit: ${looseMatch}`);
      }
    }
  }

  // ALLTID TVING WxL-FORMAT (fallback hvis scraper feiler)
  const finalSize = bestMatch || `${targetW}x${targetL}`;
  
  // VIKTIG: Håndter "liten/stor i størrelsen"-logikk
  let finalSecondary: string;
  let secondaryNote: string;
  
  if (brandSuggestion > 0) {
    // Varen er LITEN: Best Fit er allerede justert opp (W33)
    // Alternativ er MINDRE (W32 - original størrelse)
    const tightW = targetW - 1;
    finalSecondary = looseMatch || `${tightW}x${targetL}`;
    
    secondaryNote = "TIGHT FIT – Sitter helt tett uten belte";
  } else if (brandSuggestion < 0) {
    // Varen er STOR: Best Fit er allerede justert ned (W31)
    // Alternativ er STØRRE (W32 - relaxed fit)
    const relaxedW = targetW + 1;
    finalSecondary = looseMatch || `${relaxedW}x${targetL}`;
    
    secondaryNote = "RELAXED – Litt romsligere midje. Krever belte";
  } else {
    // Normal vare: Loose Fit er én størrelse opp
    finalSecondary = looseMatch || `${targetW + 1}x${targetL}`;
    secondaryNote = "Loose Fit - For en romsligere midje";
  }
  
  console.log(`PerFit [WxL]: Final recommendation - Best: ${finalSize}, Alternative: ${finalSecondary}`);

  let matchedRow: SizeRow | undefined = undefined;
  const targetWaistCm = MENS_JEANS_WAIST_MAPPING[targetW] || targetW * 2.54;
  sizeData.forEach(row => {
    if (Math.abs(row.waist - targetWaistCm) < 3) matchedRow = row;
  });

  // Bygg fitNote basert på justeringer (FORENKLET VERSJON)
  let fitNote = "Best Fit";
  const heightDiff = Math.abs(userHeight - modelHeight);
  
  // Smart høyde-advarsel: Kun hvis vi IKKE har endret lengden
  const heightWarning = (heightDiff > 10 && targetL === modelL) 
    ? `\n⚠️ Modellen er ${heightDiff}cm ${userHeight < modelHeight ? 'høyere' : 'lavere'} enn deg` 
    : '';
  
  if (brandSuggestion < 0) {
    // STOR: Varen er stor - vi har gått ned én størrelse
    fitNote = `BEST FIT – Sitter som din normale størrelse${heightWarning}`;
  } else if (brandSuggestion > 0) {
    // LITEN: Varen er liten - vi har gått opp én størrelse
    fitNote = `BEST FIT – Justert opp for komfort${heightWarning}`;
  } else {
    fitNote = `Best Fit${heightWarning}`;
  }

  // Sjekk for duplikater mellom finalSize og finalSecondary
  const isDualValid = finalSize !== finalSecondary;

  return {
    size: finalSize,
    confidence: 1.0,
    category: 'bottom',
    fitNote: fitNote,
    userChest: userWaist,  // Required by interface (for bottoms, use waist)
    targetChest: userWaist, // Required by interface (for bottoms, use waist)
    buffer: 0,
    userWaist: userWaist,
    userHeight: userHeight || undefined,
    matchedRow: matchedRow,
    isDual: isDualValid,
    secondarySize: isDualValid ? finalSecondary : undefined,
    secondarySizeNote: isDualValid ? secondaryNote : undefined
  };
}
