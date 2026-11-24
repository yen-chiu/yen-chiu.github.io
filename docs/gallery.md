# Gallery / 光影档案

Static Astro gallery. R2 is object storage, not a relational database. Git-versioned metadata in src/data/photos.ts is the initial catalogue. Upload only exported, GPS-stripped WebP/JPEG derivatives to your own public R2 custom domain, then add their thumbnail and preview HTTPS URLs and dimensions to the catalogue. Keep RAW and originals in a private bucket. Set lifecycle and CORS as appropriate; no credentials in client code. No bucket or external database has been provisioned.

Design references: Frud's Blog (https://www.aibrium.cn/), astro-gallery (https://github.com/SlashGordon/astro-gallery), PicImpact (https://github.com/besscroft/PicImpact), PhotoSwipe (https://photoswipe.com/). Original implementation uses native dialog, no copied code or photographs. Current gallery is empty until authorized photographs are supplied. Future work: upload pipeline, srcset derivatives, albums with dedicated routes, optional D1 if authenticated admin is needed.
