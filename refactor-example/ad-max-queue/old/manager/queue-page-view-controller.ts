import { tanstackRouter } from '@/.vite/create-router';
import { Toast } from '@/component/toast/util';
import { AlertDialogPreset } from '@/component/ui/modal/preset/alert-dialog';
import { getTaskStatusWithResult } from '@/feature/common/async_task/api';
import { createAutoKeyMiniQueryClient } from '@/feature/common/experimental/auto-key-helper';
import {
  type CombinedStore,
  type ReadonlyStoreApi,
  createCombinedStore,
} from '@/feature/common/experimental/use-combined-store';
import { dialogManager } from '@/feature/component.dialog/manager';
import { DataCategoryEnum } from '@/feature/my-ads/component/data-category-filter';
import { PaginatedQueryManager } from '@/feature/my-ads/manager/common/paginated-query-manager';
import { MetricLevelEnum } from '@/feature/my-ads/manager/constant';
import type { MetricPageFilterMessage } from '@/feature/my-ads/manager/performance-metirc/metric-state-control-manager';
import { type MetricPageFilterManagerState, createAllTimeRange } from '@/feature/my-ads/manager/util';
import type { GeneralMetaAdsAccount, IAdsPlatformService } from '@/feature/services/ad-platform-service.type';
import type { IBrandSpaceService } from '@/feature/services/brand-space-service/brand-space-service.type';
import type { ITransientDataService } from '@/feature/services/transient-data-service.type';
import {
  AdDeliveryActionTypeENum,
  AdDeliveryFromEnum,
  type AdDeliveryMessage,
} from '@/feature/tool.ad-delivery/constant';
import { router } from '@/hook/use-router';
import { DisposerManager } from '@/manager/disposer-manager';
import { ProcessingTaskManager } from '@/manager/processing-task-manager';
import lodash from 'lodash';
import { createStore } from 'zustand';
import { combine } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { generateConcept, getAccountStats, getBrandAdmaxSetup, getTestingBudget } from '../api/admax-setup';
import {
  type AnalysisPipeline,
  type AnalysisPipelineRejectionReasonEnum,
  approveAndExecuteAnalysisPipeline,
  getAnalysisPipelines,
  rejectAnalysisPipeline,
} from '../api/analysis-pipeline';
import { submitInsightFeedback } from '../api/campaign-insights';
import {
  type CreationPipelineRejectionReasonEnum,
  getCreationPipelines,
  rejectCreationPipeline,
} from '../api/creation-pipeline';
import {
  type AdKnowledgeRule,
  AdsPlatformEnum,
  type ApiUpdateKnowledgeRuleParams,
  KnowledgeRuleStatusEnum,
  KnowledgeRuleTypeEnum,
  approveKnowledgeRule,
  createKnowledgeRule,
  declineKnowledgeRule,
  getKnowledgeRules,
  updateKnowledgeRule,
} from '../api/knowledge-base';
import { AddOverrideRuleDialog } from '../component/add-override-rule-dialog';
import { InstructDialog } from '../component/instruct-dialog';
import { InsufficientBudgetDialog } from '../component/insufficient-budget-dialog';
import { RejectDialog } from '../component/reject-dialog';
import { RequestChangesDialog } from '../component/request-changes-dialog';
import { RequestCreativesDialog } from '../component/request-creatives-dialog';
import type { IRuleDataProvider } from '../component/review-all-rules-dialog/rule-data-provider.interface';
import { RuleDetailDialog } from '../component/rules-detail-dialog';
import { mockAutomationStatus, mockWeeklyCycle } from '../page/queue/mock-data';
import type { AutomationStatus, CreationQueueItem, TestingBudget, WeeklyCycle } from '../type';
import { AutomationLevel, CyclePhase, QueuePageTabEnum } from '../type';

import { AdMaxPersistStateManager, type PersistedAdMaxState } from './ad-max-persist-state-manager';
import { QueueAccountGuard, type QueueGuardAction } from './queue-account-guard';

interface QueuePageState {
  isReady: boolean;
  activeTab: QueuePageTabEnum;
  isGeneratingConcept: boolean;
  conceptGenerationTaskId: string | null;
  hasTriggeredConceptGeneration: boolean;

  creationQueue: CreationQueueItem[];
  automationStatus: AutomationStatus;
  weeklyCycle: WeeklyCycle;
  testingBudget: TestingBudget | null;
}

const initialState: QueuePageState = {
  isReady: false,
  activeTab: QueuePageTabEnum.Creation,
  isGeneratingConcept: false,
  conceptGenerationTaskId: null,
  hasTriggeredConceptGeneration: false,
  creationQueue: [],
  automationStatus: {
    level: AutomationLevel.SUPERVISED,
    currentWeek: 1,
    weeksInCurrentLevel: 1,
    approvalRate: 85,
    confidence: 75,
    canUpgrade: false,
    circuitBreakers: [],
  },
  weeklyCycle: {
    currentWeek: 1,
    cyclePhase: CyclePhase.CREATION,
    creationPipelineActive: true,
    analysisPipelineActive: false,
    nextCycleStart: new Date(),
  },
  testingBudget: null,
};

export class QueuePageViewController implements IRuleDataProvider {
  readonly store = createStore(immer(combine(initialState, () => ({}))));
  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;
  private readonly disposerManager = new DisposerManager();
  private readonly persistStateManager = new AdMaxPersistStateManager();
  private readonly queueAccountGuard: QueueAccountGuard;
  private readonly processingTaskManager = new ProcessingTaskManager();

