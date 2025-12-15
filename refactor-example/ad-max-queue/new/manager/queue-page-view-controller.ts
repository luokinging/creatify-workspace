import { AlertDialogPreset } from '@/component/ui/modal/preset/alert-dialog';
import { createAutoKeyMiniQueryClient } from '@/feature/common/experimental/auto-key-helper';
import {
  type CombinedStore,
  type ReadonlyStoreApi,
  createCombinedStore,
} from '@/feature/common/experimental/use-combined-store';
import { dialogManager } from '@/feature/component.dialog/manager';
import type { IBrandSpaceService } from '@/feature/services/brand-space-service/brand-space-service.type';
import type { MetaAdAccount } from '@/feature/services/experimental/experimental-ads-platform-service/entity/meta-ad-account';
import type { IPlatformIntegrationService } from '@/feature/services/experimental/experimental-ads-platform-service/platform-integration-service.type';
import type { ITransientDataService } from '@/feature/services/transient-data-service.type';
import { router } from '@/hook/use-router';
import { DisposerManager } from '@/manager/disposer-manager';
import { createStore } from 'zustand';
import { combine } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { getAccountStats, getBrandAdmaxSetup } from '../../api/admax-setup';
import { mockAutomationStatus, mockWeeklyCycle } from '../../page/queue/mock-data';
import type { AutomationStatus, WeeklyCycle } from '../../type';
import { AutomationLevel, CyclePhase, QueuePageTabEnum } from '../../type';
import { AdMaxPersistStateManager, type PersistedAdMaxState } from '../ad-max-persist-state-manager';
import { QueueAccountGuard, type QueueGuardAction } from '../queue-account-guard';
import { QueueAnalysisPipelineManager } from './queue-analysis-pipeline-manager';
import { QueueCreationPipelineManager } from './queue-creation-pipeline-manager';
import { QueueKnowledgeBaseManager } from './queue-knowledge-base-manager';
import { QueueNavigationManager } from './queue-navigation-manager';

const initialState = {
  isReady: false,
  automationStatus: {
    level: AutomationLevel.SUPERVISED,
    currentWeek: 1,
    weeksInCurrentLevel: 1,
    approvalRate: 85,
    confidence: 75,
    canUpgrade: false,
    circuitBreakers: [],
  } as AutomationStatus,
  weeklyCycle: {
    currentWeek: 1,
    cyclePhase: CyclePhase.CREATION,
    creationPipelineActive: true,
    analysisPipelineActive: false,
    nextCycleStart: new Date(),
  } as WeeklyCycle,
};

type QueuePageViewControllerState = typeof initialState;

export class QueuePageViewController {
  private readonly store = createStore(immer(combine(initialState, () => ({}))));
  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;

  private readonly disposerManager = new DisposerManager();
  readonly persistStateManager = new AdMaxPersistStateManager();
  readonly queueAccountGuard: QueueAccountGuard;

  // Sub-managers
  readonly navigationManager: QueueNavigationManager;
  readonly analysisManager: QueueAnalysisPipelineManager;
  readonly creationManager: QueueCreationPipelineManager;
  readonly knowledgeBaseManager: QueueKnowledgeBaseManager;

  // Query clients (kept in VC as they are simple and shared)
  readonly accountStatsQueryClient = createAutoKeyMiniQueryClient(() => ({
    fn: getAccountStats,
    fnParams: [
      {
        account_id: this.selectedAdAccountId || undefined,
        platform: 'meta' as const,
      },
    ] as const,
    enabled: Boolean(this.selectedAdAccountId),
    gcTime: Infinity,
  }));

  readonly brandAdmaxSetupQueryClient = createAutoKeyMiniQueryClient(() => ({
    fn: getBrandAdmaxSetup,
    fnParams: [] as const,
    enabled: !this.selectedAdAccountId,
    gcTime: Infinity,
  }));

