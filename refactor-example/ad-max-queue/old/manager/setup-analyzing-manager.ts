import { getTaskStatusWithResult } from '@/feature/common/async_task/api';
import type { IPlatformIntegrationService } from '@/feature/services/experimental/experimental-ads-platform-service/platform-integration-service.type';
import { DisposerManager } from '@/manager/disposer-manager';
import { Emitter } from '@/manager/event-emitter';
import { ProcessingTaskManager } from '@/manager/processing-task-manager';
import { sleep } from '@/util/sleep';
import { createStore } from 'zustand';
import { combine } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { brandColdStartKnowledgeBase, coldStartKnowledgeBase } from '../api/admax-setup';

function getAnalysisSteps(totalDuration: number, hasProductOrCompetitor: boolean) {
  const baseSteps = [{ label: 'Connecting to Meta Ads API' }, { label: 'Analyzing historical campaign data' }];

  const conditionalSteps = hasProductOrCompetitor ? [{ label: 'Analyzing products & competitors' }] : [];

  const finalSteps = [{ label: 'Generating AI recommendations' }];

  const steps = [...baseSteps, ...conditionalSteps, ...finalSteps];

  const stepDuration = Math.floor(totalDuration / steps.length);

  return steps.map((step) => ({
    ...step,
    duration: stepDuration,
  }));
}

const initialState = {
  currentAnalysisStep: 0,
  completedAnalysisSteps: [] as number[],
};

export class SetupAnalyzingManager {
  readonly store = createStore(immer(combine(initialState, () => ({}))));
  private readonly disposerManager = new DisposerManager();
  private readonly processingTaskManager = new ProcessingTaskManager();
  private analysisTimer: ReturnType<typeof setTimeout> | null = null;
  private hasProductOrCompetitor = false;

  private _onAnalysisComplete = new Emitter<void>();
  private _onAnalysisFailed = new Emitter<void>();
  onAnalysisComplete = this._onAnalysisComplete.event;
  onAnalysisFailed = this._onAnalysisFailed.event;

  constructor(private readonly platformIntegrationService: IPlatformIntegrationService) {}

  private get analysisSteps() {
    return getAnalysisSteps(this.mockPollingDuration, this.hasProductOrCompetitor);
  }

  get analysisStepsList() {
    return this.analysisSteps;
  }

  get state() {
    return this.store.getState();
  }

  setState(updater: (state: typeof initialState) => void) {
    this.store.setState(updater);
  }

  startAnalysis() {
    this.setState((state) => {
      state.currentAnalysisStep = 0;
      state.completedAnalysisSteps = [];
    });

    this.processAnalysisStep();
  }

  private processAnalysisStep() {
    const { currentAnalysisStep } = this.state;

    if (currentAnalysisStep >= this.analysisSteps.length) {
      return;
    }

    const stepDuration = this.analysisSteps[currentAnalysisStep].duration;
    this.analysisTimer = setTimeout(() => {
      this.setState((state) => {
        state.completedAnalysisSteps.push(currentAnalysisStep);
        state.currentAnalysisStep = currentAnalysisStep + 1;
      });
      this.processAnalysisStep();
    }, stepDuration);

    // Register timer with disposer manager to ensure cleanup
    this.disposerManager.addDisposeFn(() => {
      if (this.analysisTimer) {
        clearTimeout(this.analysisTimer);
        this.analysisTimer = null;
      }
    });
  }

  async startColdStart(params: {
    accountId?: string;
    brandId?: string;
    productIds?: string[];
    competitorTrackerIds?: string[];
    onTaskIdReceived?: (taskId: string) => void;
  }) {
    this.isPollingActive = true;
    this.hasProductOrCompetitor =
      !!(params.productIds && params.productIds.length > 0) ||
      !!(params.competitorTrackerIds && params.competitorTrackerIds.length > 0);

    // Reset state for new analysis
    this.setState((state) => {
      state.currentAnalysisStep = 0;
      state.completedAnalysisSteps = [];
    });

    let task_id: string;

    try {
      if (params.accountId) {
        // Account flow: use account cold start API
        const payload: {
          account_id?: string;
          product_ids?: string[];
          competitor_tracker_ids?: string[];
        } = {
          product_ids: params.productIds,
          competitor_tracker_ids: params.competitorTrackerIds,
        };

        if (params.accountId) {
          payload.account_id = params.accountId;
        }

        const response = await coldStartKnowledgeBase(payload);
        task_id = response.task_id;
      } else if (params.brandId) {
        // Brand flow: use brand cold start API
        const response = await brandColdStartKnowledgeBase({
          brand_id: params.brandId,
          product_ids: params.productIds,
          competitor_tracker_ids: params.competitorTrackerIds,
        });
        task_id = response.task_id;
      } else {
        throw new Error('Either accountId or brandId is required');
      }

      // Notify callback about task_id
      if (params.onTaskIdReceived) {
        params.onTaskIdReceived(task_id);
      }

      this.pollTaskStatus(task_id);
      this.startMockProgress();
    } catch (error) {
      console.error('Failed to start cold start knowledge base:', error);
      this.isPollingActive = false;
      this.currentPollingTaskId = null;
      this._onAnalysisFailed.fire();
      throw error;
    }
  }

