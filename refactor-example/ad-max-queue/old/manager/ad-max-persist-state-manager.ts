import { createStore } from 'zustand';
import { combine, createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { BudgetSettingsRequest } from '../api/admax-setup';
import type { SetupStepEnum } from '../type';

export interface ReviewStructureDraft {
  budget_settings: BudgetSettingsRequest;
  total_monthly_budget: number;
}

export interface PersistedAdMaxState {
  selectedAccountId: string | null;
  currentSetupStep: SetupStepEnum | null;
  setupBrandId: string | null;
  analysisTaskId: string | null;
  reviewStructureDraft: ReviewStructureDraft | null;
}

const initialState: PersistedAdMaxState = {
  selectedAccountId: null,
  currentSetupStep: null,
  setupBrandId: null,
  analysisTaskId: null,
  reviewStructureDraft: null,
};

const STATE_STORAGE_KEY = 'ad-max-persist-state';

export class AdMaxPersistStateManager {
  readonly store = createStore(
    persist(immer(combine(initialState, () => ({}))), {
      name: STATE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    })
  );

  get state() {
    return this.store.getState();
  }

  setState(updater: (state: PersistedAdMaxState) => void) {
    this.store.setState(updater);
  }

  setSelectedAccountId(accountId: string | null) {
    this.setState((state) => {
      state.selectedAccountId = accountId;
    });
  }

  setCurrentSetupStep(step: SetupStepEnum | null) {
    this.setState((state) => {
      state.currentSetupStep = step;
    });
  }

  setSetupBrandId(brandId: string | null) {
    this.setState((state) => {
      state.setupBrandId = brandId;
    });
  }

  setAnalysisTaskId(taskId: string | null) {
    this.setState((state) => {
      state.analysisTaskId = taskId;
    });
  }

  clearSetupState() {
    this.setState((state) => {
      state.currentSetupStep = null;
      state.setupBrandId = null;
      state.analysisTaskId = null;
      state.reviewStructureDraft = null;
    });
  }

  setReviewStructureDraft(draft: ReviewStructureDraft | null) {
    this.setState((state) => {
      state.reviewStructureDraft = draft;
    });
  }

  getReviewStructureDraft(): ReviewStructureDraft | null {
    return this.state.reviewStructureDraft;
  }

  clearReviewStructureDraft() {
    this.setState((state) => {
      state.reviewStructureDraft = null;
    });
  }
}
