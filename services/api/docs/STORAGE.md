# Object storage (image uploads)

Dish images can be **uploaded** by the admin and stored in S3-compatible object storage. The API stores only the **URL** in the database; the file lives in your bucket.

## When storage is not configured

- Admin can still **paste an image URL** (any https URL) in the item edit form.
- The **Upload image** button will show an error: "Image upload is not configured."

## Enabling uploads

Set these environment variables (e.g. in `.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `STORAGE_BUCKET` | Yes | Bucket name |
| `STORAGE_PUBLIC_BASE_URL` | Yes | Base URL for public access (e.g. `https://your-bucket.r2.dev` or CloudFront URL). No trailing slash. |
| `STORAGE_ACCESS_KEY_ID` | Yes | Access key |
| `STORAGE_SECRET_ACCESS_KEY` | Yes | Secret key |
| `STORAGE_REGION` | No | Region (default `us-east-1`). For R2/MinIO often `auto` or any value. |
| `STORAGE_ENDPOINT` | No | Custom endpoint (required for Cloudflare R2, MinIO). E.g. `https://<account_id>.r2.cloudflarestorage.com` |

### Example: Cloudflare R2

```env
STORAGE_BUCKET=your-bucket-name
STORAGE_PUBLIC_BASE_URL=https://pub-xxxxx.r2.dev
STORAGE_ACCESS_KEY_ID=your-r2-access-key
STORAGE_SECRET_ACCESS_KEY=your-r2-secret-key
STORAGE_REGION=auto
STORAGE_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
```

### Example: AWS S3

```env
STORAGE_BUCKET=your-bucket-name
STORAGE_PUBLIC_BASE_URL=https://your-bucket.s3.region.amazonaws.com
STORAGE_ACCESS_KEY_ID=AKIA...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_REGION=us-east-1
```

- Ensure the bucket allows **public read** for the objects (or use a CDN/CloudFront in front and set `STORAGE_PUBLIC_BASE_URL` to that).

## API

- **POST /upload/image** (admin only)  
  - Body: `multipart/form-data` with field `file` (image file).  
  - Allowed: JPEG, PNG, WebP, GIF. Max 5MB.  
  - Response: `{ "url": "https://..." }`. Use this URL as `image_url` when creating/updating a menu item.

## Flow

1. Admin selects a file in the item edit form → browser sends it to `POST /upload/image`.
2. API validates type/size, uploads to the bucket with key `menu-items/{uuid}.{ext}`, returns the public URL.
3. Admin form sets the Image URL field to that URL; on **Save**, the item is PATCHed with `image_url` (stored in DB).
4. Public dish detail page shows the image via that URL.
