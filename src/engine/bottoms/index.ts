// Main entry point for bottoms recommendation logic
import { SizeRow, UserProfile, SizeRecommendation } from '../../stores/types';
import { calculateWxLRecommendation } from './wxl-logic';
import { calculateTableRecommendation } from './table-logic';
import { calculateBottomsTextBasedRecommendation } from './text-logic';

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
  },
  dropdownSizes?: string[],
  fitHint?: string
): SizeRecommendation | null {
  // Routing logic: WxL > Table > Text
  if (dropdownSizes && dropdownSizes.length > 0 && dropdownSizes.some(s => /(?:W)?\s*(\d+)\s*[x×X/\-\s]+(?:L)?\s*(\d+)/i.test(s))) {
    return calculateWxLRecommendation(userProfile, sizeData, textData, dropdownSizes, fitHint);
  }
  if (sizeData && sizeData.length > 0) {
    return calculateTableRecommendation(userProfile, sizeData, textData, fitHint);
  }
  // Fallback: text-based
  if (textData) {
    // Provide a dummy modelSize if missing (required by text-logic)
    const textDataWithModelSize = { modelSize: 'M', ...textData };
    return calculateBottomsTextBasedRecommendation(userProfile, textDataWithModelSize);
  }
  return null;
}
