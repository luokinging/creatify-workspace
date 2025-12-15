import { Toast } from '@/component/toast/util';
import { getTaskStatusWithResult } from '@/feature/common/async_task/api';
import {
  type CombinedStore,
  type ReadonlyStoreApi,
  createCombinedStore,
} from '@/feature/common/experimental/use-combined-store';
import { dialogManager } from '@/feature/component.dialog/manager';
import { PaginatedQueryManager } from '@/feature/my-ads/manager/common/paginated-query-manager';
import type { MetaAdAccount } from '@/feature/services/experimental/experimental-ads-platform-service/entity/meta-ad-account';
import type { IPlatformIntegrationService } from '@/feature/services/experimental/experimental-ads-platform-service/platform-integration-service.type';
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
import { generateConcept, getTestingBudget } from '../../api/admax-setup';
import {
  type CreationPipelineRejectionReasonEnum,
  getCreationPipelines,
  rejectCreationPipeline,
} from '../../api/creation-pipeline';
import { AdsPlatformEnum } from '../../api/knowledge-base';
import { InsufficientBudgetDialog } from '../../component/insufficient-budget-dialog';
import { RejectDialog } from '../../component/reject-dialog';
import { RequestCreativesDialog } from '../../component/request-creatives-dialog';
import type { TestingBudget } from '../../type';
import { QueuePageTabEnum } from '../../type';
import type { AdMaxPersistStateManager } from '../ad-max-persist-state-manager';

const initialState = {
  isGeneratingConcept: false,
  conceptGenerationTaskId: null as string | null,
  hasTriggeredConceptGeneration: false,
  testingBudget: null as TestingBudget | null,
};

type QueueCreationPipelineManagerState = typeof initialState;

export class QueueCreationPipelineManager {
  private readonly store = createStore(immer(combine(initialState, () => ({}))));
  readonly pipelineQueryManager = new PaginatedQueryManager(getCreationPipelines);
  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;

  private readonly disposerManager = new DisposerManager();
  private readonly processingTaskManager = new ProcessingTaskManager();
  private disposeScrollBottom: (() => void) | null = null;

  constructor(
    private readonly persistStateManager: AdMaxPersistStateManager,
    private readonly platformIntegrationService: IPlatformIntegrationService,
    private readonly transientDataService: ITransientDataService,
    private readonly onTabChange: (tab: QueuePageTabEnum) => void
  ) {
    this.combinedStore = createCombinedStore([this.store, this.pipelineQueryManager.store] as const);
  }

  get state() {
    return this.store.getState();
  }

  private setState(updater: (state: QueueCreationPipelineManagerState) => void) {
    this.store.setState(updater);
  }

  get isGeneratingConcept(): boolean {
    return this.state.isGeneratingConcept;
  }

  get testingBudget(): TestingBudget | null {
    return this.state.testingBudget;
  }

  get budgetPercentage(): number {
    if (!this.state.testingBudget) return 0;
    const { remaining, monthlyBudgetAllocation } = this.state.testingBudget;
    if (monthlyBudgetAllocation === 0) return 0;
    return (remaining / monthlyBudgetAllocation) * 100;
  }

  get isLowBudget(): boolean {
    if (!this.state.testingBudget) return false;
    return this.budgetPercentage < 30 && this.state.testingBudget.monthlyBudgetAllocation > 0;
  }

  private get selectedAdAccountId(): string | undefined {
    return this.persistStateManager.state.selectedAccountId ?? undefined;
  }

  private getMetaAccountsList(): MetaAdAccount[] {
    return this.platformIntegrationService.metaPlatformManager.brandAccountManager.state.accounts;
  }

  /**
   * Fetch creation pipelines and optionally trigger concept generation
   */
  async fetch(isBrandMode: boolean) {
    if (isBrandMode) {
      // Brand mode: don't pass platform, no account_id
      await this.pipelineQueryManager.fetch({});
    } else {
      // Account mode: pass platform and account_id
      await this.pipelineQueryManager.fetch({
        platform: AdsPlatformEnum.Meta,
        account_id: this.selectedAdAccountId,
      });
    }
  }

  /**
   * Fetch pipelines and then check if concept generation is needed
   * This ensures data is fully loaded before deciding to trigger generation
   */
  async fetchAndMaybeGenerateConcepts(isBrandMode: boolean, isAccountReady: boolean, isCreationTabActive: boolean) {
    // First, fetch the pipeline data
    await this.fetch(isBrandMode);

    // Then check if we need to generate concepts (only for Creation tab)
    if (isCreationTabActive) {
      await this.checkAndHandleConceptGeneration(isAccountReady, isBrandMode);
    }
  }

  /**
   * Set scroll element for infinite scroll
   */
  setScrollElement(element: HTMLDivElement, isActive: () => boolean) {
    if (!element) return;
    this.disposeScrollBottom?.();

    const handleScroll = lodash.debounce(() => {
      // Only trigger when this tab is active
      if (!isActive()) return;

      const threshold = 100;
      const isNearBottom = element.scrollTop + element.clientHeight + threshold >= element.scrollHeight;
      const { isFetchingNextPage, isLoading, hasNextPage } = this.pipelineQueryManager.state;
      if (isNearBottom && !isLoading && !isFetchingNextPage && hasNextPage) {
        this.pipelineQueryManager.fetchNextPage();
      }
    }, 100);

    element.addEventListener('scroll', handleScroll);

    this.disposeScrollBottom = () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }

