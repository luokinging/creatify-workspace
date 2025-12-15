import type { AutoKeyMiniQueryClient } from '@/feature/common/experimental/auto-key-helper';
import type { GeneralMetaAdsAccount, IAdsPlatformService } from '@/feature/services/ad-platform-service.type';
import type { RouteValue } from '@/type/route-constants';
import type { BrandAdmaxSetupResponse } from '../api/admax-setup';
import type { AccountGuardResult, GuidedActionDialog, KnowledgeBaseSectionMeta, QueueAccountState } from '../type';
import { QueuePageTabEnum } from '../type';
import type { AdMaxPersistStateManager } from './ad-max-persist-state-manager';

export type QueueGuardAction =
  | 'request-creatives'
  | 'test-creatives'
  | 'approve-creation'
  | 'analysis-tab'
  | 'stats-budget';

export interface QueueHeaderCtaMeta {
  label: string;
  description?: string;
  href: RouteValue;
  variant: 'primary' | 'secondary';
}

const BIND_ACCOUNT_DIALOG: GuidedActionDialog = {
  id: 'bind-account',
  title: '🚀 Unlock AI-Powered Performance Analysis',
  description:
    'Connect your Meta account to unlock real-time campaign insights, automated recommendations, and data-driven optimizations that boost your ROAS.',
  ctaLabel: 'Connect Meta Account',
  ctaHref: '/settings/organization/ad-accounts',
  trackingContext: {
    surface: 'admax-queue',
    action: 'bind-account',
  },
};

const COMPLETE_SETUP_DIALOG: GuidedActionDialog = {
  id: 'complete-setup',
  title: '🚀 Unlock Full AdMax Potential',
  description:
    'Complete setup to activate AI-powered creative generation, automated performance analysis, and intelligent campaign recommendations.',
  ctaLabel: 'Complete Setup',
  ctaHref: '/tool/ad-max/setup',
  trackingContext: {
    surface: 'admax-queue',
    action: 'complete-setup',
  },
};

type GuardBlockReason = Exclude<AccountGuardResult['reason'], 'ok'>;

const DEFAULT_DISABLED_TOOLTIPS: Record<GuardBlockReason, string> = {
  'no-account': 'Connect a Meta account to unlock this action.',
  'setup-incomplete': 'Complete AdMax Setup to continue.',
};

const ACTION_DISABLED_TOOLTIPS: Partial<Record<QueueGuardAction, Partial<Record<GuardBlockReason, string>>>> = {
  'request-creatives': {
    'no-account': 'Connect Meta before requesting new creatives.',
    'setup-incomplete': 'Finish AdMax Setup to request creatives.',
  },
  'test-creatives': {
    'no-account': 'Bind a Meta account to test your own creatives.',
    'setup-incomplete': 'Complete AdMax Setup to run creative tests.',
  },
  'approve-creation': {
    'no-account': 'Connect a Meta account to publish creatives.',
    'setup-incomplete': 'Complete AdMax Setup to publish creatives.',
  },
  'analysis-tab': {
    'no-account': 'Connect a Meta account to unlock performance analysis and recommendations.',
    'setup-incomplete': 'Complete AdMax Setup to unlock Analysis.',
  },
  'stats-budget': {
    'no-account': 'Connect Meta to view live stats and testing budget.',
    'setup-incomplete': 'Complete Setup to unlock stats and testing budget.',
  },
};

export class QueueAccountGuard {
  constructor(
    private readonly adsPlatformService: IAdsPlatformService,
    private readonly persistStateManager: AdMaxPersistStateManager,
    private readonly brandAdmaxSetupQueryClient: AutoKeyMiniQueryClient<BrandAdmaxSetupResponse>
  ) {}

