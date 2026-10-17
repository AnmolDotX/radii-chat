import { FeatureName, EntitlementState, EntitlementTier } from './types';

class EntitlementManager {
  private state: EntitlementState = {
    tier: 'free',
    expiresAt: null,
    freeLinkMessagesRemaining: 10,
    freeCloudDropRemaining: 1,
    deliveredViaLinkCount: 0,
    isTrialActive: false,
    trialDaysLeft: 7,
  };

  private listeners: Set<(state: EntitlementState) => void> = new Set();

  public getState(): EntitlementState {
    return { ...this.state };
  }

  /**
   * Evaluates feature access. Never check plan === 'plus' directly.
   */
  public can(feature: FeatureName): boolean {
    if (this.state.tier === 'plus_active' || this.state.tier === 'plus_trial') {
      return true;
    }

    if (feature === 'orbitor_link' && this.state.freeLinkMessagesRemaining > 0) {
      return true;
    }

    if (feature === 'cloud_drop_2gb' && this.state.freeCloudDropRemaining > 0) {
      return true;
    }

    return false;
  }

  public useLinkMessageQuota(): boolean {
    if (this.state.tier === 'plus_active' || this.state.tier === 'plus_trial') {
      this.state.deliveredViaLinkCount += 1;
      this.notify();
      return true;
    }

    if (this.state.freeLinkMessagesRemaining > 0) {
      this.state.freeLinkMessagesRemaining -= 1;
      this.state.deliveredViaLinkCount += 1;
      this.notify();
      return true;
    }

    return false;
  }

  public startFreeTrial(): void {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    this.state = {
      ...this.state,
      tier: 'plus_trial',
      isTrialActive: true,
      trialDaysLeft: 7,
      expiresAt: Date.now() + sevenDaysMs,
    };
    this.notify();
  }

  public activateSubscription(tier: EntitlementTier = 'plus_active'): void {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    this.state = {
      ...this.state,
      tier,
      isTrialActive: false,
      trialDaysLeft: 0,
      expiresAt: Date.now() + thirtyDaysMs,
    };
    this.notify();
  }

  public subscribe(listener: (state: EntitlementState) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = { ...this.state };
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const entitlements = new EntitlementManager();
