import { Toast } from '@/component/toast/util';
import { AdsPlatformEnum } from '@/feature/account/ads-platform-service/type';
import {
  type CombinedStore,
  type ReadonlyStoreApi,
  createCombinedStore,
} from '@/feature/common/experimental/use-combined-store';
import { getCampaignListV2 } from '@/feature/market-trend/api/campaign';
import { getLibraryFolderById } from '@/feature/resource/assets-library/api/util.client';
import type { LibraryFolderApiItemType, LibraryFolderItemType } from '@/feature/resource/assets-library/type';
import { transformLibraryFolderDetail } from '@/feature/resource/assets-library/util';
import type { IAdsPlatformService } from '@/feature/services/ad-platform-service.type';
import type { IBrandSpaceService } from '@/feature/services/brand-space-service/brand-space-service.type';
import type { IPlatformIntegrationService } from '@/feature/services/experimental/experimental-ads-platform-service/platform-integration-service.type';
import { getToolContentUnderstandingTrackerInfo } from '@/feature/tool.creative-insight/api/util';
import type { ToolContentUnderstandingTrackerInfoType } from '@/feature/tool.creative-insight/util.tracker';
import { getToolContentUnderstandingTrackerInfoData } from '@/feature/tool.creative-insight/util.tracker';
import { getProductFolderInfoByProductId } from '@/feature/tool.url-to-video/api/action.client';
import { router } from '@/hook/use-router';
import { reportEvent } from '@/lib/log/event';
import { DisposerManager } from '@/manager/disposer-manager';
import lodash from 'lodash';
import { createStore } from 'zustand';
import { combine } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { getBrandAdmaxSetup, submitAdMaxSetup } from '../api/admax-setup';
import { getInsightQuestions, submitInsightFeedback } from '../api/campaign-insights';
import { CampaignTypeEnum } from '../api/knowledge-base';
import type { CampaignConfig } from '../type';
import { QueuePageTabEnum, SetupStepEnum } from '../type';
import { AdMaxPersistStateManager } from './ad-max-persist-state-manager';
import { SetupAnalyzingManager } from './setup-analyzing-manager';

const BASE_SETUP_STEPS: SetupStepEnum[] = [
  SetupStepEnum.ConnectAccount,
  SetupStepEnum.ProductSetup,
  SetupStepEnum.AiAnalysis,
  SetupStepEnum.UserInfoCollection,
];

const initialState = {
  isReady: false,
  currentStep: SetupStepEnum.ConnectAccount,
  currentAnalysisStep: 0,
  completedAnalysisSteps: [] as number[],
  campaigns: null as CampaignConfig[] | null,
  initialCampaigns: null as CampaignConfig[] | null,
  selectedProducts: [] as LibraryFolderItemType<LibraryFolderApiItemType>[],
  selectedCompetitors: [] as ToolContentUnderstandingTrackerInfoType[],
  tempSelectedAdAccountId: null as string | null,
  userInfoQuestions: '',
  userInfoAnswer: '',
  userInfoSnapshotId: null as string | null,
  isUserInfoLoading: false,
  isSubmittingUserInfo: false,
  visibleSteps: [...BASE_SETUP_STEPS],
};

export class SetupPageViewController {
  readonly store = createStore(immer(combine(initialState, () => ({}))));
  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;
  private readonly disposerManager = new DisposerManager();
  private readonly setupAnalyzingManager: SetupAnalyzingManager;
  readonly persistStateManager = new AdMaxPersistStateManager();

  constructor(
    private readonly adsPlatformService: IAdsPlatformService,
    private readonly platformIntegrationService: IPlatformIntegrationService,
    private readonly brandSpaceService: IBrandSpaceService
  ) {
    this.setupAnalyzingManager = new SetupAnalyzingManager(this.platformIntegrationService);
    this.combinedStore = createCombinedStore([
      this.adsPlatformService.store,
      this.store,
      this.persistStateManager.store,
    ] as const);
  }

  get visibleSteps() {
    return this.state.visibleSteps;
  }

  private shouldShowReviewStructureStep() {
    // Show review structure step for both brand and account flows
    return true;
  }

  private shouldShowTemplateConfigStep() {
    // Only show template config for account flow
    return Boolean(this.selectedAdAccountId);
  }

  private computeVisibleSteps(): SetupStepEnum[] {
    const steps = [...BASE_SETUP_STEPS];
    if (this.shouldShowReviewStructureStep()) {
      steps.push(SetupStepEnum.ReviewStructure);
    }
    if (this.shouldShowTemplateConfigStep()) {
      steps.push(SetupStepEnum.TemplateConfig);
    }
    return steps;
  }

  private syncVisibleSteps() {
    const steps = this.computeVisibleSteps();
    this.setState((state) => {
      state.visibleSteps = steps;
      if (!steps.includes(state.currentStep)) {
        state.currentStep = steps[steps.length - 1] ?? SetupStepEnum.ConnectAccount;
      }
    });
  }

  get state() {
    return this.store.getState();
  }

  setState(updater: (state: typeof initialState) => void) {
    this.store.setState(updater);
  }

  private async setCurrentStep(step: SetupStepEnum) {
    this.setState((state) => {
      state.currentStep = step;
    });
    // Persist current step to localStorage
    this.persistStateManager.setCurrentSetupStep(step);
    // Persist flow type for cache recovery
    const selectedAdAccountId = this.selectedAdAccountId;
    if (!selectedAdAccountId) {
      // Brand flow: persist brand ID
      const currentBrand = this.brandSpaceService.storeManager.currentBrand;
      if (currentBrand?.id) {
        this.persistStateManager.setSetupBrandId(currentBrand.id);
      }
    } else {
      // Account flow: clear brand ID to indicate account flow
      this.persistStateManager.setSetupBrandId(null);
    }
    // Load necessary data for the new step
    // This ensures that when navigating between steps, all required data is loaded
    await this.loadDataForStep(step);
  }

  get selectedAdAccountId() {
    // Priority: tempSelectedAdAccountId > persistStateManager.selectedAccountId
    // This allows setup flow to use temporary selection without affecting persist store
    const tempId = this.state.tempSelectedAdAccountId;
    if (tempId !== null) {
      return tempId;
    }

    const persistId = this.persistStateManager.state.selectedAccountId;
    if (persistId === null) {
      return null;
    }

    // Verify that the persisted account ID still exists in the account list
    const metaAccounts = this.adsPlatformService.state.metaAdsAccount?.list || [];
    const visibleAccounts = metaAccounts.filter((account) => !account.is_hidden);
    const accountExists = visibleAccounts.some((account) => account.__account_id === persistId);

    if (!accountExists) {
      // Account no longer exists, clear persist state
      this.persistStateManager.setSelectedAccountId(null);
      return null;
    }

    return persistId;
  }

