import { IconPark } from '@/lib/iconpark/icon';
import { cn } from '@/util/css';
import { CreationPipelineStatusEnum } from '../../api/creation-pipeline';
import { AdSetStatus } from '../../type';

const adSetStatusConfig = {
  [AdSetStatus.PENDING_APPROVAL]: {
    label: 'Pending Approval',
    icon: 'clock',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
  [AdSetStatus.APPROVED]: {
    label: 'Approved',
    icon: 'check',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
  },
  [AdSetStatus.REJECTED]: {
    label: 'Rejected',
    icon: 'close',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  [AdSetStatus.DEPLOYED]: {
    label: 'Deployed',
    icon: 'promote',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  [AdSetStatus.LIVE]: {
    label: 'Live',
    icon: 'play',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
  },
};

const creationPipelineStatusConfig = {
  [CreationPipelineStatusEnum.PENDING]: {
    label: 'Pending Approval',
    icon: 'clock',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
  [CreationPipelineStatusEnum.APPROVED]: {
    label: 'Approved',
    icon: 'check',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
  },
  [CreationPipelineStatusEnum.DECLINED]: {
    label: 'Declined',
    icon: 'close',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
};

interface StatusBadgeProps {
  status: AdSetStatus | CreationPipelineStatusEnum;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Check if it's a CreationPipelineStatusEnum
  const isCreationPipelineStatus = Object.values(CreationPipelineStatusEnum).includes(
    status as CreationPipelineStatusEnum
  );

  const config = isCreationPipelineStatus
    ? creationPipelineStatusConfig[status as CreationPipelineStatusEnum]
    : adSetStatusConfig[status as AdSetStatus];

  if (!config) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border px-2 py-1 font-medium text-label-xs',
        config.color,
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <IconPark icon={config.icon} size={12} />
      {config.label}
    </div>
  );
}
