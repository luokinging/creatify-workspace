import { ImageLoader } from '@/component/ui/image/image-loader';
import type { ToolProductInfoType } from '@/feature/resource/assets-library/type';
import { IconPark } from '@/lib/iconpark/icon';

interface ProductCardProps {
  product: ToolProductInfoType;
  className?: string;
}

export function ProductCard(props: ProductCardProps) {
  const { product, className } = props;
  const imageUrl = product.image_urls?.[0];
  const title = product.title;
  const description = product.description;

  return (
    <div className={`flex items-start gap-4 rounded-lg bg-area-container p-4 ${className || ''}`}>
      {imageUrl ? (
        <ImageLoader
          src={imageUrl}
          alt={title}
          wrapperClassName="size-20 shrink-0 rounded-lg overflow-hidden"
          className="object-cover"
        />
      ) : (
        <div className="size-20 flex-center shrink-0 rounded-lg bg-area-platform">
          <IconPark icon="image" size={28} className="text-color-support" />
        </div>
      )}
      <div className="min-w-0 flex-1 flex-col gap-1.5">
        {title && <p className="font-semibold text-body-md text-color-title leading-tight">{title}</p>}
        {description && <p className="line-clamp-3 text-body-sm text-color-support leading-relaxed">{description}</p>}
      </div>
    </div>
  );
}
