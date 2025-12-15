import { Button, IconButton } from '@/component/ui/button';
import { SimpleTooltip } from '@/component/ui/tooltip/simple-tooltip';
import { AdsPlatformEnum } from '@/feature/account/ads-platform-service/type';
import { useCombinedStore } from '@/feature/common/experimental/use-combined-store';
import { ThirdPartAccountDropdownSelect } from '@/feature/my-ads/block/common/third-part-account-dropdown-select';
import { IAdsPlatformService } from '@/feature/services/ad-platform-service.type';
import { useServices } from '@/feature/services/app-container-service/react-context';
import { IBrandSpaceService } from '@/feature/services/brand-space-service/brand-space-service.type';
import { ITransientDataService } from '@/feature/services/transient-data-service.type';
import { router } from '@/hook/use-router';
import { IconPark } from '@/lib/iconpark/icon';
import { useEffect, useState } from 'react';
import { TabButton } from '../../component/tab-button';
import {
  QueuePageViewControllerProvider,
  useQueuePageViewController,
} from '../../context/queue-page-view-controller.context';
import { QueuePageViewController } from '../../manager/queue-page-view-controller';
import { QueuePageTabEnum } from '../../type';
import { AnalysisQueueSection } from './analysis-queue-section';
import { CreationQueueSection } from './creation-queue-section';
import { KnowledgeBaseSection } from './knowledge-base-section';
import { StatsBar } from './stats-bar';

function QueuePageContent() {
  const vc = useQueuePageViewController();
  const selectAdsAccount = useCombinedStore(vc.combinedStore, () => vc.getSelectedAdsAccount());
  const queueAccountState = useCombinedStore(vc.combinedStore, () => vc.queueAccountState);
  const headerCtaMeta = useCombinedStore(vc.combinedStore, () => vc.getHeaderCtaMeta());

  const { activeTab, totalPending, creationCount, analysisCount, isLowBudget, budgetPercentage, selectedAdAccountId } =
    useCombinedStore(vc.combinedStore, () => ({
      activeTab: vc.state.activeTab,
      totalPending: vc.totalPending,
      creationCount: vc.creationCount,
      analysisCount: vc.analysisCount,
      isLowBudget: vc.isLowBudget,
      budgetPercentage: vc.budgetPercentage,
      selectedAdAccountId: vc.selectedAdAccountId,
    }));
  const analysisGuard = useCombinedStore(vc.combinedStore, () => vc.getGuardResult('analysis-tab'));

  const handleHeaderCtaClick = () => {
    if (!headerCtaMeta) return;
    router.navigate({ to: headerCtaMeta.href });
  };

  const handleAnalysisTabClick = () => {
    if (analysisGuard.canProceed) {
      vc.setActiveTab(QueuePageTabEnum.Analysis);
    } else {
      // Show dialog explaining Analysis Pipeline and guide to connect Meta
      vc.presentGuardDialog(analysisGuard);
    }
  };

  const analysisTabButton = (
    <TabButton
      active={activeTab === QueuePageTabEnum.Analysis}
      icon="chart-line"
      disabled={false}
      onClick={handleAnalysisTabClick}
      className={!analysisGuard.canProceed ? 'opacity-50' : ''}
      trailing={
        analysisCount > 0 && (
          <span className="min-w-[20px] flex-center rounded-full bg-blue-500/20 px-2 py-0.5 font-medium text-blue-500 text-label-xs">
            {analysisCount}
          </span>
        )
      }
    >
      Analysis Pipeline
    </TabButton>
  );

  return (
    <div
      ref={(el) => {
        if (!el) return;
        vc.setAnalysisPipelineScrollElement(el);
        vc.setCreationPipelineScrollElement(el);
      }}
      className="size-full flex-col items-center overflow-y-auto"
    >
      <div className=" w-full max-w-7xl flex-col gap-6 px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-color-title text-title-h3">Campaign Management</h1>
              {totalPending > 0 && (
                <span className="size-7 flex-center rounded-full bg-orange-500/10 font-medium text-label-sm text-orange-500">
                  {totalPending}
                </span>
              )}
            </div>
            <p className="text-body-md text-color-support">
              Review campaigns, optimize performance, and manage learned insights
            </p>
          </div>
          <div className="flex items-center gap-2">
            {queueAccountState.status === 'account-ready' ? (
              <>
                {selectAdsAccount?.status === 'syncing' && (
                  <SimpleTooltip content="Syncing data… Metrics may be temporarily incomplete.">
                    <IconPark icon="info-line" size={18} className="text-color-support" />
                  </SimpleTooltip>
                )}
                <ThirdPartAccountDropdownSelect
                  isSetupComplete
                  triggerClass="max-w-[200px]"
                  accountId={selectedAdAccountId}
                  type={AdsPlatformEnum.Meta}
                  onAccountSelect={(account) => {
                    vc.setSelectedAdAccountId(account.__account_id);
                  }}
                />
              </>
            ) : (
              headerCtaMeta && (
                <Button variant="primary" size="sm" onClick={handleHeaderCtaClick}>
                  <span className="mr-1.5">🚀</span>
                  {headerCtaMeta.label}
                </Button>
              )
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar />

        {/* Pipeline Tabs */}
        <div className="flex items-center justify-between gap-2 border-line-2 border-b border-solid">
          <div className="flex items-center gap-2">
            <TabButton
              active={activeTab === QueuePageTabEnum.Creation}
              icon="play"
              onClick={() => vc.setActiveTab(QueuePageTabEnum.Creation)}
              trailing={
                creationCount > 0 && (
                  <span className="min-w-[20px] flex-center rounded-full bg-blue-500/20 px-2 py-0.5 font-medium text-blue-500 text-label-xs">
                    {creationCount}
                  </span>
                )
              }
            >
              Creation Pipeline
            </TabButton>
            {analysisTabButton}
            <TabButton
              active={activeTab === QueuePageTabEnum.Knowledge}
              icon="book-star"
              onClick={() => vc.setActiveTab(QueuePageTabEnum.Knowledge)}
            >
              Knowledge Base
            </TabButton>
          </div>

          <IconButton
            size="md"
            icon="setting"
            onClick={() => {
              // Clear setup cache before navigating to setup page
              vc.clearSetupCache();
              router.navigate({
                to: '/tool/ad-max/setup',
              });
            }}
          />
        </div>

        {/* Tab Content - sections will handle their own state via vc */}
        <div className="flex-1">
          {activeTab === QueuePageTabEnum.Creation && <CreationQueueSection />}
          {activeTab === QueuePageTabEnum.Analysis && <AnalysisQueueSection />}
          {activeTab === QueuePageTabEnum.Knowledge && <KnowledgeBaseSection />}
        </div>
      </div>
    </div>
  );
}

export function QueuePage() {
  const adsPlatformService = useServices(IAdsPlatformService);
  const transientDataService = useServices(ITransientDataService);
  const brandSpaceService = useServices(IBrandSpaceService);
  const [vc] = useState(() => new QueuePageViewController(adsPlatformService, transientDataService, brandSpaceService));

  useEffect(() => {
    vc.bootstrap();
    return () => vc.dispose();
  }, []);

  return (
    <QueuePageViewControllerProvider vc={vc}>
      <QueuePageContent />
    </QueuePageViewControllerProvider>
  );
}
