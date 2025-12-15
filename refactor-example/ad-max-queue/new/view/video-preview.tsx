import { Checkbox } from '@/component/ui/checkbox';
import { ImageLoader } from '@/component/ui/image/image-loader';
import {
  MediaJobBottomBadgeMask,
  MediaJobFailedMask,
  MediaJobInQueueMask,
  MediaJobRunningMask,
} from '@/feature/common/component/preview-widget/video-mask';
import type { Preview } from '@/feature/tool.url-to-video/type';
import { getVideoTotalSeconds } from '@/feature/tool.url-to-video/video-util';
import { type JobProgress, MediaJobStatusEnum, type MediaJobType } from '@/type/media-job';
import { cn } from '@/util/css';
import { useRef } from 'react';

interface VideoPreviewProps {
  video: Preview;
  index: number;
  className?: string;
  jobProgress?: JobProgress;
  mediaJob?: MediaJobType;
  muteOnHoverPlay?: boolean;
  onClick?: () => void;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  checkboxDisabled?: boolean;
}

export function VideoPreview({
  video,
  index,
  className,
  jobProgress,
  mediaJob,
  muteOnHoverPlay = true,
  onClick,
  checked,
  onCheckedChange,
  checkboxDisabled = false,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Extract video URL and thumbnail from Preview
  const videoUrl = video.outputs?.render_video_out || video.outputs?.sample_video_url || '';
  const thumbnailUrl = video.outputs?.thumbnail || '';

  // Safe duration calculation with null check
  const duration = (() => {
    if (video.status === MediaJobStatusEnum.FAILED) return 0;
    if (!video.layoutData && !video.layoutDataV2) return 0;
    try {
      return Math.round(getVideoTotalSeconds(video));
    } catch (error) {
      console.error('Failed to calculate video duration:', error);
      return 0;
    }
  })();

  // Loading state: when layoutData is missing and status is not FAILED
  const isLoading = !video.layoutData && !video.layoutDataV2 && video.status !== MediaJobStatusEnum.FAILED;

  // Status flags
  const isVideoReady = video.status === MediaJobStatusEnum.DONE && videoUrl;
  const isInQueue = video.status === MediaJobStatusEnum.IN_QUEUE;
  const isRunning = video.status === MediaJobStatusEnum.RUNNING;
  const isFailed = video.status === MediaJobStatusEnum.FAILED;
  const isDone = video.status === MediaJobStatusEnum.DONE;
  const isPending = video.status === MediaJobStatusEnum.PENDING;

  // Progress percentage
  const progress = jobProgress?.data?.pct || 0;

  // Failed reason
  const failedTitle = mediaJob?.outputs?.generate_preview_failed ? 'Preview generation failed' : undefined;
  const failedDescription = mediaJob?.outputs?.preview_failed_reason;

  function handleMouseEnter() {
    if (videoRef.current && videoUrl && isVideoReady) {
      videoRef.current.play();
    }
  }

  function handleMouseLeave() {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  const renderMask = () => {
    if (isLoading) {
      return (
        <MediaJobInQueueMask
          show={true}
          className="backdrop-blur-none"
          title="Loading..."
          description="Preparing video preview..."
        />
      );
    }
    if (isInQueue) {
      return <MediaJobInQueueMask show={true} className="backdrop-blur-none" />;
    }
    if (isRunning) {
      return <MediaJobRunningMask show={true} className="backdrop-blur-none" progress={progress} />;
    }
    if (isFailed) {
      return <MediaJobFailedMask show={true} title={failedTitle} description={failedDescription} />;
    }
    // no need to render done mask
    // if (isDone) {
    //   return <MediaJobDoneMask show={true} />;
    // }

    return null;
  };

  return (
    <div
      className={cn(
        `group relative aspect-[9/16] w-[160px] cursor-pointer overflow-hidden rounded-lg border border-line-2 bg-area-container`,
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Video or Thumbnail */}
      {isVideoReady ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="size-full object-cover"
          muted={muteOnHoverPlay}
          loop
          playsInline
        />
      ) : thumbnailUrl ? (
        <ImageLoader src={thumbnailUrl} alt={`Video ${index + 1}`} className="size-full object-cover" />
      ) : (
        <div className="size-full flex-center bg-gradient-to-br from-blue-500/10 to-purple-500/10">
          <div className="text-body-sm text-color-weak">{renderMask() === undefined ? 'No preview' : renderMask()}</div>
        </div>
      )}

      {/* Loading Mask - shown when layoutData is missing */}
      <MediaJobInQueueMask
        show={isLoading}
        className="backdrop-blur-none"
        title="Loading..."
        description="Preparing video preview..."
      />

      {/* Status Masks */}
      {/* <MediaJobInQueueMask show={isInQueue && !isLoading} className="backdrop-blur-none" />

      <MediaJobRunningMask show={isRunning} className="backdrop-blur-none" progress={progress} />

      <MediaJobFailedMask show={isFailed} title={failedTitle} description={failedDescription} />

      <MediaJobDoneMask show={isDone} /> */}
      {renderMask()}

      <MediaJobBottomBadgeMask
        show={!isInQueue && !isRunning && !isLoading && duration > 0}
        duration={duration}
        isEdited={video.is_edited && isPending}
      />

      {/* Checkbox and Video number */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        {onCheckedChange !== undefined && (
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => {
              onCheckedChange(value === true);
            }}
            disabled={checkboxDisabled}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        )}
        {/* <div className="size-6 flex-center rounded-full bg-black/80 font-medium text-label-xs text-white">
          {index + 1}
        </div> */}
      </div>
    </div>
  );
}
