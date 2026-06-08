(function () {
  function load() {
    if (!window.ApiClient || typeof ApiClient.getUrl !== 'function') {
      window.setTimeout(load, 500);
      return;
    }
    if (document.getElementById('xray-bundle')) {
      return;
    }
    var script = document.createElement('script');
    script.id = 'xray-bundle';
    script.src = ApiClient.getUrl('XRay/script') + '?v=' + Date.now();
    script.defer = true;
    document.body.appendChild(script);
  }
  load();
})();
