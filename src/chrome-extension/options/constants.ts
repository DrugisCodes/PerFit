/**
 * Constants for the PerFit Options page
 */

import { MeasurementStep, MeasurementField } from './types';

export const getMeasurementSteps = (unit: "metric" | "imperial", shoeSizeLabel: string): MeasurementStep[] => [
  {
    field: "chest",
    title: "Chest Measurement",
    description: "Measure around the fullest part of your chest, keeping the tape horizontal.",
    placeholder: unit === "metric" ? "e.g., 95" : "e.g., 37",
    icon: "👔",
    emoji: "👔",
    image: "/images/chest.png",
  },
  {
    field: "waist",
    title: "Waist Measurement",
    description: "Measure around your natural waistline, typically just above your belly button.",
    placeholder: unit === "metric" ? "e.g., 85" : "e.g., 33",
    icon: "📏",
    emoji: "📏",
    image: "/images/waist.png",
  },
  {
    field: "hip",
    title: "Hip Measurement",
    description: "Measure around the fullest part of your hips, keeping the tape horizontal.",
    placeholder: unit === "metric" ? "e.g., 100" : "e.g., 39",
    icon: "👖",
    emoji: "👖",
    image: "/images/hip.png",
  },
  {
    field: "armLength",
    title: "Arm Length",
    description: "Measure from the center back of your neck to your wrist with arm slightly bent.",
    placeholder: unit === "metric" ? "e.g., 62" : "e.g., 24",
    icon: "💪",
    emoji: "💪",
    image: "/images/armLengde.png",
  },
  {
    field: "inseam",
    title: "Inseam / Inside Leg",
    description: "Measure from the crotch seam to the bottom of the ankle bone.",
    placeholder: unit === "metric" ? "e.g., 81" : "e.g., 32",
    icon: "🦵",
    emoji: "🦵",
    image: "/images/inseam.png",
  },
  {
    field: "torsoLength",
    title: "Torso Length",
    description: "Measure from the base of your neck down to your waistline.",
    placeholder: unit === "metric" ? "e.g., 65" : "e.g., 26",
    icon: "📐",
    emoji: "📐",
    image: "/images/torso.png",
  },
  {
    field: "height",
    title: "Height (Høyde)",
    description: "Your total height in centimeters. Used for text-based size matching when tables are unavailable.",
    placeholder: unit === "metric" ? "e.g., 175" : "e.g., 69",
    icon: "📏",
    emoji: "📏",
    image: "/images/height.png",
  },
  {
    field: "footLength",
    title: "Foot Length",
    description: "Measure from your heel to your longest toe.",
    placeholder: unit === "metric" ? "e.g., 27.0" : "e.g., 10.6",
    icon: "📏",
    emoji: "📏",
    image: "",
  },
  {
    field: "shoeSize",
    title: "Shoe Size (Optional)",
    description: `Your usual shoe size in ${shoeSizeLabel} sizing.`,
    placeholder: unit === "metric" ? "e.g., 42" : "e.g., 9",
    icon: "👟",
    emoji: "👟",
    image: "",
  },
];

export const measurementImages: Record<MeasurementField, string> = {
  chest: "/images/chest.png",
  waist: "/images/waist.png",
  hip: "/images/hip.png",
  armLength: "/images/armLengde.png",
  inseam: "/images/inseam.png",
  torsoLength: "/images/torso.png",
  height: "/images/height.png",
  shoeSize: "", // No image for shoe size
  footLength: "", // No image for foot length
  fitPreference: "", // No image for fit preference
};
