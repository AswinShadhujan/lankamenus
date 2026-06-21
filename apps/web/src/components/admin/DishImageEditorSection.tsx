'use client';

import { useEffect, useState } from 'react';
import { resolvePublicMediaUrl } from '@/lib/api';
import { resolveDishDisplayImageUrl } from '@/lib/dish-image';
import type { MenuItem } from '@/types/menu';
import { DishImagePreview } from '@/components/admin/DishImagePreview';

type Item = Pick<MenuItem, 'image_url' | 'media_asset'>;

export type DishImageEditorSectionProps = {
  item: Item;
  /** Primary URL field (HTTPS / legacy string shown in preview when set). */
  primaryUrlValue: string;
  onPrimaryUrlChange: (value: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputDisabled?: boolean;
  /** Bump after each upload attempt ends so local file preview clears on failure. */
  uploadVersion?: number;
  /** Optional: apply primary URL as managed cover immediately (PATCH image-url). */
  showPrimaryApply?: boolean;
  onApplyPrimaryUrl?: () => void | Promise<void>;
  primaryApplyBusy?: boolean;
  primaryApplyLabel?: string;
  /** Optional second field (e.g. legacy `image_url` saved with full form). */
  showSecondaryUrl?: boolean;
  secondaryUrlLabel?: string;
  secondaryUrlValue?: string;
  onSecondaryUrlChange?: (value: string) => void;
  errorText?: string | null;
  hint?: string;
};

const PLACEHOLDER_CLS =
  'flex max-h-48 min-h-[7rem] w-full max-w-md items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-secondary)]';

export function DishImageEditorSection({
  item,
  primaryUrlValue,
  onPrimaryUrlChange,
  onFileChange,
  fileInputDisabled,
  uploadVersion = 0,
  showPrimaryApply = false,
  onApplyPrimaryUrl,
  primaryApplyBusy,
  primaryApplyLabel = 'Apply URL as cover',
  showSecondaryUrl = false,
  secondaryUrlLabel = 'Legacy image URL (saved with form)',
  secondaryUrlValue = '',
  onSecondaryUrlChange,
  errorText,
  hint,
}: DishImageEditorSectionProps) {
  const [stagedBlobUrl, setStagedBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (stagedBlobUrl) URL.revokeObjectURL(stagedBlobUrl);
    };
  }, [stagedBlobUrl]);

  useEffect(() => {
    setStagedBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [uploadVersion]);

  const serverResolved = resolveDishDisplayImageUrl(item);
  const draftResolved = primaryUrlValue.trim()
    ? resolvePublicMediaUrl(primaryUrlValue.trim())
    : '';

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setStagedBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      if (file && file.type.startsWith('image/')) {
        return URL.createObjectURL(file);
      }
      return null;
    });
    onFileChange(e);
  };

  const showPreview = Boolean(stagedBlobUrl || draftResolved || serverResolved);

  return (
    <div className="space-y-3">
      <span className="admin-label">Dish image</span>
      {hint ? <p className="text-small text-[var(--text-secondary)]">{hint}</p> : null}

      <div>
        <p className="admin-text-muted mb-1 text-xs">Preview</p>
        {stagedBlobUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stagedBlobUrl}
            alt=""
            className="max-h-48 w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] object-contain"
          />
        ) : showPreview ? (
          <DishImagePreview
            url={draftResolved || serverResolved}
            variant="editor"
          />
        ) : (
          <div className={PLACEHOLDER_CLS} role="img" aria-label="No image yet">
            No image yet — upload a file or enter a URL below.
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Upload image</p>
        <label className="admin-btn-primary inline-block cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={fileInputDisabled}
            onChange={handlePickFile}
          />
          {fileInputDisabled ? 'Uploading…' : 'Choose image file'}
        </label>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          JPEG, PNG, WebP or GIF · max 5 MB. Replaces the dish cover once the upload request succeeds.
        </p>
      </div>

      <div>
        <label htmlFor="dish-editor-primary-url" className="admin-label">
          Image URL (https)
        </label>
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <input
            id="dish-editor-primary-url"
            type="url"
            value={primaryUrlValue}
            onChange={(e) => onPrimaryUrlChange(e.target.value)}
            placeholder="https://…"
            className="admin-input min-w-[200px] flex-1"
            disabled={Boolean(primaryApplyBusy)}
          />
          {showPrimaryApply && onApplyPrimaryUrl ? (
            <button
              type="button"
              className="admin-btn-secondary shrink-0"
              disabled={primaryApplyBusy || !primaryUrlValue.trim()}
              onClick={() => void onApplyPrimaryUrl()}
            >
              {primaryApplyBusy ? 'Saving…' : primaryApplyLabel}
            </button>
          ) : null}
        </div>
        {showPrimaryApply ? (
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Apply stores the URL as managed cover.{' '}
            {showSecondaryUrl
              ? 'Use the legacy field below if you need the classic image_url column on save.'
              : null}
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Saved with the dish when you click Save dish (legacy image field).
          </p>
        )}
      </div>

      {showSecondaryUrl && onSecondaryUrlChange ? (
        <div>
          <label htmlFor="dish-editor-secondary-url" className="admin-label">
            {secondaryUrlLabel}
          </label>
          <input
            id="dish-editor-secondary-url"
            type="url"
            value={secondaryUrlValue}
            onChange={(e) => onSecondaryUrlChange(e.target.value)}
            placeholder="Optional; saved with full form submit"
            className="admin-input mt-1"
          />
        </div>
      ) : null}

      {errorText ? <p className="admin-text-error text-sm">{errorText}</p> : null}
    </div>
  );
}
