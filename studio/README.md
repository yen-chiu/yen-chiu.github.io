# Avatar Studio

This is the private avatar publisher for the Vesper blog. It is **not** a
public Astro page. The front end and upload API run on a dedicated Cloudflare
Worker, and are inaccessible without an authenticated Cloudflare Access
session for one explicitly allowlisted email address.

## Publishing model

1. Sign in to the protected Worker using Cloudflare Access.
2. Select a square PNG (128–2048 px, max 4 MiB).
3. Preview both static and gently floating appearances *locally*.
4. Explicitly confirm publishing in the browser.
5. The Worker validates the Access JWT signature, application AUD, expiration,
   exact allowlisted email, request origin, content type, and image header.
6. With its secret fine-grained GitHub token, the Worker **only stages**
   `src/assets/avatar.png` on branch `feature/avatar-studio` via the GitHub Contents API.
7. The branch-only `.github/workflows/avatar-studio-publish.yml` builds and
   validates both `wendell-avatar-animated.webp` and `.gif` from that staged PNG.
8. The dedicated job commits all three resources to `main` in **one commit**
   and explicitly dispatches `deploy.yml`. The normal Pages job no longer
   installs Pillow or converts the avatar.

The preview is a CSS motion preview, **not an encoder-generated WebP/GIF**.
Files are generated in the separate Avatar Studio GitHub Actions job **after confirmation**.
No publishing occurs on file selection or preview. If the image generator or
verification fails, `main` remains untouched. A successful staged PNG commit
means only that generation was queued, not that the site is deployed.

## Setup (required before use)

1. On Cloudflare, configure a dedicated Worker custom domain such as
   `studio.yenchiu.com`. Do **not** copy the private Studio to the public
   Astro `src/pages` or `public` directories.
2. In **Cloudflare Zero Trust → Access → Applications**, create a self-hosted
   Access application for the exact Studio hostname. Set its Allow policy to
   **one specific account email only**. Enable protection for the Worker on
   **every served route/hostname**, including any `workers.dev` routes and
   preview deployments. The checked-in `wrangler.toml` explicitly disables
   `workers.dev` exposure.
3. Set these Worker environment variables in Cloudflare:
   - `ACCESS_TEAM_DOMAIN`: your actual `<team>.cloudflareaccess.com` domain
   - `ACCESS_AUD`: the exact Access application's AUD tag
   - `OWNER_EMAIL`: the exact email address allowed to sign in
4. Create a **fine-grained GitHub personal access token** scoped **only** to
   `yen-chiu/yen-chiu.github.io` with `Contents: Read and write`. Store
   the token in a Cloudflare Worker **secret** named `GITHUB_TOKEN`. Never
   put this token, email, or Access identifiers in a committed file.
5. Deploy from this branch with an authenticated Wrangler session:
   `npx wrangler deploy --config studio/wrangler.toml`
   After deployment, attach the exact protected custom domain to the Worker.
6. Visit the Studio while logged out and confirm that Access requires login.
   Verify a different account is denied, the correct account can preview a
   PNG, and the Publish action still requires a confirmation dialog. Confirm
   that the Avatar Studio image job generates both formats, commits all three
   files atomically to `main`, dispatches the normal Pages build and that the
   public site serves the matching new resources.

For more conservative operation, run the Worker in a staging environment
before supplying any GitHub write credential. Publishing writes to
**main only after a successful isolated asset-generation job**; initial
uploads go to `feature/avatar-studio`. Code changes do not automatically merge.

## Security boundaries

- A hidden URL, `robots.txt`, or frontend password is **not** access
  control. Auth is enforced on **all** Worker routes.
- The Worker independently verifies the **RS256 JWT** with Cloudflare's
  signing keys, exact issuer, audience, expiration and owner email. If
  configuration is incomplete, it denies requests.
- All writes require `POST /api/publish` with matching `Origin`, an
  explicit confirmation header, a PNG body, and valid PNG IHDR constraints.
- The Worker's only permissible destination is the fixed staging branch and
  PNG source path. The trusted Actions job can update exactly three fixed
  paths in `main` in one commit.
- GitHub credentials remain server-side. No image upload goes to the server
  until the user explicitly confirms.
- Cloudflare Access setup and secret creation are external account actions
  and are **not** performed by merging this code. Until configured and
  deployed, the Studio is not an accessible, functioning live service.
