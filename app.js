(function () {
  const views = {
    home: document.getElementById("view-home"),
    locadora: document.getElementById("view-locadora"),
    centro: document.getElementById("view-centro"),
    construtora: document.getElementById("view-construtora"),
  };

  function setViewVisibility(el, active) {
    if (!el) return;
    el.classList.toggle("view--active", active);
    el.setAttribute("aria-hidden", active ? "false" : "true");
  }

  function show(name) {
    const next = views[name];
    if (!next) return;

    Object.entries(views).forEach(([key, el]) => {
      setViewVisibility(el, key === name);
    });

    document.title =
      name === "home"
        ? "Grupo DK Empreendimentos"
        : `Grupo DK — ${next.getAttribute("aria-label") || name}`;

    window.scrollTo(0, 0);
    if (name === "home") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } else {
      history.replaceState(null, "", `#${name}`);
    }
  }

  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-go");
      if (target) show(target);
    });
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => show("home"));
  });

  if (window.location.hash === "#locadora") show("locadora");
  else if (window.location.hash === "#centro") show("centro");
  else if (window.location.hash === "#construtora") show("construtora");
  else {
    setViewVisibility(views.home, true);
    Object.keys(views).forEach((k) => {
      if (k !== "home") setViewVisibility(views[k], false);
    });
  }

  window.addEventListener("hashchange", () => {
    const h = window.location.hash.slice(1);
    if (views[h]) show(h);
    else if (!h) show("home");
  });
})();
