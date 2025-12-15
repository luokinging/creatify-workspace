import { Button } from '@/component/ui/button';
import { Card } from '@/component/ui/card/card';
import { IconPark } from '@/lib/iconpark/icon';
import { cn } from '@/util/css';

interface BaseQueueCardProps {
  title: string;
  titleIcon?: string;
  titleBadge?: React.ReactNode;
  metaInfo: Array<{
    icon: string;
    text: string;
  }>;
  children: React.ReactNode;
  actions: Array<{
    label: string;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outlined';
    onClick: () => void;
  }>;
  className?: string;
}

export function BaseQueueCard({
  title,
  titleIcon,
  titleBadge,
  metaInfo,
  children,
  actions,
  className,
}: BaseQueueCardProps) {
  return (
    <Card className={cn('flex-col gap-4 p-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-line-2 border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            {titleIcon && <IconPark icon={titleIcon} size={20} className="text-color-weak" />}
            <h3 className="text-color-title text-title-h6">{title}</h3>
            {titleBadge}
          </div>
          <div className="flex items-center gap-3 text-body-xs text-color-support">
            {metaInfo.map((info, index) => (
              <span key={index} className="flex items-center gap-1.5">
                <IconPark icon={info.icon} size={14} />
                {info.text}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              size="sm"
              variant={action.variant || ('secondary' as any)}
              icon={action.icon}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-col gap-4">{children}</div>
    </Card>
  );
}
