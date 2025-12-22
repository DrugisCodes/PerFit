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

  useEffect(() => {
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
      chrome.runtime.openOptionsPage();
    }
  };

  if (isLoading) {
    return (
      <div className="w-[350px] h-fit bg-white">
        <div className="text-gray-600 text-center font-medium p-6">Loading...</div>
      </div>
    );
  }

  // No profile exists
  if (!profile) {
    return (
      <div className="w-[350px] h-fit bg-white">
        <div className="bg-white rounded-xl shadow-lg p-5 text-center m-3 border border-gray-100">
          <img 
            src="/logo.png" 
            alt="PerFit Logo" 
            className="w-24 h-auto object-contain mx-auto mb-6 filter drop-shadow-lg animate-in fade-in zoom-in duration-700"
          />
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Welcome to PerFit!
          </h2>
          <p className="text-xs text-gray-600 mb-4">
            Set up your profile to get personalized fit recommendations.
          </p>
          <button
            onClick={handleOpenOptions}
            className="w-full py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Set Up Profile
          </button>
        </div>
      </div>
    );
  }

  // Profile exists - show temporary test message
  return (
    <div className="w-[350px] h-fit bg-gray-50 p-3">
      <div className="w-full bg-white rounded-xl shadow-lg p-6 text-center border border-green-100">
        <div className="mx-auto w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-green-700 mb-1">Det fungerer!</h2>
        <p className="text-xs text-gray-600 mb-4">
          Profil-dataene dine ble funnet i nettleseren.
        </p>
        <button
          onClick={handleOpenOptions}
          className="w-full py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all text-xs"
        >
          Trykk for å se endre målene
        </button>
      </div>
    </div>
  );
};