  private disposeAnalysisPipelineScrollBottom: (() => void) | null = null;
  private disposeCreationPipelineScrollBottom: (() => void) | null = null;

  readonly knowledgeRulesQueryClient = createAutoKeyMiniQueryClient(() => ({
    fn: getKnowledgeRules,
    fnParams: [
      {
        account_id: this.selectedAdAccountId || undefined,
      },
    ] as const,
    gcTime: Infinity,
  }));

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

  readonly analysisPipelineQueryManager = new PaginatedQueryManager(getAnalysisPipelines);
  readonly creationPipelineQueryManager = new PaginatedQueryManager(getCreationPipelines);

  constructor(
    private readonly adsPlatformService: IAdsPlatformService,
    private readonly transientDataService: ITransientDataService,
    private readonly brandSpaceService: IBrandSpaceService
  ) {
    this.queueAccountGuard = new QueueAccountGuard(
      this.adsPlatformService,
      this.persistStateManager,
      this.brandAdmaxSetupQueryClient
    );
    this.combinedStore = createCombinedStore([
      this.adsPlatformService.store,
      this.store,
      this.persistStateManager.store,
      this.knowledgeRulesQueryClient.store,
      this.accountStatsQueryClient.store,
      this.brandAdmaxSetupQueryClient.store,
      this.analysisPipelineQueryManager.store,
      this.creationPipelineQueryManager.store,
    ] as const);
  }

  get state() {
    return this.store.getState();
  }

  get knowledgeRulesState() {
    return this.knowledgeRulesQueryClient.store.getState();
  }

  get accountStatsState() {
    return this.accountStatsQueryClient.store.getState();
  }

  setState(updater: (state: QueuePageState) => void) {
    this.store.setState(updater);
  }

  get queueAccountState() {
    return this.queueAccountGuard.getAccountState();
  }

  getHeaderCtaMeta() {
    return this.queueAccountGuard.getHeaderCtaMeta();
  }

  getGuardResult(action: QueueGuardAction) {
    return this.queueAccountGuard.getActionGuardResult(action);
  }

  isTabEnabled(tab: QueuePageTabEnum) {
    return this.queueAccountGuard.isTabEnabled(tab);
  }

  private async navigateToCta(href: string) {
    try {
      router.navigate({ to: href as never });
    } catch {
      window.location.href = href;
    }
  }

  async presentGuardDialog(result: ReturnType<typeof this.getGuardResult>) {
    if (!result.dialog) return;
    try {
      await dialogManager.show(AlertDialogPreset, {
        title: result.dialog.title,
        description: result.dialog.description,
        confirmText: result.dialog.ctaLabel,
        cancelText: 'Cancel',
      });
      await this.navigateToCta(result.dialog.ctaHref);
    } catch {
      /* user canceled */
    }
  }

  private async withGuard(action: QueueGuardAction, runner: () => Promise<void>) {
    const guardResult = this.getGuardResult(action);
    if (!guardResult.canProceed) {
      await this.presentGuardDialog(guardResult);
      return;
    }
    await runner();
  }

  get selectedAdAccountId() {
    return this.persistStateManager.state.selectedAccountId ?? undefined;
  }

  setSelectedAdAccountId(accountId: string | null) {
    this.persistStateManager.setSelectedAccountId(accountId);
  }

  getSelectedAdsAccount(): GeneralMetaAdsAccount | undefined {
    return this.adsPlatformService.state.metaAdsAccount?.list.find(
      (account) => account.account_id === this.selectedAdAccountId
    );
  }

  private getAvailableMetaAccountList(): GeneralMetaAdsAccount[] {
    const brandMetaAccountList = this.adsPlatformService.state.metaAdsAccount?.list || [];
    return brandMetaAccountList.filter((account) => !account.is_hidden);
  }

  /**
   * Get the best available meta account based on priority:
   * 1. synced with campaigns (highest priority)
   * 2. other synced accounts
   * 3. syncing accounts
   * 4. no data accounts (campaignCount === 0)
   */
  private getBestAvailableMetaAccountId(): string | undefined {
    const availableAccounts = this.getAvailableMetaAccountList().filter((account) => !!account.is_setup_complete);

    if (availableAccounts.length === 0) {
      return undefined;
    }

    // Priority 1: synced accounts with campaigns
    const syncedWithCampaignsAccount = availableAccounts.find(
      (account) => account.status === 'synced' && (account.ads_data_map?.campaign_count ?? 0) > 0
    );
    if (syncedWithCampaignsAccount?.__account_id) {
      return syncedWithCampaignsAccount.__account_id;
    }

    // Priority 2: other synced accounts
    const syncedAccount = availableAccounts.find((account) => account.status === 'synced');
    if (syncedAccount?.__account_id) {
      return syncedAccount.__account_id;
    }

    // Priority 3: syncing accounts
    const syncingAccount = availableAccounts.find((account) => account.status === 'syncing');
    if (syncingAccount?.__account_id) {
      return syncingAccount.__account_id;
    }

    // Fallback: return first available account
    return availableAccounts[0]?.__account_id;
  }

