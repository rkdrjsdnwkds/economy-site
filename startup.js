(function(){
  window.__ECONOMY_BOOT_STARTED__ = false;
  window.__ECONOMY_FIREBASE_READY__ = false;

  var APP_VERSION = "175";
  var LOCAL_URL = "http://127.0.0.1:5000/";

  if(location.protocol === "file:"){
    var fileEl = document.getElementById("status");
    if(fileEl){
      fileEl.innerHTML = "<b>로컬 서버로 실행해야 합니다</b><div class='sub'>index.html을 직접 더블클릭해서 여는 방식이 아니라, " + LOCAL_URL + " 주소에서 실행해야 합니다.</div><p class='small'>서버가 이미 켜져 있다면 <a href='" + LOCAL_URL + "'>" + LOCAL_URL + "</a> 로 이동하세요.</p>";
    }
    return;
  }

  window.addEventListener("error", function(e){
    var el = document.getElementById("status");
    if(el && !window.__ECONOMY_FIREBASE_READY__){
      el.innerHTML = "<b>Startup error</b><div class='sub'>" + (e.message || "Unknown error") + "</div><p class='small'>Please send the red Console error from F12.</p>";
    }
  });

  setTimeout(function(){
    var el = document.getElementById("status");
    if(el && !window.__ECONOMY_BOOT_STARTED__){
      el.innerHTML = "<b>Firebase module load failed</b><div class='sub'>The app script did not start. Refresh with Ctrl+F5, or open http://127.0.0.1:5000/ directly.</div>";
    }
  }, 5000);

  function scriptVersion(){
    var cfg = window.ECONOMY_SITE_CONFIG || {};
    return (cfg.meta && cfg.meta.version) || APP_VERSION;
  }

  function loadScript(src, onload){
    var script = document.createElement("script");
    script.src = src;
    script.onload = onload;
    script.onerror = onload;
    document.head.appendChild(script);
  }

  function loadApp(){
    var script = document.createElement("script");
    script.type = "module";
    script.src = "app.js?v=" + encodeURIComponent(scriptVersion());
    script.onerror = function(){
      var el = document.getElementById("status");
      if(el){
        el.innerHTML = "<b>App file load failed</b><div class='sub'>Could not load app.js. Refresh with Ctrl+F5, or open http://127.0.0.1:5000/ directly.</div>";
      }
    };
    document.head.appendChild(script);
  }

  loadScript("site-config.js?v=" + Date.now(), function(){
    loadScript("catalog.js?v=" + Date.now(), loadApp);
  });
})();
