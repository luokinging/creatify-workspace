import { Button, IconButton } from '@/component/ui/button';
import { Card } from '@/component/ui/card/card';
import { SimpleTooltip } from '@/component/ui/tooltip/simple-tooltip';
import { dialogManager } from '@/feature/component.dialog/manager';
import { AssetsPreviewModal } from '@/feature/component.dialog/modal/assets-preview.modal';
import { usePermissionValue } from '@/feature/permission/hook';
import { featuresPermissionItems } from '@/feature/permission/permission-items';
import type { PreviewAssetItem } from '@/feature/tool.url-to-video/type';
import { IconPark } from '@/lib/iconpark/icon';
import { cn } from '@/util/css';
import { titleForm } from '@/util/string';
import { formatDistanceToNow } from 'date-fns';
import { useRef } from 'react';
import type { AnalysisPipeline } from '../../api/analysis-pipeline';
import { AnalysisPipelineActionTypeEnum, AnalysisPipelineImpactLevelEnum } from '../../api/analysis-pipeline';
import { AnalysisPipelineDebugDialog } from '../../component/analysis-pipeline-debug-dialog';
import { useQueuePageViewController } from '../../context/queue-page-view-controller.context';

interface AnalysisQueueItemCardProps {
  item: AnalysisPipeline;
  onApprove: (id: string) => void;
  onReject: (id: string, name: string, type: 'recommendation') => void;
  onRequestChanges?: (id: string, name: string, type: 'recommendation') => void;
}

