(function registerPWA(){
  if (!("serviceWorker" in navigator)) {
    window.forceAppUpdate = function(){ window.location.reload(); };
    return;
  }

  var refreshing = false;
  function reloadOnce(){
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  }

  function showUpdateBanner(worker){
    var old = document.querySelector(".pwaUpdateBanner");
    if (old) old.remove();
    var el = document.createElement("div");
    el.className = "pwaUpdateBanner";
    el.innerHTML = '<b>새 버전이 준비됐습니다.</b><button type="button">바로 적용</button>';
    el.querySelector("button").addEventListener("click", function(){
      if (worker) worker.postMessage({type:"SKIP_WAITING"});
      else window.forceAppUpdate();
    });
    document.body.appendChild(el);
  }

  window.forceAppUpdate = async function(){
    try {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function(reg){ return reg.update().catch(function(){ return undefined; }); }));
      var keys = window.caches ? await caches.keys() : [];
      await Promise.all(keys.map(function(key){ return caches.delete(key); }));
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({type:"CLEAR_CACHE_AND_RELOAD"});
      }
    } catch (error) {
      console.error("PWA update reset failed:", error);
    }
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);

  window.addEventListener("load", function(){
    navigator.serviceWorker.register("/sw.js", {updateViaCache:"none"}).then(function(registration){
      function watchInstalling(worker){
        if (!worker) return;
        worker.addEventListener("statechange", function(){
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(worker);
          }
        });
      }
      watchInstalling(registration.installing);
      registration.addEventListener("updatefound", function(){
        watchInstalling(registration.installing);
      });
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner(registration.waiting);
      }
      setInterval(function(){ registration.update().catch(function(){}); }, 10 * 60 * 1000);
      document.addEventListener("visibilitychange", function(){
        if (!document.hidden) registration.update().catch(function(){});
      });
    }).catch(function(error){
      console.error("PWA service worker registration failed:", error);
    });
  });
})();
