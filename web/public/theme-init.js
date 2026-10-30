(function () {
  try {
    var pref = localStorage.getItem("dksoft.theme");
    if (pref === "light" || pref === "dark") {
      document.documentElement.dataset.theme = pref;
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch (e) {
    /* armazenamento bloqueado: segue o tema do sistema */
  }
})();
