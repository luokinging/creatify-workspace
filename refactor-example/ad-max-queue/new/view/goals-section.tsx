import { Toast } from '@/component/toast/util';
import { Button } from '@/component/ui/button';
import { Card } from '@/component/ui/card/card';
import { useCombinedStore } from '@/feature/common/experimental/use-combined-store';
import { IAdsPlatformService } from '@/feature/services/ad-platform-service.type';
import { useServices } from '@/feature/services/app-container-service/react-context';
import { router } from '@/hook/use-router';
import { IconPark } from '@/lib/iconpark/icon';
import { useEffect, useState } from 'react';
import { useZustand } from 'use-zustand';
import { GOAL_LABEL_API_MAP, createCampaignGoals, getCampaignGoals } from '../../api/campaign-goals';
import type { Goal } from '../../component/edit-goals-dialog';
import { EditGoalsDialog } from '../../component/edit-goals-dialog';
import { useQueuePageViewController } from '../../context/queue-page-view-controller.context';

export function GoalsSection() {
  const vc = useQueuePageViewController();
  const adsPlatformService = useServices(IAdsPlatformService);
  const selectedAdAccountId = useCombinedStore(vc.combinedStore, () => vc.selectedAdAccountId);
  const queueAccountState = useCombinedStore(vc.combinedStore, () => vc.queueAccountState);
  const headerCtaMeta = useCombinedStore(vc.combinedStore, () => vc.getHeaderCtaMeta());

  const metaAccounts = useZustand(adsPlatformService.store, (s) => s.metaAdsAccount?.list || []);
  const selectedMetaAccount = metaAccounts.find((account) => account.account_id === selectedAdAccountId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isBrandMode = !selectedAdAccountId;
  const canFetchGoals = queueAccountState.status === 'account-ready' || isBrandMode;

  // Fetch goals when account changes or in brand mode
  useEffect(() => {
    if (!canFetchGoals) {
      setGoals([]);
      return;
    }

    const fetchGoals = async () => {
      setIsLoading(true);
      try {
        // In brand mode, pass undefined to use brand_id from header
        const response = await getCampaignGoals(selectedAdAccountId);
        // Map API goals to frontend format
        const mappedGoals = response.goals.map((goal) => ({
          label: goal.label_display,
          value: goal.value,
        }));
        setGoals(mappedGoals);
      } catch (error) {
        console.error('Failed to fetch goals:', error);
        Toast.error('Failed to load campaign goals');
        setGoals([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGoals();
  }, [selectedAdAccountId, canFetchGoals]);

  const handleEditGoals = () => {
    setIsDialogOpen(true);
  };

  const handleSaveGoals = async (newGoals: Goal[]) => {
    try {
      const apiGoals = newGoals.map((goal) => ({
        label: GOAL_LABEL_API_MAP[goal.label] || goal.label.toLowerCase().replace(/\s+/g, '_'),
        value: goal.value,
      }));

      const response = await createCampaignGoals(selectedAdAccountId, {
        goals: apiGoals,
      });

      const mappedGoals = response.goals.map((goal) => ({
        label: goal.label_display,
        value: goal.value,
      }));

      setGoals(mappedGoals);
      Toast.success('Campaign goals updated');
    } catch (error) {
      console.error('Failed to save goals:', error);
      Toast.error('Failed to save campaign goals');
      throw error;
    }
  };

  return (
    <>
      <Card className="flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-center justify-between border-line-2 border-b pb-3">
          <div className="flex items-center gap-3">
            <IconPark icon="star-line" size={20} className="text-color-weak" />
            <h3 className="text-color-title text-title-h6">Campaign Goals</h3>
          </div>
          <Button size="sm" variant="ghost" icon="edit" onClick={handleEditGoals} disabled={!canFetchGoals}>
            Edit
          </Button>
        </div>

        {/* Goals Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-color-support">
              <div className="h-4 w-4 animate-spin rounded-full border-blue-500 border-b-2"></div>
              <span className="text-label-sm">Loading goals...</span>
            </div>
          </div>
        ) : canFetchGoals && goals.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-3">
            {goals.map((goal, index) => (
              <div key={index} className="flex items-baseline gap-2">
                <p className="text-color-support text-label-sm">{goal.label}:</p>
                <p className="font-medium text-body-sm text-color-title">{goal.value}</p>
              </div>
            ))}
          </div>
        ) : canFetchGoals ? (
          <div className="flex items-center justify-between py-6">
            <p className="text-color-support text-label-sm">No campaign goals set. Click "Edit" to add goals.</p>
          </div>
        ) : (
          <div className="flex items-center justify-between py-6">
            <p className="text-color-support text-label-sm">Connect Meta to customize your campaign goals.</p>
            {headerCtaMeta && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  router.navigate({ to: headerCtaMeta.href });
                }}
              >
                {headerCtaMeta.label}
              </Button>
            )}
          </div>
        )}
      </Card>

      <EditGoalsDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialGoals={goals}
        onConfirm={handleSaveGoals}
      />
    </>
  );
}
