import "../global.css";
import "./options-style.css";
import { useState, useEffect } from "react";

// Import types and constants
import type { UnitSystem, ProfileData, WizardData, MeasurementField } from "./types";
import { getMeasurementSteps } from "./constants";

// Import components
import { SummaryView } from "./components/SummaryView";
import { WizardStep } from "./components/WizardStep";
import { ReviewStep } from "./components/ReviewStep";

const Options = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [unit, setUnit] = useState<UnitSystem>("metric");
  const [profile, setProfile] = useState<ProfileData>({
    chest: "",
    waist: "",
    hip: "",
    armLength: "",
    inseam: "",
    torsoLength: "",
    shoeSize: "",
    fitPreference: 5,
  });
  const [savedData, setSavedData] = useState<WizardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [editingField, setEditingField] = useState<MeasurementField | null>(null);

  const unitLabel = unit === "metric" ? "cm" : "in";
  const shoeSizeLabel = unit === "metric" ? "EU" : "US";
  const measurementSteps = getMeasurementSteps(unit, shoeSizeLabel);
  const totalSteps = measurementSteps.length + 3; // +3 for unit selection, fit preference, and summary

  // Load saved data on mount with validation
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        chrome.storage.local.get(["wizardData"], (result) => {
          if (chrome.runtime.lastError) {
            console.error("PerFit Options: Chrome storage error:", chrome.runtime.lastError);
            setIsLoading(false);
            return;
          }
          
          if (result.wizardData && typeof result.wizardData === "object") {
            // Validate and set unit
            const validUnit = result.wizardData.unit === "metric" || result.wizardData.unit === "imperial" 
              ? result.wizardData.unit 
              : "metric";
            
            // Validate and set profile with safe defaults
            const loadedProfile = result.wizardData.profile || {};
            const safeProfile: ProfileData = {
              chest: String(loadedProfile.chest || ""),
              waist: String(loadedProfile.waist || ""),
              hip: String(loadedProfile.hip || ""),
              armLength: String(loadedProfile.armLength || ""),
              inseam: String(loadedProfile.inseam || ""),
              torsoLength: String(loadedProfile.torsoLength || ""),
              shoeSize: String(loadedProfile.shoeSize || ""),
              fitPreference: typeof loadedProfile.fitPreference === "number" && loadedProfile.fitPreference >= 1 && loadedProfile.fitPreference <= 10
                ? loadedProfile.fitPreference
                : 5
            };
            
            setSavedData({ unit: validUnit, profile: safeProfile });
            setUnit(validUnit);
            setProfile(safeProfile);
            
            // Auto-jump to summary step if profile exists
            setCurrentStep(totalSteps - 1);
            setIsSaved(true);
            
            console.log("PerFit Options: Loaded profile successfully, jumping to summary", safeProfile);
          } else {
            console.log("PerFit Options: No saved data found, starting fresh");
          }
          setIsLoading(false);
        });
      } catch (error) {
        console.error("PerFit Options: Error loading data:", error);
        setIsLoading(false);
      }
    } else {
      console.warn("PerFit Options: Chrome API not available (are you testing locally?)");
      setIsLoading(false);
    }
  }, []);

  const handleUnitSelect = (selectedUnit: UnitSystem) => {
    setUnit(selectedUnit);
    handleNext();
  };

  const handleInputChange = (field: MeasurementField, value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, "");
    setProfile((prev) => ({
      ...prev,
      [field]: numericValue,
    }));
  };

  const handleNext = () => {
    const nextStep = Math.min(currentStep + 1, totalSteps - 1);
    console.log(`PerFit Options: Moving from step ${currentStep} to ${nextStep}`, {
      isMeasurementStep: nextStep > 0 && nextStep <= measurementSteps.length,
      isFitPreferenceStep: nextStep === totalSteps - 2,
      isSummaryStep: nextStep === totalSteps - 1
    });
    setCurrentStep(nextStep);
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSaveProfile = () => {
    const wizardData: WizardData = { unit, profile };
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        chrome.storage.local.set({ 
          wizardData,
          userProfile: profile // Keep backward compatibility
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("PerFit Options: Failed to save profile:", chrome.runtime.lastError);
            alert("Failed to save profile. Please try again.");
            return;
          }
          console.log("PerFit Options: Profile saved successfully", wizardData);
          setSavedData(wizardData);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3000);
        });
      } catch (error) {
        console.error("PerFit Options: Error saving profile:", error);
        alert("An error occurred while saving. Please try again.");
      }
    } else {
      console.warn("PerFit Options: Chrome API not available, saving to local state only");
      console.log("Profile data:", wizardData);
      setSavedData(wizardData);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleImmediateSave = (field: MeasurementField) => {
    const wizardData: WizardData = { unit, profile };
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        chrome.storage.local.set({ 
          wizardData,
          userProfile: profile
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("PerFit Options: Failed to save field:", chrome.runtime.lastError);
            return;
          }
          console.log(`PerFit Options: ${field} saved immediately`);
          setSavedData(wizardData);
          setEditingField(null);
        });
      } catch (error) {
        console.error("PerFit Options: Error saving field:", error);
      }
    } else {
      console.log(`PerFit Options: ${field} updated (local only)`);
      setSavedData(wizardData);
      setEditingField(null);
    }
  };

  const handleEditProfile = () => {
    setCurrentStep(0);
    setIsSaved(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  // Summary View (after completing wizard)
  if (savedData && currentStep === totalSteps - 1 && isSaved) {
    return (
      <SummaryView
        profile={profile}
        unit={unit}
        unitLabel={unitLabel}
        shoeSizeLabel={shoeSizeLabel}
        measurementSteps={measurementSteps}
        editingField={editingField}
        setEditingField={setEditingField}
        onInputChange={handleInputChange}
        onImmediateSave={handleImmediateSave}
        onEditProfile={handleEditProfile}
        savedData={savedData}
        setProfile={setProfile}
        setSavedData={setSavedData}
      />
    );
  }

  // Review Step (final step before saving)
  if (currentStep === totalSteps - 1 && !isSaved) {
    return (
      <ReviewStep
        currentStep={currentStep}
        totalSteps={totalSteps}
        profile={profile}
        unit={unit}
        unitLabel={unitLabel}
        shoeSizeLabel={shoeSizeLabel}
        measurementSteps={measurementSteps}
        editingField={editingField}
        setEditingField={setEditingField}
        onInputChange={handleInputChange}
        onImmediateSave={handleImmediateSave}
        onBack={handleEditProfile}
        onSave={handleSaveProfile}
        setProfile={setProfile}
        setSavedData={setSavedData}
      />
    );
  }

  // Wizard Steps (unit selection + measurements + fit preference)
  return (
    <WizardStep
      currentStep={currentStep}
      totalSteps={totalSteps}
      unit={unit}
      profile={profile}
      measurementSteps={measurementSteps}
      onInputChange={handleInputChange}
      onNext={handleNext}
      onBack={handleBack}
      onUnitChange={handleUnitSelect}
    />
  );
};

export default Options;
