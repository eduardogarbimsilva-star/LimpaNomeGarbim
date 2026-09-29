/* =========================================================
   Milena Garbim · Limpa Nome — recursos de destaque
   Inspirados em sites de referência (ver README):
   - Diagnóstico em 30 segundos (ferramenta tipo Serasa/Nubank)
   - Frase que acende com a rolagem (Apple)
   - Dicas compartilháveis e "Indique para uma amiga" (Nubank, Natura)
   - Botões magnéticos, barra fixa no celular
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const MG = window.MG || {}, D = window.Dados, CFG = window.SITE_CONFIG || {};
  const esc = MG.esc || ((t) => String(t)), avisar = MG.avisar || alert, icone = MG.icone || (() => "");
  const menosMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const endereco = () => location.href.split(/[?#]/)[0].replace(/[^/]*$/, "");
  const zap = () => String(CFG.whatsapp || "").replace(/\D/g, "");

  /* ---------- Compartilhar (celular: menu do aparelho; computador: WhatsApp) ---------- */
  async function compartilhar(texto) {
    const url = endereco();
    if (navigator.share) {
      try { await navigator.share({ title: "Milena Garbim · Limpa Nome", text: texto, url }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    window.open("https://wa.me/?text=" + encodeURIComponent(texto + "\n\n" + url), "_blank", "noopener");
  }
  document.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-compartilhar]");
    if (c) { compartilhar(c.dataset.compartilhar); return; }
    if (e.target.closest("[data-indicar]")) {
      e.preventDefault();
      compartilhar("Oi! Conheci a Milena Garbim, que ajuda a limpar o nome e recuperar o crédito com transparência. Faz um diagnóstico grátis em 30 segundos 👇");
      return;
    }
    const cop = e.target.closest("[data-copiar-link]");
    if (cop) {
      try { await navigator.clipboard.writeText(endereco()); avisar("Link copiado! É só colar para quem você quiser."); }
      catch (err) { avisar("Copie este link: " + endereco()); }
    }
  });

  /* ---------- Frase que acende palavra por palavra com a rolagem ---------- */
  const manifesto = $("[data-manifesto]");
  if (manifesto) {
    let palavras = [], mexendo = false;
    const separar = () => {
      mexendo = true;
      const texto = manifesto.textContent.trim();
      manifesto.innerHTML = texto.split(/\s+/).map((p) => `<span class="mp">${esc(p)}</span>`).join(" ");
      palavras = $$(".mp", manifesto);
      mexendo = false;
      acender();
    };
    function acender() {
      const r = manifesto.getBoundingClientRect(), vh = innerHeight;
      const prog = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const n = menosMovimento ? palavras.length : Math.round(prog * palavras.length);
      palavras.forEach((p, i) => p.classList.toggle("acesa", i < n));
    }
    manifesto.dataset.fonte = manifesto.innerHTML;   // o painel compara com isto antes de trocar o texto
    new MutationObserver(() => { if (!mexendo && !manifesto.querySelector(".mp")) separar(); }).observe(manifesto, { childList: true });
    separar();
    addEventListener("scroll", () => requestAnimationFrame(acender), { passive: true });
  }

  /* ---------- Dicas: carrossel ---------- */
  const trilho = $("[data-dicas]");
  if (trilho) {
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-dica-passo]");
      if (!b) return;
      const passo = ($(".dica", trilho) || { offsetWidth: 300 }).offsetWidth + 18;
      trilho.scrollBy({ left: passo * +b.dataset.dicaPasso, behavior: menosMovimento ? "auto" : "smooth" });
    });
  }

  /* ---------- Diagnóstico em 30 segundos ---------- */
  const quiz = $("[data-quiz]");
  if (quiz) {
    const passos = $$(".quiz-passo", quiz), barra = $(".quiz-barra span", quiz), resultado = $(".quiz-resultado", quiz);
    let respostas = [];
    const ir = (i) => {
      passos.forEach((p, k) => { p.classList.toggle("ativo", k === i); p.classList.toggle("feito", k < i); });
      barra.style.width = ((i) / passos.length * 100) + "%";
    };
    quiz.addEventListener("click", async (e) => {
      const op = e.target.closest(".quiz-op");
      if (op) {
        const i = +op.closest(".quiz-passo").dataset.passo;
        respostas[i] = { valor: op.dataset.valor, texto: op.textContent };
        op.classList.add("escolhida");
        setTimeout(() => { if (i + 1 < passos.length) ir(i + 1); else mostrar(); }, 260);
        return;
      }
      if (e.target.closest("[data-refazer]")) { respostas = []; resultado.hidden = true; $$(".quiz-op", quiz).forEach((b) => b.classList.remove("escolhida")); ir(0); return; }
      const sol = e.target.closest("[data-quiz-solicitar]");
      if (sol && window.Solicitacao) { if (!window.Solicitacao.tem(sol.dataset.quizSolicitar)) window.Solicitacao.alternar(sol.dataset.quizSolicitar); else MG.abrirGaveta && MG.abrirGaveta(); }
    });
    async function mostrar() {
      barra.style.width = "100%";
      passos.forEach((p) => { p.classList.remove("ativo"); p.classList.add("feito"); });
      const [o, tempo, tentou] = respostas.map((r) => r && r.valor);
      let cat = { categorias: [], servicos: [] };
      try { cat = await D.catalogo(true); } catch (err) { /* sem catálogo: mostra só o contato */ }
      const daCategoria = (id) => cat.servicos.filter((s) => s.categoria === id);
      let indicados = daCategoria(o);
      const notas = [];
      if (tempo === "antigo" && ["limpa-nome", "negativacao-indevida"].includes(o)) {
        notas.push("Negativação com mais de 5 anos não pode continuar no seu nome. Vale conferir a contestação.");
        if (o !== "negativacao-indevida") indicados = indicados.concat(daCategoria("negativacao-indevida"));
      }
      if (o === "bacen") notas.push("O Bacen tem dois métodos. Na análise, a Milena indica qual cabe no seu caso.");
      if (tentou === "tentou") notas.push("Não desanime: com a negociação certa, muitos casos que pareciam travados se resolvem.");
      if (tentou === "negociando") notas.push("Antes de fechar um acordo, vale uma segunda opinião sobre valores e juros.");
      const nomeCat = (cat.categorias.find((c) => c.id === o) || {}).nome || respostas[0].texto;
      const resumo = `Olá, Milena! Fiz o diagnóstico no site:\n• ${respostas[0].texto}\n• Há quanto tempo: ${respostas[1].texto}\n• Já tentou resolver: ${respostas[2].texto}`;
      const linkZap = zap() ? "https://wa.me/" + zap() + "?text=" + encodeURIComponent(resumo) : "index.html#analise";
      resultado.innerHTML = `<span class="quiz-num">Seu resultado</span>
        <h3>Caminho indicado: <em>${esc(nomeCat)}</em></h3>
        ${notas.map((n) => `<p class="quiz-nota">${icone("alerta")}${esc(n)}</p>`).join("")}
        <div class="quiz-indicados">${indicados.slice(0, 3).map((s) => `<div class="quiz-servico"><div><strong>${esc(s.nome)}</strong><small>${esc(s.resumo || "")}</small></div>
          <button type="button" class="btn btn-primario" data-quiz-solicitar="${esc(s.id)}">${icone("mais")}Solicitar</button></div>`).join("")}</div>
        <div class="botoes-form">
          <a class="btn btn-whats" href="${esc(linkZap)}" ${zap() ? 'target="_blank" rel="noopener"' : ""}>Falar com a Milena</a>
          <button type="button" class="btn btn-contorno-rosa" data-compartilhar="Fiz um diagnóstico grátis do meu nome com a Milena Garbim em 30 segundos. Faz o seu também 👇">${icone("enviar")}Compartilhar</button>
          <button type="button" class="btn-texto" data-refazer>Refazer</button>
        </div>
        <p class="quiz-aviso">Indicação inicial. A análise com a Milena confirma o melhor caminho para o seu caso.</p>`;
      resultado.hidden = false;
      resultado.classList.remove("aparece"); void resultado.offsetWidth; resultado.classList.add("aparece");
    }
    ir(0);
  }

  /* ---------- Botões magnéticos (computador) ---------- */
  if (!menosMovimento && matchMedia("(pointer: fine)").matches) {
    $$(".hero .btn, .cta .btn, .indique .btn").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.translate = `${(e.clientX - r.left - r.width / 2) * .22}px ${(e.clientY - r.top - r.height / 2) * .3}px`;
      });
      b.addEventListener("pointerleave", () => { b.style.translate = ""; });
    });
  }

  /* ---------- Barra fixa no celular: aparece depois do topo ---------- */
  const barraCel = $(".barra-celular");
  if (barraCel) {
    const aqui = location.pathname.split("/").pop() || "index.html";
    $$("a[href]", barraCel).forEach((a) => { if (a.getAttribute("href").split("#")[0] === aqui && !a.getAttribute("href").includes("#")) a.classList.add("ativo"); });
    const ver = () => barraCel.classList.toggle("mostrar", scrollY > 280 || !$(".hero"));
    addEventListener("scroll", ver, { passive: true });
    ver();
  }
})();
