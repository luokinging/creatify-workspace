import { Toast } from '@/component/toast/util';
import { Button } from '@/component/ui/button';
import { Card } from '@/component/ui/card/card';
import { getLayoutConfig } from '@/feature/common/api/media-job';
import { dialogManager } from '@/feature/component.dialog/manager';
import { AssetsPreviewModal } from '@/feature/component.dialog/modal/assets-preview.modal';
import { HorizontalScrollArea } from '@/feature/editor-v2/component/horizontal-scroll-area';
import { batchJobProgress } from '@/feature/editor/api/util.client';
import { getAllInOneFlow } from '@/feature/tool.all-in-one/api/util';
import type { AllInOneFlowType } from '@/feature/tool.all-in-one/util';
import { creativeTestingJobRecordToPreview } from '@/feature/tool.creative-testing/util';
import type { Preview, PreviewAssetItem } from '@/feature/tool.url-to-video/type';
import { IconPark } from '@/lib/iconpark/icon';
import type { DraftDataType } from '@/lib/remotion/editor-v2-render/schema/draft';
import { type JobProgress, MediaJobStatusEnum, type MediaJobType } from '@/type/media-job';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import type { CreationPipeline } from '../../api/creation-pipeline';
import { ProductCard } from './product-card';
import { StatusBadge } from './status-badge';
import { VideoPreview } from './video-preview';

interface CreationQueueItemCardProps {
  item: CreationPipeline;
  onApprove: (id: string, selectedJobIds: string[]) => void;
  onReject: (id: string, name: string, type: 'ad-set') => void;
  onGenerate?: (id: string, concept: string, product?: CreationPipeline['product']) => void;
}

