(() => {
  const hostname = window.location.hostname.toLowerCase();
  const productionHosts = ["brasaland.site", "www.brasaland.site"];
  const apiOrigin = productionHosts.includes(hostname) ? "https://api.brasaland.site" : "";
  window.brasalandApiUrl = (path) => `${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
})();
