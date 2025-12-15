import { useCombinedStore } from '@/feature/common/experimental/use-combined-store';
import { ApprovalRate } from '../../component/approval-rate';
import { StatCard } from '../../component/stat-card';
import { useQueuePageViewController } from '../../context/queue-page-view-controller.context';

export function StatsBar() {
  const vc = useQueuePageViewController();

  const { accountStatsState, queueAccountState, creationCount } = useCombinedStore(vc.combinedStore, () => ({
    accountStatsState: vc.accountStatsState,
    queueAccountState: vc.queueAccountState,
    creationCount: vc.creationCount,
  }));

  const { isLoading, error, data } = accountStatsState;
  const isAccountReady = queueAccountState.status === 'account-ready';

  const formatWeeklySpend = (spend?: number | null): string => {
    if (spend === null || spend === undefined) {
      return '-';
    }
    if (spend >= 1000) {
      const kValue = spend / 1000;
      return `$${kValue.toFixed(1)}k/week`;
    }
    return `$${spend.toFixed(0)}/week`;
  };

  // Format ROAS change percentage (e.g., "+10%" or "-5%")
  const formatRoasChange = (roasWow: number): string => {
    if (roasWow >= 0) {
      return `+${roasWow.toFixed(0)}%`;
    }
    return `${roasWow.toFixed(0)}%`;
  };

  if (!isAccountReady) {
    // Brand mode: show creation pipeline overview instead of Meta stats
    return (
      <div className="flex items-center gap-3">
        <StatCard icon="play" theme="blue" title={`${creationCount} pending`} subtitle="Ready for review" />
        <StatCard icon="ai" theme="green" title="AI-Powered" subtitle="Creative generation" />
      </div>
    );
  }

  // Show loading state first, even if there's a previous error
  if (isLoading) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatCard icon="chart-line" theme="green" title="Loading..." />
          <StatCard icon="promote" theme="blue" title="Loading..." />
        </div>
        <ApprovalRate level="supervised" approvalRate={0} />
      </div>
    );
  }

  // Only show error if not loading and there's an error with no data
  if (error && !data) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatCard icon="chart-line" theme="green" title="Error loading data" />
          <StatCard icon="promote" theme="blue" title="Error loading data" />
        </div>
        <ApprovalRate level="supervised" approvalRate={0} />
      </div>
    );
  }

  // If no data but no error, show loading (initial state)
  if (!data) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatCard icon="chart-line" theme="green" title="Loading..." />
          <StatCard icon="promote" theme="blue" title="Loading..." />
        </div>
        <ApprovalRate level="supervised" approvalRate={0} />
      </div>
    );
  }

  const roasInfo = data.roas_info;
  const campaignInfo = data.campaign_info;
  const pipelineAcceptanceRate = data.pipeline_acceptance_rate;

  const currentRoas = roasInfo?.current_7d_roas ?? null;
  const roasTitle = currentRoas !== null ? `${currentRoas.toFixed(1)}x` : '';
  const roasChange =
    roasInfo?.roas_wow !== null && roasInfo?.roas_wow !== undefined ? formatRoasChange(roasInfo.roas_wow) : undefined;

  const campaignsCount = campaignInfo?.active_campaign_count;
  const campaignsTitle =
    campaignsCount !== null && campaignsCount !== undefined
      ? `${campaignsCount} campaign${campaignsCount !== 1 ? 's' : ''}`
      : '-';
  const weeklySpendSubtitle = campaignInfo ? formatWeeklySpend(campaignInfo.weekly_spend) : '-';
  const approvalRateValue = Math.round(pipelineAcceptanceRate?.acceptance_rate ?? 0);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {currentRoas !== null && (
          <StatCard icon="chart-line" theme="green" title={`ROAS ${roasTitle}`} change={roasChange} />
        )}
        <StatCard icon="promote" theme="blue" title={campaignsTitle} subtitle={weeklySpendSubtitle} />
        {/* <StatCard
          icon="calendar"
          theme="blue"
          title={`Week ${weeklyCycle.currentWeek}`}
          suffix={
            <>
              <span>{weeklyCycle.cyclePhase === CyclePhase.CREATION && 'Creating'}</span>
              <span>{weeklyCycle.cyclePhase === CyclePhase.ANALYSIS && 'Optimizing'}</span>
              <span>{weeklyCycle.cyclePhase === CyclePhase.BOTH && 'Creating & Optimizing'}</span>
            </>
          }
        /> */}
      </div>
      <ApprovalRate level="supervised" approvalRate={approvalRateValue} />
    </div>
  );
}
