import { ProfileData, MeasurementStep, MeasurementField, UnitSystem } from '../types';

interface WizardStepProps {
  currentStep: number;
  totalSteps: number;
  unit: UnitSystem;
  profile: ProfileData;
  measurementSteps: MeasurementStep[];
  onInputChange: (field: MeasurementField, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onUnitChange: (unit: UnitSystem) => void;
}

export const WizardStep = ({
  currentStep,
  totalSteps,
  unit,
  profile,
  measurementSteps,
  onInputChange,
  onNext,
  onBack,
  onUnitChange,
}: WizardStepProps) => {
  // Step 0: Unit selection
  if (currentStep === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 transform transition-all duration-300 hover:shadow-3xl">
          <div className="text-center mb-8">
            <div className="mb-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📏</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome to PerFit
              </h1>
              <p className="text-gray-600">
                Let's set up your profile to find your perfect fit
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">
              Choose Your Measurement System
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => onUnitChange("metric")}
                className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                  unit === "metric"
                    ? "border-blue-500 bg-blue-50 shadow-lg scale-105"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <div className="text-4xl mb-2">🌍</div>
                <div className="text-lg font-semibold text-gray-900">Metric</div>
                <div className="text-sm text-gray-500">Centimeters (cm)</div>
              </button>
              <button
                onClick={() => onUnitChange("imperial")}
                className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                  unit === "imperial"
                    ? "border-blue-500 bg-blue-50 shadow-lg scale-105"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <div className="text-4xl mb-2">🇺🇸</div>
                <div className="text-lg font-semibold text-gray-900">Imperial</div>
                <div className="text-sm text-gray-500">Inches (in)</div>
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onNext}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Steps 1-7: Measurements
  if (currentStep >= 1 && currentStep <= 7) {
    const step = measurementSteps[currentStep - 1];
    const isLastMeasurementStep = currentStep === 7;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 transform transition-all duration-300 hover:shadow-3xl">
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

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Left: Illustration */}
            <div className="flex items-center justify-center">
              <div className="bg-blue-50 rounded-2xl p-8 w-full max-w-sm">
                <img
                  src={step.image}
                  alt={step.title}
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </div>

            {/* Right: Input */}
            <div className="flex flex-col justify-center">
              <div className="mb-6">
                <div className="text-4xl mb-4">{step.emoji}</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  {step.title}
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your {step.title.toLowerCase()}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={profile[step.field]}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, "");
                      onInputChange(step.field, value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && profile[step.field]) {
                        onNext();
                      }
                    }}
                    placeholder={step.placeholder}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    autoFocus
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <span className="text-gray-400 text-sm font-medium">
                      {step.field === "shoeSize" ? "" : unit === "metric" ? "cm" : "in"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t border-gray-200">
            <button
              onClick={onBack}
              className="px-6 py-3 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200"
            >
              Back
            </button>
            <button
              onClick={onNext}
              disabled={!profile[step.field]}
              className={`px-8 py-3 font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transform transition-all duration-200 shadow-lg ${
                profile[step.field]
                  ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 hover:scale-105 active:scale-95 hover:shadow-xl"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isLastMeasurementStep ? "Continue" : "Next"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 8: Fit Preference
  if (currentStep === 8) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 transform transition-all duration-300 hover:shadow-3xl">
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

          <div className="mb-8">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">👔</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                How do you like your clothes to fit?
              </h2>
              <p className="text-gray-600">
                This helps us recommend the perfect size for your style
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 mb-4">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {(() => {
                    const val = profile.fitPreference;
                    if (val <= 2) return "Tight / Skinny";
                    if (val <= 4) return "Fitted";
                    if (val <= 6) return "Regular Fit";
                    if (val <= 8) return "Loose / Relaxed";
                    return "Oversized / Baggy";
                  })()}
                </div>
                <div className="text-gray-500">Level {profile.fitPreference}/10</div>
              </div>

              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={profile.fitPreference}
                onChange={(e) => onInputChange("fitPreference", e.target.value)}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-tighter mt-2">
                <span>Tight</span>
                <span>Regular</span>
                <span>Baggy</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">1-3</div>
                <div className="text-gray-600">Tight/Skinny</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">4-7</div>
                <div className="text-gray-600">Regular</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">8-10</div>
                <div className="text-gray-600">Loose/Baggy</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t border-gray-200">
            <button
              onClick={onBack}
              className="px-6 py-3 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200"
            >
              Back
            </button>
            <button
              onClick={onNext}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            >
              Review & Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
