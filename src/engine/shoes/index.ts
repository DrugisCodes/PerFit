/**
 * Shoe sizing module
 * 
 * Exports all public functions for shoe size calculations
 */

// Types
export type { ShoeSize, ShoeContext, BufferLimits, ShoeConstruction } from './types';

// Utility functions
export { cleanShoeSize, formatSizeForDisplay } from './utils';

// Interpolation functions
export { interpolateFootLength, buildCompleteSizeList } from './interpolation';

// Main recommendation function
export { calculateShoeRecommendation } from './recommendation';
