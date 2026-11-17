# Navigation and appearance references

Read and adapted for the existing Astro/Iris site on 2026-11-17. No Svelte or
theme runtime dependency was added, and no upstream artwork was copied.

## Fuwari — saicaca

Source snapshot: `6d39b0dec41282e7852e23e032998a5789abee28`.

- [NavMenuPanel.astro](https://github.com/saicaca/fuwari/blob/6d39b0dec41282e7852e23e032998a5789abee28/src/components/widget/NavMenuPanel.astro)
- [DisplaySettings.svelte](https://github.com/saicaca/fuwari/blob/6d39b0dec41282e7852e23e032998a5789abee28/src/components/widget/DisplaySettings.svelte)
- [setting-utils.ts](https://github.com/saicaca/fuwari/blob/6d39b0dec41282e7852e23e032998a5789abee28/src/utils/setting-utils.ts)

Informed the anchored floating panel, hue slider, reset, persisted preference
and pre-paint application. MIT license retained in Fuwari-LICENSE.MIT.

## Mizuki — LyraVoid Team

Source snapshot: `dbdd3eb039e5e92f9375f5f8f79c3589cdf6ca16` (default branch master).

- [NavMenuPanel.astro](https://github.com/LyraVoid/Mizuki/blob/dbdd3eb039e5e92f9375f5f8f79c3589cdf6ca16/src/components/organisms/navigation/NavMenuPanel.astro)
- [SettingsPanel.svelte](https://github.com/LyraVoid/Mizuki/blob/dbdd3eb039e5e92f9375f5f8f79c3589cdf6ca16/src/components/features/settings/SettingsPanel.svelte)
- [backgroundWallpaper.ts](https://github.com/LyraVoid/Mizuki/blob/dbdd3eb039e5e92f9375f5f8f79c3589cdf6ca16/src/config/backgroundWallpaper.ts)

Informed icon-labelled groups, one expanded group at a time, background modes,
banner options and layout settings. Repository Apache-2.0 license retained in
Mizuki-LICENSE.Apache-2.0; inherited Fuwari notices remain credited above.

## Local integration changes

Reimplemented the interaction in lifecycle-managed custom elements for the
existing Astro ClientRouter and persistent header. Closing on navigation,
outside click and Escape, constrained scroll areas, native details controls,
corrupt-storage handling, hue clamping, a namespaced storage key and calculated
text contrast were added locally. This records integration choices, not claims
that every upstream behavior was defective. The new cover is a local vector
landscape, separate from upstream demo images and the unchanged page avatar.