  get isAdAccountConnected() {
    if (!this.state.isReady) return false;
    // const metaAccounts = this.adsPlatformService.store.getState().metaAdsAccount?.list || [];
    // return metaAccounts.length > 0;
    const metaPlatform = this.adsPlatformService.state.platforms.find((p) => p.platform === AdsPlatformEnum.Meta);
    return Boolean(metaPlatform?.connected);
  }

  get isSelectedAccountSetupComplete() {
    if (!this.state.isReady || !this.selectedAdAccountId) return false;
    const metaAccounts = this.adsPlatformService.state.metaAdsAccount?.list || [];
    const selectedAccount = metaAccounts.find((acc) => acc.__account_id === this.selectedAdAccountId);
    return selectedAccount?.is_setup_complete === true;
  }

  get isBrandSetupComplete() {
    if (!this.state.isReady) return false;
    // If account is selected, this is not brand flow
    if (this.selectedAdAccountId) return false;
    // Check if brand setup cache indicates completion
    return this.brandAdmaxSetupCache?.is_setup_complete === true;
  }

  get isSetupComplete() {
    // Check if either account or brand setup is complete
    return this.isSelectedAccountSetupComplete || this.isBrandSetupComplete;
  }

  getInPageNavigateHandler() {
    const { currentStep } = this.state;
    const navigateMap: Record<
      SetupStepEnum,
      { goPrev: () => void | Promise<void>; goNext: () => void | Promise<void> }
    > = {
      [SetupStepEnum.ConnectAccount]: {
        goPrev: lodash.noop,
        goNext: async () => {
          await this.setCurrentStep(SetupStepEnum.ProductSetup);
        },
      },
      [SetupStepEnum.ProductSetup]: {
        goPrev: async () => {
          await this.setCurrentStep(SetupStepEnum.ConnectAccount);
        },
        goNext: async () => {
          try {
            await this.startAnalysis();
            await this.setCurrentStep(SetupStepEnum.AiAnalysis);
          } catch (error) {
            console.error('Failed to start analysis:', error);
            Toast.error('Failed to start analysis. Please check your inputs and try again.');
          }
        },
      },
      [SetupStepEnum.AiAnalysis]: {
        goPrev: async () => {
          await this.setCurrentStep(SetupStepEnum.ProductSetup);
        },
        goNext: () => {
          // ignore
        },
      },
      [SetupStepEnum.UserInfoCollection]: {
        goPrev: async () => {
          await this.setCurrentStep(SetupStepEnum.ProductSetup);
        },
        goNext: async () => {
          if (this.shouldShowReviewStructureStep()) {
            await this.setCurrentStep(SetupStepEnum.ReviewStructure);
          } else {
            await this.completeAccountlessSetup();
          }
        },
      },
      [SetupStepEnum.ReviewStructure]: {
        goPrev: async () => {
          // setCurrentStep will automatically load necessary data for UserInfoCollection step
          await this.setCurrentStep(SetupStepEnum.UserInfoCollection);
        },
        goNext: async () => {
          await this.saveCampaignStructure();
          if (this.shouldShowTemplateConfigStep()) {
            await this.setCurrentStep(SetupStepEnum.TemplateConfig);
          } else {
            await this.completeAccountlessSetup();
          }
        },
      },
      [SetupStepEnum.TemplateConfig]: {
        goPrev: async () => {
          if (this.shouldShowReviewStructureStep()) {
            await this.setCurrentStep(SetupStepEnum.ReviewStructure);
          } else {
            // Should not happen, but fallback to UserInfoCollection
            await this.setCurrentStep(SetupStepEnum.UserInfoCollection);
          }
        },
        goNext: () => {
          this.completeSetup();
        },
      },
    };
    return navigateMap[currentStep];
  }

  selectAdAccount(accountId: string | null) {
    const currentAccountId = this.selectedAdAccountId;
    const isChangingAccount = currentAccountId && currentAccountId !== accountId;

    // Only update temporary state during setup, don't modify persist store
    this.setState((state) => {
      state.tempSelectedAdAccountId = accountId;
    });
    // Clear campaign data when switching accounts to avoid confusion
    if (isChangingAccount) {
      this.setState((state) => {
        state.campaigns = null;
        state.initialCampaigns = null;
        // Clear products and competitors when switching accounts
        state.selectedProducts = [];
        state.selectedCompetitors = [];
      });
      // Clear brand admax setup cache when switching accounts
      this.brandAdmaxSetupCache = null;
      // Clear setup state when switching accounts
      this.persistStateManager.clearSetupState();
    }

    // Load saved products and competitors when account changes
    // Skip if brand flow and already have cache and data loaded
    if (accountId === null && !isChangingAccount && this.brandAdmaxSetupCache) {
      const hasProducts = this.state.selectedProducts.length > 0;
      const hasCompetitors = this.state.selectedCompetitors.length > 0;
      if (hasProducts || hasCompetitors) {
        // Data already loaded, skip
        this.syncVisibleSteps();
        return;
      }
    }
    this.loadSavedProductsAndCompetitors(accountId, !!isChangingAccount);
    this.syncVisibleSteps();
  }

  setSelectedProducts(products: LibraryFolderItemType<LibraryFolderApiItemType>[]) {
    this.setState((state) => {
      state.selectedProducts = products;
    });
  }

  setSelectedCompetitors(competitors: ToolContentUnderstandingTrackerInfoType[]) {
    this.setState((state) => {
      state.selectedCompetitors = competitors;
    });
  }

  removeProduct(productId: string) {
    this.setState((state) => {
      state.selectedProducts = state.selectedProducts.filter((p) => p.id !== productId);
    });
  }

  removeCompetitor(pageId: string) {
    this.setState((state) => {
      state.selectedCompetitors = state.selectedCompetitors.filter((c) => c.page_id !== pageId);
    });
  }

