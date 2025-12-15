import { Toast } from '@/component/toast/util';
import { createAutoKeyMiniQueryClient } from '@/feature/common/experimental/auto-key-helper';
import {
  type CombinedStore,
  type ReadonlyStoreApi,
  createCombinedStore,
} from '@/feature/common/experimental/use-combined-store';
import { dialogManager } from '@/feature/component.dialog/manager';
import type { IBrandSpaceService } from '@/feature/services/brand-space-service/brand-space-service.type';
import { DisposerManager } from '@/manager/disposer-manager';
import { submitInsightFeedback } from '../../api/campaign-insights';
import {
  type AdKnowledgeRule,
  KnowledgeRuleStatusEnum,
  KnowledgeRuleTypeEnum,
  approveKnowledgeRule,
  declineKnowledgeRule,
  getKnowledgeRules,
} from '../../api/knowledge-base';
import { InstructDialog } from '../../component/instruct-dialog';
import type { IRuleDataProvider } from '../../component/review-all-rules-dialog/rule-data-provider.interface';
import type { AdMaxPersistStateManager } from '../ad-max-persist-state-manager';

export class QueueKnowledgeBaseManager implements IRuleDataProvider {
  readonly knowledgeRulesQueryClient = createAutoKeyMiniQueryClient(() => ({
    fn: getKnowledgeRules,
    fnParams: [
      {
        account_id: this.selectedAdAccountId || undefined,
      },
    ] as const,
    gcTime: Infinity,
  }));

  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;

  private readonly disposerManager = new DisposerManager();

  constructor(
    private readonly persistStateManager: AdMaxPersistStateManager,
    private readonly brandSpaceService: IBrandSpaceService
  ) {
    this.combinedStore = createCombinedStore([this.knowledgeRulesQueryClient.store] as const);
  }

  private get selectedAdAccountId(): string | undefined {
    return this.persistStateManager.state.selectedAccountId ?? undefined;
  }

  get state() {
    return this.knowledgeRulesQueryClient.store.getState();
  }

  get rules(): AdKnowledgeRule[] {
    return this.state.data || [];
  }

  // ============ IRuleDataProvider Interface Methods ============

  getCreativeRules(): AdKnowledgeRule[] {
    return this.rules.filter((rule) => rule.type === KnowledgeRuleTypeEnum.Creative);
  }

  getTargetingRules(): AdKnowledgeRule[] {
    return this.rules.filter((rule) => rule.type === KnowledgeRuleTypeEnum.Targeting);
  }

  getEvaluationRules(): AdKnowledgeRule[] {
    return this.rules.filter((rule) => rule.type === KnowledgeRuleTypeEnum.Evaluation);
  }

  updateRuleStatus(ruleId: string, _type: string, newStatus: 'approved' | 'declined' | 'pending') {
    if (newStatus === 'approved') {
      this.approveRule(ruleId);
    } else if (newStatus === 'declined') {
      this.declineRule(ruleId);
    }
  }

  // ============ Computed Properties ============

  get lastRuleUpdated(): Date {
    if (this.rules.length === 0) return new Date();
    return new Date(Math.max(...this.rules.map((rule) => new Date(rule.updated_at).getTime())));
  }

  // ============ Rule Operations ============

  private async approveRule(ruleId: string) {
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
  }

  private async declineRule(ruleId: string) {
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
  }

  // ============ Dialog Operations ============

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

  private async submitInstruct(instruction: string, snapshotId: string) {
    const accountId = this.selectedAdAccountId;
    const currentBrand = this.brandSpaceService.storeManager.currentBrand;

    if (!accountId && !currentBrand?.id) {
      throw new Error('Missing account ID or brand ID');
    }

    await submitInsightFeedback({
      account_id: accountId || undefined,
      brand_id: accountId ? undefined : currentBrand?.id,
      snapshot_id: snapshotId,
      user_answer: instruction,
    });
    Toast.success('Instruction submitted successfully');
  }

  // ============ Lifecycle ============

  bootstrap() {
    // Nothing to bootstrap initially
  }

  dispose() {
    this.disposerManager.dispose();
  }
}
