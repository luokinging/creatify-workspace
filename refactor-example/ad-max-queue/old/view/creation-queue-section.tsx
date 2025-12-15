import { Button } from '@/component/ui/button';
import { Card } from '@/component/ui/card/card';
import { SimpleTooltip } from '@/component/ui/tooltip/simple-tooltip';
import { useCombinedStore } from '@/feature/common/experimental/use-combined-store';
import { router } from '@/hook/use-router';
import { IconPark } from '@/lib/iconpark/icon';
import type { CreationPipeline } from '../../api/creation-pipeline';
import { AdsPlatformEnum } from '../../api/knowledge-base';
import { useQueuePageViewController } from '../../context/queue-page-view-controller.context';
import { CreationQueueItemCard } from './creation-queue-item-card';

function EmptyState() {
  return (
    <Card className="flex-center flex-col gap-4 py-16">
      <div className="size-20 flex-center rounded-full bg-area-platform">
        <IconPark icon="video-camera" size={32} className="text-color-weak" />
      </div>
      <div className="flex-col items-center gap-1 text-center">
        <p className="text-color-title text-title-h6">No Pending Approvals</p>
        <p className="max-w-md text-body-sm text-color-support">
          No new ad sets ready for review. Check back next cycle.
        </p>
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <Card className="flex-center flex-col gap-4 py-16">
      <div className="text-color-support">Loading...</div>
    </Card>
  );
}

function GeneratingConceptsState() {
  return (
    <Card className="flex-center flex-col gap-4 py-16">
      <div className="size-20 flex-center rounded-full bg-blue-500/10">
        <IconPark icon="loading" spin size={32} className="text-blue-500" />
      </div>
      <div className="flex-col items-center gap-1 text-center">
        <p className="text-color-title text-title-h6">Generating Creative Concepts...</p>
        <p className="max-w-md text-body-sm text-color-support">
          We're analyzing your products and generating ad concepts. This may take a few moments.
        </p>
      </div>
    </Card>
  );
}

function CreationQueueHeader() {
  const vc = useQueuePageViewController();

  const { testingBudget, isLowBudget, queueAccountState } = useCombinedStore(vc.combinedStore, () => ({
    testingBudget: vc.state.testingBudget,
    isLowBudget: vc.isLowBudget,
    queueAccountState: vc.queueAccountState,
  }));
  const headerCtaMeta = useCombinedStore(vc.combinedStore, () => vc.getHeaderCtaMeta());
  const showTestingBudget = queueAccountState.status === 'account-ready';

  const handleTestingBudgetCta = () => {
    if (!headerCtaMeta) return;
    router.navigate({ to: headerCtaMeta.href });
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          size="md"
          variant="secondary"
          icon="add"
          onClick={async () => {
            await vc.openRequestCreativesDialog(AdsPlatformEnum.Meta, vc.selectedAdAccountId);
          }}
        >
          Request Creatives
        </Button>
        <Button
          size="md"
          variant="secondary"
          icon="upload"
          onClick={async () => {
            await vc.handleBringOwnCreatives();
          }}
        >
          Test Your Own Creatives
        </Button>
      </div>
      {showTestingBudget && testingBudget && testingBudget.monthlyBudgetAllocation > 0 ? (
        <SimpleTooltip content="Remaining monthly budget available for testing new creatives">
          <div className="flex items-center gap-3 rounded-lg border border-purple-500/30 bg-purple-500/5 px-4 py-2">
            <IconPark icon="price" size={16} className="text-purple-500" />
            <div className="flex items-center gap-2">
              <span className="font-medium text-body-sm text-color-title">
                Testing Budget: ${(testingBudget.remaining || 0).toLocaleString()} / $
                {testingBudget.monthlyBudgetAllocation.toLocaleString()}
              </span>
              {isLowBudget && (
                <span className="rounded-full bg-orange-500/10 px-2 py-0.5 font-medium text-label-xs text-orange-500">
                  Low
                </span>
              )}
            </div>
          </div>
        </SimpleTooltip>
      ) : null}
    </div>
  );
}

export function CreationQueueSection() {
  const vc = useQueuePageViewController();

  const {
    data: items = [],
    isDataPending,
    isFetchingNextPage,
  } = useCombinedStore(vc.combinedStore, () => vc.creationPipelineQueryManager.state);

  const isGeneratingConcept = useCombinedStore(vc.combinedStore, () => vc.isGeneratingConcept);

  if (isDataPending) {
    return <LoadingState />;
  }

  if (isGeneratingConcept) {
    return (
      <div className="flex-col gap-4">
        <CreationQueueHeader />
        <GeneratingConceptsState />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-col gap-4">
        <CreationQueueHeader />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex-col gap-4">
      <CreationQueueHeader />

      {items.map((item: CreationPipeline) => (
        <CreationQueueItemCard
          key={item.id}
          item={item}
          onApprove={vc.approveCreationItem.bind(vc)}
          onReject={vc.rejectItem.bind(vc)}
          onGenerate={(id, concept, product) =>
            vc.openRequestCreativesDialog(AdsPlatformEnum.Meta, vc.selectedAdAccountId, id, concept, product)
          }
        />
      ))}

      {isFetchingNextPage && (
        <div className="w-full flex-center flex-col gap-4 py-8">
          <IconPark icon="loading" spin size={20} />
          <span className="text-body-sm text-color-support">Loading more...</span>
        </div>
      )}
    </div>
  );
}
