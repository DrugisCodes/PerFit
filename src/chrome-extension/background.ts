/**
 * PerFit Background Service Worker (Manifest V3)
 * 
 * Dynamic behavior based on page type:
 * - On Zalando: Show SIZE badge, disable popup, click runs analysis
 * - Not on Zalando: No badge, enable popup, click opens menu
 */

/**
 * Check if URL is a valid Zalando product page
 */
function isProductPage(url: string | undefined): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  
  return urlLower.includes("zalando") && 
         urlLower.endsWith(".html") && 
         !urlLower.includes("-home") &&
         !urlLower.includes("/klaer");
}

/**
 * Update badge and popup behavior for a specific tab
 */
async function updateTabBehavior(tabId: number, url: string | undefined): Promise<void> {
  if (isProductPage(url)) {
    // ON ZALANDO: Show badge, disable popup (enables onClick)
    await chrome.action.setBadgeText({ tabId, text: "SIZE" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#7c3aed" }); // Purple to match PerFit brand
    await chrome.action.setPopup({ tabId, popup: "" }); // Disable popup
    console.log(`PerFit: Zalando page detected - popup disabled for tab ${tabId}`);
  } else {
    // NOT ON ZALANDO: Clear badge, enable popup
    await chrome.action.setBadgeText({ tabId, text: "" });
    await chrome.action.setPopup({ tabId, popup: "popup.html" }); // Enable popup
    console.log(`PerFit: Non-Zalando page - popup enabled for tab ${tabId}`);
  }
}

// Listen for tab URL changes (navigation within tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Update when URL changes OR when page finishes loading
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateTabBehavior(tabId, tab.url);
  }
});

// Listen for tab switches (user activates a different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  updateTabBehavior(activeInfo.tabId, tab.url);
});

/**
 * Handle icon clicks - ONLY fires on Zalando pages (where popup is disabled)
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  console.log("PerFit: Icon clicked on Zalando page");

  // Try to communicate with existing content script
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "ACTIVATE_PERFIT" });
    console.log("PerFit: Sent activation signal to existing script");
  } catch (error) {
    // Content script not injected yet, inject it now
    console.log("PerFit: Injecting content script...");
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-script.js"]
    });
  }
});

/**
 * Handle messages from popup (for "Run Analysis" button on non-Zalando pages)
 */
chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
  if (message.action === "RUN_ANALYSIS") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    
    if (!tab.id || !tab.url) {
      sendResponse({ success: false, error: "No active tab" });
      return;
    }

    // Check if it's a valid Zalando product page
    if (!isProductPage(tab.url)) {
      sendResponse({ success: false, error: "Not a Zalando product page" });
      return;
    }

    // Try to communicate with existing content script
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "ACTIVATE_PERFIT" });
      console.log("PerFit: Sent activation signal from popup");
      sendResponse({ success: true });
    } catch (error) {
      // Content script not injected yet, inject it now
      console.log("PerFit: Injecting content script from popup...");
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content-script.js"]
      });
      
      sendResponse({ success: true });
    }
  }
  
  return true; // Keep message channel open for async response
});
