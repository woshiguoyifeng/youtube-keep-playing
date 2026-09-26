console.log(`[YouTube Keep Playing v${chrome.runtime.getManifest().version}]`);

const s = document.createElement('script');
s.src = chrome.runtime.getURL('autoconfirm.js');
s.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(s);
