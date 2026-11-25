/* SPRUCE UP Digital Engineering — assinatura do rodapé e selo no canto da tela.
   Mesmo arquivo em todos os sites feitos pela SPRUCE UP.
   - Rodapé: logo leve (S sem fundo + nome), que se adapta ao fundo claro ou escuro do site.
   - Selo: aparece sozinho no canto inferior esquerdo, fica acima dos botões que já existem ali,
     encolhe para o "S", some quando o rodapé aparece e pode ser fechado (volta depois de 3 dias). */
(function () {
  var SPRUCE_URL = "https://spruce-up-gamma.vercel.app/";
  var S_IMG = "assets/img/spruce-s-t.webp";
  var CHAVE = "spruce-selo-fechado";
  var reduzido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function luminancia(el) {
    for (var n = el; n && n !== document.documentElement; n = n.parentElement) {
      var c = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
      if (c && (c.length < 4 || +c[3] > 0.2)) return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    }
    return 1;
  }

  /* ---------- Rodapé ---------- */
  document.querySelectorAll(".spruce-assinatura").forEach(function (a) {
    if (SPRUCE_URL) { a.href = SPRUCE_URL; a.target = "_blank"; a.rel = "noopener"; }
    if (!a.querySelector(".spruce-logo")) {
      var logo = document.createElement("span");
      logo.className = "spruce-logo";
      logo.innerHTML = '<img src="' + S_IMG + '" alt="" width="114" height="120"><span class="spruce-nome"><strong>SPRUCE <b>UP</b></strong><small>Digital Engineering</small></span>';
      a.appendChild(logo);
      a.setAttribute("aria-label", "Site desenvolvido por SPRUCE UP Digital Engineering");
    }
    if (luminancia(a) < 0.45) a.classList.add("spruce-escuro");
  });
  document.querySelectorAll("[data-spruce-link]").forEach(function (a) {
    if (!SPRUCE_URL) return;
    a.href = SPRUCE_URL; a.target = "_blank"; a.rel = "noopener"; a.hidden = false;
  });

  /* ---------- Selo no canto ---------- */
  if (!SPRUCE_URL) return;
  try { if (Date.now() - (+localStorage.getItem(CHAVE) || 0) < 3 * 864e5) return; } catch (e) { /* sem armazenamento */ }

  var selo = document.createElement("div");
  selo.className = "spruce-selo";
  selo.innerHTML =
    '<a class="spruce-selo-link" href="' + SPRUCE_URL + '" target="_blank" rel="noopener" aria-label="Site desenvolvido por SPRUCE UP Digital Engineering">' +
      '<span class="spruce-selo-s"><img src="' + S_IMG + '" alt="" width="114" height="120"></span>' +
      '<span class="spruce-selo-txt"><small>Site desenvolvido por</small><b>SPRUCE <i>UP</i> Digital Engineering</b></span>' +
    "</a>" +
    '<button type="button" class="spruce-selo-fechar" aria-label="Fechar selo da SPRUCE UP">×</button>';
  document.body.appendChild(selo);

  // fica acima de qualquer botão fixo que já esteja no canto inferior esquerdo (voltar ao topo, chat, barra do celular)
  function posicionar() {
    var baixo = 18, alturaTela = window.innerHeight;
    var fixos = document.querySelectorAll("body *");
    for (var i = 0; i < fixos.length; i++) {
      var el = fixos[i];
      if (el === selo || selo.contains(el)) continue;
      var st = getComputedStyle(el);
      if (st.position !== "fixed" || st.display === "none" || st.visibility === "hidden" || +st.opacity < 0.1) continue;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.left > 240 || r.bottom < alturaTela - 220 || r.height > alturaTela * 0.5) continue;
      baixo = Math.max(baixo, Math.round(alturaTela - r.top + 12));
    }
    selo.style.setProperty("--spruce-selo-baixo", baixo + "px");
  }
  var espera = 0;
  function reposicionar() { clearTimeout(espera); espera = setTimeout(posicionar, 250); }
  window.addEventListener("resize", reposicionar);
  window.addEventListener("scroll", reposicionar, { passive: true });

  // some quando a assinatura do rodapé está na tela
  var rodape = document.querySelector(".spruce-rodape");
  if (rodape && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { selo.classList.toggle("is-oculto", es[0].isIntersecting); }).observe(rodape);
  }

  selo.querySelector(".spruce-selo-fechar").addEventListener("click", function () {
    selo.classList.remove("is-visivel");
    try { localStorage.setItem(CHAVE, String(Date.now())); } catch (e) { /* sem armazenamento */ }
    setTimeout(function () { selo.remove(); }, 600);
  });

  // botões de outros recursos (chat, voltar ao topo) podem surgir depois: confere a posição de tempos em tempos
  setInterval(function () { if (!document.hidden) posicionar(); }, 1500);

  setTimeout(function () {
    posicionar();
    // no celular aparece só o "S" (o espaço do canto é pequeno); no computador abre o nome por alguns segundos
    var largo = window.innerWidth >= 600;
    selo.classList.add("is-visivel");
    if (largo) {
      selo.classList.add("is-aberto");
      setTimeout(function () { selo.classList.remove("is-aberto"); }, reduzido ? 5000 : 6500);
    } else {
      selo.classList.add("is-pulso");
    }
  }, 2500);
})();
