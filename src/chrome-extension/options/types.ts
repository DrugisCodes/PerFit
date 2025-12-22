/**
 * Type definitions for the PerFit Options page
 */

export type UnitSystem = "metric" | "imperial";

export interface ProfileData {
  chest: string;
  waist: string;
  hip: string;
  armLength: string;
  inseam: string;
  torsoLength: string;
  shoeSize: string;
  height: string;
  footLength: string;
  fitPreference: number;
}

export interface WizardData {
  unit: UnitSystem;
  profile: ProfileData;
}

export type MeasurementField = keyof ProfileData;

export interface MeasurementStep {
  field: MeasurementField;
  title: string;
  description: string;
  placeholder: string;
  icon: string;
  emoji: string;
  image: string;
}