  async loadSavedProductsAndCompetitors(accountId: string | null, clearExisting: boolean = false) {
    let productIds: string[] = [];
    let trackerIds: string[] = [];

    if (!accountId) {
      // Brand flow: use cached data or fetch from brand API
      try {
        let brandAdmaxSetup = this.brandAdmaxSetupCache;

        // If no cache, fetch from API
        if (!brandAdmaxSetup) {
          const currentBrand = this.brandSpaceService.storeManager.currentBrand;
          brandAdmaxSetup = await getBrandAdmaxSetup({
            brand_id: currentBrand?.id,
          });
          this.brandAdmaxSetupCache = brandAdmaxSetup;
        }

        productIds = Array.from(new Set(brandAdmaxSetup.ecommerce_products || []));
        trackerIds = Array.from(new Set(brandAdmaxSetup.content_understanding_trackers || []));

        // If no products/competitors and not clearing, skip loading
        if (productIds.length === 0 && trackerIds.length === 0) {
          if (clearExisting) {
            this.setSelectedProducts([]);
            this.setSelectedCompetitors([]);
          }
          return;
        }
      } catch (error) {
        console.error('Failed to fetch brand admax setup:', error);
        if (clearExisting) {
          this.setSelectedProducts([]);
          this.setSelectedCompetitors([]);
        }
        return;
      }
    } else {
      // Account flow: use existing logic
      const metaAccounts = this.adsPlatformService.state.metaAdsAccount?.list || [];
      const selectedAccount = metaAccounts.find((acc) => acc.__account_id === accountId);

      if (!selectedAccount) return;

      productIds = Array.from(new Set(selectedAccount.ecommerce_products || []));
      trackerIds = Array.from(new Set(selectedAccount.content_understanding_trackers || []));

      if (productIds.length === 0 && trackerIds.length === 0) {
        if (clearExisting) {
          this.setSelectedProducts([]);
          this.setSelectedCompetitors([]);
        }
        return;
      }
    }

    try {
      // Load products
      if (productIds.length > 0) {
        const productPromises = productIds.map(async (productId) => {
          try {
            // First get folder ID from product ID
            const folderInfo = await getProductFolderInfoByProductId({ product: productId });
            if (!folderInfo?.id) {
              return null;
            }

            // Then get complete folder data with assets
            const folderData = await getLibraryFolderById(folderInfo.id, { with_assets: true, exp: true });
            if (folderData) {
              return transformLibraryFolderDetail(folderData);
            }
            return null;
          } catch (error) {
            console.error(`Failed to load product ${productId}:`, error);
            return null;
          }
        });

        const loadedProducts = (await Promise.all(productPromises)).filter(
          (p): p is LibraryFolderItemType<LibraryFolderApiItemType> => p !== null
        );

        // Deduplicate loaded products by id to avoid duplicates from API
        const uniqueLoadedProducts = Array.from(new Map(loadedProducts.map((p) => [p.id, p])).values());

        if (uniqueLoadedProducts.length > 0) {
          if (clearExisting) {
            // Replace existing products when switching accounts
            this.setSelectedProducts(uniqueLoadedProducts);
          } else {
            // Merge with existing products, avoiding duplicates
            const currentProducts = this.state.selectedProducts;
            const existingProductIds = new Set(currentProducts.map((p) => p.id));
            const uniqueNewProducts = uniqueLoadedProducts.filter((p) => !existingProductIds.has(p.id));
            this.setSelectedProducts([...currentProducts, ...uniqueNewProducts]);
          }
        } else if (clearExisting) {
          this.setSelectedProducts([]);
        }
      } else if (clearExisting) {
        this.setSelectedProducts([]);
      }

      // Load competitors (trackers)
      if (trackerIds.length > 0) {
        const trackerPromises = trackerIds.map(async (trackerId) => {
          try {
            const trackerData = await getToolContentUnderstandingTrackerInfo(trackerId);
            if (trackerData) {
              return getToolContentUnderstandingTrackerInfoData(trackerData);
            }
            return null;
          } catch (error) {
            console.error(`Failed to load tracker ${trackerId}:`, error);
            return null;
          }
        });

        const loadedTrackers = (await Promise.all(trackerPromises)).filter(
          (t): t is ToolContentUnderstandingTrackerInfoType => t !== null
        );

        // Deduplicate loaded trackers by page_id to avoid duplicates from API
        const uniqueLoadedTrackers = Array.from(new Map(loadedTrackers.map((t) => [t.page_id, t])).values());

        if (uniqueLoadedTrackers.length > 0) {
          if (clearExisting) {
            // Replace existing competitors when switching accounts
            this.setSelectedCompetitors(uniqueLoadedTrackers);
          } else {
            // Merge with existing competitors, avoiding duplicates by page_id
            const currentCompetitors = this.state.selectedCompetitors;
            const existingPageIds = new Set(currentCompetitors.map((c) => c.page_id));
            const uniqueNewTrackers = uniqueLoadedTrackers.filter((t) => !existingPageIds.has(t.page_id));
            this.setSelectedCompetitors([...currentCompetitors, ...uniqueNewTrackers]);
          }
        } else if (clearExisting) {
          this.setSelectedCompetitors([]);
        }
      } else if (clearExisting) {
        this.setSelectedCompetitors([]);
      }
    } catch (error) {
      console.error('Failed to load saved products and competitors:', error);
    }
  }

  async handleClickNextOnConnectAccountSection() {
    await this.getInPageNavigateHandler().goNext();
  }

  async startAnalysis() {
    const selectedAdAccountId = this.selectedAdAccountId;
    const { selectedProducts, selectedCompetitors } = this.state;

    const currentBrand = this.brandSpaceService.storeManager.currentBrand;

    await this.setupAnalyzingManager.startColdStart({
      accountId: selectedAdAccountId ?? undefined,
      brandId: selectedAdAccountId ? undefined : currentBrand?.id,
      productIds: selectedProducts.map((p) => p.product || p.id),
      competitorTrackerIds: selectedCompetitors.map((c) => c.page_id),
      onTaskIdReceived: (taskId) => {
        // Save task_id to persist state so we can resume polling after refresh
        this.persistStateManager.setAnalysisTaskId(taskId);
      },
    });
    this.setupAnalyzingManager.startAnalysis();
  }

  get analysisProgress() {
    return this.setupAnalyzingManager.analysisProgress;
  }

  get currentAnalysisStepInfo() {
    return this.setupAnalyzingManager.currentAnalysisStepInfo;
  }

  get isAllStepsCompleted() {
    return this.setupAnalyzingManager.isAllStepsCompleted;
  }

  get analysisSteps() {
    return this.setupAnalyzingManager.analysisStepsList;
  }

  updateCampaignBudget(campaignType: CampaignTypeEnum, newBudget: number) {
    this.setState((state) => {
      if (!state.campaigns) return;
      const updatedCampaigns = state.campaigns.map((c) => (c.type === campaignType ? { ...c, budget: newBudget } : c));
      const newTotal = updatedCampaigns.reduce((sum, c) => sum + c.budget, 0);
      state.campaigns = updatedCampaigns.map((c) => ({
        ...c,
        percent: Math.round((c.budget / newTotal) * 100),
      }));
    });
  }