  setAnalysisPipelineScrollElement(element: HTMLDivElement) {
    if (!element) return;
    this.disposeAnalysisPipelineScrollBottom?.();

    const handleAnalysisPipelineScroll = lodash.debounce(() => {
      // 只在 Analysis tab 激活时触发
      if (this.state.activeTab !== QueuePageTabEnum.Analysis) return;

      const threshold = 100;
      const isNearBottom = element.scrollTop + element.clientHeight + threshold >= element.scrollHeight;
      const { isFetchingNextPage, isLoading, hasNextPage } = this.analysisPipelineQueryManager.state;
      if (isNearBottom && !isLoading && !isFetchingNextPage && hasNextPage) {
        this.analysisPipelineQueryManager.fetchNextPage();
      }
    }, 100);

    element.addEventListener('scroll', handleAnalysisPipelineScroll);

    this.disposeAnalysisPipelineScrollBottom = () => {
      element.removeEventListener('scroll', handleAnalysisPipelineScroll);
    };
  }

  setCreationPipelineScrollElement(element: HTMLDivElement) {
    if (!element) return;
    this.disposeCreationPipelineScrollBottom?.();

    const handleCreationPipelineScroll = lodash.debounce(() => {
      // 只在 Creation tab 激活时触发
      if (this.state.activeTab !== QueuePageTabEnum.Creation) return;

      const threshold = 100;
      const isNearBottom = element.scrollTop + element.clientHeight + threshold >= element.scrollHeight;
      const { isFetchingNextPage, isLoading, hasNextPage } = this.creationPipelineQueryManager.state;
      if (isNearBottom && !isLoading && !isFetchingNextPage && hasNextPage) {
        this.creationPipelineQueryManager.fetchNextPage();
      }
    }, 100);

    element.addEventListener('scroll', handleCreationPipelineScroll);

    this.disposeCreationPipelineScrollBottom = () => {
      element.removeEventListener('scroll', handleCreationPipelineScroll);
    };
  }

  get creationCount() {
    return this.creationPipelineQueryManager.items.length;
  }

  get analysisCount() {
    return this.analysisPipelineQueryManager.items.length;
  }

  get totalPending() {
    return this.creationCount + this.analysisCount;
  }

  get budgetPercentage() {
    if (!this.state.testingBudget) return 0;
    const { remaining, monthlyBudgetAllocation } = this.state.testingBudget;
    if (monthlyBudgetAllocation === 0) return 0;
    return (remaining / monthlyBudgetAllocation) * 100;
  }

  get isLowBudget() {
    if (!this.state.testingBudget) return false;
    return this.budgetPercentage < 30 && this.state.testingBudget.monthlyBudgetAllocation > 0;
  }

  get isGeneratingConcept() {
    return this.state.isGeneratingConcept;
  }

  getCreativeRules(): AdKnowledgeRule[] {
    const rules = this.knowledgeRulesQueryClient.store.getState().data || [];
    return rules.filter((rule) => rule.type === KnowledgeRuleTypeEnum.Creative);
  }

  getTargetingRules(): AdKnowledgeRule[] {
    const rules = this.knowledgeRulesQueryClient.store.getState().data || [];
    return rules.filter((rule) => rule.type === KnowledgeRuleTypeEnum.Targeting);
  }

  getEvaluationRules(): AdKnowledgeRule[] {
    const rules = this.knowledgeRulesQueryClient.store.getState().data || [];
    return rules.filter((rule) => rule.type === KnowledgeRuleTypeEnum.Evaluation);
  }

  get lastRuleUpdated(): Date {
    const rules = this.knowledgeRulesQueryClient.store.getState().data || [];
    if (rules.length === 0) return new Date();

    return new Date(Math.max(...rules.map((rule) => new Date(rule.updated_at).getTime())));
  }

  get approvalRulesCount(): number {
    const rules = this.knowledgeRulesQueryClient.store.getState().data || [];
    return rules.filter((r) => r.status === KnowledgeRuleStatusEnum.Approved).length;
  }

  get rejectionRulesCount(): number {
    const rules = this.knowledgeRulesQueryClient.store.getState().data || [];
    return rules.filter((r) => r.status === KnowledgeRuleStatusEnum.Declined).length;
  }

  private getTabFromRouterState(): QueuePageTabEnum {
    try {
      if (tanstackRouter.state?.location?.pathname === '/tool/ad-max/queue') {
        const searchParams = tanstackRouter.state.location.search as { tab?: QueuePageTabEnum } | undefined;
        const tabParam = searchParams?.tab;
        if (tabParam && Object.values(QueuePageTabEnum).includes(tabParam)) {
          return tabParam;
        }
      }
    } catch (error) {
      // Ignore error, use default
    }
    return QueuePageTabEnum.Creation;
  }

  setActiveTab(tab: QueuePageTabEnum) {
    if (!this.queueAccountGuard.isTabEnabled(tab)) {
      const guardResult = this.getGuardResult('analysis-tab');
      this.presentGuardDialog(guardResult);
      return;
    }
    this.setState((state) => {
      state.activeTab = tab;
    });
    try {
      router.navigate({
        to: '/tool/ad-max/queue',
        search: { tab },
        replace: true,
      });
    } catch (error) {
      console.error('Failed to update URL:', error);
    }
  }

  async openRequestChangesDialog(id: string, name: string, type: 'ad-set' | 'recommendation') {
    try {
      const result = await dialogManager.show(RequestChangesDialog, {
        itemName: name,
        itemType: type,
      });

      this.submitRequestChanges(id, type, result.feedback, result.categories);
    } catch (error) {
      // User cancelled - ignore error
    }
  }

  async openInstructDialog(snapshotId: string | null) {
    const accountId = this.selectedAdAccountId;
    const currentBrand = this.brandSpaceService.storeManager.currentBrand;

    if (!snapshotId) {
      Toast.error('Cannot submit instruction: missing snapshot information');
      return;
    }

    if (!accountId && !currentBrand?.id) {
      Toast.error('Cannot submit instruction: missing account or brand information');
      return;
    }

    dialogManager.show(InstructDialog, {
      onSubmit: async (instruction: string) => {
        await this.submitInstruct(instruction, snapshotId);
      },
    });
  }