export function AnalysisQueueItemCard({ item, onApprove, onReject, onRequestChanges }: AnalysisQueueItemCardProps) {
  const submittedAt = new Date(item.created_at);
  // Priority: use actual_start_time from meta_ads_ad, fallback to campaign start_time
  const adRunningTimeStr = item.meta_ads_ad?.actual_start_time || item.meta_ads_campaign?.start_time;
  const adRunningTime = adRunningTimeStr ? new Date(adRunningTimeStr) : null;
  const canAccessStaffFeatures = usePermissionValue(featuresPermissionItems.canAccessCreatifyStaffFeatures);
  const vc = useQueuePageViewController();

  const actionDetail = item.action_detail;
  const budgetChange = actionDetail?.budget_change;
  const currentValue = budgetChange?.current ?? 0;
  const newValue = budgetChange?.suggested ?? 0;
  const delta = newValue - currentValue;
  const deltaPercent = budgetChange?.change_percent ?? 0;

  const typeConfig = {
    [AnalysisPipelineActionTypeEnum.SCALE]: {
      label: 'Promote to Scale Campaign',
      icon: 'chart-line',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
    },
    [AnalysisPipelineActionTypeEnum.PAUSE]: {
      label: 'Turn Off',
      icon: 'close',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
    },
    [AnalysisPipelineActionTypeEnum.RUN_LONGER]: {
      label: 'Run Longer',
      icon: 'add',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    [AnalysisPipelineActionTypeEnum.ADD_BUDGET]: {
      label: 'Add Budget',
      icon: 'chart-line',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
  };

  const config = typeConfig[item.action_type] || {
    label: 'Unknown Action',
    icon: 'info',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
  };

  const impactConfig = {
    [AnalysisPipelineImpactLevelEnum.LOW]: {
      label: 'Low Impact',
      className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      icon: 'info-line',
    },
    [AnalysisPipelineImpactLevelEnum.MEDIUM]: {
      label: 'Medium Impact',
      className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      icon: 'info-line',
    },
    [AnalysisPipelineImpactLevelEnum.HIGH]: {
      label: 'High Impact',
      className: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      icon: 'info-line',
    },
    [AnalysisPipelineImpactLevelEnum.CRITICAL]: {
      label: 'Critical Impact',
      className: 'bg-red-500/10 text-red-500 border-red-500/20',
      icon: 'info-line',
    },
  };

  const impact = impactConfig[item.level] || {
    label: 'Unknown Impact',
    className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    icon: 'info-line',
  };

  const hasMedia = item.cu_job.url_type === 'video' || item.cu_job.url_type === 'image';
  const videoUrl = item.cu_job.url_type === 'video' ? item.cu_job.url : undefined;
  const thumbnailUrl = item.cu_job.url_type === 'image' ? item.cu_job.url : undefined;

  return (
    <Card className="flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-start gap-3 border-line-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn('flex items-center gap-2 rounded-lg border px-3 py-1.5', config.bgColor, config.borderColor)}
          >
            <IconPark icon={config.icon} size={16} className={config.color} />
            <span className={cn('font-semibold text-label-sm', config.color)}>{config.label}</span>
          </div>
          <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1', impact.className)}>
            <IconPark icon={impact.icon} size={14} />
            <span className="font-medium text-label-xs">{impact.label}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4 text-body-xs text-color-support">
          {adRunningTime && (
            <SimpleTooltip content="Ad running time">
              <div className="flex items-center gap-1.5">
                <IconPark icon="calendar" size={14} />
                <span>{formatDistanceToNow(adRunningTime, { addSuffix: true })}</span>
              </div>
            </SimpleTooltip>
          )}

          <SimpleTooltip content="Recommendation created">
            <div className="flex items-center gap-1.5">
              <IconPark icon="clock" size={14} />
              <span>{formatDistanceToNow(submittedAt, { addSuffix: true })}</span>
            </div>
          </SimpleTooltip>
        </div>
      </div>

      {/* Main Content: Video + Details */}
      <div className="flex gap-6">
        {/* Left: Video Preview */}
        {hasMedia && (
          <LargeVideoPreview
            videoUrl={videoUrl}
            thumbnailUrl={thumbnailUrl}
            cuJobId={item.cu_job.id}
            muteOnHoverPlay={false}
            onClick={() => {
              if (videoUrl || thumbnailUrl) {
                const assetsList: PreviewAssetItem[] = [
                  {
                    id: item.cu_job.id,
                    url: videoUrl || thumbnailUrl || '',
                    type: videoUrl ? ('video' as const) : ('image' as const),
                    name: item.title || 'Preview',
                    poster: thumbnailUrl,
                  },
                ];
                dialogManager.show(AssetsPreviewModal, {
                  assetsList,
                  initialSlide: 0,
                });
              }
            }}
          />
        )}

        {/* Right: Ad Info + Metrics + Action + Reasoning */}
        <div className="flex-1 flex-col gap-4">
          {/* Ad Name and Campaign Name */}
          <div className="flex-col gap-2">
            <div
              className="flex cursor-pointer items-center gap-1 text-color-title text-title-h6 hover:underline"
              onClick={() => {
                vc.navigateToAdMetric(item);
              }}
            >
              <span>{titleForm(item.meta_ads_ad?.name || 'N/A')}</span>
              <IconPark icon="jump-page" size={14} />
            </div>

            {item.meta_ads_campaign && (
              <div
                className={cn(
                  'flex cursor-pointer items-center gap-1 text-color-support text-label-sm',
                  'hover:underline'
                )}
                onClick={() => {
                  vc.navigateToCampaignMetric(item);
                }}
              >
                <span>{item.meta_ads_campaign.name}</span>
                <IconPark icon="jump-page" size={14} />
              </div>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2">
            {item.annotate_data?.metrics?.map((metric) => {
              const rawValue = metric.formatted_value || metric.value;
              const displayValue =
                rawValue === null || rawValue === undefined || rawValue === 'N/A' || rawValue === ''
                  ? '-'
                  : String(rawValue);

              return (
                <MetricCard
                  key={metric.key}
                  label={metric.key}
                  value={displayValue}
                  performance={levelToLocalColorMap[metric.level || ('yellow' as const)]}
                />
              );
            })}
          </div>

          {/* Action Details */}
          {/* {actionDetail && (
            <div className="flex items-center justify-between rounded-lg border border-line-2 bg-area-platform p-3">
              <div className="flex items-center gap-2">
                <IconPark icon="chart-line" size={16} className="text-color-support" />
                <p className="font-semibold text-color-title text-label-sm">Recommended Action</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-body-sm text-color-title">
                    {actionDetail.action_type === 'pause'
                      ? 'Active'
                      : budgetChange?.currency
                        ? `${budgetChange.currency} ${formatMetric(currentValue, 'currency').replace('$', '')}`
                        : formatMetric(currentValue, 'currency')}
                  </p>
                  <IconPark icon="arrow-right" size={16} className="text-color-weak" />
                  <p className={cn('font-semibold text-body-sm', delta > 0 ? 'text-green-500' : 'text-red-500')}>
                    {actionDetail.action_type === 'pause'
                      ? 'Paused'
                      : budgetChange?.currency
                        ? `${budgetChange.currency} ${formatMetric(newValue, 'currency').replace('$', '')}`
                        : formatMetric(newValue, 'currency')}
                  </p>
                </div>
                {budgetChange && deltaPercent !== 0 && (
                  <div
                    className={cn(
                      'rounded-lg px-2.5 py-1',
                      delta > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    )}
                  >
                    <p className="font-semibold text-label-sm">
                      <span>{delta >= 0 ? '+' : ''}</span>
                      {deltaPercent.toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )} */}

          {/* Reasoning */}
          {item.reason && (
            <div className="flex-col gap-1 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <div className="flex items-center gap-2">
                <IconPark icon="ai" size={16} className="shrink-0 text-blue-500" />
                <div className="font-semibold text-color-title text-label-sm">{item.title || 'AI Reasoning'}</div>
              </div>

              <div className="text-body-sm text-color-support leading-relaxed">{item.reason}</div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-line-2 border-t pt-4">
        <Button
          size="md"
          variant="ghost"
          onClick={() => onReject(item.id, item.title || 'N/A', 'recommendation')}
          icon="close"
        >
          Reject
        </Button>

        <div className="flex items-center gap-3">
          {canAccessStaffFeatures && (
            <IconButton
              size="md"
              variant="secondary"
              onClick={async () => {
                try {
                  await dialogManager.show(AnalysisPipelineDebugDialog, {
                    data: item,
                    title: 'Card Debug Info',
                  });
                } catch {
                  // User closed dialog - ignore
                }
              }}
              icon="setting"
            />
          )}
          {onRequestChanges && (
            <Button
              size="md"
              variant="secondary"
              onClick={() => onRequestChanges?.(item.id, item.title || 'N/A', 'recommendation')}
              icon="feedback"
            >
              Request Changes
            </Button>
          )}
          {/* Request Changes button removed - backend doesn't provide corresponding API */}
          <Button size="md" variant="primary" onClick={() => onApprove(item.id)} icon="check">
            Approve & Execute
          </Button>
        </div>
      </div>
    </Card>
  );
}

export const colorToClassMap = {
  good: 'border-green-500/20 bg-green-500/5',
  neutral: 'border-line-2 bg-area-platform',
  bad: 'border-red-500/20 bg-red-500/5',
};

export const levelToLocalColorMap = {
  yellow: 'neutral' as const,
  green: 'good' as const,
  red: 'bad' as const,
} as const;
interface MetricCardProps {
  label: string;
  value: string;
  performance: keyof typeof colorToClassMap;
}

function MetricCard({ label, value, performance }: MetricCardProps) {
  return (
    <div
      className={cn(
        'flex-col gap-1.5 rounded-lg border p-3',
        // neutral && 'border-line-2 bg-area-platform',
        // good && 'border-green-500/20 bg-green-500/5',
        // !good && !neutral && 'border-red-500/20 bg-red-500/5'
        colorToClassMap[performance]
      )}
    >
      <p className="font-medium text-body-xs text-color-support">{label}</p>
      <p className="font-semibold text-body-md text-color-title">{value}</p>
    </div>
  );
}

interface LargeVideoPreviewProps {
  videoUrl?: string;
  thumbnailUrl?: string;
  cuJobId: string;
  muteOnHoverPlay?: boolean;
  onClick?: () => void;
}

function LargeVideoPreview({
  videoUrl,
  thumbnailUrl,
  cuJobId,
  muteOnHoverPlay = true,
  onClick,
}: LargeVideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  function handleMouseEnter() {
    if (videoRef.current && videoUrl) {
      videoRef.current.play();
    }
  }

  function handleMouseLeave() {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  return (
    <div
      className="group relative aspect-[9/16] w-1/2 max-w-[200px] shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line-2 bg-area-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="size-full object-cover"
          muted={muteOnHoverPlay}
          loop
          playsInline
        />
      ) : thumbnailUrl ? (
        <img src={thumbnailUrl} alt="Preview" className="size-full object-cover" />
      ) : (
        <div className="size-full flex-center bg-gradient-to-br from-blue-500/10 to-purple-500/10">
          <IconPark icon="play" size={24} className="text-color-weak" />
        </div>
      )}
      {/* Play icon overlay - shows when not playing */}
      {videoUrl && (
        <div className="pointer-events-none absolute inset-0 flex-center bg-black/20 opacity-100 transition-opacity group-hover:opacity-0">
          <div className="size-12 flex-center rounded-full bg-black/60">
            <IconPark icon="play" size={24} className="text-white" />
          </div>
        </div>
      )}
    </div>
  );
}