export function CreationQueueItemCard({ item, onApprove, onReject, onGenerate }: CreationQueueItemCardProps) {
  const { flow, concept, product } = item;
  const submittedAt = new Date(item.created_at);
  const updatedAt = new Date(item.updated_at);

  // Concept Mode
  if (!flow && concept) {
    return (
      <Card className="flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-center justify-between border-line-2 border-b pb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-color-title text-title-h6">{item.title}</h3>
            <StatusBadge status={item.status} />
            <div className="flex items-center gap-3 text-body-xs text-color-support">
              <span className="flex items-center gap-1.5">
                <IconPark icon="file-text" size={14} />
                Concept
              </span>
              <div className="flex items-center gap-1.5">
                <IconPark icon="clock" size={14} />
                <span>Submitted {formatDistanceToNow(submittedAt, { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Information */}
        {product && (
          <div className="flex-col gap-2">
            <h4 className="font-medium text-body-md text-color-support">Product</h4>
            <ProductCard product={product} />
          </div>
        )}

        {/* Concept Content */}
        <div className="flex-col gap-2">
          <h4 className="font-medium text-body-md text-color-support">Concept</h4>
          <div className="flex flex-col gap-2 rounded-lg bg-area-container p-4">
            <p className="whitespace-pre-wrap text-body-md text-color-title">{concept}</p>
          </div>
        </div>

        {/* AI Reasoning */}
        {item.reason && (
          <div className="flex gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <IconPark icon="ai" size={16} className="shrink-0 text-blue-500" />
            <div className="flex-col gap-1">
              <p className="font-semibold text-color-title text-label-xs">AI Reasoning</p>
              <p className="text-body-sm text-color-support leading-relaxed">{item.reason}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between border-line-2 border-t pt-4">
          <Button size="md" variant="text" onClick={() => onReject(item.id, item.title, 'ad-set')} icon="close">
            Reject
          </Button>
          <div className="flex items-center gap-3">
            <Button size="md" variant="primary" onClick={() => onGenerate?.(item.id, concept, product)} icon="ai">
              Generate
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Normal Flow Mode
  if (!flow) return null;

  const targetingAgeRange =
    item.targeting?.age_min != null && item.targeting?.age_max != null
      ? `${item.targeting.age_min}-${item.targeting.age_max}`
      : 'N/A';
  const targetingInterests = item.targeting?.industry ? [item.targeting.industry] : [];
  // daily_budget unit: USD, display format: $XX/day
  const dailyBudget = item.daily_budget ?? 0;

  const [toggleAll, setToggleAll] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Preview[]>([]);

  // Fetch flow data and convert child_media_jobs to Preview[]
  const {
    data: flowData,
    isLoading: isFlowLoading,
    refetch: refetchFlowInfo,
  } = useQuery<{
    flowInfo?: AllInOneFlowType;
    previewVideos: Preview[];
  }>({
    queryKey: ['ALL_IN_ONE_FLOW_INFO', flow.id],
    queryFn: async () => {
      if (typeof flow.id === 'undefined' || flow.id === '') {
        return { flowInfo: undefined, previewVideos: [] as Preview[] };
      }
      try {
        const data = await getAllInOneFlow(flow.id);
        const previewVideos: Preview[] = [];
        for (const job of data.child_media_jobs || []) {
          try {
            let layoutData: DraftDataType | undefined;
            const layout = job.outputs?.layout ?? '';
            if (layout && layout !== '') {
              layoutData = await getLayoutConfig<DraftDataType>(layout);
            }
            const previewVideo = creativeTestingJobRecordToPreview(job, layoutData);
            previewVideos.push(previewVideo);
          } catch (error) {
            console.error(`Failed to convert job ${job.id} to preview:`, error);
            // Skip failed videos, continue processing others
          }
        }
        return { flowInfo: data, previewVideos };
      } catch (error) {
        console.error(`Failed to fetch flow ${flow.id}:`, error);
        throw error;
      }
    },
    refetchOnWindowFocus: false,
    enabled: !!flow?.id,
  });
  const flowInfo = flowData?.flowInfo;
  const previewVideos = flowData?.previewVideos || [];

  // Progress polling (optimized condition check)
  const { data: jobProgressList } = useQuery({
    queryKey: ['ALL_IN_ONE_FLOW_PROGRESS', flow.id],
    queryFn: async () => {
      const inCompleteJobIds = previewVideos
        ?.filter((video) => video.status !== MediaJobStatusEnum.DONE)
        .map((video) => video.id);

      if (!inCompleteJobIds || inCompleteJobIds.length === 0) {
        return [];
      }
      refetchFlowInfo();
      const jobProgressList = await batchJobProgress(inCompleteJobIds);
      return jobProgressList;
    },
    refetchOnWindowFocus: false,
    refetchInterval: 5000,
    enabled: !!flowData?.previewVideos && flowData.previewVideos.some((v) => v.status !== MediaJobStatusEnum.DONE),
    retry: 1,
  });

  // Convert Preview[] to PreviewAssetItem[]
  const assetsList: PreviewAssetItem[] = useMemo(() => {
    const result: PreviewAssetItem[] = [];
    previewVideos.forEach((video) => {
      const videoUrl = video.outputs?.render_video_out || video.outputs?.sample_video_url || '';
      const isReady = video.status === MediaJobStatusEnum.DONE && videoUrl;
      if (isReady) {
        result.push({
          id: video.id,
          url: videoUrl,
          type: 'video' as const,
          name: 'Preview',
          poster: video.outputs?.thumbnail,
        });
      }
    });
    return result;
  }, [previewVideos]);

  // Handle video preview click
  const handleVideoPreviewClick = (index: number) => {
    const video = previewVideos[index];
    const videoUrl = video.outputs?.render_video_out || video.outputs?.sample_video_url || '';
    if (video.status === MediaJobStatusEnum.DONE && videoUrl && assetsList.length > 0) {
      const initialSlide = assetsList.findIndex((asset) => asset.id === video.id);
      dialogManager.show(AssetsPreviewModal, {
        assetsList,
        initialSlide: initialSlide >= 0 ? initialSlide : 0,
      });
    }
  };

  // Create jobProgressMap for efficient lookup
  const jobProgressMap = useMemo(() => {
    const map = new Map<string, JobProgress>();
    jobProgressList?.forEach((progress) => {
      map.set(progress.job_id, progress);
    });
    return map;
  }, [jobProgressList]);

  // Create mediaJobMap from flowData.flowInfo.child_media_jobs
  const mediaJobMap = useMemo(() => {
    const map = new Map<string, MediaJobType>();
    flowInfo?.child_media_jobs?.forEach((job) => {
      map.set(job.id, job);
    });
    return map;
  }, [flowInfo?.child_media_jobs]);

  useEffect(() => {
    if (flowData?.previewVideos) {
      // Select only jobs with status DONE (completed)
      setSelectedJobs(flowData.previewVideos.filter((job: Preview) => job.status === MediaJobStatusEnum.DONE));
    }
  }, [flowData?.previewVideos]);
  useEffect(() => {
    if (!previewVideos) return;
    if (selectedJobs.length === previewVideos.length) {
      setToggleAll(true);
    } else {
      setToggleAll(false);
    }
  }, [selectedJobs, previewVideos]);

  const toggleJobCheck = (job: Preview) => {
    setSelectedJobs((prev) => {
      if (prev.some((j) => j.id === job.id)) {
        return prev.filter((j) => j.id !== job.id);
      }
      return [...prev, job];
    });
  };

  // Handle approve button click
  const handleApproveClick = async () => {
    for (const job of selectedJobs) {
      if (job.status === MediaJobStatusEnum.FAILED) {
        Toast.error('Some selected jobs have failed.');
        return;
      }
      if (job.status !== MediaJobStatusEnum.DONE) {
        Toast.error('Some selected jobs are still rendering.');
        return;
      }
    }
    onApprove(
      item.id,
      selectedJobs.map((j) => j.id)
    );
  };

  if (isFlowLoading) {
    return (
      <Card className="flex-col gap-4 p-5">
        <div className="flex-center flex-col gap-2 py-8">
          <IconPark icon="loading" spin size={20} />
          <span className="text-body-sm text-color-support">Loading...</span>
        </div>
      </Card>
    );
  }
  return (
    <Card className="flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center justify-between border-line-2 border-b pb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-color-title text-title-h6">{item.title}</h3>
          <StatusBadge status={item.status} />
          <div className="flex items-center gap-3 text-body-xs text-color-support">
            <span className="flex items-center gap-1.5">
              <IconPark icon="play" size={14} />
              {previewVideos.length} videos
            </span>

            {/* todo unknown time, comment for now */}
            {/* <div className="flex items-center gap-1.5">
              <IconPark icon="calendar" size={14} />
              <span>Week 3</span>
            </div> */}

            <div className="flex items-center gap-1.5">
              <IconPark icon="clock" size={14} />
              <span>Submitted {formatDistanceToNow(submittedAt, { addSuffix: true })}</span>
            </div>
          </div>
        </div>

        {/* Targeting & Budget Info */}
        {/* Temporarily hidden */}
        {/* <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <IconPark icon="promote" size={16} className="text-blue-500" />
            <div className="flex-col gap-0">
              <p className="font-semibold text-body-sm text-color-title">{targetingAgeRange}</p>
              <p className="text-color-support text-label-xs">{targetingInterests.join(', ')}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-line-2" />
          <div className="flex items-center gap-2">
            <IconPark icon="price" size={16} className="text-green-500" />
            <div className="flex-col gap-0">
              <p className="font-semibold text-body-sm text-color-title">${dailyBudget}/day</p>
              <p className="text-color-support text-label-xs">~${(dailyBudget * 7).toLocaleString()}/week</p>
            </div>
          </div>
        </div> */}
      </div>

      {/* Video Grid - using HorizontalScrollArea */}
      {previewVideos.length > 0 ? (
        <HorizontalScrollArea className="w-full">
          <div className="flex gap-3">
            {previewVideos.map((video, index) => {
              const progress = jobProgressMap.get(video.id);
              const mediaJob = mediaJobMap.get(video.id);
              const isSelected = selectedJobs.some((j) => j.id === video.id);
              return (
                <VideoPreview
                  key={video.id}
                  video={video}
                  index={index}
                  jobProgress={progress}
                  mediaJob={mediaJob}
                  muteOnHoverPlay={false}
                  onClick={() => handleVideoPreviewClick(index)}
                  checked={isSelected}
                  onCheckedChange={() => toggleJobCheck(video)}
                />
              );
            })}
          </div>
        </HorizontalScrollArea>
      ) : (
        <div className="flex-center flex-col gap-2 py-8 text-body-sm text-color-support">
          <IconPark icon="video-camera" size={24} />
          <span>No videos available</span>
        </div>
      )}

      {/* AI Reasoning */}
      {item.reason && (
        <div className="flex gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <IconPark icon="ai" size={16} className="shrink-0 text-blue-500" />
          <div className="flex-col gap-1">
            <p className="font-semibold text-color-title text-label-xs">AI Reasoning</p>
            <p className="text-body-sm text-color-support leading-relaxed">{item.reason}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-line-2 border-t pt-4">
        <Button size="md" variant="text" onClick={() => onReject(item.id, item.title, 'ad-set')} icon="close">
          Reject
        </Button>
        <div className="flex items-center gap-3">
          <Button
            size="md"
            onClick={() => {
              setSelectedJobs((prev) => {
                if (toggleAll) {
                  return [];
                }
                return previewVideos;
              });
            }}
          >
            {toggleAll ? 'Unselect all' : 'Select all'}
          </Button>
          <Button
            size="md"
            variant="primary"
            onClick={handleApproveClick}
            icon="check"
            disabled={selectedJobs.length === 0}
          >
            Approve & Schedule
          </Button>
        </div>
      </div>
    </Card>
  );
}