  async openRequestCreativesDialog(
    platform?: string,
    accountId?: string,
    creationPipelineId?: string,
    initialPrompt?: string,
    product?: import('@/feature/resource/assets-library/type').ToolProductInfoType
  ) {
    // Brand mode: allow generating creatives without Meta account
    // Only block if setup is incomplete
    try {
      await dialogManager.show(RequestCreativesDialog, {
        platform,
        accountId,
        creationPipelineId,
        initialPrompt,
        product,
      });
      if (creationPipelineId) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await this.creationPipelineQueryManager.refetch();
    } catch {
      /* user cancelled */
    }
  }

  async openRejectDialog(id: string, name: string, type: 'ad-set' | 'recommendation') {
    try {
      const result = await dialogManager.show(RejectDialog, {
        itemName: name,
        itemType: type,
      });

      await this.executeReject(id, type, result.reason, result.categories);
    } catch (error) {
      // User cancelled - ignore error
    }
  }
  private checkBudgetSufficiency(dailyBudget: number | null): boolean {
    if (!this.state.testingBudget || !dailyBudget) {
      return true;
    }

    const { remaining } = this.state.testingBudget;
    return remaining >= dailyBudget;
  }

  private async showInsufficientBudgetDialog(dailyBudget: number): Promise<boolean> {
    try {
      const remaining = this.state.testingBudget?.remaining || 0;
      await dialogManager.show(InsufficientBudgetDialog, {
        remainingBudget: remaining,
        requiredBudget: dailyBudget,
      });
      this.setActiveTab(QueuePageTabEnum.Knowledge);
      return true;
    } catch (error) {
      return false;
    }
  }

  async approveCreationItem(id: string, selectedJobIds: string[]) {
    // Check if Meta account is required for approval
    const guardResult = this.getGuardResult('approve-creation');
    if (!guardResult.canProceed) {
      await this.presentGuardDialog(guardResult);
      return;
    }

    try {
      // Get the item from query manager (no need to call approve API, just navigate to ad launcher page)
      const items = this.creationPipelineQueryManager.state.data;
      const item = items.find((item) => item.id === id);
      if (!item) {
        Toast.error('Failed to find creation pipeline item');
        return;
      }

      if (!item.flow) {
        Toast.error('Creation pipeline is missing flow data');
        return;
      }

      // Check budget sufficiency
      if (item.daily_budget && !this.checkBudgetSufficiency(item.daily_budget)) {
        const shouldNavigate = await this.showInsufficientBudgetDialog(item.daily_budget);
        if (shouldNavigate) {
          return;
        }
      }

      // Get best available meta account based on priority (synced > syncing > no data)
      const selectedAccountId = this.selectedAdAccountId;

      // Get campaign ID from budget_settings (testing type for creation pipeline)
      let campaignId: string | undefined;
      if (selectedAccountId) {
        await this.adsPlatformService.waitReady();
        const metaAccounts = this.adsPlatformService.state.metaAdsAccount?.list || [];
        const selectedAccount = metaAccounts.find((acc) => acc.account_id === selectedAccountId);
        const testingCampaignIds = selectedAccount?.budget_settings?.testing?.campaign_ids;
        if (testingCampaignIds && Array.isArray(testingCampaignIds) && testingCampaignIds.length > 0) {
          campaignId = testingCampaignIds[0];
        }
      }

      // Create transient data message
      const message: AdDeliveryMessage = {
        creationPipelineData: {
          creation_pipeline_id: id,
          flow_id: item.flow.id, // Include flow_id to fetch product information
          media_job_ids: selectedJobIds,
          campaign_id: campaignId,
        },
        from: AdDeliveryFromEnum.AdMaxCampaign,
        selectedAccountId,
        selectedCampaignId: campaignId,
      };
      const messageId = this.transientDataService.createMessage(message);

      // Navigate to ad-launch page
      router.navigate({
        to: '/tool/creative-testing/ad-launch',
        search: {
          platform: AdsPlatformEnum.Meta,
          actionType: AdDeliveryActionTypeENum.LAUNCH_NEW_CREATIVES.valueOf(),
          messageId,
        },
      });
    } catch (error) {
      console.error('Failed to approve creation item:', error);
      Toast.error('Failed to approve creation pipeline. Please try again.');
      throw error;
    }
  }

  async approveAnalysisItem(id: string) {
    try {
      await approveAndExecuteAnalysisPipeline(id);
      await this.analysisPipelineQueryManager.refetch();
    } catch (error) {
      console.error('Failed to approve analysis item:', error);
      throw error;
    }
  }

  navigateToAdMetric(item: AnalysisPipeline) {
    const filter: Partial<MetricPageFilterManagerState> = {
      specificAdId: item.ad_id,
      adPlatform: item.platform as AdsPlatformEnum,
      adAccountId: item.account_id || undefined,
      dataCategory: DataCategoryEnum.AdsManager,
      adMetricLevel: MetricLevelEnum.Ad,
      dateRange: createAllTimeRange(),
    };
    const message: MetricPageFilterMessage = { filter };
    const messageId = this.transientDataService.createMessage(message);
    router.navigate({
      to: '/my-ads/metric',
      search: { messageId },
    });
  }

