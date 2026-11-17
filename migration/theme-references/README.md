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


## Home, archives and links — 2026-11-18

Read Iris snapshot `56f5cfee0d39c08649a714da68a53200c7600223`:

- [Home](https://github.com/LemonAdorable/astro-theme-iris/blob/56f5cfee0d39c08649a714da68a53200c7600223/src/pages/index.astro)
- [Links](https://github.com/LemonAdorable/astro-theme-iris/blob/56f5cfee0d39c08649a714da68a53200c7600223/src/pages/links/index.astro)

Read Mizuki's [archive](https://github.com/LyraVoid/Mizuki/blob/dbdd3eb039e5e92f9375f5f8f79c3589cdf6ca16/src/pages/archive.astro)
and [calendar utilities](https://github.com/LyraVoid/Mizuki/blob/dbdd3eb039e5e92f9375f5f8f79c3589cdf6ca16/src/components/widgets/calendar/utils/calendarUtils.ts).

Iris informed the full-screen avatar entrance, downward exploration and grouped
link cards/site-information block. Mizuki informed the Monday-first publication
calendar and statistics alongside archives. This is a local implementation, not
a new theme/runtime dependency. Existing Iris licensing remains at repository root;
Mizuki licensing is retained above. No friend identities, music recordings or
upstream artwork were copied.

Integration changes: scroll-linked cover contraction uses normal document scrolling
without the upstream forced return-to-top behavior; avatar motion is scoped to the
avatar button and lifecycle-cleaned; reduced-motion disables tilt, bounce and glitch.
Calendar dates use Asia/Shanghai civil publication days and include leap-year tests.
The optional reading rain sound is generated locally through Web Audio, starts only
on explicit play, and stops on navigation/background. Link groups use the original
blog's public profiles/external links and clearly labelled theme references; there
is no fake exchange, health-check or automated application status.
