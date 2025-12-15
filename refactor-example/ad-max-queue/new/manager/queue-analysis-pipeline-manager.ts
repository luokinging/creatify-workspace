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
import type { ITransientDataService } from '@/feature/services/transient-data-service.type';
import { router } from '@/hook/use-router';
import { DisposerManager } from '@/manager/disposer-manager';
import lodash from 'lodash';
import {
  type AnalysisPipeline,
  type AnalysisPipelineRejectionReasonEnum,
  approveAndExecuteAnalysisPipeline,
  getAnalysisPipelines,
  rejectAnalysisPipeline,
} from '../../api/analysis-pipeline';
import { AdsPlatformEnum } from '../../api/knowledge-base';
import { RejectDialog } from '../../component/reject-dialog';
import type { AdMaxPersistStateManager } from '../ad-max-persist-state-manager';

export class QueueAnalysisPipelineManager {
  readonly pipelineQueryManager = new PaginatedQueryManager(getAnalysisPipelines);
  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;

  private readonly disposerManager = new DisposerManager();
  private disposeScrollBottom: (() => void) | null = null;

  constructor(
    private readonly persistStateManager: AdMaxPersistStateManager,
    private readonly transientDataService: ITransientDataService
  ) {
    this.combinedStore = createCombinedStore([this.pipelineQueryManager.store] as const);
  }

  private get selectedAdAccountId(): string | undefined {
    return this.persistStateManager.state.selectedAccountId ?? undefined;
  }

  /**
   * Fetch analysis pipelines
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
   * Approve an analysis item
   */
  async approveItem(id: string) {
    await approveAndExecuteAnalysisPipeline(id);
    await this.pipelineQueryManager.refetch();
  }

  /**
   * Reject an analysis item (opens dialog)
   */
  async rejectItem(id: string, name: string) {
    const result = await dialogManager.show(RejectDialog, {
      itemName: name,
      itemType: 'recommendation',
    });
    await this.executeReject(id, result.reason, result.categories as AnalysisPipelineRejectionReasonEnum[]);
  }

  private async executeReject(id: string, reason: string, categories: AnalysisPipelineRejectionReasonEnum[]) {
    await rejectAnalysisPipeline(id, {
      rejection_reason: categories,
      rejection_details: reason,
    });
    await this.pipelineQueryManager.refetch();
  }

  /**
   * Navigate to ad metric page
   */
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

  /**
   * Navigate to campaign metric page
   */
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

  bootstrap() {
    // Nothing to bootstrap initially
  }

  dispose() {
    this.disposeScrollBottom?.();
    this.pipelineQueryManager.dispose();
    this.disposerManager.dispose();
  }
}
