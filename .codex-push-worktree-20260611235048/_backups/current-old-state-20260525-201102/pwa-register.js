(function registerPWA(){
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function(){
    navigator.serviceWorker.register("/sw.js").catch(function(error){
      console.error("PWA service worker registration failed:", error);
    });
  });
})();
