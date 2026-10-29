// Appliqué avant l'affichage (évite le flash blanc en thème sombre)
(function () {
  try {
    var t = localStorage.getItem('sakafo_theme') || 'auto';
    var dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
})();
