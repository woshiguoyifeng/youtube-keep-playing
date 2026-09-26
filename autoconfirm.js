const tag = '[YouTube Keep Playing]';
const isYoutubeMusic = window.location.hostname === 'music.youtube.com';

const confirmNodename = isYoutubeMusic ? 'YTMUSIC-YOU-THERE-RENDERER' : 'YT-CONFIRM-DIALOG-RENDERER';
// CSS selectors are case-insensitive, so the lowercase form matches both.
const confirmSelector = confirmNodename.toLowerCase();

const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
const appName = isYoutubeMusic ? 'ytmusic-app' : 'ytd-app';
const popupContainer = isYoutubeMusic ? 'ytmusic-popup-container' : 'ytd-popup-container';

// Content advisory interstitial ("I understand and wish to proceed") — the
// user explicitly opened the video, so this is confirmed regardless of idle.
const advisoryButtonSelector =
  'ytd-watch-flexy[player-unavailable] button[aria-label="I understand and wish to proceed"]';
const advisoryIntervalMillis = 2000;

let pauseRequested = false;
let pauseRequestedTimeout;
const pauseRequestedTimeoutMillis = 5000;
const idleTimeoutMillis = 5000;
let lastInteractionTime = new Date().getTime();

let videoElement = null;
let appObserver = null;
let popupObserverAttached = false;

function log(message) {
  console.log(`${tag}[${getTimestamp()}] ${message}`);
}

function debug(message) {
  console.debug(`${tag}[${getTimestamp()}] ${message}`);
}

function asDoubleDigit(value) {
  return value < 10 ? '0' + value : value;
}

function getTimestamp() {
  let dt = new Date();
  return `${asDoubleDigit(dt.getHours())}:${asDoubleDigit(dt.getMinutes())}:${asDoubleDigit(dt.getSeconds())}`;
}

function isIdle() {
  return getIdleTime() >= idleTimeoutMillis;
}

function getIdleTime() {
  return new Date().getTime() - lastInteractionTime;
}

function listenForMediaKeys() {
  if (navigator.mediaSession === undefined) {
    log("Your browser doesn't seem to support navigator.mediaSession yet :/");
    return;
  }
  debug('Listening to "pause" media key...');
  navigator.mediaSession.setActionHandler('pause', () => {
    debug('Paused due to [media key pause]');
    pauseVideo();
  });
  navigator.mediaSession.yns_setActionHandler = navigator.mediaSession.setActionHandler;
  navigator.mediaSession.setActionHandler = (action, fn) => {
    if (action === 'pause') {
      debug("Blocked attempt to override media key 'pause' action");
      return;
    }
    navigator.mediaSession.yns_setActionHandler(action, fn);
  };
}

function listenForMouse() {
  const eventName = window.PointerEvent ? 'pointer' : 'mouse';
  document.addEventListener(eventName + 'down', (e) => {
    processInteraction(eventName + 'down');
  });
  document.addEventListener(eventName + 'up', (e) => {
    processInteraction(eventName + 'up');
  });
}

function listenForKeyboard() {
  document.addEventListener('keydown', (e) => {
    processInteraction('keydown');
  });
  document.addEventListener('keyup', (e) => {
    processInteraction('keyup');
  });
}

function processInteraction(action) {
  if (pauseRequested) {
    debug(`Paused due to [${action}]`);
    pauseVideo();
    return;
  }
  lastInteractionTime = new Date().getTime();
}

function dismissConfirmPopup() {
  debug('[dismiss confirm popup]');
  const container = document.querySelector(popupContainer);
  if (container) container.click();
  pauseVideo();
  videoElement?.play();
}

function handlePopupOpened(e) {
  if (isIdle() && e.detail && e.detail.nodeName === confirmNodename) {
    dismissConfirmPopup();
  }
}

function listenForPopupEvent() {
  debug('Listening for popup event...');
  document.addEventListener('yt-popup-opened', handlePopupOpened);
}

// Resilience layer: the popup event does not fire in every scenario
// (background tabs, throttled timers, autoplay stall dialogs). Watch the
// popup container directly so any confirm renderer that appears while the
// user is idle gets dismissed even without the event.
function scanPopupContainer() {
  if (!isIdle()) return;
  const open = document.querySelectorAll(
    `${popupContainer} ${confirmSelector}, ${confirmSelector}`);
  if (open.length > 0) {
    debug(`[scan] found ${open.length} confirm dialog(s) in DOM`);
    dismissConfirmPopup();
  }
}

function observePopupContainer(retry) {
  const container = document.querySelector(popupContainer);
  if (!container) {
    if (retry < 20) setTimeout(() => observePopupContainer(retry + 1), 1500);
    return;
  }
  if (popupObserverAttached) return;
  popupObserverAttached = true;
  debug(`Observing ${popupContainer}...`);
  const observer = new MutationObserver(scanPopupContainer);
  observer.observe(container, {childList: true, subtree: true});
  // Timer fallback for when MutationObserver alone is not enough; browsers
  // throttle timers in background tabs, the observer keeps working.
  setInterval(scanPopupContainer, 3000);
}

function overrideVideoPause() {
  if (videoElement?.yns_pause !== undefined) return;
  if (document.querySelector('video') === null) return;

  videoElement = document.querySelector('video');
  listenForMediaKeys();
  debug('Overriding video pause...');
  videoElement.yns_pause = videoElement.pause;
  videoElement.pause = () => {
    debug('Video pause requested');
    if (!isIdle()) {
      debug('Paused due to [pause]');
      pauseVideo();
      return;
    }
    pauseRequested = true;
    setPauseRequestedTimeout();
  };
}

function observeApp() {
  debug(`Observing ${appName}...`);
  appObserver = new MutationObserver((mutations, observer) => {
    overrideVideoPause();
  });

  appObserver.observe(document.querySelector(appName), {
    childList: true,
    subtree: true
  });
}

function autoConfirmAdvisory() {
  const button = document.querySelector(advisoryButtonSelector);
  if (!button) return;
  debug('[auto-confirm advisory prompt]');
  button.click();
}

function setPauseRequestedTimeout(justClear = false) {
  clearTimeout(pauseRequestedTimeout);
  if (justClear) return;
  pauseRequestedTimeout = setTimeout(() => {
    pauseRequested = false;
  }, pauseRequestedTimeoutMillis);
}

function pauseVideo() {
  videoElement?.yns_pause();
  pauseRequested = false;
  setPauseRequestedTimeout(true);
}

listenForMouse();
listenForKeyboard();

listenForPopupEvent();
overrideVideoPause();
try {
  observeApp();
} catch (e) {
  // A redesign could rename the app element; the popup scan and advisory
  // layers below must still boot.
  log(`observeApp failed: ${e}`);
}
observePopupContainer(0);
setInterval(autoConfirmAdvisory, advisoryIntervalMillis);

log(`Monitoring YouTube ${isYoutubeMusic ? 'Music ' : ''}for 'Confirm watching?' action...`);
