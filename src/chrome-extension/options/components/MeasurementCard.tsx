import { ProfileData, MeasurementStep, MeasurementField, UnitSystem } from '../types';

interface MeasurementCardProps {
  step: MeasurementStep;
  profile: ProfileData;
  unit: UnitSystem;
  unitLabel: string;
  shoeSizeLabel: string;
  editingField: MeasurementField | null;
  setEditingField: (field: MeasurementField | null) => void;
  onInputChange: (field: MeasurementField, value: string) => void;
  onImmediateSave: (field: MeasurementField) => void;
}

export const MeasurementCard = ({
  step,
  profile,
  unitLabel,
  shoeSizeLabel,
  editingField,
  setEditingField,
  onInputChange,
  onImmediateSave,
}: MeasurementCardProps) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-all relative group cursor-pointer">
      <div className="flex items-center mb-2">
        <span className="text-2xl mr-3">{step.icon}</span>
        <div className="text-sm font-medium text-gray-500">
          {step.title}
        </div>
        {editingField !== step.field && (
          <button
            onClick={() => setEditingField(step.field)}
            className="ml-auto p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>
      {editingField === step.field ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={profile[step.field]}
            onChange={(e) => onInputChange(step.field, e.target.value)}
            onBlur={() => onImmediateSave(step.field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onImmediateSave(step.field);
              if (e.key === 'Escape') setEditingField(null);
            }}
            autoFocus
            className="text-2xl font-semibold text-gray-900 border-2 border-blue-500 rounded px-2 py-1 flex-1"
            placeholder={step.placeholder}
          />
          <button
            onClick={() => onImmediateSave(step.field)}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
            title="Save"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="text-2xl font-semibold text-gray-900">
          {profile[step.field] || "—"}{" "}
          {profile[step.field] && (
            step.field === "shoeSize" ? shoeSizeLabel : unitLabel
          )}
        </div>
      )}
    </div>
  );
};