  constructor(
    private readonly platformIntegrationService: IPlatformIntegrationService,
    private readonly transientDataService: ITransientDataService,
    private readonly brandSpaceService: IBrandSpaceService
  ) {
    // Initialize QueueAccountGuard
    this.queueAccountGuard = new QueueAccountGuard(
      this.platformIntegrationService,
      this.persistStateManager,
      this.brandAdmaxSetupQueryClient
    );

    // Initialize sub-managers
    this.navigationManager = new QueueNavigationManager(this.queueAccountGuard);

    this.analysisManager = new QueueAnalysisPipelineManager(this.persistStateManager, this.transientDataService);

    this.creationManager = new QueueCreationPipelineManager(
      this.persistStateManager,
      this.platformIntegrationService,
      this.transientDataService,
      (tab) => this.navigationManager.setActiveTab(tab)
    );

    this.knowledgeBaseManager = new QueueKnowledgeBaseManager(this.persistStateManager, this.brandSpaceService);

    // Compose combined store from all managers
    this.combinedStore = createCombinedStore([
      this.platformIntegrationService.metaPlatformManager.brandAccountManager.store,
      this.store,
      this.persistStateManager.store,
      this.navigationManager.combinedStore,
      this.analysisManager.combinedStore,
      this.creationManager.combinedStore,
      this.knowledgeBaseManager.combinedStore,
      this.accountStatsQueryClient.store,
      this.brandAdmaxSetupQueryClient.store,
    ] as const);
  }

  // ============ State Getters ============

  get state() {
    return this.store.getState();
  }

  private setState(updater: (state: QueuePageViewControllerState) => void) {
    this.store.setState(updater);
  }

  get selectedAdAccountId(): string | undefined {
    return this.persistStateManager.state.selectedAccountId ?? undefined;
  }

  get isBrandMode(): boolean {
    return !this.selectedAdAccountId;
  }

  get queueAccountState() {
    return this.queueAccountGuard.getAccountState();
  }

  get accountStatsState() {
    return this.accountStatsQueryClient.store.getState();
  }

  // ============ Computed Properties ============

  get activeTab() {
    return this.navigationManager.activeTab;
  }

  // ============ Account Management ============

  private getMetaAccountsList(): MetaAdAccount[] {
    return this.platformIntegrationService.metaPlatformManager.brandAccountManager.state.accounts;
  }

  private getAvailableMetaAccountList(): MetaAdAccount[] {
    return this.getMetaAccountsList().filter((account) => !account.source.is_hidden);
  }

  setSelectedAdAccountId(accountId: string | null) {
    this.persistStateManager.setSelectedAccountId(accountId);
  }

  getSelectedAdsAccount(): MetaAdAccount | undefined {
    return this.getMetaAccountsList().find((account) => account.source.account_id === this.selectedAdAccountId);
  }

  private getBestAvailableMetaAccountId(): string | undefined {
    const availableAccounts = this.getAvailableMetaAccountList().filter(
      (account) => !!account.source.is_setup_complete
    );

    if (availableAccounts.length === 0) {
      return undefined;
    }

    // Priority 1: synced accounts with campaigns
    const syncedWithCampaignsAccount = availableAccounts.find(
      (account) => account.source.status === 'synced' && (account.source.ads_data_map?.campaign_count ?? 0) > 0
    );
    if (syncedWithCampaignsAccount?.generalAccountId) {
      return syncedWithCampaignsAccount.generalAccountId;
    }

    // Priority 2: other synced accounts
    const syncedAccount = availableAccounts.find((account) => account.source.status === 'synced');
    if (syncedAccount?.generalAccountId) {
      return syncedAccount.generalAccountId;
    }

    // Priority 3: syncing accounts
    const syncingAccount = availableAccounts.find((account) => account.source.status === 'syncing');
    if (syncingAccount?.generalAccountId) {
      return syncingAccount.generalAccountId;
    }

    // Fallback: return first available account
    return availableAccounts[0]?.generalAccountId;
  }

  // ============ Guard Methods ============

  getHeaderCtaMeta() {
    return this.queueAccountGuard.getHeaderCtaMeta();
  }

  getGuardResult(action: QueueGuardAction) {
    return this.queueAccountGuard.getActionGuardResult(action);
  }

  isTabEnabled(tab: QueuePageTabEnum) {
    return this.navigationManager.isTabEnabled(tab);
  }

  async presentGuardDialog(result: ReturnType<typeof this.getGuardResult>) {
    if (!result.dialog) return;
    await dialogManager.show(AlertDialogPreset, {
      title: result.dialog.title,
      description: result.dialog.description,
      confirmText: result.dialog.ctaLabel,
      cancelText: 'Cancel',
    });
    await this.navigateToCta(result.dialog.ctaHref);
  }

