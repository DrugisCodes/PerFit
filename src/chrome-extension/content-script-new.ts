/**
 * PerFit Content Script
 * 
 * This script runs on supported e-commerce sites and provides
 * personalized size recommendations based on the user's measurements.
 * 
 * Architecture:
 * - Uses Provider pattern to support multiple stores
 * - Fetches user profile from chrome.storage.local
 * - Calculates size recommendation based on fit preference
 * - Injects UI element with recommendation
 */

import { detectProvider } from '../stores';
import { UserProfile, SizeRecommendation, GarmentCategory } from '../stores/types';
import { calculateRecommendation } from './RecommendationEngine';

/**
 * Inject global CSS styles for PerFit components
 * 
 * Ensures floating button logo remains circular even after re-injection.
 * Applies !important rules to override any conflicting styles.
 */
function injectGlobalStyles(): void {
  // Check if styles already injected
  if (document.getElementById('perfit-global-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'perfit-global-styles';
  style.textContent = `
    /* PerFit floating button - ensure always circular */
    #perfit-floating-btn {
      border-radius: 50% !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
    }

    /* PerFit logo image - ensure always circular with correct size */
    #perfit-floating-btn img {
      width: 92% !important;
      height: 92% !important;
      border-radius: 50% !important;
      object-fit: cover !important;
    }
  `;

  document.head.appendChild(style);
  console.log('PerFit: Global styles injected');
}

/**
 * Inject recommendation UI on the page
 * 
 * Creates a fixed-position box in the bottom-right corner
 * showing the recommended size.
 * 
 * @param recommendation - Size recommendation to display
 */
function showRecommendation(recommendation: SizeRecommendation): void {
  // Remove existing recommendation if present
  const existingBox = document.getElementById('perfit-recommendation');
  if (existingBox) {
    existingBox.remove();
  }

  // Create recommendation box
  const box = document.createElement('div');
  box.id = 'perfit-recommendation';
  box.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px 24px;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;

  // Create close button
  const closeButton = document.createElement('span');
  closeButton.id = 'perfit-close';
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 12px;
    font-size: 28px;
    font-weight: bold;
    color: white;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s ease;
    line-height: 1;
    user-select: none;
  `;
  
  // Close button hover effect
  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.opacity = '1';
  });
  
  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.opacity = '0.7';
  });
  
  // Close button click handler
  closeButton.addEventListener('click', () => {
    box.style.transition = 'opacity 0.3s ease-out';
    box.style.opacity = '0';
    setTimeout(() => box.remove(), 300);
  });

  // Add slide-in animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  // Category emoji
  const categoryEmoji: Record<GarmentCategory, string> = {
    'top': '👕',
    'bottom': '👖',
    'shoes': '👟',
    'unknown': '👔'
  };

  // Build message based on category
  let measurementText = '';
  let tableInfo = '';
  
  if (recommendation.category === 'top') {
    measurementText = `Your chest: ${recommendation.userChest}cm (exact match, no buffer)`;
    tableInfo = recommendation.matchedRow 
      ? `Table: ${recommendation.matchedRow.chest}cm chest` 
      : '';
  } else if (recommendation.category === 'bottom') {
    measurementText = `Your waist & hip (exact match, no buffer)`;
    tableInfo = recommendation.matchedRow 
      ? `Table: ${recommendation.matchedRow.waist}cm waist / ${recommendation.matchedRow.hip}cm hip` 
      : '';
  } else if (recommendation.category === 'shoes') {
    measurementText = `Your shoe size: ${recommendation.userChest}`;
    tableInfo = '';
  } else {
    measurementText = `Your measurement: ${recommendation.userChest}cm`;
    tableInfo = recommendation.matchedRow 
      ? `Table: ${recommendation.matchedRow.chest}cm chest / ${recommendation.matchedRow.waist}cm waist` 
      : '';
  }

  box.innerHTML = `
    <div style="text-align: center; padding: 10px 0;">
      <div style="font-size: 48px; font-weight: bold; line-height: 1; margin-bottom: 8px; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">
        ${recommendation.size}
      </div>
      <div style="font-size: 16px; font-weight: bold; letter-spacing: 1.5px; margin-bottom: 16px; opacity: 0.95;">
         PerFit Match
      </div>
      <div style="font-size: 13px; opacity: 0.9; line-height: 1.5; margin-top: 12px;">
        ${categoryEmoji[recommendation.category]} ${measurementText}
      </div>
      ${tableInfo ? `
        <div style="font-size: 11px; opacity: 0.75; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); font-family: monospace;">
          ${tableInfo}
        </div>
      ` : ''}
    </div>
  `;

  // Append close button to the box
  box.appendChild(closeButton);

  document.body.appendChild(box);

  // Auto-hide after 15 seconds
  setTimeout(() => {
    box.style.transition = 'opacity 0.5s ease-out';
    box.style.opacity = '0';
    setTimeout(() => box.remove(), 500);
  }, 15000);

  // Restore floating button after showing recommendation
  injectFloatingButton();
}

/**
 * Main execution function for running PerFit size recommendation
 * 
 * Flow:
 * 1. Detect store provider
 * 2. Fetch user profile from storage
 * 3. Open size guide
 * 4. Scrape size data
 * 5. Calculate recommendation
 * 6. Highlight recommended row
 * 7. Display recommendation popup
 * 
 * @param triggeredByButton - Whether this was triggered by the floating button (affects UI feedback)
 */
async function runPerFit(triggeredByButton: boolean = false): Promise<void> {
  try {
    console.log("PerFit: Content script initialized");

    // Step 1: Detect store provider
    const provider = detectProvider();
    if (!provider) {
      console.log("PerFit: This page is not supported. Provider detection failed.");
      return;
    }

    console.log(`PerFit: Active provider: ${provider.name}`);

    // Step 2: Fetch user profile
    if (typeof chrome === "undefined" || !chrome.storage) {
      console.error("PerFit: Chrome API not available");
      return;
    }

    const result = await chrome.storage.local.get(["userProfile"]);
    
    if (chrome.runtime.lastError) {
      console.error("PerFit: Storage error:", chrome.runtime.lastError);
      return;
    }

    const userProfile: UserProfile = result.userProfile;

    if (!userProfile || typeof userProfile !== "object") {
      console.log("PerFit: No user profile found. Please set up your measurements in the extension options.");
      return;
    }

    if (!userProfile.chest || isNaN(parseInt(userProfile.chest))) {
      console.error("PerFit: Invalid chest measurement in profile");
      return;
    }

    console.log("PerFit: User profile loaded successfully");

    // Step 3: Open size guide
    const opened = await provider.openSizeGuide();
    if (!opened) {
      console.error("PerFit: Failed to open size guide");
      return;
    }

    // Step 4: Scrape size data
    const sizeData = provider.scrapeTableData();
    if (sizeData.length === 0) {
      console.error("PerFit: No size data found in table");
      return;
    }

    // Step 4.5: Detect garment category
    const category = provider.getTableCategory();
    console.log(`PerFit: Detected garment category: ${category}`);

    // Step 5: Calculate recommendation
    const recommendation = calculateRecommendation(userProfile, sizeData, category);
    if (!recommendation) {
      console.error("PerFit: Failed to calculate recommendation");
      return;
    }

    // Step 6: Highlight the recommended size in the table
    if (recommendation.matchedRow && recommendation.matchedRow.rowIndex !== undefined) {
      provider.highlightRow(recommendation.matchedRow.rowIndex);
    } else {
      console.warn("PerFit: No matched row or rowIndex found, skipping highlighting");
    }

    // Step 7: Display recommendation popup
    console.log(`PerFit: ✅ Recommendation ready: ${recommendation.size}`);
    showRecommendation(recommendation);

    // If triggered by button, show success feedback
    if (triggeredByButton) {
      updateFloatingButton('success');
    }

  } catch (error) {
    console.error("PerFit: Critical error in main execution:", error);
    
    // Show error feedback if triggered by button
    if (triggeredByButton) {
      updateFloatingButton('error');
    }
  }
}

/**
 * Inject floating PerFit button on the page
 * 
 * Creates a fixed-position circular button on the right side
 * that triggers the PerFit recommendation when clicked.
 */
function injectFloatingButton(): void {
  // Check if button already exists
  if (document.getElementById('perfit-floating-btn')) {
    return;
  }

  // Create button
  const button = document.createElement('button');
  button.id = 'perfit-floating-btn';
  button.setAttribute('aria-label', 'Get PerFit size recommendation');
  
  // Get extension icon URL
  const iconUrl = chrome.runtime.getURL('logo.png');
  
  // Create image element
  const img = document.createElement('img');
  img.src = iconUrl;
  img.alt = 'PerFit';
  
  // Append image to button (styling handled by global CSS)
  button.appendChild(img);
  
  button.style.cssText = `
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(118, 75, 162, 0.4);
    z-index: 999998;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    padding: 0;
  `;

  // Add hover effect
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-50%) scale(1.05)';
    button.style.boxShadow = '0 6px 28px rgba(118, 75, 162, 0.6)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(-50%) scale(1)';
    button.style.boxShadow = '0 4px 20px rgba(118, 75, 162, 0.4)';
  });

  // Add click handler
  button.addEventListener('click', async () => {
    console.log("PerFit: Floating button clicked");
    
    // Show loading state
    button.disabled = true;
    button.innerHTML = `
      <div style="width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
    `;
    
    // Add spinner animation
    if (!document.getElementById('perfit-spinner-style')) {
      const spinnerStyle = document.createElement('style');
      spinnerStyle.id = 'perfit-spinner-style';
      spinnerStyle.textContent = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(spinnerStyle);
    }

    // Run PerFit
    await runPerFit(true);
  });

  // Append to body
  document.body.appendChild(button);
  console.log("PerFit: Floating button injected");
}

/**
 * Update floating button state after recommendation
 * 
 * @param state - 'success' or 'error'
 */
function updateFloatingButton(state: 'success' | 'error'): void {
  const button = document.getElementById('perfit-floating-btn') as HTMLButtonElement;
  if (!button) return;

  if (state === 'success') {
    button.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="white"/>
      </svg>
    `;
    button.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
  } else {
    button.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="white"/>
      </svg>
    `;
    button.style.background = 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)';
  }

  // Reset button after 3 seconds
  setTimeout(() => {
    const iconUrl = chrome.runtime.getURL('logo.png');
    button.disabled = false;
    button.innerHTML = `
      <img src="${iconUrl}" alt="PerFit" style="width: 28px; height: 28px; display: block;" />
    `;
    button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }, 3000);
}

/**
 * Initialize content script
 * 
 * Injects the floating button immediately when the page loads.
 * The button can be clicked at any time to trigger the recommendation.
 */
function initialize(): void {
  try {
    console.log("PerFit: Initializing content script...");
    
    // Inject global styles first
    injectGlobalStyles();
    
    // Detect if we're on a supported page
    const provider = detectProvider();
    if (!provider) {
      console.log("PerFit: This page is not supported. Skipping button injection.");
      return;
    }

    console.log(`PerFit: Detected ${provider.name}. Injecting floating button...`);
    
    // Inject the floating button immediately
    injectFloatingButton();
    
  } catch (error) {
    console.error("PerFit: Failed to initialize:", error);
  }
}

/**
 * Wait for DOM to be ready, then initialize
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
