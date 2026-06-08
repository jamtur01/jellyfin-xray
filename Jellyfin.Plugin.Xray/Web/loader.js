(function () {
  var attempts = 0;
  function load() {
    if (!window.ApiClient || typeof ApiClient.getUrl !== 'function') {
      if (++attempts < 20) {
        window.setTimeout(load, 500);
      }
      return;
    }
    if (document.getElementById('xray-bundle')) {
      return;
    }
    var script = document.createElement('script');
    script.id = 'xray-bundle';
    script.src = ApiClient.getUrl('XRay/script') + '?v=' + Date.now();
    document.body.appendChild(script);
  }
  load();
})();
