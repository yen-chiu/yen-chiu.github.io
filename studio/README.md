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
6. With its secret fine-grained GitHub token, the Worker **only** updates
   `src/assets/avatar.png` on `main` via the GitHub Contents API.
7. Existing `.github/workflows/deploy.yml` creates
   `wendell-avatar-animated.webp` and `wendell-avatar-animated.gif` from the
   updated PNG and deploys them. It also builds the normal Astro static avatar.

The preview is a CSS motion preview, **not an encoder-generated WebP/GIF**.
The files are only produced after the GitHub Actions build completes. No
automatic publishing happens on file selection or preview.

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
   that published builds produce both image formats.

For more conservative operation, run the Worker in a staging environment
before supplying any GitHub write credential. Publishing writes to
**main by design**, but implementing and evaluating the Studio itself is done
on branch `feature/avatar-studio`; there is no automatic merge.

## Security boundaries

- A hidden URL, `robots.txt`, or frontend password is **not** access
  control. Auth is enforced on **all** Worker routes.
- The Worker independently verifies the **RS256 JWT** with Cloudflare's
  signing keys, exact issuer, audience, expiration and owner email. If
  configuration is incomplete, it denies requests.
- All writes require `POST /api/publish` with matching `Origin`, an
  explicit confirmation header, a PNG body, and valid PNG IHDR constraints.
- The only permissible destination is one fixed repo/path/branch.
- GitHub credentials remain server-side. No image upload goes to the server
  until the user explicitly confirms.
- Cloudflare Access setup and secret creation are external account actions
  and are **not** performed by merging this code. Until configured and
  deployed, the Studio is not an accessible, functioning live service.
