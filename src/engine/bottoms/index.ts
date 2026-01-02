// Main entry point for bottoms recommendation logic
import { SizeRow, UserProfile, SizeRecommendation } from '../../stores/types';
import { calculateWxLRecommendation } from './wxl-logic';
import { calculateTableRecommendation } from './table-logic';
import { calculateBottomsTextBasedRecommendation } from './text-logic';
import { calculateUniversalBottomFallback } from './universal-fallback';

export function calculateBottomRecommendation(
  userProfile: UserProfile,
  sizeData: SizeRow[],
  textData?: {
    isAnkleLength?: boolean;
    lengthType?: string;
    stretch?: number;
    modelHeight?: number;
    inseamLength?: number;
    inseamLengthSize?: string;
    fit?: string;
  },
  dropdownSizes?: string[],
  fitHint?: string
): SizeRecommendation | null {
  // Routing logic: WxL > Table > Text > Universal Fallback
  
  // PRIORITY 1: WxL logic if product has WxL format (indicated by inseamLengthSize like "31X32")
  const hasWxLProduct = textData?.inseamLengthSize && /\d+[xX\/]\d+/.test(textData.inseamLengthSize);
  const hasWxLDropdown = dropdownSizes && dropdownSizes.length > 0 && dropdownSizes.some(s => /(?:W)?\s*(\d+)\s*[x×X/\-\s]+(?:L)?\s*(\d+)/i.test(s));
  
  if (hasWxLProduct || hasWxLDropdown) {
    console.log(`PerFit [BOTTOMS]: ⚡ WxL FORMAT DETECTED - Using WxL logic (product: ${hasWxLProduct}, dropdown: ${hasWxLDropdown})`);
    return calculateWxLRecommendation(userProfile, sizeData, textData, dropdownSizes || []);
  }
  
  if (sizeData && sizeData.length > 0) {
    return calculateTableRecommendation(userProfile, sizeData, textData, dropdownSizes);
  }
  
  // Check if we have meaningful text data (model info)
  const hasMeaningfulTextData = textData && (textData.modelHeight !== undefined || textData.inseamLength !== undefined);
  
  // Fallback: text-based (only if model data exists)
  if (hasMeaningfulTextData) {
    // Provide a dummy modelSize if missing (required by text-logic)
    const textDataWithModelSize = { modelSize: 'M', ...textData };
    return calculateBottomsTextBasedRecommendation(userProfile, textDataWithModelSize);
  }
  
  // Universal Fallback: when both size tables and model data are missing
  // Determine fit preference from textData or fitHint
  let fitPreference: 'relaxed' | 'slim' | 'regular' = 'regular';
  if (textData?.fit?.toLowerCase() === 'relaxed') {
    fitPreference = 'relaxed';
  } else if (textData?.fit?.toLowerCase() === 'slim') {
    fitPreference = 'slim';
  } else if (fitHint?.toLowerCase().includes('liten')) {
    fitPreference = 'relaxed'; // Size up for items that run small
  } else if (fitHint?.toLowerCase().includes('stor')) {
    fitPreference = 'slim'; // Size down for items that run large
  }
  
  console.log('PerFit: Activating Universal Fallback Mode (no size table or model data found)');
  return calculateUniversalBottomFallback(userProfile, fitPreference);
}
