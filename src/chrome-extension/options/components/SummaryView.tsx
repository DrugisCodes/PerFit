import { ProfileData, MeasurementStep, MeasurementField, WizardData, UnitSystem } from '../types';
import { MeasurementCard } from './MeasurementCard';

interface SummaryViewProps {
  profile: ProfileData;
  unit: UnitSystem;
  unitLabel: string;
  shoeSizeLabel: string;
  measurementSteps: MeasurementStep[];
  editingField: MeasurementField | null;
  setEditingField: (field: MeasurementField | null) => void;
  onInputChange: (field: MeasurementField, value: string) => void;
  onImmediateSave: (field: MeasurementField) => void;
  onEditProfile: () => void;
  savedData: WizardData | null;
  setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
  setSavedData: React.Dispatch<React.SetStateAction<WizardData | null>>;
}

export const SummaryView = ({
  profile,
  unit,
  unitLabel,
  shoeSizeLabel,
  measurementSteps,
  editingField,
  setEditingField,
  onInputChange,
  onImmediateSave,
  onEditProfile,
  savedData,
  setProfile,
  setSavedData,
}: SummaryViewProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Profile Complete!
            </h1>
            <p className="text-gray-600">
              Your measurements have been saved successfully
            </p>
          </div>

          {/* Profile Summary */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Your Measurements
              </h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                {savedData?.unit === "metric" ? "Metric (cm)" : "Imperial (in)"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {measurementSteps.map((step) => (
                <MeasurementCard
                  key={step.field}
                  step={step}
                  profile={profile}
                  unit={unit}
                  unitLabel={unitLabel}
                  shoeSizeLabel={shoeSizeLabel}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  onInputChange={onInputChange}
                  onImmediateSave={onImmediateSave}
                />
              ))}
              
              {/* Fit Preference Display - Editable */}
              <div className="bg-blue-50 rounded-lg p-4 md:col-span-2 border-2 border-blue-200">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-3">👔</span>
                  <div className="text-sm font-medium text-gray-500">
                    Fit Preference
                  </div>
                </div>
                <div className="text-2xl font-semibold text-gray-900 mb-3">
                  {(() => {
                    const val = profile.fitPreference;
                    if (val <= 2) return "Tight / Skinny";
                    if (val <= 4) return "Fitted";
                    if (val <= 6) return "Regular Fit";
                    if (val <= 8) return "Loose / Relaxed";
                    return "Oversized / Baggy";
                  })()} ({profile.fitPreference}/10)
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={profile.fitPreference}
                  onChange={(e) => {
                    setProfile(prev => ({ ...prev, fitPreference: parseInt(e.target.value) }));
                    // Auto-save on change
                    const wizardData: WizardData = { unit, profile: { ...profile, fitPreference: parseInt(e.target.value) } };
                    if (typeof chrome !== "undefined" && chrome.storage) {
                      chrome.storage.local.set({ wizardData, userProfile: wizardData.profile }, () => {
                        setSavedData(wizardData);
                      });
                    }
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">
                  <span>Tight</span>
                  <span>Regular</span>
                  <span>Baggy</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={onEditProfile}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            >
              Edit Measurements
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