  updateCampaignPercent(campaignType: CampaignTypeEnum, newPercent: number) {
    this.setState((state) => {
      if (!state.campaigns) return;

      const totalBudget = state.campaigns.reduce((sum, c) => sum + c.budget, 0);
      const targetCampaign = state.campaigns.find((c) => c.type === campaignType);
      if (!targetCampaign) return;

      // Only adjust visible campaigns (exclude retargeting)
      const visibleCampaigns = state.campaigns.filter((c) => c.type !== CampaignTypeEnum.RETARGETING);
      const otherVisibleCampaigns = visibleCampaigns.filter((c) => c.type !== campaignType);

      // Calculate what percentage is left for other visible campaigns
      const remainingPercentForOthers = 100 - newPercent;

      // If only one other visible campaign, it gets all remaining percent
      if (otherVisibleCampaigns.length === 1) {
        state.campaigns = state.campaigns.map((c) => {
          if (c.type === CampaignTypeEnum.RETARGETING) {
            return c;
          } else if (c.type === campaignType) {
            const budget = Math.round((totalBudget * newPercent) / 100);
            return { ...c, percent: newPercent, budget };
          } else {
            const budget = totalBudget - Math.round((totalBudget * newPercent) / 100);
            return { ...c, percent: remainingPercentForOthers, budget };
          }
        });
        return;
      }

      // Multiple other campaigns: distribute remaining percentage proportionally
      const otherTotalOldPercent = otherVisibleCampaigns.reduce((sum, c) => sum + c.percent, 0);

      let accumulatedPercent = newPercent;
      let accumulatedBudget = 0;

      state.campaigns = state.campaigns.map((c, index, arr) => {
        if (c.type === CampaignTypeEnum.RETARGETING) {
          return c;
        } else if (c.type === campaignType) {
          const budget = Math.round((totalBudget * newPercent) / 100);
          accumulatedBudget += budget;
          return { ...c, percent: newPercent, budget };
        } else {
          // For last visible campaign, use remaining to ensure exact 100%
          const isLastVisible =
            index === arr.length - 1 ||
            (index === arr.length - 2 && arr[arr.length - 1].type === CampaignTypeEnum.RETARGETING);

          if (isLastVisible) {
            const remainingPercent = 100 - accumulatedPercent;
            const remainingBudget = totalBudget - accumulatedBudget;
            return { ...c, percent: remainingPercent, budget: remainingBudget };
          } else {
            // Proportionally distribute
            const ratio =
              otherTotalOldPercent > 0 ? c.percent / otherTotalOldPercent : 1 / otherVisibleCampaigns.length;
            const newOtherPercent = Math.round(remainingPercentForOthers * ratio);
            const budget = Math.round((totalBudget * newOtherPercent) / 100);
            accumulatedPercent += newOtherPercent;
            accumulatedBudget += budget;
            return { ...c, percent: newOtherPercent, budget };
          }
        }
      });
    });
  }

  get totalBudget() {
    const { campaigns } = this.state;
    if (!campaigns) return 0;
    // Only sum visible campaigns (exclude retargeting)
    return campaigns.filter((c) => c.type !== CampaignTypeEnum.RETARGETING).reduce((sum, c) => sum + c.budget, 0);
  }

  updateTotalBudget(newTotalBudget: number) {
    this.setState((state) => {
      if (!state.campaigns || newTotalBudget <= 0) return;

      // Only visible campaigns (exclude retargeting) should be recalculated
      const visibleCampaigns = state.campaigns.filter((c) => c.type !== CampaignTypeEnum.RETARGETING);

      // Calculate total percentage of visible campaigns
      const visibleTotalPercent = visibleCampaigns.reduce((sum, c) => sum + c.percent, 0);

      // Normalize percentages if they don't sum to 100%
      const needsNormalization = Math.abs(visibleTotalPercent - 100) > 0.5;

      let accumulatedBudget = 0;
      let accumulatedPercent = 0;

      state.campaigns = state.campaigns.map((c) => {
        if (c.type === CampaignTypeEnum.RETARGETING) {
          // Keep retargeting unchanged
          return c;
        }

        // Check if this is the last visible campaign
        const visibleIndex = visibleCampaigns.findIndex((vc) => vc.type === c.type);
        const isLastVisible = visibleIndex === visibleCampaigns.length - 1;

        if (isLastVisible) {
          // Last visible campaign gets remaining budget to ensure exact total
          const remainingBudget = newTotalBudget - accumulatedBudget;

          if (needsNormalization) {
            // Only update percent if normalization is needed
            const remainingPercent = 100 - accumulatedPercent;
            return { ...c, budget: remainingBudget, percent: remainingPercent };
          } else {
            // Keep percent unchanged
            return { ...c, budget: remainingBudget };
          }
        } else {
          // Normalize percent if needed, otherwise keep unchanged
          const normalizedPercent =
            needsNormalization && visibleTotalPercent > 0
              ? Math.round((c.percent / visibleTotalPercent) * 100)
              : c.percent;

          const newBudget = Math.round((newTotalBudget * normalizedPercent) / 100);
          accumulatedBudget += newBudget;
          accumulatedPercent += normalizedPercent;

          if (needsNormalization) {
            return { ...c, budget: newBudget, percent: normalizedPercent };
          } else {
            return { ...c, budget: newBudget };
          }
        }
      });
    });
  }

  linkCampaigns(campaignMappings: Record<CampaignTypeEnum, { campaignId: string; campaignName: string } | null>) {
    this.setState((state) => {
      if (!state.campaigns) return;

      state.campaigns = state.campaigns.map((campaign) => {
        const mapping = campaignMappings[campaign.type];
        if (mapping) {
          // Update linked campaign info
          return {
            ...campaign,
            campaignIds: [mapping.campaignId],
            linkedCampaignName: mapping.campaignName,
          };
        } else if (mapping === null && campaign.type in campaignMappings) {
          // Only clear if explicitly set to null in mappings (user wants to unlink)
          return {
            ...campaign,
            campaignIds: [],
            linkedCampaignName: undefined,
          };
        } else {
          // Keep existing campaign unchanged (e.g., RETARGETING not in mappings)
          return campaign;
        }
      });
    });
  }