  navigateToCampaignMetric(item: AnalysisPipeline) {
    const campaignId = item.meta_ads_campaign?.campaign_id || item.campaign_id;
    const filter: Partial<MetricPageFilterManagerState> = {
      campaignId,
      adPlatform: item.platform as AdsPlatformEnum,
      adAccountId: item.account_id || undefined,
      dataCategory: DataCategoryEnum.AdsManager,
      adMetricLevel: MetricLevelEnum.Campaign,
    };
    const message: MetricPageFilterMessage = { filter };
    const messageId = this.transientDataService.createMessage(message);
    router.navigate({
      to: '/my-ads/metric',
      search: { messageId },
    });
  }

  async rejectItem(id: string, name: string, type: 'ad-set' | 'recommendation') {
    await this.openRejectDialog(id, name, type);
  }

  private async executeReject(
    id: string,
    type: 'ad-set' | 'recommendation',
    reason: string,
    categories: AnalysisPipelineRejectionReasonEnum[] | CreationPipelineRejectionReasonEnum[]
  ) {
    if (type === 'recommendation') {
      try {
        await rejectAnalysisPipeline(id, {
          rejection_reason: categories as AnalysisPipelineRejectionReasonEnum[],
          rejection_details: reason,
        });
        await this.analysisPipelineQueryManager.refetch();
      } catch (error) {
        console.error('Failed to reject analysis pipeline:', error);
        throw error;
      }
    } else {
      // type === 'ad-set' (Creation Pipeline)
      try {
        await rejectCreationPipeline(id, {
          rejection_reason: categories as CreationPipelineRejectionReasonEnum[],
          rejection_details: reason,
        });
        await this.creationPipelineQueryManager.refetch();
      } catch (error) {
        console.error('Failed to reject creation pipeline:', error);
        throw error;
      }
    }
  }

  private submitRequestChanges(id: string, type: 'ad-set' | 'recommendation', feedback: string, categories: string[]) {
    // TODO: implement request changes logic
  }

  private async submitInstruct(instruction: string, snapshotId: string) {
    const accountId = this.selectedAdAccountId;
    const currentBrand = this.brandSpaceService.storeManager.currentBrand;

    if (!accountId && !currentBrand?.id) {
      throw new Error('Missing account ID or brand ID');
    }

    try {
      await submitInsightFeedback({
        account_id: accountId || undefined,
        brand_id: accountId ? undefined : currentBrand?.id,
        snapshot_id: snapshotId,
        user_answer: instruction,
      });
      Toast.success('Instruction submitted successfully');
    } catch (error) {
      console.error('Failed to submit instruction:', error);
      Toast.error('Failed to submit instruction');
      throw error;
    }
  }

  async requestItemChanges(id: string, name: string, type: 'ad-set' | 'recommendation') {
    await this.openRequestChangesDialog(id, name, type);
  }

  /**
   * Handle "Bring Own Creatives" button click
   * Navigate to Meta Ads Launch (New Creative) page without creating creation_pipeline
   */
  async handleBringOwnCreatives() {
    await this.withGuard('test-creatives', async () => {
      try {
        const selectedAccountId = this.selectedAdAccountId;

        let campaignId: string | undefined;
        if (selectedAccountId) {
          await this.adsPlatformService.waitReady();
          const metaAccounts = this.adsPlatformService.state.metaAdsAccount?.list || [];
          const selectedAccount = metaAccounts.find((acc) => acc.account_id === selectedAccountId);
          const testingCampaignIds = selectedAccount?.budget_settings?.testing?.campaign_ids;
          if (testingCampaignIds && Array.isArray(testingCampaignIds) && testingCampaignIds.length > 0) {
            campaignId = testingCampaignIds[0];
          }
        }

        const message: AdDeliveryMessage = {
          from: AdDeliveryFromEnum.AdMaxCampaign,
          selectedAccountId,
          selectedCampaignId: campaignId,
        };
        const messageId = this.transientDataService.createMessage(message);

        router.navigate({
          to: '/tool/creative-testing/ad-launch',
          search: {
            platform: 'meta',
            actionType: AdDeliveryActionTypeENum.LAUNCH_NEW_CREATIVES.valueOf(),
            messageId,
          },
        });
      } catch (error) {
        console.error('Failed to navigate to ad launcher page:', error);
        Toast.error('Failed to navigate to ad launcher page. Please try again.');
      }
    });
  }

  async openRuleDetailDialog(rule: AdKnowledgeRule) {
    try {
      await dialogManager.show(RuleDetailDialog, {
        rule,
        onConfirm: async (updateData: ApiUpdateKnowledgeRuleParams) => {
          await this.updateRule(rule.id, updateData);
        },
      });
    } catch (error) {
      // User cancelled - ignore error
    }
  }

  async updateRule(ruleId: string, updateData: ApiUpdateKnowledgeRuleParams) {
    try {
      await this.knowledgeRulesQueryClient.optimisticUpdate({
        executor: async () => {
          await updateKnowledgeRule(ruleId, updateData);
        },
        optimisticUpdater: (currentData) => {
          if (!currentData) return currentData;
          return currentData.map((rule) => {
            if (rule.id !== ruleId) return rule;

            const updatedRule: AdKnowledgeRule = {
              ...rule,
              ...updateData,
            };
            return updatedRule;
          });
        },
      });
      await this.knowledgeRulesQueryClient.fetch();
      Toast.success('Rule updated successfully');
    } catch (error) {
      console.error('Failed to update rule:', error);
      Toast.error('Failed to update rule');
      throw error;
    }
  }

