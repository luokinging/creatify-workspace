import { LogoLottieLoading } from '@/component/loader/lottie-loading';
import { Card } from '@/component/ui/card/card';
import { useCombinedStore } from '@/feature/common/experimental/use-combined-store';
import { IconPark } from '@/lib/iconpark/icon';
import type { AnalysisPipeline } from '../../api/analysis-pipeline';
import { useQueuePageViewController } from '../../context/queue-page-view-controller.context';
import { AnalysisQueueItemCard } from './analysis-queue-item-card';

function EmptyState() {
  return (
    <Card className="flex-center flex-col gap-4 py-16">
      <LogoLottieLoading className="h-24 w-24" />
      <div className="flex-col items-center gap-1 text-center">
        <p className="text-color-title text-title-h6">Analyzing Performance</p>
        <p className="max-w-md text-body-sm text-color-support">
          Our AI is analyzing your campaign performance. Recommendations will appear here when ready.
        </p>
      </div>
    </Card>
  );
}

export function AnalysisQueueSection() {
  const vc = useQueuePageViewController();

  // const { items, isLoading } = useCombinedStore(vc.combinedStore, () => ({
  //   items: vc.analysisPipelineQueryManager.items,
  //   isLoading: vc.analysisPipelineQueryManager.state.isLoading,
  // }));

  const {
    data: items = [],
    isLoading: _,
    isDataPending,
    isFetchingNextPage,
  } = useCombinedStore(vc.combinedStore, () => vc.analysisPipelineQueryManager.state);

  if (isDataPending) {
    return (
      <Card className="flex-center flex-col gap-4 py-16">
        <div className="text-color-support">Loading...</div>
      </Card>
    );
  }

  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex-col gap-4">
      {items.map((item: AnalysisPipeline) => (
        <AnalysisQueueItemCard
          key={item.id}
          item={item}
          onApprove={vc.approveAnalysisItem.bind(vc)}
          onReject={vc.rejectItem.bind(vc)}
          // todo: hide it temporarily until backend API is implemented
          // onRequestChanges={vc.requestItemChanges.bind(vc)}
        />
      ))}
      {isFetchingNextPage && (
        <div className="w-full flex-center flex-col gap-4">
          <IconPark icon="loading" spin size={20} />
          <span>Loading more...</span>
        </div>
      )}
    </div>
  );
}