  async saveCampaignStructure() {
    const { campaigns } = this.state;
    const selectedAdAccountId = this.selectedAdAccountId;

    if (!campaigns) {
      Toast.error('Please complete the campaign structure setup');
      throw new Error('Campaign structure is incomplete');
    }

    try {
      // totalBudget is monthly budget in dollars, send as is (no longer cents)
      const totalMonthlyBudget = this.totalBudget;

      // Build budget settings with campaign mappings
      const scalingCampaign = campaigns.find((c) => c.type === CampaignTypeEnum.SCALE);
      const retargetingCampaign = campaigns.find((c) => c.type === CampaignTypeEnum.RETARGETING);
      const testingCampaign = campaigns.find((c) => c.type === CampaignTypeEnum.TESTING);

      const budgetSettings = {
        scaling: {
          campaign_ids: scalingCampaign?.campaignIds || [],
          pct: scalingCampaign ? scalingCampaign.percent * 100 : 0,
        },
        retargeting: {
          campaign_ids: [],
          pct: 0,
        },
        testing: {
          campaign_ids: testingCampaign?.campaignIds || [],
          pct: testingCampaign ? testingCampaign.percent * 100 : 0,
        },
      };

      if (selectedAdAccountId) {
        // Account flow: Save draft instead of calling API
        // Draft will be submitted together with launch_config in Template Config step
        this.persistStateManager.setReviewStructureDraft({
          budget_settings: budgetSettings,
          total_monthly_budget: totalMonthlyBudget,
        });
        Toast.success('Campaign structure saved');
      } else {
        // Accountless flow: Submit immediately with complete payload
        // Brand is automatically retrieved from request.user.current_notnull_brand on backend
        await submitAdMaxSetup({
          platform: 'meta',
          budget_settings: budgetSettings,
          total_monthly_budget: totalMonthlyBudget,
        });
        Toast.success('Campaign structure saved successfully');
      }
    } catch (error) {
      console.error('Failed to save campaign structure:', error);
      Toast.error('Failed to save campaign structure. Please try again.');
      throw error;
    }
  }

  private finalizeSetupNavigation() {
    Toast.success('AdMax setup completed successfully');
    // Clear setup state after completion
    this.persistStateManager.clearSetupState();
    Promise.allSettled([
      this.adsPlatformService.refetchBrandData(),
      this.adsPlatformService.refetchOrganizationAdsAccountData(),
    ]);
    router.navigate({
      to: '/tool/ad-max/queue',
      search: {
        tab: QueuePageTabEnum.Knowledge,
      },
    });
  }

  private async completeAccountlessSetup() {
    try {
      this.finalizeSetupNavigation();
    } catch (error) {
      console.error('Failed to complete setup:', error);
      Toast.error('Failed to complete setup. Please try again.');
    }
  }

  async completeSetup() {
    const { campaigns } = this.state;
    const selectedAdAccountId = this.selectedAdAccountId;

    if (!campaigns || !selectedAdAccountId) {
      Toast.error('Please complete the campaign structure setup');
      return;
    }

    try {
      // Save the temporary accountId to persist store when setup is completed
      this.persistStateManager.setSelectedAccountId(selectedAdAccountId);

      // Campaign structure should already be saved in Review Structure step
      // Just navigate to queue page
      this.finalizeSetupNavigation();
    } catch (error) {
      console.error('Failed to complete setup:', error);
      Toast.error('Failed to complete setup. Please try again.');
    }
  }

  skipToQueue() {
    // When skipping setup, the account is already complete, so save to persist store
    const selectedAdAccountId = this.selectedAdAccountId;
    if (selectedAdAccountId) {
      this.persistStateManager.setSelectedAccountId(selectedAdAccountId);
    }

    // Clear setup state when skipping
    this.persistStateManager.clearSetupState();

    router.navigate({
      to: '/tool/ad-max/queue',
      search: {
        tab: QueuePageTabEnum.Knowledge,
      },
    });
  }

  async skipAnalysis() {
    this.setupAnalyzingManager.dispose();
    // Clear saved task_id since we're skipping analysis
    this.persistStateManager.setAnalysisTaskId(null);

    const selectedAdAccountId = this.selectedAdAccountId;

    let budgetSettings: any = null;
    let totalMonthlyBudget = 10000;

    if (selectedAdAccountId) {
      // Account flow: get data from account
      const metaAccounts = this.adsPlatformService.state.metaAdsAccount?.list || [];
      const selectedAccount = metaAccounts.find((acc) => acc.__account_id === selectedAdAccountId);
      budgetSettings = selectedAccount?.budget_settings;
      totalMonthlyBudget = selectedAccount?.total_monthly_budget || 10000;
    } else if (this.brandAdmaxSetupCache) {
      // Brand flow: use cached data
      budgetSettings = this.brandAdmaxSetupCache.budget_settings;
      totalMonthlyBudget = this.brandAdmaxSetupCache.total_monthly_budget || 10000;
    }

    const defaultBudgetSettings = {
      scaling: { pct: 5000, campaign_ids: [] },
      retargeting: { pct: 3000, campaign_ids: [] },
      testing: { pct: 2000, campaign_ids: [] },
    };

    const settings = budgetSettings || defaultBudgetSettings;

    const scalingPct = settings.scaling.pct / 100;
    const retargetingPct = settings.retargeting.pct / 100;
    const testingPct = settings.testing.pct / 100;

    const scalingBudget = Math.round((totalMonthlyBudget * scalingPct) / 100);
    const retargetingBudget = Math.round((totalMonthlyBudget * retargetingPct) / 100);
    const testingBudget = Math.round((totalMonthlyBudget * testingPct) / 100);

    const allCampaignIds = [
      ...(settings.scaling.campaign_ids || []),
      ...(settings.retargeting.campaign_ids || []),
      ...(settings.testing.campaign_ids || []),
    ];

    const campaignNameMap =
      allCampaignIds.length > 0 && selectedAdAccountId
        ? await this.loadCampaignNames(allCampaignIds, selectedAdAccountId!)
        : new Map<string, string>();

    const campaignsData: CampaignConfig[] = [
      {
        type: CampaignTypeEnum.SCALE,
        budget: scalingBudget,
        percent: Math.round(scalingPct),
        campaignIds: settings.scaling.campaign_ids || [],
        linkedCampaignName: settings.scaling.campaign_ids?.[0] && campaignNameMap.get(settings.scaling.campaign_ids[0]),
      },
      {
        type: CampaignTypeEnum.RETARGETING,
        budget: retargetingBudget,
        percent: Math.round(retargetingPct),
        campaignIds: settings.retargeting.campaign_ids || [],
        linkedCampaignName:
          settings.retargeting.campaign_ids?.[0] && campaignNameMap.get(settings.retargeting.campaign_ids[0]),
      },
      {
        type: CampaignTypeEnum.TESTING,
        budget: testingBudget,
        percent: Math.round(testingPct),
        campaignIds: settings.testing.campaign_ids || [],
        linkedCampaignName: settings.testing.campaign_ids?.[0] && campaignNameMap.get(settings.testing.campaign_ids[0]),
      },
    ];

    this.setState((s) => {
      s.campaigns = campaignsData;
      s.initialCampaigns = JSON.parse(JSON.stringify(campaignsData));
    });
    await this.setCurrentStep(SetupStepEnum.UserInfoCollection);

    await this.loadUserInfoQuestions();
  }

