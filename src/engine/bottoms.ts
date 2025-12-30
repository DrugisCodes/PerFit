
// MIGRATION NOTE: This file has been refactored for modularity.
// All logic is now split into:
//   bottoms/wxl-logic.ts
//   bottoms/table-logic.ts
//   bottoms/text-logic.ts
//   bottoms/index.ts (main entry point)

export { calculateBottomRecommendation } from './bottoms/index';
export { calculateBottomsTextBasedRecommendation } from './bottoms/text-logic';
