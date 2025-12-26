/**
 * PerFit Content Script - Main Entry Point
 * 
 * Thin orchestration layer that:
 * - Guards against non-product pages
 * - Handles Chrome message listeners
 * - Manages activation and cached state
 * - Handles click-outside-to-close
 */

// TOP-LEVEL GUARD: Exit immediately if not a product page (BEFORE any imports)
const pathname = window.location.pathname.toLowerCase();
if ((!pathname.includes(".html") && !pathname.includes("/p/")) || pathname.includes("-home")) {
  throw new Error("PerFit: Not a product page, aborting.");
}

import { SizeRecommendation } from '../stores/types';
import { detectCategoryFromPage } from './detector';
import { 
  showRecommendation, 
  showActionMenu, 
  removeActionMenu, 
  removeRecommendation,
  setMenuOpening,
  getIsOpeningMenu,
  resetMenuOpening
} from './ui-manager';
import { runPerFit } from './orchestrator';

/**
 * Cached recommendation for Resume State pattern
 * Stores the last successful size recommendation to avoid re-scraping
 */
let cachedRecommendation: SizeRecommendation | null = null;

/**
 * Getter for cached recommendation
 */
function getCachedRecommendation(): SizeRecommendation | null {
  return cachedRecommendation;
}

/**
 * Setter for cached recommendation
 */
function setCachedRecommendation(rec: SizeRecommendation | null): void {
  cachedRecommendation = rec;
}

/**
 * Wrapper for runPerFit that passes cache handlers
 */
async function runPerFitWithCache(manualOverride?: boolean): Promise<void> {
  await runPerFit(getCachedRecommendation, setCachedRecommendation, manualOverride);
}

/**
 * Handle activation - Smart logic for Resume State
 * 
 * Scenario A: Cached recommendation exists -> Show it immediately
 * Scenario B: No cache -> Show action menu
 * Scenario C: UI already visible -> Toggle (close it)
 */
function handleActivation(manualOverride?: boolean): void {
  // Check if any UI is already visible
  const menuVisible = !!document.getElementById('perfit-action-host');
  const recommendationVisible = !!document.getElementById('perfit-recommendation-host');
  
  if (menuVisible || recommendationVisible) {
    // Scenario C: Toggle - close existing UI
    removeActionMenu();
    removeRecommendation();
    console.log("PerFit: Toggled UI off");
    return;
  }
  
  if (cachedRecommendation && manualOverride === undefined) {
    // Scenario A: Show cached recommendation directly (only if not recalculating)
    console.log("PerFit: Showing cached recommendation");
    setMenuOpening();
    showRecommendation(cachedRecommendation);
  } else {
    // Scenario B: No cache OR manual override - show action menu
    console.log("PerFit: Showing action menu");
    setMenuOpening();
    showActionMenu(runPerFitWithCache, manualOverride);
  }
}

/**
 * Click-to-Run Entry Point
 * Runs immediately when injected by background service worker
 */

// Listen for activation messages from background script (Resume State)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "ACTIVATE_PERFIT") {
    console.log("PerFit: Received activation message");
    handleActivation();
    sendResponse({ success: true });
  } else if (message.action === "recalculate_with_override") {
    console.log("PerFit: Received recalculate request with manual override:", message.isManualStretch);
    // Re-run recommendation with manual override
    handleActivation(message.isManualStretch);
    sendResponse({ success: true });
  } else if (message.action === "get_category") {
    console.log("PerFit: Popup requested category");
    // Return cached category and moccasin flag if available
    const cachedCategory = sessionStorage.getItem('perfit-category');
    const isMoccasin = sessionStorage.getItem('perfit-isMoccasin') === 'true';
    sendResponse({ category: cachedCategory, isMoccasin: isMoccasin });
  }
  return true; // Keep message channel open for async response
});

// Click-outside-to-close functionality
window.addEventListener('mousedown', (event) => {
  // Ignore if we're currently opening a menu
  if (getIsOpeningMenu()) {
    resetMenuOpening();
    return;
  }

  const actionHost = document.getElementById('perfit-action-host');
  const recommendationHost = document.getElementById('perfit-recommendation-host');

  // Check if click is outside both menus
  const clickedOutsideAction = actionHost && !actionHost.contains(event.target as Node);
  const clickedOutsideRecommendation = recommendationHost && !recommendationHost.contains(event.target as Node);

  if (clickedOutsideAction) {
    removeActionMenu();
  }

  if (clickedOutsideRecommendation) {
    removeRecommendation();
  }
}, true); // Use capture phase to handle before any other handlers

// NUCLEAR GUARD: Tillater produktsider (.html eller /p/) så lenge det ikke er en kategoriside
const path = window.location.pathname.toLowerCase();
const isProduct = (path.includes(".html") || path.includes("/p/")) && !path.includes("-home");

if (!isProduct) {
  console.log("PerFit: Not a product page, stopping.");
} else {
  // Early category detection for popup (non-blocking, no size chart opening)
  const earlyCategory = detectCategoryFromPage();
  if (earlyCategory) {
    sessionStorage.setItem('perfit-category', earlyCategory);
    console.log("PerFit: Early detection - Category:", earlyCategory);
  }
  
  // Initial activation on fresh injection
  handleActivation();
}
