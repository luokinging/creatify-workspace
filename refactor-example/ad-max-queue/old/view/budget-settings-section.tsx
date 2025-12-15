import { Toast } from '@/component/toast/util';
import { Button } from '@/component/ui/button';
import { useCombinedStore } from '@/feature/common/experimental/use-combined-store';
import { dialogManager } from '@/feature/component.dialog/manager';
import { IAdsPlatformService } from '@/feature/services/ad-platform-service.type';
import { useServices } from '@/feature/services/app-container-service/react-context';
import { IconPark } from '@/lib/iconpark/icon';
import { useZustand } from 'use-zustand';
import { CampaignTypeEnum } from '../../api/knowledge-base';
import { CampaignBudgetCard } from '../../component/campaign-budget-card';
import { EditBudgetSettingsDialog } from '../../component/edit-budget-settings-dialog';
import { useQueuePageViewController } from '../../context/queue-page-view-controller.context';
import type { CampaignConfig } from '../../type';

export function BudgetSettingsSection() {
  const vc = useQueuePageViewController();
  const adsPlatformService = useServices(IAdsPlatformService);

  const selectedAdAccountId = useCombinedStore(vc.combinedStore, () => vc.selectedAdAccountId);

  const metaAccounts = useZustand(adsPlatformService.store, (s) => s.metaAdsAccount?.list || []);
  const selectedMetaAccount = metaAccounts.find((account) => account.account_id === selectedAdAccountId);

  const budgetSettings = selectedMetaAccount?.budget_settings;
  const totalMonthlyBudget = selectedMetaAccount?.total_monthly_budget || 0;

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

  const campaigns: CampaignConfig[] = [
    {
      type: CampaignTypeEnum.SCALE,
      budget: scalingBudget,
      percent: Math.round(scalingPct),
      campaignIds: settings.scaling.campaign_ids || [],
    },
    {
      type: CampaignTypeEnum.RETARGETING,
      budget: retargetingBudget,
      percent: Math.round(retargetingPct),
      campaignIds: settings.retargeting.campaign_ids || [],
    },
    {
      type: CampaignTypeEnum.TESTING,
      budget: testingBudget,
      percent: Math.round(testingPct),
      campaignIds: settings.testing.campaign_ids || [],
    },
  ];

  const displayedCampaigns = campaigns.filter((campaign) => campaign.type !== CampaignTypeEnum.RETARGETING);

  const handleEditBudget = async () => {
    if (!selectedAdAccountId) {
      Toast.error('No ad account selected');
      return;
    }

    try {
      await dialogManager.show(EditBudgetSettingsDialog, {
        accountId: selectedAdAccountId,
        initialBudget: totalMonthlyBudget,
        initialCampaigns: campaigns,
      });

      await adsPlatformService.refetchOrganizationAdsAccountData();
      Toast.success('Budget settings refreshed');
    } catch (error) {
      // User cancelled
    }
  };

  if (!selectedAdAccountId || totalMonthlyBudget === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-line-2 bg-area-platform p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconPark icon="chart-line" size={20} className="text-brand" />
          <h2 className="font-semibold text-color-title text-title-h5">Budget Settings</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <p className="text-color-support text-label-xs">Total Monthly Budget</p>
            <p className="font-semibold text-color-title text-title-h5">${totalMonthlyBudget.toLocaleString()}</p>
          </div>
          <Button size="sm" variant="secondary" icon="edit" onClick={handleEditBudget}>
            Edit Budget
          </Button>
        </div>
      </div>

      {/* Campaign Cards */}
      <div className="flex-col gap-3">
        {displayedCampaigns.map((campaign) => (
          <CampaignBudgetCard key={campaign.type} campaign={campaign} readOnly />
        ))}
      </div>
    </div>
  );
}
