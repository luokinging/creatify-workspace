import { Toast } from '@/component/toast/util';
import { Button } from '@/component/ui/button';
import { Card } from '@/component/ui/card/card';
import { useCombinedStore } from '@/feature/common/experimental/use-combined-store';
import { MarkdownRenderer } from '@/feature/conversation/component/markdown-renderer';
import { router } from '@/hook/use-router';
import { IconPark } from '@/lib/iconpark/icon';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import { getCampaignInsights, getInsightQuestions } from '../../api/campaign-insights';
import { BudgetSettingsSummary } from '../../component/budget-settings-summary';
import { TemplateConfigSummary } from '../../component/template-config-summary';
import { useQueuePageViewController } from '../../context/queue-page-view-controller.context';
import { GoalsSection } from './goals-section';

export function KnowledgeBaseSection() {
  const vc = useQueuePageViewController();

  const selectedAdAccountId = useCombinedStore(vc.combinedStore, () => vc.selectedAdAccountId);
  const queueAccountState = useCombinedStore(vc.combinedStore, () => vc.queueAccountState);
  const headerCtaMeta = useCombinedStore(vc.combinedStore, () => vc.getHeaderCtaMeta());
  const brandAdmaxSetup = useCombinedStore(vc.combinedStore, () => vc.brandAdmaxSetupQueryClient.store.getState().data);

  const isBrandMode = !selectedAdAccountId;

  // Brand mode: show budget summary if brand setup has budget_settings
  // Account mode: show budget summary if account is ready and has setup summary
  const canShowBudgetSummary = isBrandMode
    ? queueAccountState.hasSetupSummary && Boolean(brandAdmaxSetup?.budget_settings)
    : queueAccountState.status === 'account-ready' && queueAccountState.hasSetupSummary && Boolean(selectedAdAccountId);

  const canShowTemplateSummary =
    queueAccountState.status === 'account-ready' && queueAccountState.hasTemplateConfig && Boolean(selectedAdAccountId);

  const { isLoading, error, data: rules } = useCombinedStore(vc.combinedStore, () => vc.knowledgeBaseManager.state);

  // Insights state
  const [insights, setInsights] = useState<string>('');
  const [insightsLastUpdated, setInsightsLastUpdated] = useState<Date | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<Error | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);

  // Fetch insights when account changes or in brand mode
  useEffect(() => {
    // Only fetch if we're in a valid state (brand mode or account ready)
    const canFetchInsights =
      isBrandMode || (queueAccountState.status === 'account-ready' && Boolean(selectedAdAccountId));

    if (!canFetchInsights) {
      setInsights('');
      setInsightsLastUpdated(null);
      setSnapshotId(null);
      return;
    }

    const fetchInsights = async () => {
      setIsLoadingInsights(true);
      setInsightsError(null);
      try {
        // In brand mode, pass undefined to use brand_id from header
        const [insightsResponse, questionsResponse] = await Promise.all([
          getCampaignInsights(selectedAdAccountId),
          getInsightQuestions(selectedAdAccountId),
        ]);
        setInsights(insightsResponse.insights || '');
        setInsightsLastUpdated(insightsResponse.last_updated ? new Date(insightsResponse.last_updated) : null);
        setSnapshotId(questionsResponse.snapshot_id);
      } catch (error) {
        console.error('Failed to fetch insights:', error);
        setInsightsError(error instanceof Error ? error : new Error('Unknown error'));
        setInsights('');
        setInsightsLastUpdated(null);
        setSnapshotId(null);
      } finally {
        setIsLoadingInsights(false);
      }
    };

    fetchInsights();
  }, [selectedAdAccountId, isBrandMode, queueAccountState.status]);

  const handleRefresh = async () => {
    const canFetchInsights =
      isBrandMode || (queueAccountState.status === 'account-ready' && Boolean(selectedAdAccountId));
    if (!canFetchInsights) return;

    setIsLoadingInsights(true);
    setInsightsError(null);

    try {
      // In brand mode, pass undefined to use brand_id from header
      const fetchPromises: Promise<unknown>[] = [
        getCampaignInsights(selectedAdAccountId),
        getInsightQuestions(selectedAdAccountId),
      ];

      // Only fetch knowledge rules if we have an account ID
      if (selectedAdAccountId) {
        fetchPromises.push(vc.knowledgeBaseManager.knowledgeRulesQueryClient.fetch());
      }

      const [insightsResponse, questionsResponse] = await Promise.all(fetchPromises);

      setInsights((insightsResponse as any).insights || '');
      setInsightsLastUpdated(
        (insightsResponse as any).last_updated ? new Date((insightsResponse as any).last_updated) : null
      );
      setSnapshotId((questionsResponse as any).snapshot_id);

      Toast.success('Insights refreshed');
    } catch (error) {
      console.error('Failed to refresh insights:', error);
      setInsightsError(error instanceof Error ? error : new Error('Unknown error'));
      Toast.error('Failed to refresh insights');
    } finally {
      setIsLoadingInsights(false);
    }
  };

  // Use insights last updated time, fallback to rules update time
  const lastUpdated = insightsLastUpdated || vc.knowledgeBaseManager.lastRuleUpdated;
  const lastSyncTimeText = formatDistanceToNow(lastUpdated);

  // All insights from rules (for count)
  const allInsights = rules || [];
  const campaignCount = allInsights.length;

  // Use real insights text from API
  const narrativeText =
    insights ||
    "No insights available yet. As you approve or decline campaign decisions, we'll build a comprehensive understanding of what works best for your campaigns.";

  if (isLoading || isLoadingInsights) {
    return (
      <div className="flex-col gap-6 p-6">
        <div className="flex min-h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-blue-500 border-b-2"></div>
            <p className="text-color-support">Loading insights...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || insightsError) {
    const errorMessage = error instanceof Error ? error.message : insightsError?.message || 'Unknown error';
    return (
      <div className="flex-col gap-6 p-6">
        <div className="mb-4 text-center text-red-500">
          <span>
            Error loading insights: <span>{errorMessage}</span>
          </span>
        </div>
        <div className="flex justify-center">
          <Button onClick={handleRefresh} variant="outlined">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col gap-4">
      {/* Goals Section */}
      <GoalsSection />

      {/* Budget Settings Summary */}
      {canShowBudgetSummary ? (
        <BudgetSettingsSummary
          selectedAdAccountId={selectedAdAccountId}
          isBrandMode={isBrandMode}
          brandAdmaxSetup={brandAdmaxSetup}
        />
      ) : (
        <Card className="flex items-center justify-between p-5">
          <div className="flex flex-col">
            <p className="font-medium text-color-title">Budget summary unavailable</p>
            <p className="text-body-sm text-color-support">
              {isBrandMode
                ? 'Finish AdMax Setup to enable Queue actions.'
                : headerCtaMeta?.description || 'Connect Meta to review saved budget allocations.'}
            </p>
          </div>
          {headerCtaMeta && (
            <Button size="sm" variant="ghost" icon="link" onClick={() => router.navigate({ to: headerCtaMeta.href })}>
              {headerCtaMeta.label}
            </Button>
          )}
        </Card>
      )}

      {/* Template Config Summary */}
      {canShowTemplateSummary ? <TemplateConfigSummary selectedAdAccountId={selectedAdAccountId} /> : null}

      {/* Campaign Insights */}
      <Card className="flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-center justify-between border-line-2 border-b pb-3">
          <div className="flex items-center gap-3">
            <IconPark icon="book" size={20} className="text-color-weak" />
            <h3 className="text-color-title text-title-h6">Campaign Insights</h3>
            <div className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1">
              <IconPark icon="check" size={12} className="text-green-600" />
              <span className="font-medium text-green-600 text-label-xs">Live Data</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-body-xs text-color-support">
              <IconPark icon="clock" size={14} />
              <span>Updated {lastSyncTimeText} ago</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon="comment"
              onClick={() => vc.knowledgeBaseManager.openInstructDialog(snapshotId)}
            >
              Instruct
            </Button>
          </div>
        </div>

        {/* Insights Content */}
        <div className="flex-col gap-3">
          <div className="flex items-center gap-2 text-body-sm text-color-support">
            <IconPark icon="chart-line" size={14} />
            <span>
              <span>Based on {campaignCount} campaign </span>
              <span>{campaignCount === 1 ? 'insight' : 'insights'}</span>
            </span>
          </div>
          <div className="text-body-md text-color-title leading-relaxed">
            <MarkdownRenderer content={narrativeText} />
          </div>
        </div>
      </Card>
    </div>
  );
}