  private async loadCampaignNames(campaignIds: string[], adAccountId: string): Promise<Map<string, string>> {
    const campaignNameMap = new Map<string, string>();

    if (campaignIds.length === 0) {
      return campaignNameMap;
    }

    try {
      // Fetch campaign details for all IDs
      const response = await getCampaignListV2({
        platform: AdsPlatformEnum.Meta,
        advertiser_id: adAccountId,
      });

      const campaigns = response.results || [];

      // Build a map of campaign_id -> name
      for (const campaign of campaigns) {
        if (campaignIds.includes(campaign.campaign_id)) {
          campaignNameMap.set(campaign.campaign_id, campaign.name);
        }
      }
    } catch (error) {
      console.error('Failed to load campaign names:', error);
    }

    return campaignNameMap;
  }

  /**
   * Load campaigns data from account or brand budget settings
   * This is used when restoring to ReviewStructure step
   */
  private async loadCampaignsFromBudgetSettings(): Promise<void> {
    const selectedAdAccountId = this.selectedAdAccountId;

    let budgetSettings: any = null;
    let totalMonthlyBudget = 10000;

    // First, check if there's a saved draft (for account flow)
    const draft = this.persistStateManager.getReviewStructureDraft();
    if (draft && selectedAdAccountId) {
      // Use draft data if available (account flow only)
      budgetSettings = draft.budget_settings;
      totalMonthlyBudget = draft.total_monthly_budget;
    } else if (selectedAdAccountId) {
      // Account flow: get data from account
      const metaAccounts = this.adsPlatformService.state.metaAdsAccount?.list || [];
      const selectedAccount = metaAccounts.find((acc) => acc.__account_id === selectedAdAccountId);
      budgetSettings = selectedAccount?.budget_settings;
      totalMonthlyBudget = selectedAccount?.total_monthly_budget || 10000;
    } else if (this.brandAdmaxSetupCache) {
      // Brand flow: use cached data
      budgetSettings = this.brandAdmaxSetupCache.budget_settings;
      totalMonthlyBudget = this.brandAdmaxSetupCache.total_monthly_budget || 10000;
    }

    // Default budget settings matching backend structure (in basis points)
    const defaultBudgetSettings = {
      scaling: { pct: 5000, campaign_ids: [] }, // 50%
      retargeting: { pct: 3000, campaign_ids: [] }, // 30%
      testing: { pct: 2000, campaign_ids: [] }, // 20%
    };

    // Use real data or defaults (both use same backend structure)
    const settings = budgetSettings || defaultBudgetSettings;

    // Convert pct from basis points (0-10000) to percentage (0-100)
    const scalingPct = settings.scaling.pct / 100;
    const retargetingPct = settings.retargeting.pct / 100;
    const testingPct = settings.testing.pct / 100;

    // Calculate dollar amounts from percentages
    const scalingBudget = Math.round((totalMonthlyBudget * scalingPct) / 100);
    const retargetingBudget = Math.round((totalMonthlyBudget * retargetingPct) / 100);
    const testingBudget = Math.round((totalMonthlyBudget * testingPct) / 100);

    // Collect all campaign IDs that need names
    const allCampaignIds = [
      ...(settings.scaling.campaign_ids || []),
      ...(settings.retargeting.campaign_ids || []),
      ...(settings.testing.campaign_ids || []),
    ];

    // Load campaign names if there are linked campaigns
    const campaignNameMap =
      allCampaignIds.length > 0 && selectedAdAccountId
        ? await this.loadCampaignNames(allCampaignIds, selectedAdAccountId)
        : new Map<string, string>();

    const campaignsData: CampaignConfig[] = [
      {
        type: CampaignTypeEnum.SCALE,
        budget: scalingBudget,
        percent: Math.round(scalingPct),
        campaignIds: settings.scaling.campaign_ids || [],
        linkedCampaignName: settings.scaling.campaign_ids?.[0] && campaignNameMap.get(settings.scaling.campaign_ids[0]),
      },
      {
        type: CampaignTypeEnum.RETARGETING,
        budget: retargetingBudget,
        percent: Math.round(retargetingPct),
        campaignIds: settings.retargeting.campaign_ids || [],
        linkedCampaignName:
          settings.retargeting.campaign_ids?.[0] && campaignNameMap.get(settings.retargeting.campaign_ids[0]),
      },
      {
        type: CampaignTypeEnum.TESTING,
        budget: testingBudget,
        percent: Math.round(testingPct),
        campaignIds: settings.testing.campaign_ids || [],
        linkedCampaignName: settings.testing.campaign_ids?.[0] && campaignNameMap.get(settings.testing.campaign_ids[0]),
      },
    ];

    this.setState((s) => {
      s.campaigns = campaignsData;
      // Save initial campaigns for "Why This Structure" display
      s.initialCampaigns = JSON.parse(JSON.stringify(campaignsData));
    });
  }

  /**
   * Load necessary data for a specific step when restoring
   * This ensures that when user refreshes and restores to a step, all required data is loaded
   */
  private async loadDataForStep(step: SetupStepEnum): Promise<void> {
    switch (step) {
      case SetupStepEnum.ReviewStructure:
        // ReviewStructure needs campaigns data
        if (!this.state.campaigns) {
          await this.loadCampaignsFromBudgetSettings();
        }
        break;

      case SetupStepEnum.UserInfoCollection:
        // UserInfoCollection needs questions
        // Always fetch fresh questions from API when entering this step
        // Questions are generated based on current account/brand analysis, so they should be fresh
        if (!this.state.isUserInfoLoading) {
          await this.loadUserInfoQuestions(true); // Force reload to get fresh questions
        }
        break;

      case SetupStepEnum.ProductSetup: {
        // ProductSetup needs products and competitors
        // These should already be loaded in bootstrap, but ensure they're loaded
        const selectedAdAccountId = this.selectedAdAccountId;
        if (
          this.state.selectedProducts.length === 0 &&
          this.state.selectedCompetitors.length === 0 &&
          (selectedAdAccountId || this.brandAdmaxSetupCache)
        ) {
          await this.loadSavedProductsAndCompetitors(selectedAdAccountId, false);
        }
        break;
      }

      case SetupStepEnum.AiAnalysis: {
        // AiAnalysis step: check if we need to resume polling
        const savedTaskId = this.persistStateManager.state.analysisTaskId;
        const hasProductOrCompetitor =
          this.state.selectedProducts.length > 0 || this.state.selectedCompetitors.length > 0;

        if (savedTaskId) {
          // Resume polling for existing task
          try {
            await this.setupAnalyzingManager.resumePolling(savedTaskId, hasProductOrCompetitor);
          } catch (error) {
            console.error('Failed to resume polling:', error);
            // Clear invalid task_id
            this.persistStateManager.setAnalysisTaskId(null);
          }
        } else if (this.state.campaigns && this.isAllStepsCompleted) {
          // Analysis is complete, advance to next step
          await this.setCurrentStep(SetupStepEnum.UserInfoCollection);
          await this.loadUserInfoQuestions();
        }
        // If no task_id and no campaigns, user needs to go back and start analysis again
        break;
      }

      case SetupStepEnum.ConnectAccount:
      case SetupStepEnum.TemplateConfig:
        // These steps don't need additional data loading
        break;
    }
  }