  /**
   * Fetch testing budget
   */
  async fetchTestingBudget() {
    try {
      const accountId = this.selectedAdAccountId;
      if (!accountId) return;

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

  /**
   * Clear testing budget
   */
  clearTestingBudget() {
    this.setState((state) => {
      state.testingBudget = null;
    });
  }

  /**
   * Check budget sufficiency
   */
  private checkBudgetSufficiency(dailyBudget: number | null): boolean {
    if (!this.state.testingBudget || !dailyBudget) {
      return true;
    }

    const { remaining } = this.state.testingBudget;
    return remaining >= dailyBudget;
  }

  /**
   * Show insufficient budget dialog
   * Returns true if dialog confirmed, false if cancelled
   */
  private async showInsufficientBudgetDialog(dailyBudget: number): Promise<boolean> {
    const remaining = this.state.testingBudget?.remaining || 0;
    await dialogManager.show(InsufficientBudgetDialog, {
      remainingBudget: remaining,
      requiredBudget: dailyBudget,
    });
    this.onTabChange(QueuePageTabEnum.Knowledge);
    return true;
  }

  /**
   * Approve a creation item
   */
  async approveItem(id: string, selectedJobIds: string[]) {
    try {
      // Get the item from query manager
      const items = this.pipelineQueryManager.state.data;
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

      const selectedAccountId = this.selectedAdAccountId;

      // Get campaign ID from budget_settings
      let campaignId: string | undefined;
      if (selectedAccountId) {
        await this.platformIntegrationService.waitReady();
        const metaAccounts = this.getMetaAccountsList();
        const selectedAccount = metaAccounts.find((acc) => acc.source.account_id === selectedAccountId);
        const testingCampaignIds = selectedAccount?.source.budget_settings?.testing?.campaign_ids;
        if (testingCampaignIds && Array.isArray(testingCampaignIds) && testingCampaignIds.length > 0) {
          campaignId = testingCampaignIds[0];
        }
      }

      // Create transient data message
      const message: AdDeliveryMessage = {
        creationPipelineData: {
          creation_pipeline_id: id,
          flow_id: item.flow.id,
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

  /**
   * Reject a creation item (opens dialog)
   */
  async rejectItem(id: string, name: string) {
    const result = await dialogManager.show(RejectDialog, {
      itemName: name,
      itemType: 'ad-set',
    });
    await this.executeReject(id, result.reason, result.categories as CreationPipelineRejectionReasonEnum[]);
  }

  private async executeReject(id: string, reason: string, categories: CreationPipelineRejectionReasonEnum[]) {
    await rejectCreationPipeline(id, {
      rejection_reason: categories,
      rejection_details: reason,
    });
    await this.pipelineQueryManager.refetch();
  }

  /**
   * Open request creatives dialog
   */
  async openRequestCreativesDialog(
    platform?: string,
    accountId?: string,
    creationPipelineId?: string,
    initialPrompt?: string,
    product?: import('@/feature/resource/assets-library/type').ToolProductInfoType
  ) {
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
    await this.pipelineQueryManager.refetch();
  }

  /**
   * Handle "Bring Own Creatives" button click
   */
  async handleBringOwnCreatives() {
    try {
      const selectedAccountId = this.selectedAdAccountId;

      let campaignId: string | undefined;
      if (selectedAccountId) {
        await this.platformIntegrationService.waitReady();
        const metaAccounts = this.getMetaAccountsList();
        const selectedAccount = metaAccounts.find((acc) => acc.source.account_id === selectedAccountId);
        const testingCampaignIds = selectedAccount?.source.budget_settings?.testing?.campaign_ids;
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
  }

  // ============ Concept Generation Logic ============

  private extractCeleryTaskId(externalTaskId: string): string {
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

  /**
   * Check and handle concept generation
   * IMPORTANT: This should only be called AFTER fetch() completes successfully
   */
  async checkAndHandleConceptGeneration(isAccountReady: boolean, isBrandMode: boolean) {
    // Check if we have either account-ready or brand mode
    if (!isAccountReady && !isBrandMode) {
      return;
    }

    // Limit: only trigger once per page visit
    if (this.state.hasTriggeredConceptGeneration) {
      return;
    }

    // Only trigger generation if data is loaded AND there are zero items
    // At this point, fetch() has already completed, so items reflects actual data
    if (this.pipelineQueryManager.items.length === 0) {
      try {
        this.setState((state) => {
          state.isGeneratingConcept = true;
          state.hasTriggeredConceptGeneration = true;
        });

        await this.triggerGenerateConcepts();
        await this.pipelineQueryManager.refetch();
      } catch (error) {
        console.error('Failed to generate concepts:', error);
      } finally {
        this.setState((state) => {
          state.isGeneratingConcept = false;
        });
      }
    }
  }

  /**
   * Reset concept generation state (when switching accounts)
   */
  resetConceptGenerationState() {
    this.setState((state) => {
      state.hasTriggeredConceptGeneration = false;
      state.conceptGenerationTaskId = null;
      state.isGeneratingConcept = false;
    });
  }

  bootstrap() {
    // Nothing to bootstrap initially
  }

  dispose() {
    this.disposeScrollBottom?.();
    this.pipelineQueryManager.dispose();
    this.processingTaskManager.cancelAll();

    // Clear any pending concept generation task ID
    this.setState((state) => {
      state.conceptGenerationTaskId = null;
      state.isGeneratingConcept = false;
    });

    this.disposerManager.dispose();
  }
}
