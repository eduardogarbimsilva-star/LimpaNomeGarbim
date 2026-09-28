/* =========================================================
   Limpa Nome Garbim — comportamento das páginas
   ========================================================= */
(function () {
  var CFG = window.SITE_CONFIG || {};
  var numeroWhats = String(CFG.whatsapp || "").replace(/\D/g, "");

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }

  function linkWhats(texto) {
    if (!numeroWhats) return "";
    return "https://wa.me/" + numeroWhats + "?text=" + encodeURIComponent(texto || "");
  }

  function avisar(msg) {
    var t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("visivel");
    clearTimeout(avisar.tempo);
    avisar.tempo = setTimeout(function () { t.classList.remove("visivel"); }, 4200);
  }

  /* ---------- Dados do config.js ---------- */
  $$("[data-cfg]").forEach(function (el) {
    var v = CFG[el.getAttribute("data-cfg")];
    if (v) el.textContent = v;
    else if (el.hasAttribute("data-cfg-ocultar")) (el.closest("[data-cfg-bloco]") || el).hidden = true;
  });

  $$("[data-email]").forEach(function (a) {
    if (CFG.email) a.href = "mailto:" + CFG.email;
    else (a.closest("[data-cfg-bloco]") || a).hidden = true;
  });

  /* ---------- Links do WhatsApp ---------- */
  var textoPadrao = "Olá! Vim pelo site da " + (CFG.empresa || "Limpa Nome Garbim") + " e quero fazer uma análise do meu nome.";
  $$("[data-whats]").forEach(function (a) {
    var texto = a.getAttribute("data-whats") || textoPadrao;
    var link = linkWhats(texto);
    if (link) { a.href = link; a.target = "_blank"; a.rel = "noopener"; }
    else {
      a.href = (document.getElementById("analise") ? "" : "index.html") + "#analise";
      a.addEventListener("click", function () { avisar("Preencha o formulário de análise que entramos em contato."); });
    }
  });
  if (!numeroWhats) $$("[data-so-whats]").forEach(function (el) { el.hidden = true; });

  /* ---------- Redes sociais ---------- */
  var temRede = false;
  $$("[data-rede]").forEach(function (a) {
    var url = (CFG.redes || {})[a.getAttribute("data-rede")];
    if (url) { a.href = url; a.hidden = false; temRede = true; }
  });
  $$("[data-canais]").forEach(function (el) { el.hidden = !temRede; });

  /* ---------- Ano no rodapé ---------- */
  $$("[data-ano]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Menu no celular ---------- */
  var btnMenu = $(".btn-menu"), menu = $("nav .menu");
  if (btnMenu && menu) {
    btnMenu.addEventListener("click", function () {
      var aberto = menu.classList.toggle("aberto");
      btnMenu.setAttribute("aria-expanded", aberto ? "true" : "false");
    });
    $$("a", menu).forEach(function (a) {
      a.addEventListener("click", function () { menu.classList.remove("aberto"); btnMenu.setAttribute("aria-expanded", "false"); });
    });
  }

  /* ---------- Animação de entrada ---------- */
  var revelar = $$(".revelar");
  if ("IntersectionObserver" in window) {
    var obs = new IntersectionObserver(function (itens) {
      itens.forEach(function (i) { if (i.isIntersecting) { i.target.classList.add("visivel"); obs.unobserve(i.target); } });
    }, { threshold: 0.12 });
    revelar.forEach(function (el) { obs.observe(el); });
  } else revelar.forEach(function (el) { el.classList.add("visivel"); });

  /* ---------- Medidor de score do topo (animação) ---------- */
  var medidor = $("[data-medidor]");
  if (medidor) {
    var arco = $(".arco-valor", medidor), numero = $("[data-score]", medidor);
    var alvo = +medidor.getAttribute("data-medidor") || 780, total = 251.3, inicio = null, de = 320;
    var reduzir = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function desenhar(v) {
      arco.style.strokeDashoffset = total * (1 - v / 1000);
      numero.textContent = Math.round(v);
    }
    if (reduzir) desenhar(alvo);
    else {
      desenhar(de);
      setTimeout(function () {
        requestAnimationFrame(function passo(t) {
          if (!inicio) inicio = t;
          var p = Math.min((t - inicio) / 1800, 1), e = 1 - Math.pow(1 - p, 3);
          desenhar(de + (alvo - de) * e);
          if (p < 1) requestAnimationFrame(passo);
        });
      }, 400);
    }
  }

  /* ---------- Máscara de telefone ---------- */
  $$("input[data-telefone]").forEach(function (inp) {
    inp.addEventListener("input", function () {
      var d = inp.value.replace(/\D/g, "").slice(0, 11), s = d;
      if (d.length > 2) s = "(" + d.slice(0, 2) + ") " + d.slice(2);
      if (d.length > 7) s = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
      inp.value = s;
    });
  });

  /* ---------- Formulário de análise -> WhatsApp ---------- */
  var form = $("#form-analise");
  if (form) {
    var servicoUrl = new URLSearchParams(location.search).get("servico");
    if (servicoUrl && form.servico) {
      $$("option", form.servico).forEach(function (o) { if (o.value === servicoUrl || o.textContent === servicoUrl) form.servico.value = o.value; });
    }
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nome = form.nome.value.trim().replace(/\s+/g, " ");
      var tel = form.telefone.value.replace(/\D/g, "");
      var erro = "";
      if (!/^[A-Za-zÀ-ÿ'.-]+( [A-Za-zÀ-ÿ'.-]+)+$/.test(nome)) erro = "Informe seu nome e sobrenome.";
      else if (!/^[1-9]{2}9?\d{8}$/.test(tel)) erro = "Informe um WhatsApp válido com DDD.";
      else if (!form.aceite.checked) erro = "Para continuar, aceite a Política de Privacidade.";
      if (erro) { avisar(erro); return; }

      var orgaos = $$("input[name=orgaos]:checked", form).map(function (c) { return c.value; });
      var linhas = [
        "Olá, " + (CFG.proprietaria ? CFG.proprietaria.split(" ")[0] : "tudo bem") + "! Quero uma análise do meu nome.",
        "",
        "*Nome:* " + nome,
        "*WhatsApp:* " + form.telefone.value,
        form.cidade.value.trim() ? "*Cidade/UF:* " + form.cidade.value.trim() : "",
        "*Serviço:* " + form.servico.value,
        "*Valor aproximado das dívidas:* " + form.valor.value,
        "*Onde está negativado:* " + (orgaos.length ? orgaos.join(", ") : "Não sei"),
        form.mensagem.value.trim() ? "*Detalhes:* " + form.mensagem.value.trim() : ""
      ].filter(function (l, i) { return l !== "" || i === 1; });
      var texto = linhas.join("\n");
      var link = linkWhats(texto);

      if (link) {
        window.open(link, "_blank", "noopener");
        avisar("Abrimos o WhatsApp com a sua mensagem. É só enviar!");
      } else if (CFG.email) {
        location.href = "mailto:" + CFG.email + "?subject=" + encodeURIComponent("Análise de nome - " + nome) + "&body=" + encodeURIComponent(texto.replace(/\*/g, ""));
      } else {
        avisar("Canal de atendimento ainda não configurado. Tente novamente em breve.");
      }
    });
  }
})();