  private brandAdmaxSetupCache: any = null;

  async bootstrap() {
    await this.adsPlatformService.waitReady();

    // Auto-select the first visible ad account that is not setup complete
    const metaAccounts = this.adsPlatformService.state.metaAdsAccount?.list || [];
    const visibleAccounts = metaAccounts.filter((account) => !account.is_hidden);
    const availableAccounts = visibleAccounts.filter((account) => account.is_setup_complete !== true);
    const firstAccountId = availableAccounts[0]?.__account_id;

    // Initialize temporary accountId from persist state or set default
    // Don't modify persist store during setup flow initialization
    const persistSelectedId = this.persistStateManager.state.selectedAccountId ?? null;
    let tempAccountId: string | null = null;

    if (persistSelectedId) {
      const selectedAccount = visibleAccounts.find((account) => account.__account_id === persistSelectedId);
      // Use persist accountId if it exists and is not setup complete
      if (selectedAccount && selectedAccount.is_setup_complete !== true) {
        tempAccountId = persistSelectedId;
      } else {
        // If persist account is complete or not found, clear it and use first available
        if (persistSelectedId && !selectedAccount) {
          // Account no longer exists, clear persist state
          this.persistStateManager.setSelectedAccountId(null);
        }
        if (firstAccountId) {
          tempAccountId = firstAccountId;
        }
      }
    } else if (firstAccountId) {
      // No persist accountId, use first available
      tempAccountId = firstAccountId;
    }
    // Set temporary accountId without modifying persist store
    if (tempAccountId !== null) {
      this.setState((state) => {
        state.tempSelectedAdAccountId = tempAccountId;
      });
    } else {
      // Ensure tempSelectedAdAccountId is null when no account is available
      this.setState((state) => {
        state.tempSelectedAdAccountId = null;
      });
    }

    this.syncVisibleSteps();
    // Load saved products and competitors for both brand and account flows
    // This will also load brandAdmaxSetupCache for brand flow
    await this.loadSavedProductsAndCompetitors(tempAccountId, false);

    // Restore current setup step from persisted state
    // Only restore if setup is NOT complete (allow re-setup)
    const persistedStep = this.persistStateManager.state.currentSetupStep;
    const persistedBrandId = this.persistStateManager.state.setupBrandId;
    const currentBrand = this.brandSpaceService.storeManager.currentBrand;

    // Check if flow type has changed (account <-> brand)
    // If flow type changed, clear cache and start from beginning
    // Flow type detection:
    // - Brand flow: persistedBrandId !== null
    // - Account flow: persistedBrandId === null (when step was saved in account flow)
    const wasBrandFlow = persistedBrandId !== null;
    const isBrandFlow = tempAccountId === null;
    // Flow type changed if:
    // 1. Was brand flow (has persistedBrandId) but now has account (account flow)
    // 2. Was account flow (no persistedBrandId but has persistedStep) but now no account (brand flow)
    const flowTypeChanged =
      (wasBrandFlow && !isBrandFlow) || // Brand -> Account
      (!wasBrandFlow && persistedStep !== null && isBrandFlow); // Account -> Brand

    if (flowTypeChanged) {
      // Flow type changed from brand to account, clear cache and start from beginning
      this.persistStateManager.clearSetupState();
    }

    let shouldRestore = false;

    if (persistedStep && this.state.visibleSteps.includes(persistedStep) && !flowTypeChanged) {
      if (tempAccountId) {
        // Account flow: only restore if account is NOT setup complete
        const selectedAccount = metaAccounts.find((acc) => acc.__account_id === tempAccountId);
        shouldRestore = Boolean(selectedAccount && selectedAccount.is_setup_complete !== true);
      } else if (persistedBrandId && persistedBrandId === currentBrand?.id) {
        // Brand flow: only restore if brand is NOT setup complete
        shouldRestore = !this.brandAdmaxSetupCache || this.brandAdmaxSetupCache.is_setup_complete !== true;
      } else if (!tempAccountId && !persistedBrandId) {
        // No account and no persisted brand ID - this is a new brand flow session
        // Allow restore if brand is not setup complete
        shouldRestore = !this.brandAdmaxSetupCache || this.brandAdmaxSetupCache.is_setup_complete !== true;
        // Record brand ID for brand flow when restoring
        if (shouldRestore && currentBrand?.id) {
          this.persistStateManager.setSetupBrandId(currentBrand.id);
        }
      }

      if (shouldRestore) {
        // Use setCurrentStep to restore step and load necessary data
        // This ensures that when user refreshes and restores to a step, all required data is loaded
        await this.setCurrentStep(persistedStep);
      } else {
        // Clear persisted state if setup is complete or context doesn't match
        this.persistStateManager.clearSetupState();
      }
    }

    // Set ready after all initialization is complete
    this.setState((state) => {
      state.isReady = true;
    });

    // Sync manager state to controller state
    this.setupAnalyzingManager.store.subscribe((state) => {
      this.setState((s) => {
        s.currentAnalysisStep = state.currentAnalysisStep;
        s.completedAnalysisSteps = state.completedAnalysisSteps;
      });
    });

    const analysisDisposer = this.setupAnalyzingManager.onAnalysisComplete(async () => {
      // Clear saved task_id since analysis is complete
      this.persistStateManager.setAnalysisTaskId(null);

      if (!this.state.campaigns) {
        const selectedAdAccountId = this.selectedAdAccountId;

        let budgetSettings: any = null;
        let totalMonthlyBudget = 10000;

        if (selectedAdAccountId) {
          // Account flow: get data from account
          const metaAccounts = this.adsPlatformService.state.metaAdsAccount?.list || [];
          const selectedAccount = metaAccounts.find((acc) => acc.__account_id === selectedAdAccountId);
          budgetSettings = selectedAccount?.budget_settings;
          totalMonthlyBudget = selectedAccount?.total_monthly_budget || 10000;
        } else if (this.brandAdmaxSetupCache) {
          // Brand flow: use cached data
          budgetSettings = this.brandAdmaxSetupCache.budget_settings;
          totalMonthlyBudget = this.brandAdmaxSetupCache.total_monthly_budget || 10000;
        }

        // Default budget settings matching backend structure (in basis points)
        const defaultBudgetSettings = {
          scaling: { pct: 5000, campaign_ids: [] }, // 50%
          retargeting: { pct: 3000, campaign_ids: [] }, // 30%
          testing: { pct: 2000, campaign_ids: [] }, // 20%
        };

        // Use real data or defaults (both use same backend structure)
        const settings = budgetSettings || defaultBudgetSettings;

        // Convert pct from basis points (0-10000) to percentage (0-100)
        const scalingPct = settings.scaling.pct / 100;
        const retargetingPct = settings.retargeting.pct / 100;
        const testingPct = settings.testing.pct / 100;

        // Calculate dollar amounts from percentages
        const scalingBudget = Math.round((totalMonthlyBudget * scalingPct) / 100);
        const retargetingBudget = Math.round((totalMonthlyBudget * retargetingPct) / 100);
        const testingBudget = Math.round((totalMonthlyBudget * testingPct) / 100);

        // Collect all campaign IDs that need names
        const allCampaignIds = [
          ...(settings.scaling.campaign_ids || []),
          ...(settings.retargeting.campaign_ids || []),
          ...(settings.testing.campaign_ids || []),
        ];

        // Load campaign names if there are linked campaigns
        const campaignNameMap =
          allCampaignIds.length > 0 && selectedAdAccountId
            ? await this.loadCampaignNames(allCampaignIds, selectedAdAccountId)
            : new Map<string, string>();

        const campaignsData: CampaignConfig[] = [
          {
            type: CampaignTypeEnum.SCALE,
            budget: scalingBudget,
            percent: Math.round(scalingPct),
            campaignIds: settings.scaling.campaign_ids || [],
            linkedCampaignName:
              settings.scaling.campaign_ids?.[0] && campaignNameMap.get(settings.scaling.campaign_ids[0]),
          },
          {
            type: CampaignTypeEnum.RETARGETING,
            budget: retargetingBudget,
            percent: Math.round(retargetingPct),
            campaignIds: settings.retargeting.campaign_ids || [],
            linkedCampaignName:
              settings.retargeting.campaign_ids?.[0] && campaignNameMap.get(settings.retargeting.campaign_ids[0]),
          },
          {
            type: CampaignTypeEnum.TESTING,
            budget: testingBudget,
            percent: Math.round(testingPct),
            campaignIds: settings.testing.campaign_ids || [],
            linkedCampaignName:
              settings.testing.campaign_ids?.[0] && campaignNameMap.get(settings.testing.campaign_ids[0]),
          },
        ];

        this.setState((s) => {
          s.campaigns = campaignsData;
          // Save initial campaigns for "Why This Structure" display
          s.initialCampaigns = JSON.parse(JSON.stringify(campaignsData));
        });
        await this.setCurrentStep(SetupStepEnum.UserInfoCollection);
      } else {
        // If campaigns already exist (e.g., navigating back), just update the step
        await this.setCurrentStep(SetupStepEnum.UserInfoCollection);
      }
      await this.loadUserInfoQuestions();
    });

    const analysisFailedDisposer = this.setupAnalyzingManager.onAnalysisFailed(async () => {
      // Clear saved task_id since analysis failed
      this.persistStateManager.setAnalysisTaskId(null);
      await this.setCurrentStep(SetupStepEnum.ConnectAccount);
      Toast.error('Failed to analyze ad account. Please try again.');
    });

    this.disposerManager.add(analysisDisposer);
    this.disposerManager.add(analysisFailedDisposer);
  }

