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

export const Popup = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isZalandoPage, setIsZalandoPage] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    // Check if we're on a Zalando product page
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab && currentTab.url) {
          const url = currentTab.url.toLowerCase();
          try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const isZalando = url.includes("zalando") && pathname.includes(".html") && !pathname.includes("-home");
            setIsZalandoPage(isZalando);
          } catch {
            setIsZalandoPage(false);
          }
        }
      });
    }

    // Load user profile
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        chrome.storage.local.get(["userProfile"], (result) => {
          if (chrome.runtime.lastError) {
            console.error("PerFit Popup: Chrome storage error:", chrome.runtime.lastError);
            setIsLoading(false);
            return;
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
