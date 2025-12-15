import { tanstackRouter } from '@/.vite/create-router';
import {
  type CombinedStore,
  type ReadonlyStoreApi,
  createCombinedStore,
} from '@/feature/common/experimental/use-combined-store';
import { router } from '@/hook/use-router';
import { DisposerManager } from '@/manager/disposer-manager';
import { createStore } from 'zustand';
import { combine } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { QueuePageTabEnum } from '../../type';
import type { QueueAccountGuard } from '../queue-account-guard';

const initialState = {
  activeTab: QueuePageTabEnum.Creation,
};

type QueueNavigationManagerState = typeof initialState;

export class QueueNavigationManager {
  private readonly store = createStore(immer(combine(initialState, () => ({}))));
  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;

  private readonly disposerManager = new DisposerManager();

  constructor(private readonly queueAccountGuard: QueueAccountGuard) {
    this.combinedStore = createCombinedStore([this.store] as const);
  }

  get state() {
    return this.store.getState();
  }

  private setState(updater: (state: QueueNavigationManagerState) => void) {
    this.store.setState(updater);
  }

  get activeTab() {
    return this.state.activeTab;
  }

  /**
   * Get the tab from current router state
   */
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

  /**
   * Set active tab with guard check
   * Returns true if tab was set, false if blocked by guard
   */
  setActiveTab(tab: QueuePageTabEnum): boolean {
    if (!this.queueAccountGuard.isTabEnabled(tab)) {
      return false;
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

    return true;
  }

  /**
   * Check if a tab is enabled
   */
  isTabEnabled(tab: QueuePageTabEnum): boolean {
    return this.queueAccountGuard.isTabEnabled(tab);
  }

  /**
   * Get guard result for analysis tab
   */
  getAnalysisTabGuardResult() {
    return this.queueAccountGuard.getActionGuardResult('analysis-tab');
  }

  /**
   * Bootstrap navigation manager
   * - Sync initial tab from URL
   * - Listen for router changes
   */
  bootstrap() {
    // Set initial tab from URL
    const initialTab = this.getTabFromRouterState();
    this.setState((state) => {
      state.activeTab = initialTab;
    });

    // Listen for router changes
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

  dispose() {
    this.disposerManager.dispose();
  }
}