  updateRuleStatus(ruleId: string, type: string, newStatus: 'approved' | 'declined' | 'pending') {
    const backendStatus =
      newStatus === 'approved'
        ? KnowledgeRuleStatusEnum.Approved
        : newStatus === 'declined'
          ? KnowledgeRuleStatusEnum.Declined
          : KnowledgeRuleStatusEnum.Pending;

    if (newStatus === 'approved') {
      this.approveRule(ruleId);
    } else if (newStatus === 'declined') {
      this.declineRule(ruleId);
    }
  }

  async openReviewAllRulesDialog() {
    try {
      const { ReviewAllRulesDialog } = await import('../component/review-all-rules-dialog');
      await dialogManager.show(ReviewAllRulesDialog, {
        viewController: this,
      });
    } catch (error) {
      // User cancelled - ignore error
    }
  }

  async createNewRule(data: {
    rule: string;
    type: KnowledgeRuleTypeEnum;
    response?: string;
  }) {
    try {
      const accountId = this.selectedAdAccountId;
      if (!accountId) {
        Toast.error('Please select an account first');
        return;
      }

      await createKnowledgeRule({
        ...data,
        platform: AdsPlatformEnum.Meta,
        account_id: accountId,
      });

      await this.knowledgeRulesQueryClient.fetch();
    } catch (error) {
      console.error('Failed to create knowledge rule:', error);
      throw error;
    }
  }

  async approveRule(ruleId: string) {
    try {
      await this.knowledgeRulesQueryClient.optimisticUpdate({
        executor: async () => {
          await approveKnowledgeRule(ruleId);
        },
        optimisticUpdater: (currentData) => {
          if (!currentData) return currentData;
          return currentData.map((rule) =>
            rule.id === ruleId
              ? {
                  ...rule,
                  status: KnowledgeRuleStatusEnum.Approved,
                  updated_at: new Date().toISOString(),
                }
              : rule
          );
        },
      });
      await this.knowledgeRulesQueryClient.fetch();
    } catch (error) {
      console.error('Failed to approve rule:', error);
      throw error;
    }
  }

  async declineRule(ruleId: string) {
    try {
      await this.knowledgeRulesQueryClient.optimisticUpdate({
        executor: async () => {
          await declineKnowledgeRule(ruleId);
        },
        optimisticUpdater: (currentData) => {
          if (!currentData) return currentData;
          return currentData.map((rule) =>
            rule.id === ruleId
              ? {
                  ...rule,
                  status: KnowledgeRuleStatusEnum.Declined,
                  updated_at: new Date().toISOString(),
                }
              : rule
          );
        },
      });
      await this.knowledgeRulesQueryClient.fetch();
    } catch (error) {
      console.error('Failed to decline rule:', error);
      throw error;
    }
  }

  async openAddOverrideRuleDialog(type: KnowledgeRuleTypeEnum) {
    await dialogManager.show(AddOverrideRuleDialog, {
      type,
      onConfirm: async (data) => {
        await this.createNewRule({
          rule: data.rule,
          type: data.type,
          response: data.response,
        });
      },
    });
  }

