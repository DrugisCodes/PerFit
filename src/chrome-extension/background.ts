/**
 * PerFit Background Service Worker (Manifest V3)
 * 
 * Listens for clicks on the extension icon and injects the content script
 * into valid Zalando product pages only.
 */

// Listen for clicks on the extension icon (Browser Action)
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  const url = tab.url?.toLowerCase() || "";
  const isProduct = url.includes("zalando") && url.endsWith(".html") && !url.includes("-home");
  
  if (isProduct) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-script.js"] });
  } else {
    chrome.action.setBadgeText({ tabId: tab.id, text: "!" }); // Signal that this page is not supported
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2000);
  }
});