  private async navigateToCta(href: string) {
    try {
      router.navigate({ to: href as never });
    } catch {
      window.location.href = href;
    }
  }

  async withGuard(action: QueueGuardAction, runner: () => Promise<void>) {
    const guardResult = this.getGuardResult(action);
    if (!guardResult.canProceed) {
      await this.presentGuardDialog(guardResult);
      return;
    }
    await runner();
  }

  // ============ Tab & Navigation ============

  setActiveTab(tab: QueuePageTabEnum) {
    const success = this.navigationManager.setActiveTab(tab);
    if (!success) {
      const guardResult = this.getGuardResult('analysis-tab');
      this.presentGuardDialog(guardResult);
    }
  }

  // ============ Scroll Handlers ============

  setAnalysisPipelineScrollElement(element: HTMLDivElement) {
    this.analysisManager.setScrollElement(element, () => this.activeTab === QueuePageTabEnum.Analysis);
  }

  setCreationPipelineScrollElement(element: HTMLDivElement) {
    this.creationManager.setScrollElement(element, () => this.activeTab === QueuePageTabEnum.Creation);
  }

  // ============ Pipeline Actions (With Guards) ============

  async approveCreationItem(id: string, selectedJobIds: string[]) {
    await this.withGuard('approve-creation', async () => {
      await this.creationManager.approveItem(id, selectedJobIds);
    });
  }

  async handleBringOwnCreatives() {
    await this.withGuard('test-creatives', async () => {
      await this.creationManager.handleBringOwnCreatives();
    });
  }

  // ============ Setup Cache ============

  clearSetupCache() {
    this.persistStateManager.clearSetupState();
  }

  // ============ Bootstrap & Data Loading ============

  private async bootstrapData() {
    const isBrandMode = this.isBrandMode;
    const isAccountReady = this.queueAccountState.status === 'account-ready';
    const isCreationTabActive = this.activeTab === QueuePageTabEnum.Creation;

    const fetchPromises: Promise<unknown>[] = [];

    // Fetch analysis pipelines
    fetchPromises.push(this.analysisManager.fetch(isBrandMode));

    // Fetch creation pipelines - use the combined method that handles concept generation
    // This ensures: fetch -> if empty && Creation tab -> trigger generation
    fetchPromises.push(
      this.creationManager.fetchAndMaybeGenerateConcepts(isBrandMode, isAccountReady, isCreationTabActive)
    );

    // Fetch brand setup in brand mode
    if (isBrandMode) {
      fetchPromises.push(this.brandAdmaxSetupQueryClient.fetch());
    }

    // Fetch knowledge rules if account selected
    if (this.selectedAdAccountId) {
      fetchPromises.push(this.knowledgeBaseManager.knowledgeRulesQueryClient.fetch());
    }

    // Fetch account stats if account ready
    if (this.queueAccountGuard.shouldFetchAccountStats()) {
      fetchPromises.push(this.accountStatsQueryClient.fetch());
    }

    // Fetch testing budget if applicable
    if (this.queueAccountGuard.shouldFetchTestingBudget()) {
      fetchPromises.push(this.creationManager.fetchTestingBudget());
    } else {
      this.creationManager.clearTestingBudget();
    }

    await Promise.allSettled(fetchPromises);

    this.setState((state) => {
      state.automationStatus = mockAutomationStatus;
      state.weeklyCycle = mockWeeklyCycle;
    });
  }

  private bootstrapAdAccountSync() {
    const update = () => {
      const availableAccounts = this.getAvailableMetaAccountList();
      const currentSelectedId = this.selectedAdAccountId;
      if (
        !currentSelectedId &&
        availableAccounts.length > 0 &&
        !availableAccounts.some((account) => account.generalAccountId === currentSelectedId)
      ) {
        const bestAccountId = this.getBestAvailableMetaAccountId();
        if (bestAccountId) {
          this.setSelectedAdAccountId(bestAccountId);
        }
      }
    };

    update();
    const unsubscribe = this.platformIntegrationService.metaPlatformManager.brandAccountManager.store.subscribe(update);

    this.disposerManager.addDisposeFn(unsubscribe);
  }

