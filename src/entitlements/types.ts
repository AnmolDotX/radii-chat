export type FeatureName =
  | 'orbitor_link'
  | 'encrypted_backup'
  | 'cloud_drop_2gb'
  | 'rooms_50_capacity'
  | 'priority_sos'
  | 'radar_themes';

export type EntitlementTier = 'free' | 'plus_trial' | 'plus_active' | 'plus_expired';

export interface EntitlementState {
  tier: EntitlementTier;
  expiresAt: number | null; // Unix timestamp
  freeLinkMessagesRemaining: number; // 10 per month in free tier
  freeCloudDropRemaining: number; // 1 per month in free tier
  deliveredViaLinkCount: number; // Value metric shown to user
  isTrialActive: boolean;
  trialDaysLeft: number;
}