  getAccountState(): QueueAccountState {
    const selectedAccountId = this.persistStateManager.state.selectedAccountId ?? null;
    const brandAdmaxSetup = this.brandAdmaxSetupQueryClient.store.getState().data;

    // Brand mode: no account selected (brand_id is in request header)
    if (!selectedAccountId) {
      if (!brandAdmaxSetup) {
        // Still loading brand setup or no brand setup yet
        return {
          status: 'no-account',
          activeAccountId: null,
          hasSetupSummary: false,
          hasTemplateConfig: false,
        };
      }

      const hasSetupSummary = Boolean(brandAdmaxSetup.budget_settings);
      const hasTemplateConfig = Boolean(brandAdmaxSetup.launch_config);
      const status =
        hasSetupSummary && hasTemplateConfig && brandAdmaxSetup.is_setup_complete
          ? 'account-ready'
          : 'account-unconfigured';

      return {
        status,
        activeAccountId: null,
        hasSetupSummary,
        hasTemplateConfig,
      };
    }

    // Account mode: has selected account
    const selectedAccount = this.getSelectedMetaAccount(selectedAccountId);

    if (!selectedAccount) {
      return {
        status: 'no-account',
        activeAccountId: null,
        hasSetupSummary: false,
        hasTemplateConfig: false,
      };
    }

    const hasSetupSummary = Boolean(selectedAccount.budget_settings);
    const hasTemplateConfig = Boolean(selectedAccount.launch_config);
    const status = hasSetupSummary && hasTemplateConfig ? 'account-ready' : 'account-unconfigured';

    return {
      status,
      activeAccountId: selectedAccountId,
      hasSetupSummary,
      hasTemplateConfig,
    };
  }

  getHeaderCtaMeta(): QueueHeaderCtaMeta | null {
    const accountState = this.getAccountState();

    if (accountState.status === 'no-account') {
      return {
        label: 'Connect Meta',
        description: 'Bind a Meta account to unlock AdMax automations.',
        href: '/settings/organization/ad-accounts',
        variant: 'primary',
      };
    }

    if (accountState.status === 'account-unconfigured') {
      return {
        label: 'Setup with Meta',
        description: 'Finish AdMax Setup to enable Queue actions.',
        href: '/tool/ad-max/setup',
        variant: 'primary',
      };
    }

    return null;
  }

  getActionGuardResult(action: QueueGuardAction): AccountGuardResult {
    const accountState = this.getAccountState();

    if (accountState.status === 'no-account') {
      const reason: GuardBlockReason = 'no-account';
      return {
        canProceed: false,
        reason,
        dialog: BIND_ACCOUNT_DIALOG,
        disabledTooltip: this.getDisabledTooltip(action, reason),
      };
    }

    if (accountState.status === 'account-unconfigured') {
      const reason: GuardBlockReason = 'setup-incomplete';
      return {
        canProceed: false,
        reason,
        dialog: COMPLETE_SETUP_DIALOG,
        disabledTooltip: this.getDisabledTooltip(action, reason),
      };
    }

    return {
      canProceed: true,
      reason: 'ok',
    };
  }

  isTabEnabled(tab: QueuePageTabEnum): boolean {
    if (tab === QueuePageTabEnum.Analysis) {
      return this.getAccountState().status === 'account-ready';
    }
    return true;
  }

  shouldFetchAccountStats(): boolean {
    return this.getAccountState().status === 'account-ready';
  }

  shouldFetchTestingBudget(): boolean {
    return this.shouldFetchAccountStats();
  }

  canDisplayKnowledgeBaseSection(meta: KnowledgeBaseSectionMeta): boolean {
    if (!meta.requiresAccount) {
      return true;
    }
    return this.getAccountState().status === 'account-ready';
  }

  private getDisabledTooltip(action: QueueGuardAction, reason: GuardBlockReason): string {
    return ACTION_DISABLED_TOOLTIPS[action]?.[reason] ?? DEFAULT_DISABLED_TOOLTIPS[reason];
  }

  private getSelectedMetaAccount(selectedAccountId: string | null): GeneralMetaAdsAccount | undefined {
    if (!selectedAccountId) {
      return undefined;
    }
    return this.adsPlatformService.state.metaAdsAccount?.list.find(
      (account) => account.__account_id === selectedAccountId
    );
  }
}