  private bootstrapRefreshListener() {
    let prevSelectedAdAccountId: string | null | undefined = this.selectedAdAccountId;

    const disposePersistStoreListener = this.persistStateManager.store.subscribe(async (state: PersistedAdMaxState) => {
      const selectedAdAccountId = state.selectedAccountId ?? null;
      if (selectedAdAccountId !== prevSelectedAdAccountId) {
        // Reset concept generation flag when switching accounts
        this.creationManager.resetConceptGenerationState();

        const isBrandMode = !selectedAdAccountId;

        const fetchPromises: Promise<unknown>[] = [];

        // Fetch pipelines
        fetchPromises.push(this.analysisManager.fetch(isBrandMode));
        fetchPromises.push(this.creationManager.fetch(isBrandMode));

        // Fetch brand setup in brand mode
        if (isBrandMode) {
          fetchPromises.push(this.brandAdmaxSetupQueryClient.fetch());
        }

        // Fetch knowledge rules if account selected
        if (selectedAdAccountId) {
          fetchPromises.push(this.knowledgeBaseManager.knowledgeRulesQueryClient.fetch());
        }

        // Fetch account stats if applicable
        if (this.queueAccountGuard.shouldFetchAccountStats()) {
          fetchPromises.push(this.accountStatsQueryClient.fetch());
        }

        // Fetch testing budget if applicable
        if (this.queueAccountGuard.shouldFetchTestingBudget()) {
          fetchPromises.push(this.creationManager.fetchTestingBudget());
        } else {
          this.creationManager.clearTestingBudget();
        }

        await Promise.allSettled(fetchPromises);

        // Check and handle concept generation after data is loaded
        const isAccountReady = this.queueAccountState.status === 'account-ready';
        if (this.activeTab === QueuePageTabEnum.Creation) {
          await this.creationManager.checkAndHandleConceptGeneration(isAccountReady, isBrandMode);
        }

        prevSelectedAdAccountId = selectedAdAccountId;
      }
    });

    this.disposerManager.addDisposeFn(disposePersistStoreListener);
  }

  private async checkSetupCompleteAndRedirect(): Promise<boolean> {
    const selectedAccountId = this.selectedAdAccountId;
    const availableAccounts = this.getAvailableMetaAccountList();

    // Check 1: If has selected account and it's setup complete, use it
    if (selectedAccountId) {
      const selectedAccount = availableAccounts.find((acc) => acc.generalAccountId === selectedAccountId);
      if (selectedAccount?.source.is_setup_complete) {
        return true;
      }
    }

    // Check 2: Brand mode - check brand setup status
    const brandSetup = this.brandAdmaxSetupQueryClient.store.getState().data;
    if (brandSetup?.is_setup_complete) {
      if (selectedAccountId) {
        this.setSelectedAdAccountId(null);
      }
      return true;
    }

    // Check 3: Find any setup complete account in list
    const setupCompleteAccount = availableAccounts.find(
      (acc) => acc.source.is_setup_complete && acc.source.budget_settings && acc.source.launch_config
    );

    if (setupCompleteAccount?.generalAccountId) {
      this.setSelectedAdAccountId(setupCompleteAccount.generalAccountId);
      return true;
    }

    // No setup complete brand or account found, redirect to setup
    router.navigate({ to: '/tool/ad-max/setup', replace: true });
    return false;
  }

  async bootstrap() {
    // Bootstrap navigation first
    this.navigationManager.bootstrap();

    await this.platformIntegrationService.waitReady();

    // Clear setup-related analysis task ID
    this.persistStateManager.setAnalysisTaskId(null);

    // Fetch brand setup first to check is_setup_complete
    if (!this.selectedAdAccountId) {
      await this.brandAdmaxSetupQueryClient.fetch();
    }

    // Check setup status and redirect if needed
    const canProceed = await this.checkSetupCompleteAndRedirect();
    if (!canProceed) {
      return;
    }

    this.bootstrapAdAccountSync();

    await this.bootstrapData();
    this.bootstrapRefreshListener();

    this.setState((state) => {
      state.isReady = true;
    });
  }

  dispose() {
    this.navigationManager.dispose();
    this.analysisManager.dispose();
    this.creationManager.dispose();
    this.knowledgeBaseManager.dispose();
    this.disposerManager.dispose();
  }
}
