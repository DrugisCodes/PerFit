import "../global.css";
import "./popup-style.css";
import { useState, useEffect } from "react";

interface ProfileData {
  chest: string;
  waist: string;
  hip: string;
  armLength: string;
  inseam: string;
  torsoLength: string;
  shoeSize: string;
}

/**
 * Detect category from URL - makes popup self-sufficient
 * No dependency on content script for category detection
 */
function detectCategoryFromUrl(url: string): string | null {
  const urlLower = url.toLowerCase();
  
  // Comprehensive shoe detection patterns for Zalando URLs
  const shoePatterns = [
    // Path patterns
    '/sko/', '/shoes/', '/footwear/',
    '/sneaker', '/boots', '/sandal', '/loafer', '/slipper',
    '/sko.', '/shoes.', // e.g., /sko.html
    // URL segment patterns (hyphenated)
    '-sko-', '-shoes-', '-sneaker', '-boot', '-sandal', '-loafer', '-slipper',
    // Product name patterns (common in Zalando URLs)
    'sneakers', 'joggesko', 'løpesko', 'treningssko',
    'boots', 'støvler', 'støvletter', 'chelsea',
    'sandaler', 'slippers', 'loafers', 'mokasiner',
    'sko.html', // Direct product ending
    // Category indicators
    '/herresko', '/damesko', '/barnesko',
    '-herresko', '-damesko', '-barnesko'
  ];
  
  for (const pattern of shoePatterns) {
    if (urlLower.includes(pattern)) {
      console.log("Popup: Kategori satt manuelt via URL - matchet pattern:", pattern);
      return 'shoes';
    }
  }
  
  return null;
}

