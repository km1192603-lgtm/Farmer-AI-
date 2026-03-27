export type SupportedLanguage = "ta" | "en" | "te" | "ml" | "kn";

export interface FarmerProfile {
  farmerId: string;
  district: string;
  landSizeAcres: number;
  waterAvailability: "low" | "medium" | "high";
  preferredLanguage: SupportedLanguage;
}
