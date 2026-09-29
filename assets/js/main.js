/* =========================================================
   Milena Garbim · Limpa Nome — comportamento das páginas
   - Aplica textos, fotos, dúvidas e contatos salvos pelo painel
   - Catálogo de serviços e "Minha solicitação" (carrinho)
   - Formulário de análise, menu, animações
   ========================================================= */
(function () {
  "use strict";
  const CFG = window.SITE_CONFIG || {};
  const D = window.Dados;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  /** Texto do painel -> HTML: *palavra* vira destaque, quebra de linha vira <br> */
  const fmt = (t) => esc(t).replace(/\*([^*\n]+)\*/g, "<em>$1</em>").replace(/\n/g, "<br>");
  const brl = (v) => (+v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const ICONES = (window.PADRAO || {}).icones || {};
  const icone = (n, cls = "icone-svg") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONES[n] || ICONES.estrela || ""}</svg>`;

  let numeroWhats = String(CFG.whatsapp || "").replace(/\D/g, "");
  const linkWhats = (texto) => (numeroWhats ? "https://wa.me/" + numeroWhats + "?text=" + encodeURIComponent(texto || "") : "");

  function avisar(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("visivel");
    clearTimeout(avisar.tempo);
    avisar.tempo = setTimeout(() => t.classList.remove("visivel"), 4200);
  }

  /* =========================================================
     Contatos (config.js + painel)
     ========================================================= */
  function aplicarContatos(c) {
    Object.assign(CFG, { whatsapp: c.whatsapp, telefone: c.telefone, email: c.email, cnpj: c.cnpj, horario: c.horario, endereco: c.endereco, redes: c.redes });
    numeroWhats = String(c.whatsapp || "").replace(/\D/g, "");
    $$("[data-cfg]").forEach((el) => {
      const v = CFG[el.getAttribute("data-cfg")];
      const bloco = el.closest("[data-cfg-bloco]");
      if (v) { el.textContent = v; if (bloco) bloco.hidden = false; }
      else if (el.hasAttribute("data-cfg-ocultar") && bloco) bloco.hidden = true;
    });
    $$("[data-email]").forEach((a) => {
      const bloco = a.closest("[data-cfg-bloco]") || a;
      if (CFG.email) { a.href = "mailto:" + CFG.email; bloco.hidden = false; } else bloco.hidden = true;
    });
    const textoPadrao = "Olá! Vim pelo site da " + (CFG.empresa || "Milena Garbim") + " e quero fazer uma análise do meu nome.";
    $$("[data-whats]").forEach((a) => {
      const link = linkWhats(a.getAttribute("data-whats") || textoPadrao);
      if (link) { a.href = link; a.target = "_blank"; a.rel = "noopener"; }
      else {
        a.href = (document.getElementById("analise") ? "" : "index.html") + "#analise";
        a.removeAttribute("target");
        if (!a.dataset.semWhats) { a.dataset.semWhats = "1"; a.addEventListener("click", () => { if (!numeroWhats) avisar("Preencha o formulário de análise que entramos em contato."); }); }
      }
    });
    $$("[data-so-whats]").forEach((el) => { el.hidden = !numeroWhats; });
    let temRede = false;
    $$("[data-rede]").forEach((a) => {
      const url = (CFG.redes || {})[a.getAttribute("data-rede")];
      a.hidden = !url; if (url) { a.href = url; temRede = true; }
    });
    $$("[data-canais]").forEach((el) => { el.hidden = !temRede; });
  }

  /* =========================================================
     Textos, fotos e dúvidas do painel
     ========================================================= */
  function aplicarSite(s) {
    $$("[data-texto]").forEach((el) => {
      const v = s.textos[el.getAttribute("data-texto")];
      if (typeof v !== "string") return;
      const html = fmt(v);
      if ((el.dataset.fonte || el.innerHTML) === html) return;   // igual ao que já está: não reinicia a animação
      el.innerHTML = html; el.dataset.fonte = html;
      if (el.matches(".hero h1, .topo-pagina h1")) separarPalavras(el);
    });
    $$("img[data-foto]").forEach((img) => {
      const v = s.fotos[img.getAttribute("data-foto")];
      if (v && img.getAttribute("src") !== v) img.src = v;
    });
    $$("[data-faq]").forEach((el) => {
      const lim = +el.getAttribute("data-faq") || s.faq.length;
      el.innerHTML = s.faq.slice(0, lim).map((f) => `<details class="revelar visivel"><summary>${esc(f.p)}</summary><p>${fmt(f.r)}</p></details>`).join("");
    });
  }

  /* =========================================================
     Catálogo
     ========================================================= */
  let CAT = { categorias: [], servicos: [] };
  const servicosDa = (id) => CAT.servicos.filter((s) => s.categoria === id);

  function textoPreco(s) {
    if (typeof s.preco === "number" && s.preco > 0) return `<span class="preco">${s.aPartir ? "<small>a partir de</small>" : ""}${brl(s.preco)}</span>`;
    return `<span class="preco preco-consulta">Sob consulta</span>`;
  }

  function cartaoCategoria(c) {
    const lista = servicosDa(c.id), n = lista.length;
    const itens = n > 1 ? lista.slice(0, 3).map((s) => `<li>${icone("check")}<span>${esc(s.nome)}</span></li>`).join("") : (lista[0] && lista[0].itens || []).slice(0, 3).map((t) => `<li>${icone("check")}<span>${esc(t)}</span></li>`).join("");
    return `<article class="cartao revelar visivel">
      <div class="ic">${icone(c.icone)}</div>
      ${n > 1 ? `<span class="etiqueta-cat">${n} opções</span>` : ""}
      <h3>${esc(c.nome)}</h3>
      <p>${esc(c.descricao || "")}</p>
      <ul>${itens}</ul>
      <a class="link" href="servicos.html#cat-${esc(c.id)}">${n > 1 ? "Ver opções" : "Ver serviço"} ${icone("seta")}</a>
    </article>`;
  }

  const fotosDe = (s) => (Array.isArray(s.fotos) && s.fotos.length ? s.fotos : s.foto ? [s.foto] : []);
  function cartaoServico(s) {
    const na = Solicitacao.tem(s.id);
    return `<article class="servico-card${s.destaque ? " destaque" : ""}" data-servico="${esc(s.id)}">
      ${fotosDe(s).length ? `<button type="button" class="servico-foto" data-detalhes="${esc(s.id)}" aria-label="Ver fotos de ${esc(s.nome)}"><img src="${esc(fotosDe(s)[0])}" alt="" loading="lazy">${fotosDe(s).length > 1 ? `<span class="qtd-fotos">${icone("foto")}${fotosDe(s).length}</span>` : ""}</button>` : ""}
      <div class="servico-corpo">
        ${s.destaque ? `<span class="etiqueta">Mais procurado</span>` : ""}
        <h3>${esc(s.nome)}</h3>
        <p>${esc(s.resumo || "")}</p>
        ${(s.itens || []).length ? `<ul>${s.itens.map((t) => `<li>${icone("check")}<span>${esc(t)}</span></li>`).join("")}</ul>` : ""}
        <div class="servico-rodape">
          <div>${textoPreco(s)}${s.prazo ? `<small class="prazo">${icone("relogio")}${esc(s.prazo)}</small>` : ""}</div>
          <div class="servico-botoes">
            ${s.descricao || fotosDe(s).length ? `<button type="button" class="btn-texto" data-detalhes="${esc(s.id)}">Detalhes</button>` : ""}
            <button type="button" class="btn ${na ? "btn-adicionado" : "btn-primario"}" data-adicionar="${esc(s.id)}">${na ? icone("check") + "Adicionado" : icone("mais") + "Solicitar"}</button>
          </div>
        </div>
      </div>
    </article>`;
  }

  function desenharCatalogo() {
    $$("[data-categorias]").forEach((el) => {
      const cats = CAT.categorias.filter((c) => servicosDa(c.id).length);
      if (cats.length) el.innerHTML = cats.map(cartaoCategoria).join("");
    });
    const raiz = $("[data-catalogo]");
    if (!raiz) return;
    const cats = CAT.categorias.filter((c) => servicosDa(c.id).length);
    const filtro = $("[data-filtro]");
    if (filtro) {
      filtro.innerHTML = `<button type="button" class="chip-filtro ativo" data-cat="">Todos</button>` +
        cats.map((c) => `<button type="button" class="chip-filtro" data-cat="${esc(c.id)}">${icone(c.icone)}${esc(c.nome)}</button>`).join("");
    }
    raiz.innerHTML = cats.length ? cats.map((c) => {
      const lista = servicosDa(c.id);
      return `<section class="catalogo-cat" id="cat-${esc(c.id)}" data-cat-secao="${esc(c.id)}">
        <header class="catalogo-cab">
          <span class="ic">${icone(c.icone)}</span>
          <div><h2>${esc(c.nome)}</h2>${c.descricao ? `<p>${esc(c.descricao)}</p>` : ""}</div>
          ${lista.length > 1 ? `<span class="etiqueta-cat">${lista.length} opções</span>` : ""}
        </header>
        <div class="grade-servicos${lista.length === 1 ? " unico" : ""}">${lista.map(cartaoServico).join("")}</div>
      </section>`;
    }).join("") : `<p class="vazio">Nenhum serviço disponível no momento. Fale com a gente pelo WhatsApp.</p>`;
    if (location.hash && /^#cat-/.test(location.hash)) { const alvo = document.getElementById(location.hash.slice(1)); if (alvo) setTimeout(() => alvo.scrollIntoView(), 50); }
  }

  document.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cat]");
    if (chip && chip.closest("[data-filtro]")) {
      $$("[data-filtro] .chip-filtro").forEach((b) => b.classList.toggle("ativo", b === chip));
      const id = chip.getAttribute("data-cat");
      $$("[data-cat-secao]").forEach((s) => { s.hidden = !!id && s.getAttribute("data-cat-secao") !== id; });
      return;
    }
    const add = e.target.closest("[data-adicionar]");
    if (add) { Solicitacao.alternar(add.getAttribute("data-adicionar")); return; }
    const det = e.target.closest("[data-detalhes]");
    if (det) abrirDetalhes(det.getAttribute("data-detalhes"));
  });

  function abrirDetalhes(id) {
    const s = CAT.servicos.find((x) => x.id === id);
    if (!s) return;
    const c = CAT.categorias.find((x) => x.id === s.categoria) || {};
    const m = modal(`<span class="rotulo">${esc(c.nome || "")}</span><h2>${esc(s.nome)}</h2>
      ${galeria(fotosDe(s))}
      <p class="modal-resumo">${esc(s.resumo || "")}</p>
      <div class="modal-descricao">${fmt(s.descricao || "")}</div>
      ${(s.itens || []).length ? `<ul class="lista-check">${s.itens.map((t) => `<li>${icone("check")}<span>${esc(t)}</span></li>`).join("")}</ul>` : ""}
      <div class="servico-rodape">${textoPreco(s)}<button type="button" class="btn btn-primario" data-adicionar="${esc(s.id)}" data-fechar>${Solicitacao.tem(s.id) ? "Já está na solicitação" : "Adicionar à solicitação"}</button></div>`);
    m.classList.add("modal-servico");
    iniciarGaleria(m);
  }

  /* Galeria de fotos do serviço (setas, miniaturas e arrastar) */
  function galeria(fotos) {
    if (!fotos.length) return "";
    return `<div class="galeria" data-galeria-ver data-i="0">
      <div class="galeria-palco">${fotos.map((u, i) => `<img src="${esc(u)}" alt="Foto ${i + 1} de ${fotos.length}" class="${i ? "" : "ativa"}"${i ? ' loading="lazy"' : ""}>`).join("")}
        ${fotos.length > 1 ? `<button type="button" class="galeria-seta ant" data-passo="-1" aria-label="Foto anterior">‹</button><button type="button" class="galeria-seta prox" data-passo="1" aria-label="Próxima foto">›</button><span class="galeria-contador">1 / ${fotos.length}</span>` : ""}
      </div>
      ${fotos.length > 1 ? `<div class="galeria-miniaturas">${fotos.map((u, i) => `<button type="button" data-ir="${i}" class="${i ? "" : "ativa"}" aria-label="Ver foto ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
    </div>`;
  }
  function iniciarGaleria(raiz) {
    const g = $("[data-galeria-ver]", raiz);
    if (!g) return;
    const imgs = $$(".galeria-palco img", g), minis = $$(".galeria-miniaturas button", g), cont = $(".galeria-contador", g);
    let i = 0;
    const ir = (n) => {
      i = (n + imgs.length) % imgs.length;
      imgs.forEach((im, k) => im.classList.toggle("ativa", k === i));
      minis.forEach((b, k) => b.classList.toggle("ativa", k === i));
      if (cont) cont.textContent = `${i + 1} / ${imgs.length}`;
    };
    g.addEventListener("click", (e) => {
      const p = e.target.closest("[data-passo]"), m = e.target.closest("[data-ir]");
      if (p) ir(i + +p.dataset.passo);
      if (m) ir(+m.dataset.ir);
    });
    let x0 = null;
    g.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
    g.addEventListener("pointerup", (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) ir(i + (e.clientX < x0 ? 1 : -1)); x0 = null; });
  }

  function modal(html) {
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo";
    fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button type="button" class="modal-fechar" aria-label="Fechar" data-fechar>×</button>${html}</div>`;
    document.body.appendChild(fundo);
    const fechar = () => { fundo.remove(); document.removeEventListener("keydown", tecla); };
    const tecla = (e) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", tecla);
    fundo.addEventListener("click", (e) => { if (e.target === fundo || e.target.closest("[data-fechar]")) setTimeout(fechar, 0); });
    const f = $(".modal-fechar", fundo); f && f.focus();
    return $(".modal", fundo);
  }

  /* =========================================================
     Minha solicitação (carrinho de serviços)
     ========================================================= */
  const CHAVE = "mg_solicitacao";
  const Solicitacao = {
    ids() { try { return (JSON.parse(localStorage.getItem(CHAVE)) || []).filter((x) => typeof x === "string"); } catch (e) { return []; } },
    salvar(l) { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch (e) { /* modo privado */ } atualizarGaveta(); },
    tem(id) { return this.ids().includes(id); },
    alternar(id) {
      const l = this.ids();
      if (l.includes(id)) { this.salvar(l.filter((x) => x !== id)); avisar("Serviço removido da solicitação."); }
      else { l.push(id); this.salvar(l); avisar("Adicionado! Abra \"Minha solicitação\" para enviar."); abrirGaveta(); }
      $$(`[data-adicionar="${CSS.escape(id)}"]`).forEach((b) => {
        if (b.closest(".modal")) return;
        const na = this.tem(id);
        b.className = "btn " + (na ? "btn-adicionado" : "btn-primario");
        b.innerHTML = na ? icone("check") + "Adicionado" : icone("mais") + "Solicitar";
      });
    },
    limpar() { this.salvar([]); }
  };
  window.Solicitacao = Solicitacao;

  function criarGaveta() {
    if ($(".gaveta")) return;
    const g = document.createElement("aside");
    g.className = "gaveta"; g.setAttribute("aria-label", "Minha solicitação"); g.hidden = true;
    g.innerHTML = `<div class="gaveta-fundo" data-fechar-gaveta></div>
      <div class="gaveta-painel" role="dialog" aria-modal="true" aria-labelledby="gaveta-titulo">
        <header><h2 id="gaveta-titulo">Minha solicitação</h2><button type="button" class="modal-fechar" data-fechar-gaveta aria-label="Fechar">×</button></header>
        <div class="gaveta-corpo"></div>
        <footer class="gaveta-rodape"></footer>
      </div>`;
    document.body.appendChild(g);
    g.addEventListener("click", (e) => {
      if (e.target.closest("[data-fechar-gaveta]")) fecharGaveta();
      const rem = e.target.closest("[data-remover]");
      if (rem) Solicitacao.alternar(rem.getAttribute("data-remover"));
      if (e.target.closest("[data-enviar]")) enviarSolicitacao(e.target.closest("[data-enviar]"));
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !g.hidden) fecharGaveta(); });
  }
  function abrirGaveta() { criarGaveta(); atualizarGaveta(); $(".gaveta").hidden = false; document.body.classList.add("sem-rolagem"); }
  function fecharGaveta() { const g = $(".gaveta"); if (g) g.hidden = true; document.body.classList.remove("sem-rolagem"); }

  const obsSalva = () => { try { return sessionStorage.getItem("mg_obs") || ""; } catch (e) { return ""; } };
  function atualizarGaveta(concluido) {
    const ids = Solicitacao.ids();
    $$("[data-contador]").forEach((el) => {
      if (el.textContent !== String(ids.length)) { el.classList.remove("pulou"); void el.offsetWidth; el.classList.add("pulou"); }
      el.textContent = ids.length; el.hidden = !ids.length;
    });
    const g = $(".gaveta");
    if (!g) return;
    const corpo = $(".gaveta-corpo", g), rodape = $(".gaveta-rodape", g);
    if (concluido) {
      corpo.innerHTML = `<div class="gaveta-ok">${icone("check", "icone-svg grande")}<h3>Solicitação enviada!</h3>
        <p>Número <strong>${esc(concluido.numero)}</strong>. Você acompanha cada etapa em <a href="conta.html">Minha conta</a>.</p>
        ${concluido.whats ? `<p>Se o WhatsApp não abriu, <a href="${esc(concluido.whats)}" target="_blank" rel="noopener">toque aqui</a>.</p>` : ""}</div>`;
      rodape.innerHTML = `<a class="btn btn-primario btn-bloco" href="conta.html">Acompanhar minha solicitação</a>`;
      return;
    }
    const itens = ids.map((id) => CAT.servicos.find((s) => s.id === id)).filter(Boolean);
    if (!itens.length) {
      corpo.innerHTML = `<div class="gaveta-vazia">${icone("doc", "icone-svg grande")}<p>Nenhum serviço escolhido ainda.</p><a class="btn btn-contorno-rosa" href="servicos.html">Ver serviços</a></div>`;
      rodape.innerHTML = "";
      return;
    }
    const comPreco = itens.filter((s) => typeof s.preco === "number" && s.preco > 0);
    const total = comPreco.reduce((t, s) => t + s.preco, 0);
    corpo.innerHTML = `<ul class="gaveta-lista">${itens.map((s) => {
      const c = CAT.categorias.find((x) => x.id === s.categoria) || {};
      return `<li><div><small>${esc(c.nome || "")}</small><strong>${esc(s.nome)}</strong>${textoPreco(s)}</div><button type="button" class="btn-texto" data-remover="${esc(s.id)}" aria-label="Remover ${esc(s.nome)}">Remover</button></li>`;
    }).join("")}</ul>
      <label class="campo"><span>Quer contar algo sobre o seu caso? <small>(opcional)</small></span><textarea id="gaveta-obs" maxlength="800" rows="3" placeholder="Ex.: tenho 3 dívidas em bancos diferentes...">${esc(obsSalva())}</textarea></label>`;
    $("#gaveta-obs").addEventListener("input", (e) => { try { sessionStorage.setItem("mg_obs", e.target.value); } catch (x) { /* ok */ } });
    rodape.innerHTML = `${total ? `<div class="gaveta-total"><span>Valor estimado${comPreco.length < itens.length || comPreco.some((s) => s.aPartir) ? " (a partir de)" : ""}</span><strong>${brl(total)}</strong></div>` : ""}
      <p class="gaveta-aviso">O valor final é confirmado na proposta por escrito, depois da análise. Nada é cobrado pelo site.</p>
      <button type="button" class="btn btn-primario btn-bloco" data-enviar>Enviar solicitação</button>`;
  }

  async function enviarSolicitacao(btn) {
    const ids = Solicitacao.ids();
    const obs = ($("#gaveta-obs") || {}).value || "";
    try { sessionStorage.setItem("mg_obs", obs); } catch (e) { /* ok */ }
    await window.ContaPronta;
    const C = D.Conta;
    if (!C.usuario || !C.perfilCompleto()) {
      avisar(C.usuario ? "Complete seu cadastro para enviar." : "Entre ou crie sua conta para enviar a solicitação.");
      setTimeout(() => { location.href = "conta.html?enviar=1"; }, 900);
      return;
    }
    btn.disabled = true; btn.textContent = "Enviando...";
    const janela = numeroWhats ? window.open("", "_blank") : null;
    try {
      const r = await C.criarPedido(ids, obs);
      const p = C.perfil, itens = ids.map((id) => CAT.servicos.find((s) => s.id === id)).filter(Boolean);
      const texto = [`Olá! Acabei de enviar a solicitação *${r.numero}* pelo site.`, "",
        ...itens.map((s) => `• ${s.nome}`), "",
        `*Nome:* ${p.tipo === "pj" ? p.razao_social + " (" + p.responsavel + ")" : p.nome}`,
        `*Telefone:* ${p.telefone}`, `*Cidade:* ${p.cidade}/${p.uf}`, obs ? `*Observação:* ${obs}` : ""].filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i)).join("\n");
      const link = linkWhats(texto);
      if (janela && link) janela.location.href = link; else if (janela) janela.close();
      Solicitacao.limpar();
      try { sessionStorage.removeItem("mg_obs"); } catch (e) { /* ok */ }
      atualizarGaveta({ numero: r.numero, whats: link });
    } catch (err) {
      if (janela) janela.close();
      avisar(err.message);
      btn.disabled = false; btn.textContent = "Enviar solicitação";
    }
  }
  /** Janela de confirmação no estilo do site (no lugar do confirm do navegador). Devolve true/false. */
  function confirmar(texto, opcoes) {
    opcoes = opcoes || {};
    const perigo = opcoes.perigo ?? /^(excluir|remover|apagar)/i.test(texto);
    return new Promise((resolve) => {
      const fundo = document.createElement("div");
      fundo.className = "modal-fundo";
      fundo.innerHTML = `<div class="modal modal-confirmar" role="alertdialog" aria-modal="true" aria-labelledby="conf-titulo">
        <span class="conf-icone${perigo ? " perigo" : ""}">${icone(perigo ? "lixo" : "alerta")}</span>
        <h2 id="conf-titulo">${esc(opcoes.titulo || (perigo ? "Tem certeza?" : "Confirmar"))}</h2>
        <p>${esc(texto)}</p>
        <div class="botoes-form"><button type="button" class="btn btn-contorno-rosa" data-r="0">Cancelar</button>
        <button type="button" class="btn ${perigo ? "btn-perigo" : "btn-primario"}" data-r="1">${esc(opcoes.botao || (perigo ? "Sim, excluir" : "Confirmar"))}</button></div>
      </div>`;
      document.body.appendChild(fundo);
      const fim = (v) => { document.removeEventListener("keydown", tecla); fundo.classList.add("saindo"); setTimeout(() => fundo.remove(), 180); resolve(v); };
      const tecla = (e) => { if (e.key === "Escape") fim(false); };
      document.addEventListener("keydown", tecla);
      fundo.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) fim(b.dataset.r === "1"); else if (e.target === fundo) fim(false); });
      setTimeout(() => $('[data-r="0"]', fundo).focus(), 30);
    });
  }
  window.MG = { abrirGaveta, avisar, esc, fmt, brl, icone, modal, confirmar };

  /* =========================================================
     Cabeçalho: conta e solicitação
     ========================================================= */
  $$("[data-abrir-solicitacao]").forEach((b) => b.addEventListener("click", abrirGaveta));
  function atualizarConta() {
    const C = D.Conta;
    $$("[data-link-conta]").forEach((a) => {
      const t = $(".texto", a);
      if (t) t.textContent = C.usuario ? "Olá, " + (C.nomeExibicao() || "cliente") : "Entrar";
      a.title = C.usuario ? "Minha conta" : "Entrar ou criar conta";
    });
  }
  D.Conta.aoMudar(atualizarConta);
  window.ContaPronta.then(atualizarConta);

  /* ---------- Ano, menu, animações ---------- */
  $$("[data-ano]").forEach((el) => { el.textContent = new Date().getFullYear(); });
  const btnMenu = $(".btn-menu"), menu = $("nav .menu");
  if (btnMenu && menu) {
    btnMenu.addEventListener("click", () => {
      const aberto = menu.classList.toggle("aberto");
      btnMenu.setAttribute("aria-expanded", aberto ? "true" : "false");
    });
    $$("a", menu).forEach((a) => a.addEventListener("click", () => { menu.classList.remove("aberto"); btnMenu.setAttribute("aria-expanded", "false"); }));
  }
  /* =========================================================
     Animações
     ========================================================= */
  const menosMovimento = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Em sequência: cada item de uma grade entra um pouco depois do anterior
  function escalonar(raiz) {
    $$(".grade-3, .grade-2, .dores, .passos, .selos, .valores, .grade-servicos, .faq, .lista-check", raiz || document).forEach((g) => {
      Array.from(g.children).forEach((el, i) => { el.style.setProperty("--i", Math.min(i, 8)); if (g.matches(".lista-check") && !el.classList.contains("revelar")) { el.classList.add("revelar", "lado"); } });
    });
    $$(".fundadora > .retrato, .analise > .analise-texto").forEach((el) => el.classList.add("lado"));
    $$(".fundadora > .revelar:not(.retrato), .analise > .form").forEach((el) => el.classList.add("lado-dir"));
    $$(".cta.revelar, .caixa-aviso").forEach((el) => el.classList.add("zoom"));
  }
  // Título do topo: cada palavra entra separada
  function separarPalavras(el) {
    if (!el.dataset.fonte) el.dataset.fonte = el.innerHTML;
    let n = 0;
    (function andar(no) {
      Array.from(no.childNodes).forEach((filho) => {
        if (filho.nodeType === 3) {
          const partes = filho.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
          partes.forEach((t) => {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
            const sp = document.createElement("span");
            sp.className = "palavra"; sp.style.setProperty("--p", n++); sp.textContent = t;
            frag.appendChild(sp);
          });
          no.replaceChild(frag, filho);
        } else if (filho.nodeType === 1 && filho.tagName !== "BR") andar(filho);
      });
    })(el);
  }
  $$(".hero h1, .topo-pagina h1").forEach(separarPalavras);
  $$(".hero .revelar").forEach((el) => { if (!el.classList.contains("hero-foto")) el.classList.remove("revelar"); });

  // Abertura (colocada no começo da página): sai sozinha ou com um toque
  const abertura = $(".abertura");
  if (abertura) {
    const tirar = () => { abertura.remove(); };
    setTimeout(tirar, 3100);
    abertura.addEventListener("click", () => { abertura.style.animation = "abertura-sai .5s cubic-bezier(.7,0,.3,1) forwards"; setTimeout(tirar, 500); });
  }

  // Brilhos em volta da foto do topo
  const fotoTopo = $(".hero-foto");
  if (fotoTopo) {
    const estrela = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0c.7 6.6 4.4 10.9 12 12-7.6 1.1-11.3 5.4-12 12-.7-6.6-4.4-10.9-12-12C7.6 10.9 11.3 6.6 12 0z"/></svg>';
    [["-4%", "30%", "0s", 22], ["96%", "14%", ".8s", 16], ["88%", "82%", "1.6s", 24], ["6%", "76%", "2.3s", 14], ["50%", "-5%", "1.2s", 18]].forEach(([x, y, d, t]) => {
      const b = document.createElement("span");
      b.className = "brilho"; b.innerHTML = estrela;
      b.style.cssText = `left:${x};top:${y};--b:${d};width:${t}px;height:${t}px`;
      fotoTopo.appendChild(b);
    });
  }

  // Cartões inclinam de leve acompanhando o mouse (computador)
  if (!menosMovimento && matchMedia("(pointer: fine)").matches) {
    const SEL = ".cartao, .servico-card, .valor-item";
    document.addEventListener("pointermove", (e) => {
      const c = e.target.closest && e.target.closest(SEL);
      if (!c || c.closest(".modal, .adm-cat, #conta-dados, .caixa-aviso")) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.classList.add("inclina");
      c.style.transform = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg) translateY(-6px)`;
      if (!c.dataset.ouvindoSaida) { c.dataset.ouvindoSaida = "1"; c.addEventListener("pointerleave", () => { c.style.transform = ""; }); }
    });
  }

  // Palavra girando no topo ("Especialista em ...")
  const giro = $(".rotativo-palavras");
  if (giro) {
    const palavras = $$("b", giro);
    let i = 0;
    setTimeout(() => setInterval(() => {
      const atual = palavras[i]; i = (i + 1) % palavras.length;
      atual.classList.remove("ativa"); atual.classList.add("saindo");
      setTimeout(() => atual.classList.remove("saindo"), 650);
      palavras[i].classList.add("ativa");
    }, 2600), document.body.classList.contains("com-abertura") ? 2600 : 600);
  }

  // Cartão "Seu pedido" do topo passando pelas etapas
  const etapas = $("[data-etapas]");
  if (etapas) {
    const itens = $$("li", etapas);
    let e = 0;
    setInterval(() => {
      e = (e + 1) % itens.length;
      itens.forEach((li, k) => { li.classList.toggle("ativa", k === e); li.classList.toggle("feita", k < e); });
    }, 1800);
  }

  // Cartão do chat do topo: "digitando..." e depois a mensagem
  const chipChat = $(".chip-chat");
  if (chipChat) {
    const ciclo = () => { chipChat.classList.remove("escreveu"); setTimeout(() => chipChat.classList.add("escreveu"), 2200); };
    setTimeout(() => { ciclo(); setInterval(ciclo, 7000); }, document.body.classList.contains("com-abertura") ? 3200 : 1200);
  }

  // Brilho que segue o mouse dentro dos cartões
  document.addEventListener("pointermove", (ev) => {
    const c = ev.target.closest && ev.target.closest(".cartao, .servico-card, .valor-item");
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", (ev.clientX - r.left) + "px");
    c.style.setProperty("--my", (ev.clientY - r.top) + "px");
  }, { passive: true });

  // Botão voltar ao topo
  const botaoTopo = document.createElement("button");
  botaoTopo.type = "button"; botaoTopo.className = "voltar-topo"; botaoTopo.setAttribute("aria-label", "Voltar ao topo");
  botaoTopo.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  botaoTopo.addEventListener("click", () => window.scrollTo({ top: 0, behavior: menosMovimento ? "auto" : "smooth" }));
  document.body.appendChild(botaoTopo);
  window.addEventListener("scroll", () => botaoTopo.classList.toggle("mostrar", window.scrollY > 700), { passive: true });

  let obsRevelar = null;
  function observarRevelar() {
    escalonar();
    // a assinatura começa recortada (invisível para o navegador), então observamos o bloco em volta dela
    const assinaturas = $$(".assinatura:not(.escrita)").filter((el) => !el.closest(".hero-foto, .abertura")).map((el) => { el.parentElement.dataset.temAssinatura = "1"; return el.parentElement; });
    const itens = $$(".revelar:not(.visivel), .rotulo:not(.visivel), .flutuantes-titulo:not(.visivel)").filter((el) => !el.closest(".hero-foto, .abertura") || el.classList.contains("hero-foto")).concat(assinaturas);
    if (!("IntersectionObserver" in window)) { itens.forEach((el) => el.classList.add("visivel")); $$(".assinatura").forEach((x) => x.classList.add("escrita")); return; }
    obsRevelar = obsRevelar || new IntersectionObserver((l) => l.forEach((i) => {
      if (!i.isIntersecting) return;
      if (i.target.dataset.temAssinatura) $$(".assinatura", i.target).forEach((x) => x.classList.add("escrita"));
      if (!i.target.dataset.temAssinatura || i.target.classList.contains("revelar")) i.target.classList.add("visivel");
      obsRevelar.unobserve(i.target);
    }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    itens.forEach((el) => obsRevelar.observe(el));
  }
  observarRevelar();
  window.MGAnimar = observarRevelar;

  // Cabeçalho encolhe e barra de leitura acompanha a rolagem
  const cab = $(".cabecalho");
  const barra = document.createElement("div");
  barra.className = "barra-leitura"; barra.setAttribute("aria-hidden", "true");
  document.body.appendChild(barra);
  let pedidoQuadro = 0;
  function aoRolar() {
    pedidoQuadro = 0;
    const y = window.scrollY, total = document.documentElement.scrollHeight - innerHeight;
    if (cab) cab.classList.toggle("rolou", y > 40);
    barra.style.transform = `scaleX(${total > 0 ? Math.min(1, y / total) : 0})`;
    if (!menosMovimento) {
      const foto = $(".hero-foto .moldura img");
      if (foto && y < 900) foto.style.translate = `0 ${y * 0.06}px`;
    }
  }
  window.addEventListener("scroll", () => { if (!pedidoQuadro) pedidoQuadro = requestAnimationFrame(aoRolar); }, { passive: true });
  aoRolar();

  // Foto do topo acompanha o mouse de leve
  const heroFoto = $(".hero-foto");
  if (heroFoto && !menosMovimento && matchMedia("(pointer: fine)").matches) {
    const hero = heroFoto.closest(".hero");
    hero.addEventListener("mousemove", (e) => {
      const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y2 = (e.clientY - r.top) / r.height - .5;
      heroFoto.style.transform = `perspective(1200px) rotateY(${x * 5}deg) rotateX(${-y2 * 4}deg)`;
    });
    hero.addEventListener("mouseleave", () => { heroFoto.style.transform = ""; });
    heroFoto.style.transition = "transform .6s cubic-bezier(.2,.7,.2,1)";
  }

  // Onda no toque dos botões
  if (!menosMovimento) document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".btn, .chip-filtro");
    if (!b) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), o = document.createElement("span");
    o.className = "onda";
    o.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(o);
    setTimeout(() => o.remove(), 650);
  });

  /* ---------- Medidor de score (animação) ---------- */
  const medidor = $("[data-medidor]");
  if (medidor) {
    const arco = $(".arco-valor", medidor), numero = $("[data-score]", medidor);
    const alvo = +medidor.getAttribute("data-medidor") || 780, total = 251.3, de = 320;
    const desenhar = (v) => { arco.style.strokeDashoffset = total * (1 - v / 1000); numero.textContent = Math.round(v); };
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) desenhar(alvo);
    else {
      desenhar(de);
      let inicio = null;
      setTimeout(() => requestAnimationFrame(function passo(t) {
        if (!inicio) inicio = t;
        const p = Math.min((t - inicio) / 1800, 1), e = 1 - Math.pow(1 - p, 3);
        desenhar(de + (alvo - de) * e);
        if (p < 1) requestAnimationFrame(passo);
      }), 400);
    }
  }

  /* ---------- Máscara de telefone ---------- */
  $$("input[data-telefone]").forEach((inp) => inp.addEventListener("input", () => {
    const d = inp.value.replace(/\D/g, "").slice(0, 11);
    let s = d;
    if (d.length > 2) s = "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length > 7) s = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
    inp.value = s;
  }));

  /* ---------- Formulário de análise -> WhatsApp ---------- */
  const form = $("#form-analise");
  function opcoesServicoForm() {
    if (!form || !form.servico || !CAT.servicos.length) return;
    const atual = form.servico.value;
    form.servico.innerHTML = CAT.categorias.map((c) => {
      const l = servicosDa(c.id);
      if (!l.length) return "";
      return l.length === 1 ? `<option>${esc(l[0].nome)}</option>` : `<optgroup label="${esc(c.nome)}">${l.map((s) => `<option>${esc(s.nome)}</option>`).join("")}</optgroup>`;
    }).join("") + "<option>Ainda não sei</option>";
    const pedido = new URLSearchParams(location.search).get("servico") || atual;
    if (pedido) $$("option", form.servico).forEach((o) => { if (o.textContent === pedido) form.servico.value = o.textContent; });
  }
  if (form) {
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const nome = form.nome.value.trim().replace(/\s+/g, " ");
      const tel = form.telefone.value.replace(/\D/g, "");
      let erro = "";
      if (!/^[A-Za-zÀ-ÿ'.-]+( [A-Za-zÀ-ÿ'.-]+)+$/.test(nome)) erro = "Informe seu nome e sobrenome.";
      else if (!/^[1-9]{2}9?\d{8}$/.test(tel)) erro = "Informe um WhatsApp válido com DDD.";
      else if (!form.aceite.checked) erro = "Para continuar, aceite a Política de Privacidade.";
      if (erro) { avisar(erro); return; }
      const orgaos = $$("input[name=orgaos]:checked", form).map((c) => c.value);
      const linhas = [
        "Olá, " + String(CFG.proprietaria || "Milena").split(" ")[0] + "! Quero uma análise do meu nome.", "",
        "*Nome:* " + nome, "*WhatsApp:* " + form.telefone.value,
        form.cidade.value.trim() ? "*Cidade/UF:* " + form.cidade.value.trim() : "",
        "*Serviço:* " + form.servico.value, "*Valor aproximado das dívidas:* " + form.valor.value,
        "*Onde está negativado:* " + (orgaos.length ? orgaos.join(", ") : "Não sei"),
        form.mensagem.value.trim() ? "*Detalhes:* " + form.mensagem.value.trim() : ""
      ].filter((l, i) => l !== "" || i === 1);
      const texto = linhas.join("\n"), link = linkWhats(texto);
      if (link) { window.open(link, "_blank", "noopener"); avisar("Abrimos o WhatsApp com a sua mensagem. É só enviar!"); }
      else if (CFG.email) location.href = "mailto:" + CFG.email + "?subject=" + encodeURIComponent("Análise de nome - " + nome) + "&body=" + encodeURIComponent(texto.replace(/\*/g, ""));
      else avisar("Canal de atendimento ainda não configurado. Tente novamente em breve.");
    });
  }

  /* =========================================================
     Início: carrega conteúdo do painel e o catálogo
     ========================================================= */
  aplicarContatos(Object.assign({}, CFG));
  atualizarGaveta();
  D.site().then((s) => { aplicarContatos(s.contatos); aplicarSite(s); }).catch((e) => console.warn(e));
  if ($("[data-categorias]") || $("[data-catalogo]") || form || Solicitacao.ids().length || $("[data-abrir-solicitacao]")) {
    D.catalogo(true).then((c) => {
      CAT = c;
      desenharCatalogo(); opcoesServicoForm(); atualizarGaveta(); observarRevelar();
      if (new URLSearchParams(location.search).get("solicitacao") === "1") abrirGaveta();
    }).catch((e) => console.warn(e));
  }
})();
