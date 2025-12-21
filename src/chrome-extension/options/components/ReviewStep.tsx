import { ProfileData, MeasurementStep, MeasurementField, WizardData, UnitSystem } from '../types';
import { MeasurementCard } from './MeasurementCard';

interface ReviewStepProps {
  currentStep: number;
  totalSteps: number;
  profile: ProfileData;
  unit: UnitSystem;
  unitLabel: string;
  shoeSizeLabel: string;
  measurementSteps: MeasurementStep[];
  editingField: MeasurementField | null;
  setEditingField: (field: MeasurementField | null) => void;
  onInputChange: (field: MeasurementField, value: string) => void;
  onImmediateSave: (field: MeasurementField) => void;
  onBack: () => void;
  onSave: () => void;
  setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
  setSavedData: React.Dispatch<React.SetStateAction<WizardData | null>>;
}

export const ReviewStep = ({
  currentStep,
  totalSteps,
  profile,
  unit,
  unitLabel,
  shoeSizeLabel,
  measurementSteps,
  editingField,
  setEditingField,
  onInputChange,
  onImmediateSave,
  onBack,
  onSave,
  setProfile,
  setSavedData,
}: ReviewStepProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 transform transition-all duration-300 hover:shadow-3xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {Math.round((currentStep / totalSteps) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="transition-all duration-500">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
              Review Your Measurements
            </h2>
            <p className="text-gray-600 mb-8 text-center">
              Please review your measurements before saving
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
                <div className="flex items-start">
                  <span className="text-3xl mr-4">👔</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-500 mb-2">
                      Fit Preference
                    </div>
                    <div className="text-xl font-semibold text-gray-900 mb-3">
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
                          chrome.storage.local.set({ wizardData }, () => {
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
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all duration-200"
              >
                ← Start Over
              </button>
              <button
                type="button"
                onClick={onSave}
                className="flex-1 px-6 py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Save Changes ✓
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
