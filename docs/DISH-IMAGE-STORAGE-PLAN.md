# Dish image storage – plan and implementation reference

This document describes the chosen approach for storing dish images and how it was implemented, so it can be referred to when extending or re-implementing the feature.

---

## 1. Design decision: where to store images

- **Do not store image binary data in the database.** Storing blobs in the DB increases size, complicates backups, and is harder to scale.
- **Store the image file in object storage** (e.g. AWS S3, Cloudflare R2, MinIO).
- **Store only the image URL in the database** (existing `menu_items.image_url` column). The app treats this as a single source of truth for “where the image is”.

This keeps the DB small and fast, uses storage that is built for files, and keeps the same API/UI contract (everything works with a URL).

---

## 2. Ways to get an image URL

| Option | How it works | When to use |
|--------|----------------|-------------|
| **A. Paste URL** | Admin pastes an existing https URL; we save it in `image_url`. | Image already hosted elsewhere (CDN, another site). No storage setup needed. |
| **B. Upload → object storage → save URL** | Admin uploads a file; API uploads it to S3/R2; API returns URL; we save that URL in `image_url`. | You want to own the assets and not depend on external image hosts. |

Both options store **only the URL** in the DB. Option B is the “complete” solution that includes upload-to-storage.

---

## 3. What was implemented (for Option B)

### 3.1 API

- **Storage module** (`services/api/src/storage/`)
  - **StorageService**: S3-compatible client (AWS S3, R2, MinIO). Uploads a buffer with key `menu-items/{uuid}.{ext}`, returns public URL. Only active when required env vars are set.
  - **StorageController**: `POST /upload/image` (admin only). Accepts `multipart/form-data` with field `file`. Validates image type (JPEG, PNG, WebP, GIF) and size (max 5MB). Uploads via service and returns `{ url }`.
- **Env (optional):** `STORAGE_BUCKET`, `STORAGE_PUBLIC_BASE_URL`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, and optionally `STORAGE_REGION`, `STORAGE_ENDPOINT`. See `services/api/docs/STORAGE.md`.

### 3.2 Admin UI

- **Item edit form** (`apps/web/src/app/admin/restaurants/[id]/menus/[menuId]/items/[itemId]/edit/page.tsx`)
  - “Upload image” file input: on file select, calls `POST /upload/image`, then sets the Image URL field to the returned `url`.
  - Image URL text input is unchanged: admin can still paste any https URL.
  - Saving the form PATCHes the item with `image_url` (and other fields). So the flow is: upload (get URL) → URL is in the form → Save (URL stored in DB).

### 3.3 Database

- No change: `menu_items.image_url` remains a nullable string. It holds either a pasted URL or the URL returned from the upload endpoint.

---

## 4. Flow summary

1. Admin opens item edit → chooses “Upload image” or pastes a URL.
2. If upload: browser sends file to `POST /upload/image` → API uploads to object storage → returns URL → form sets Image URL to that URL.
3. Admin clicks Save → form PATCHes item with `image_url` (and other fields) → DB stores only the URL.
4. Public dish detail page loads item, gets `image_url`, and renders `<img src={image_url} />` (or equivalent). The image is served from object storage (or the pasted URL).

---

## 5. Configuration and docs

- **Enable uploads:** set the `STORAGE_*` env vars (see `services/api/docs/STORAGE.md` for required/optional vars and examples for R2 and S3).
- **Without storage config:** upload endpoint returns an error; admins can still paste URLs and save them in `image_url`.

---

## 6. If you need to re-implement or extend later

- Keep the rule: **DB stores only the URL.** Any new upload pipeline should still end by writing a URL into `image_url`.
- New storage backends: implement the same contract as `StorageService` (e.g. `uploadImage(buffer, mimetype) => Promise<{ url }>`).
- New upload entry points (e.g. mobile admin): reuse `POST /upload/image` or add a similar endpoint that returns a URL and then update the item’s `image_url` via existing PATCH.

This plan is the single reference for “how dish images are stored and how upload fits in.”