export const Popup = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isZalandoPage, setIsZalandoPage] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [isManualStretch, setIsManualStretch] = useState(false);

  useEffect(() => {
    // Check if we're on a Zalando product page and detect category from URL
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab && currentTab.url) {
          const url = currentTab.url;
          const urlLower = url.toLowerCase();
          try {
            const urlObj = new URL(urlLower);
            const pathname = urlObj.pathname;
            const isZalando = urlLower.includes("zalando") && pathname.includes(".html") && !pathname.includes("-home");
            setIsZalandoPage(isZalando);

            if (isZalando) {
              // PRIMARY: Detect category from URL immediately (self-sufficient, no content script needed)
              const urlCategory = detectCategoryFromUrl(url);
              if (urlCategory) {
                setCategory(urlCategory);
                console.log("Popup: Kategori satt manuelt via URL:", urlCategory);
              }
              
              // Also check URL for moccasin/loafer keywords to pre-check the checkbox
              const moccasinKeywordsInUrl = ['loafer', 'mokkasin', 'moccasin', 'driving-shoe'];
              for (const keyword of moccasinKeywordsInUrl) {
                if (urlLower.includes(keyword)) {
                  setIsManualStretch(true);
                  console.log("Popup: Loafer/mokkasin funnet i URL, pre-sjekker checkbox");
                  break;
                }
              }
              
              // SECONDARY: Try content script as backup (also gets isMoccasin flag)
              if (currentTab.id) {
                try {
                  chrome.tabs.sendMessage(
                    currentTab.id,
                    { action: "get_category" },
                    (response) => {
                      // Graceful error handling - URL detection is primary
                      if (chrome.runtime.lastError) {
                        console.log("Popup: Content script ikke tilgjengelig, bruker URL-deteksjon");
                        return;
                      }
                      if (response) {
                        if (response.category) {
                          setCategory(response.category);
                          console.log("Popup: Kategori bekreftet av content script:", response.category);
                        }
                        // Pre-check the checkbox if content script detected moccasin/loafer
                        if (response.isMoccasin) {
                          setIsManualStretch(true);
                          console.log("Popup: Mokkasinsøm funnet av content script, pre-sjekker checkbox");
                        }
                      }
                    }
                  );
                } catch {
                  console.log("Popup: Feil ved kontakt med content script, bruker URL-deteksjon");
                }
              }
            }
          } catch {
            setIsZalandoPage(false);
          }
        }
      });
    }

    // Load user profile AND check for moccasin flag in storage
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        chrome.storage.local.get(["userProfile", "perfit_isMoccasin"], (result) => {
          if (chrome.runtime.lastError) {
            console.error("PerFit Popup: Chrome storage error:", chrome.runtime.lastError);
            setIsLoading(false);
            return;
          }
          
          // Check moccasin flag from storage (set by content script detection)
          if (result.perfit_isMoccasin === true) {
            setIsManualStretch(true);
            console.log("PerFit Popup: Mokkasinflagg funnet i storage, pre-sjekker checkbox");
          }
          
          if (result.userProfile && typeof result.userProfile === "object") {
            // Validate that profile has required fields
            const loadedProfile = result.userProfile;
            const hasValidData = loadedProfile.chest || loadedProfile.waist || loadedProfile.hip;
            
            if (hasValidData) {
              setProfile(loadedProfile);
              console.log("PerFit Popup: Profile loaded successfully");
            } else {
              console.log("PerFit Popup: Profile exists but is empty");
            }
          } else {
            console.log("PerFit Popup: No profile found in storage");
          }
          setIsLoading(false);
        });
      } catch (err) {
        console.error("PerFit Popup: Error loading profile:", err);
        setIsLoading(false);
      }
    } else {
      console.warn("PerFit Popup: Chrome API not available (testing locally?)");
      setIsLoading(false);
    }
  }, []);

  const handleOpenOptions = () => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      try {
        // Try opening options page using standard API
        chrome.runtime.openOptionsPage(() => {
          if (chrome.runtime.lastError) {
            console.error("PerFit Popup: Error opening options page:", chrome.runtime.lastError);
            // Fallback: Open options page manually
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
          }
        });
      } catch (err) {
        console.error("PerFit Popup: Exception opening options:", err);
        // Fallback: Try opening directly
        try {
          chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        } catch (fallbackErr) {
          console.error("PerFit Popup: Fallback failed:", fallbackErr);
        }
      }
    }
  };

  const handleRunAnalysis = async () => {
    if (!isZalandoPage) return;
    
    setIsAnalyzing(true);
    try {
      // Send message to background script to run analysis
      await chrome.runtime.sendMessage({ action: "RUN_ANALYSIS" });
      // Close popup after triggering analysis
      window.close();
    } catch (err) {
      console.error("PerFit Popup: Error running analysis:", err);
      setIsAnalyzing(false);
    }
  };

  const handleManualStretchToggle = async (checked: boolean) => {
    setIsManualStretch(checked);
    
    // Send message to content script to recalculate with override
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: "recalculate_with_override",
          isManualStretch: checked
        });
        console.log("PerFit Popup: Sent manual stretch override:", checked);
      }
    } catch (err) {
      console.error("PerFit Popup: Error sending override message:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="w-[300px] h-fit bg-white p-5 m-0 box-border">
        <div className="text-gray-600 text-center font-medium">Loading...</div>
      </div>
    );
  }

  // No profile exists
  if (!profile) {
    return (
      <div className="w-[300px] h-fit bg-white p-5 m-0 box-border">
        <div className="flex flex-col items-center">
          <img 
            src="/logo.png" 
            alt="PerFit Logo" 
            className="w-20 h-auto object-contain mb-5 filter drop-shadow-lg"
          />
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Welcome to PerFit!
          </h2>
          <p className="text-sm text-gray-600 mb-4 text-center leading-relaxed">
            Set up your profile to get personalized fit recommendations.
          </p>
          <button
            onClick={handleOpenOptions}
            className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Set Up Profile
          </button>
        </div>
      </div>
    );
  }

  // Profile exists - show clean view with logo and buttons
  return (
    <div className="w-[300px] h-fit bg-white p-5 m-0 box-border">
      <div className="flex flex-col items-center">
        {/* Logo and Title */}
        <div className="flex items-center justify-center mb-3">
          <img 
            src="/logo.png" 
            alt="PerFit" 
            className="w-14 h-auto object-contain filter drop-shadow-md"
          />
          <h1 className="ml-2 text-xl font-bold text-gray-900">PerFit</h1>
        </div>

        {/* Description Text - Conditional based on page and profile */}
        {!isZalandoPage && (
          <p className="text-sm text-gray-500 mb-4 text-center leading-relaxed">
            Find your perfect fit at supported online stores like Zalando.{!profile && ' Add your measurements to get started.'}
          </p>
        )}

        {/* Measure Size Button (only on Zalando pages) - PerFit Gradient */}
        {isZalandoPage && (
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="w-full py-3 mb-3 text-white font-bold rounded-full transition-all text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isAnalyzing ? '#94a3b8' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              opacity: isAnalyzing ? 0.6 : 1
            }}
            onMouseEnter={(e) => !isAnalyzing && (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => !isAnalyzing && (e.currentTarget.style.opacity = '1')}
          >
            {isAnalyzing ? "Analyzing..." : "Measure size"}
          </button>
        )}

        {/* Manual Stretch Override (only for shoes) */}
        {isZalandoPage && category === 'shoes' && (
          <div className="w-full mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-700 font-medium mb-2">Utvider denne skoen seg?</p>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isManualStretch}
                onChange={(e) => handleManualStretchToggle(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="ml-2 text-xs text-gray-600">Skinn / Loafer (anbefaler tettere passform)</span>
            </label>
          </div>
        )}

        {/* Add/Change Measurements Button */}
        <button
          onClick={handleOpenOptions}
          className="w-full py-2.5 px-4 bg-gray-100 text-blue-700 font-medium rounded hover:bg-gray-200 transition-all text-sm border border-gray-200"
        >
          {profile ? "Change measurements" : "Add measurements"}
        </button>
      </div>
    </div>
  );
};