  async loadUserInfoQuestions(force = false) {
    if (this.state.isUserInfoLoading) {
      return;
    }
    if (!force && this.state.userInfoQuestions) {
      return;
    }
    this.setState((state) => {
      state.isUserInfoLoading = true;
    });
    try {
      const questions = await this.fetchAIQuestions();
      this.setState((state) => {
        state.userInfoQuestions = questions;
        if (force) {
          state.userInfoAnswer = '';
        }
      });
    } catch (error) {
      console.error('Failed to load user info questions', error);
    } finally {
      this.setState((state) => {
        state.isUserInfoLoading = false;
      });
    }
  }

  setUserInfoAnswer(answer: string) {
    this.setState((state) => {
      state.userInfoAnswer = answer;
    });
  }

  async submitUserInfoAnswer() {
    if (this.state.isSubmittingUserInfo) {
      return;
    }

    // If no questions, skip directly and report event
    const questions = this.state.userInfoQuestions;
    if (!questions || questions.trim().length === 0) {
      reportEvent('user_info_continue_no_questions');
      this.skipUserInfoStep();
      return;
    }

    this.setState((state) => {
      state.isSubmittingUserInfo = true;
    });
    try {
      await this.submitUserAnswers(this.state.userInfoAnswer);
      this.getInPageNavigateHandler().goNext();
    } catch (error) {
      console.error('Failed to submit user info', error);
    } finally {
      this.setState((state) => {
        state.isSubmittingUserInfo = false;
      });
    }
  }

  skipUserInfoStep() {
    if (this.state.currentStep !== SetupStepEnum.UserInfoCollection) {
      return;
    }
    this.getInPageNavigateHandler().goNext();
  }

  goBackFromUserInfoStep() {
    if (this.state.currentStep !== SetupStepEnum.UserInfoCollection) {
      return;
    }
    this.getInPageNavigateHandler().goPrev();
  }

  async fetchAIQuestions(): Promise<string> {
    const accountId = this.selectedAdAccountId;
    const currentBrand = this.brandSpaceService.storeManager.currentBrand;

    try {
      let response: any;

      if (accountId) {
        // Account flow
        response = await getInsightQuestions(accountId);
      } else if (currentBrand?.id) {
        // Brand flow - pass undefined to use brand_id from header
        response = await getInsightQuestions();
      } else {
        return '';
      }

      // Save snapshot_id for later feedback submission
      this.setState((state) => {
        state.userInfoSnapshotId = response.snapshot_id;
      });

      return response.questions || '';
    } catch (error) {
      console.error('Failed to fetch AI questions:', error);
      return '';
    }
  }

  async submitUserAnswers(answers: string): Promise<void> {
    const accountId = this.selectedAdAccountId;
    const currentBrand = this.brandSpaceService.storeManager.currentBrand;
    const snapshotId = this.state.userInfoSnapshotId;

    if (!snapshotId) {
      throw new Error('Missing snapshot ID');
    }

    if (!accountId && !currentBrand?.id) {
      throw new Error('Missing account ID or brand ID');
    }

    await submitInsightFeedback({
      account_id: accountId || undefined,
      brand_id: accountId ? undefined : currentBrand?.id,
      snapshot_id: snapshotId,
      user_answer: answers,
    });
  }

  dispose() {
    this.setupAnalyzingManager.dispose();
    this.disposerManager.dispose();
    this.brandAdmaxSetupCache = null;
  }
}