  exportKnowledge() {
    const rules = this.knowledgeRulesQueryClient.store.getState().data || [];

    if (rules.length === 0) {
      return;
    }

    const headers = ['ID', 'Rule', 'Type', 'Response', 'Status', 'Platform', 'Created At', 'Updated At'];

    const escapeCsvField = (field: string | null | undefined): string => {
      if (field === null || field === undefined) {
        return '';
      }
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows: string[] = [headers.join(',')];

    for (const rule of rules) {
      const row = [
        escapeCsvField(rule.id),
        escapeCsvField(rule.rule),
        escapeCsvField(rule.type),
        escapeCsvField(rule.response),
        escapeCsvField(rule.status),
        escapeCsvField(rule.platform) || AdsPlatformEnum.Meta,
        escapeCsvField(rule.created_at),
        escapeCsvField(rule.updated_at),
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `knowledge-rules-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }

  private async addNewRule(ruleData: {
    type: KnowledgeRuleTypeEnum;
    rule: string;
    response: string;
  }) {
    await this.createNewRule({
      rule: ruleData.rule,
      type: ruleData.type,
      response: ruleData.response,
    });
  }

  private async fetchTestingBudget() {
    try {
      const accountId = this.selectedAdAccountId;
      if (!accountId || !this.queueAccountGuard.shouldFetchTestingBudget()) return;

      const response = await getTestingBudget({
        account_id: accountId,
        platform: 'meta',
      });

      this.setState((state) => {
        state.testingBudget = {
          campaignId: response.campaign_id,
          monthlyBudget: response.monthly_budget,
          monthlyBudgetAllocation: response.monthly_budget_allocation,
          remaining: response.monthly_budget_allocation - response.monthly_budget,
        };
      });
    } catch (error) {
      console.error('Failed to fetch testing budget:', error);
      this.setState((state) => {
        state.testingBudget = null;
      });
    }
  }

  private extractCeleryTaskId(externalTaskId: string): string {
    // External task_id format: "ads_meta_account-{celery_task_id}"
    const prefix = 'ads_meta_account-';
    if (externalTaskId.startsWith(prefix)) {
      return externalTaskId.substring(prefix.length);
    }
    return externalTaskId;
  }

  private async pollGenerateConceptTask(taskId: string): Promise<void> {
    const poller = this.processingTaskManager.polling(async () => getTaskStatusWithResult(taskId), {
      interval: 2000,
      isFinished: (res) => {
        const isSuccess = res.status === 'SUCCESS';
        const isFailure = res.status === 'FAILURE' || res.status === 'REVOKED';
        return isSuccess || isFailure;
      },
      needInterrupt: (res) => res.status === 'FAILURE' || res.status === 'REVOKED',
    });

    const result = await poller();

    if (result.status === 'FAILURE' || result.status === 'REVOKED') {
      throw new Error(result.error || 'Task failed');
    }
  }

  private async triggerGenerateConcepts(): Promise<void> {
    const accountId = this.selectedAdAccountId;

    // In brand mode (no account), brand_id is in request header, don't pass it
    const response = await generateConcept(accountId ? { account_id: accountId } : {});

    if (response.task_id) {
      const celeryTaskId = this.extractCeleryTaskId(response.task_id);

      // Save task_id to state
      this.setState((state) => {
        state.conceptGenerationTaskId = celeryTaskId;
      });

      await this.pollGenerateConceptTask(celeryTaskId);

      // Clear task_id after completion
      this.setState((state) => {
        state.conceptGenerationTaskId = null;
      });
    }
  }

  private async checkAndHandleConceptGeneration() {
    // Only trigger in Creation tab
    if (this.state.activeTab !== QueuePageTabEnum.Creation) {
      return;
    }

    // Check if we have either account-ready or brand mode
    const hasAccount = this.queueAccountState.status === 'account-ready';
    const isBrandMode = !this.selectedAdAccountId;

    if (!hasAccount && !isBrandMode) {
      return;
    }

    // Check if there's an ongoing task from previous call
    const ongoingTaskId = this.state.conceptGenerationTaskId;
    if (ongoingTaskId) {
      // Continue polling existing task
      try {
        this.setState((state) => {
          state.isGeneratingConcept = true;
        });
        await this.pollGenerateConceptTask(ongoingTaskId);
        await this.creationPipelineQueryManager.refetch();
      } catch (error) {
        console.error('Failed to poll concept generation task:', error);
      } finally {
        this.setState((state) => {
          state.isGeneratingConcept = false;
          state.conceptGenerationTaskId = null;
        });
      }
      return;
    }

    // Limit: only trigger once per page visit
    if (this.state.hasTriggeredConceptGeneration) {
      return;
    }

    // No ongoing task, check if we need to trigger new generation
    if (this.creationPipelineQueryManager.items.length === 0) {
      try {
        this.setState((state) => {
          state.isGeneratingConcept = true;
          state.hasTriggeredConceptGeneration = true;
        });

        await this.triggerGenerateConcepts();
        await this.creationPipelineQueryManager.refetch();
      } catch (error) {
        console.error('Failed to generate concepts:', error);
      } finally {
        this.setState((state) => {
          state.isGeneratingConcept = false;
        });
      }
    }
  }

  async bootstrapData() {
    // For brand mode (no account selected), don't pass platform parameter
    const isBrandMode = !this.selectedAdAccountId;

    const fetchPromises: Promise<unknown>[] = [];

    // Fetch pipelines with appropriate parameters
    if (isBrandMode) {
      // Brand mode: don't pass platform, no account_id
      fetchPromises.push(this.analysisPipelineQueryManager.fetch({}));
      fetchPromises.push(this.creationPipelineQueryManager.fetch({}));
    } else {
      // Account mode: pass platform and account_id
      fetchPromises.push(
        this.analysisPipelineQueryManager.fetch({
          platform: AdsPlatformEnum.Meta,
          account_id: this.selectedAdAccountId,
        })
      );
      fetchPromises.push(
        this.creationPipelineQueryManager.fetch({
          platform: AdsPlatformEnum.Meta,
          account_id: this.selectedAdAccountId,
        })
      );
    }

    // Fetch brand setup in brand mode (brand_id is in request header)
    if (isBrandMode) {
      fetchPromises.push(this.brandAdmaxSetupQueryClient.fetch());
    }

    if (this.selectedAdAccountId) {
      fetchPromises.push(this.knowledgeRulesQueryClient.fetch());
    }

    if (this.queueAccountGuard.shouldFetchAccountStats()) {
      fetchPromises.push(this.accountStatsQueryClient.fetch());
    }

    if (this.queueAccountGuard.shouldFetchTestingBudget()) {
      fetchPromises.push(this.fetchTestingBudget());
    } else {
      this.setState((state) => {
        state.testingBudget = null;
      });
    }

    await Promise.allSettled(fetchPromises);

    // Check and handle concept generation after all data is loaded
    // This will either continue polling an existing task or trigger a new one if needed
    await this.checkAndHandleConceptGeneration();

    this.setState((state) => {
      state.automationStatus = mockAutomationStatus;
      state.weeklyCycle = mockWeeklyCycle;
    });
  }

  private bootstrapTabHandler() {
    const initialTab = this.getTabFromRouterState();
    this.setState((state) => {
      state.activeTab = initialTab;
    });

    const handleTabChange = () => {
      if (tanstackRouter.state?.location?.pathname === '/tool/ad-max/queue') {
        const searchParams = tanstackRouter.state.location.search as { tab?: QueuePageTabEnum } | undefined;
        const tab = searchParams?.tab || QueuePageTabEnum.Creation;

        if (tab !== this.state.activeTab) {
          this.setState((state) => {
            state.activeTab = tab;
          });
        }
      }
    };

    const disposeRouterListener = tanstackRouter.subscribe('onResolved', handleTabChange);
    this.disposerManager.addDisposeFn(disposeRouterListener);
  }

  private bootstrapAdAccountSync() {
    const update = () => {
      const availableAccounts = this.getAvailableMetaAccountList();
      const currentSelectedId = this.selectedAdAccountId;
      if (
        !currentSelectedId &&
        availableAccounts.length > 0 &&
        !availableAccounts.some((account) => account.__account_id === currentSelectedId)
      ) {
        const bestAccountId = this.getBestAvailableMetaAccountId();
        if (bestAccountId) {
          this.setSelectedAdAccountId(bestAccountId);
        }
      }
    };

    update();
    const unsubscribe = this.adsPlatformService.store.subscribe(update);

    this.disposerManager.addDisposeFn(unsubscribe);
  }

  private bootstrapRefreshListener() {
    let prevSelectedAdAccountId: string | null | undefined = this.selectedAdAccountId;

    const disposePersistStoreListener = this.persistStateManager.store.subscribe(async (state: PersistedAdMaxState) => {
      const selectedAdAccountId = state.selectedAccountId ?? null;
      if (selectedAdAccountId !== prevSelectedAdAccountId) {
        // Reset concept generation flag when switching accounts
        this.setState((state) => {
          state.hasTriggeredConceptGeneration = false;
          state.conceptGenerationTaskId = null;
          state.isGeneratingConcept = false;
        });

        // For brand mode (no account selected), don't pass platform parameter
        const isBrandMode = !selectedAdAccountId;

        const fetchPromises: Promise<unknown>[] = [];

        // Fetch pipelines with appropriate parameters
        if (isBrandMode) {
          // Brand mode: don't pass platform, no account_id
          fetchPromises.push(this.analysisPipelineQueryManager.fetch({}));
          fetchPromises.push(this.creationPipelineQueryManager.fetch({}));
        } else {
          // Account mode: pass platform and account_id
          fetchPromises.push(
            this.analysisPipelineQueryManager.fetch({
              platform: AdsPlatformEnum.Meta,
              account_id: selectedAdAccountId || undefined,
            })
          );
          fetchPromises.push(
            this.creationPipelineQueryManager.fetch({
              platform: AdsPlatformEnum.Meta,
              account_id: selectedAdAccountId || undefined,
            })
          );
        }

        // Fetch brand setup in brand mode (brand_id is in request header)
        if (isBrandMode) {
          fetchPromises.push(this.brandAdmaxSetupQueryClient.fetch());
        }

        if (selectedAdAccountId) {
          fetchPromises.push(this.knowledgeRulesQueryClient.fetch());
        }
        if (this.queueAccountGuard.shouldFetchAccountStats()) {
          fetchPromises.push(this.accountStatsQueryClient.fetch());
        }
        if (this.queueAccountGuard.shouldFetchTestingBudget()) {
          fetchPromises.push(this.fetchTestingBudget());
        } else {
          this.setState((state) => {
            state.testingBudget = null;
          });
        }

        await Promise.allSettled(fetchPromises);

        // Check and handle concept generation after all data is loaded
        await this.checkAndHandleConceptGeneration();

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
      const selectedAccount = availableAccounts.find((acc) => acc.__account_id === selectedAccountId);
      if (selectedAccount?.is_setup_complete) {
        return true; // Account is setup complete, can proceed
      }
      // Selected account exists but not setup complete, fall through to find alternative
    }

    // Check 2: Brand mode - check brand setup status
    const brandSetup = this.brandAdmaxSetupQueryClient.store.getState().data;
    if (brandSetup?.is_setup_complete) {
      // Brand is setup complete, switch to brand mode (clear selected account)
      if (selectedAccountId) {
        this.setSelectedAdAccountId(null);
      }
      return true;
    }

    // Check 3: Find any setup complete account in list
    const setupCompleteAccount = availableAccounts.find(
      (acc) => acc.is_setup_complete && acc.budget_settings && acc.launch_config
    );

    if (setupCompleteAccount?.__account_id) {
      // Found a setup complete account, select it and stay in queue
      this.setSelectedAdAccountId(setupCompleteAccount.__account_id);
      return true;
    }

    // No setup complete brand or account found, redirect to setup
    router.navigate({ to: '/tool/ad-max/setup', replace: true });
    return false;
  }

  async bootstrap() {
    this.bootstrapTabHandler();

    await this.adsPlatformService.waitReady();

    // Clear setup-related analysis task ID to prevent unexpected polling
    // This ensures that if user hard refreshes from setup page to queue page,
    // any ongoing analysis polling will not continue
    this.persistStateManager.setAnalysisTaskId(null);

    // Fetch brand setup first to check is_setup_complete
    if (!this.selectedAdAccountId) {
      await this.brandAdmaxSetupQueryClient.fetch();
    }

    // Check setup status and redirect if needed
    const canProceed = await this.checkSetupCompleteAndRedirect();
    if (!canProceed) {
      return; // Redirected to setup, don't continue bootstrap
    }

    this.bootstrapAdAccountSync();

    await this.bootstrapData();
    this.bootstrapRefreshListener();

    this.setState((state) => {
      state.isReady = true;
    });
  }

  /**
   * Clear setup state cache
   * Called when navigating to setup page from queue page
   */
  clearSetupCache() {
    this.persistStateManager.clearSetupState();
  }

  dispose() {
    this.disposeAnalysisPipelineScrollBottom?.();
    this.disposeCreationPipelineScrollBottom?.();
    this.analysisPipelineQueryManager.dispose();
    this.creationPipelineQueryManager.dispose();

    // Cancel all ongoing polling tasks
    this.processingTaskManager.cancelAll();

    // Clear any pending concept generation task ID
    this.setState((state) => {
      state.conceptGenerationTaskId = null;
      state.isGeneratingConcept = false;
    });

    this.disposerManager.dispose();
  }
}