  /**
   * Resume polling for an existing task
   * Used when restoring to AiAnalysis step after page refresh
   */
  async resumePolling(taskId: string, hasProductOrCompetitor: boolean) {
    this.isPollingActive = true;
    this.hasProductOrCompetitor = hasProductOrCompetitor;

    // Check current task status first
    try {
      const currentStatus = await getTaskStatusWithResult(taskId);

      if (currentStatus.status === 'SUCCESS') {
        // Task already completed, fire complete event
        await Promise.allSettled([
          this.platformIntegrationService.metaPlatformManager.organizationAccountManager.fetchAccounts(),
          this.platformIntegrationService.metaPlatformManager.brandAccountManager.fetchAccounts(),
        ]);
        this._onAnalysisComplete.fire();
        this.isPollingActive = false;
        return;
      } else if (currentStatus.status === 'FAILURE' || currentStatus.status === 'REVOKED') {
        // Task failed, fire failed event
        this.isPollingActive = false;
        this._onAnalysisFailed.fire();
        return;
      }

      // Task is still in progress, resume polling
      // Calculate progress based on elapsed time
      // We don't know the exact start time, so we'll estimate based on current status
      const analysisSteps = getAnalysisSteps(this.mockPollingDuration, hasProductOrCompetitor);
      this.mockStartTime = Date.now() - this.mockPollingDuration * 0.5; // Estimate 50% progress

      this.pollTaskStatus(taskId);
      this.startMockProgress();
    } catch (error) {
      console.error('Failed to resume polling:', error);
      this.isPollingActive = false;
      this.currentPollingTaskId = null;
      this._onAnalysisFailed.fire();
    }
  }

  private mockStartTime = 0;
  private mockInterval = 1; // seconds
  private mockPollingDuration = 2 * 60 * 1000; // 2 minutes
  private isPollingActive = false;
  private currentPollingTaskId: string | null = null;

  private async startMockProgress() {
    this.mockStartTime = Date.now();
    const analysisSteps = getAnalysisSteps(this.mockPollingDuration, this.hasProductOrCompetitor);
    let isDoingFakeProgress = true;

    this.disposerManager.addDisposeFn(() => {
      isDoingFakeProgress = false;
    });

    while (isDoingFakeProgress) {
      await sleep(this.mockInterval);
      const pollingDuration = Date.now() - this.mockStartTime;
      const progress = pollingDuration / this.mockPollingDuration;
      const completedSteps = Math.floor(progress * analysisSteps.length);
      const maxStep = analysisSteps.length;
      const currentStep = Math.min(completedSteps, maxStep);

      if (completedSteps >= analysisSteps.length) {
        // All steps completed, mark steps before last as completed, keep last step as current
        this.setState((state) => {
          state.completedAnalysisSteps = Array.from({ length: maxStep }, (_, i) => i);
          state.currentAnalysisStep = maxStep;
        });
        // Continue waiting for actual task completion, don't break
      } else {
        this.setState((state) => {
          state.completedAnalysisSteps = Array.from({ length: currentStep }, (_, i) => i);
          state.currentAnalysisStep = currentStep;
        });
      }
    }
  }

  private async pollTaskStatus(taskId: string) {
    // If already polling the same taskId, skip
    if (this.isPollingActive && this.currentPollingTaskId === taskId) {
      return;
    }

    // If polling a different taskId, cancel the old polling
    if (this.isPollingActive && this.currentPollingTaskId !== taskId) {
      this.processingTaskManager.cancelAll();
    }

    // Set current polling taskId
    this.currentPollingTaskId = taskId;

    const handleTaskSuccess = async () => {
      await Promise.allSettled([
        this.platformIntegrationService.metaPlatformManager.organizationAccountManager.fetchAccounts(),
        this.platformIntegrationService.metaPlatformManager.brandAccountManager.fetchAccounts(),
      ]);
      this._onAnalysisComplete.fire();
      this.currentPollingTaskId = null;
    };
    const poller = this.processingTaskManager.polling(async () => getTaskStatusWithResult(taskId), {
      interval: 2000,
      isFinished: (res) => {
        const isSuccess = res.status === 'SUCCESS';
        const isFailure = res.status === 'FAILURE' || res.status === 'REVOKED';
        const isStop = isSuccess || isFailure;
        if (isSuccess) {
          handleTaskSuccess();
          this.isPollingActive = false;
        } else if (isFailure) {
          this.isPollingActive = false;
          this.currentPollingTaskId = null;
          this._onAnalysisFailed.fire();
        }
        return isStop;
      },
      needInterrupt: (res) => res.status === 'FAILURE' || res.status === 'REVOKED',
    });

    try {
      const result = await poller();

      if (result.status !== 'SUCCESS') {
        throw new Error(result.error || 'Task failed');
      }
    } catch (error) {
      console.error('error', error);
      this.currentPollingTaskId = null;
      this._onAnalysisFailed.fire();
      throw error;
    }
  }

  get analysisProgress() {
    if (this.isPollingActive) {
      const allStepsCompleted = this.state.completedAnalysisSteps.length > this.analysisSteps.length;
      if (allStepsCompleted) {
        return 99;
      }
      const progress = Math.round((this.state.currentAnalysisStep / this.analysisSteps.length) * 100);
      return Math.min(progress, 99);
    }
    const progress = ((this.state.currentAnalysisStep + 1) / this.analysisSteps.length) * 100;
    return Math.min(Math.round(progress), 99);
  }

  get currentAnalysisStepInfo() {
    const { currentAnalysisStep } = this.state;
    return this.analysisSteps[currentAnalysisStep];
  }

  get isAllStepsCompleted() {
    return (
      this.state.currentAnalysisStep === this.analysisSteps.length &&
      this.state.completedAnalysisSteps.length === this.analysisSteps.length
    );
  }

  dispose() {
    if (this.analysisTimer) {
      clearTimeout(this.analysisTimer);
      this.analysisTimer = null;
    }
    this.disposerManager.dispose();
    this.processingTaskManager.cancelAll();
    this.currentPollingTaskId = null;
    this.isPollingActive = false;
  }
}
