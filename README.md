# YouTube Keep Playing

Kiss the *"Video paused. Continue watching?"* prompt goodbye.

A maintained revival of [lawfx/YoutubeNonStop](https://github.com/lawfx/YoutubeNonStop)
(MIT), which has not accepted fixes for a long time while YouTube keeps changing
how the confirm dialog is triggered. This fork keeps the original core logic and
adds a resilience layer so playback survives the failure modes reported against
the upstream extension:

| Failure mode (upstream issues) | What this fork does |
|---|---|
| Background tab stops working ([#72](https://github.com/lawfx/YoutubeNonStop/issues/72)) | MutationObserver on `ytd-popup-container` + 3s timer scan: any confirm dialog that appears while you're idle is dismissed even when the popup event never fires |
| Autoplay stalls with no dialog ([#70](https://github.com/lawfx/YoutubeNonStop/issues/70)) | Same scan layer catches dialogs the event path misses |
| Content warning interstitials ([#67](https://github.com/lawfx/YoutubeNonStop/issues/67)) | Auto-confirms the "I understand and wish to proceed" button |
| Complete boot failure if YouTube renames an app element | Boot is hardened: a missing `ytd-app` no longer prevents the scan/advisory layers from starting; the video element is claimed at boot, not only on mutation |

Also works on [music.youtube.com](https://music.youtube.com) (YT Music), where
upstream had stopped working ([#66](https://github.com/lawfx/YoutubeNonStop/issues/66)).

## Install

**Firefox** — [Firefox Add-ons listing](https://addons.mozilla.org/) (search
"YouTube Keep Playing") or load the signed `.zip` via `about:debugging`.

**Chrome / Edge** — load this folder unpacked via `chrome://extensions`
(Developer mode → Load unpacked).

## Manual install (temporary, any browser)

1. Download this repo as a ZIP.
2. Firefox: `about:debugging` → *This Firefox* → *Load Temporary Add-on…* → pick `manifest.json`.
3. The icon shows ▶; click it to confirm the extension is active.

## How it works

Three independent layers, all gated on ~5s of user inactivity (your own pause
inputs are always honored):

1. **Popup event** — YouTube fires `yt-popup-opened` when the confirm dialog
   opens; we click it away and resume playback.
2. **DOM scan** — a MutationObserver plus a fallback timer watch the popup
   container for `yt-confirm-dialog-renderer` elements, covering background
   tabs and cases where the event never fires.
3. **Media-key guard** — prevents YouTube from hijacking the media-session
   pause handler, so your media keys still pause playback for real.

## License

MIT — original work Copyright (c) 2018 Nikos Ioannou; see [LICENSE](LICENSE).
Modifications Copyright (c) 2026.
