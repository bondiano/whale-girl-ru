(() => {
  (() => {
    "use strict";
    if (typeof window.__TAURI__ === "undefined") return;
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;
    window.whaleGirl = {
      getManifest: () => invoke("get_manifest"),
      getSheet: (characterId, sheet) => invoke("get_sheet", { characterId, sheet }),
      interact: (action) => invoke("interact", { action }),
      setHitarea: (rect) => invoke("set_hitarea", { rect }),
      dragWindow: (dx, dy) => invoke("drag_window", { dx, dy }),
      onAnim: (cb) => listen("wg-anim", (e) => cb(e.payload)),
      onSnapshot: (cb) => listen("wg-snapshot", (e) => cb(e.payload)),
      onReply: (cb) => listen("wg-reply", (e) => cb(e.payload))
    };
  })();
})();
