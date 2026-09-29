/* =========================================================
   Milena Garbim · Limpa Nome — chat dos pedidos
   - montar(): uma conversa dentro de um elemento
   - abrir(): a mesma conversa numa janela por cima da página
   - caixaEntrada(): aba de mensagens estilo WhatsApp (lista + conversa)
   Usado em Minha conta (cliente) e no Painel (equipe).
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const D = window.Dados, MG = window.MG;
  const { esc, icone, avisar } = MG;
  const hora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  function dia(d) {
    const x = new Date(d), hoje = new Date(), ontem = new Date(Date.now() - 864e5);
    if (x.toDateString() === hoje.toDateString()) return "Hoje";
    if (x.toDateString() === ontem.toDateString()) return "Ontem";
    return x.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: x.getFullYear() === hoje.getFullYear() ? undefined : "numeric" });
  }
  function quando(d) {
    const x = new Date(d);
    return x.toDateString() === new Date().toDateString() ? hora(d) : dia(d) === "Ontem" ? "Ontem" : x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  const avatar = (o) => (o.foto ? `<img src="${esc(o.foto)}" alt="" width="44" height="44">` : `<span class="chat-avatar">${esc(String(o.titulo || "?").charAt(0).toUpperCase())}</span>`);

  /**
   * Uma conversa dentro de "alvo".
   * o: { pedido, como: "cliente"|"equipe", titulo, subtitulo, foto, nomeCliente, aoMudar, aoVoltar, aoFechar }
   */
  function montar(alvo, o) {
    const p = o.pedido, como = o.como, outro = como === "cliente" ? "equipe" : "cliente";
    const aberto = D.Chat.aberto(p);
    alvo.innerHTML = `<section class="chat-janela" aria-label="Conversa do pedido ${esc(p.numero)}">
      <header class="chat-cab">
        ${o.aoVoltar ? `<button type="button" class="chat-voltar" data-chat-voltar aria-label="Voltar para a lista">${icone("seta")}</button>` : ""}
        ${avatar(o)}
        <div><strong>${esc(o.titulo)}</strong><small>${esc(o.subtitulo || "")}</small></div>
        ${o.aoFechar ? `<button type="button" class="modal-fechar" data-chat-fechar aria-label="Fechar">×</button>` : ""}
      </header>
      <div class="chat-mensagens" aria-live="polite"><p class="vazio">Carregando conversa...</p></div>
      ${aberto ? `<form class="chat-envio">
        <textarea name="texto" rows="1" maxlength="2000" placeholder="Escreva sua mensagem..." aria-label="Mensagem"></textarea>
        <button type="submit" class="chat-enviar" aria-label="Enviar">${icone("enviar")}</button>
      </form>
      <p class="chat-rodape">${como === "cliente" ? "Conversa privada com a Milena sobre este pedido. Nunca envie senhas por aqui." : "O cliente vê suas mensagens em Minha conta → Mensagens."}</p>`
      : `<p class="chat-fechado">${icone("cadeado")}${p.status === "cancelado" ? "Pedido cancelado: a conversa foi encerrada." : "A conversa abre quando a Milena confirmar o pedido."}</p>`}
    </section>`;
    const caixa = $(".chat-mensagens", alvo), form = $(".chat-envio", alvo), campo = form && form.texto;
    let ultimaAssinatura = null, parado = false;
    const vistas = new Set();   // só as mensagens novas fazem a animação de chegada
    let jaDesenhou = false;

    function desenhar(lista) {
      const assinatura = lista.map((m) => m.id + (m.lida_em ? "l" : "")).join(",");
      if (assinatura === ultimaAssinatura) return;
      ultimaAssinatura = assinatura;
      const noFim = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 80;
      let diaAtual = "";
      caixa.innerHTML = lista.length ? lista.map((m) => {
        const d = dia(m.criado_em), sep = d !== diaAtual ? `<div class="chat-dia"><span>${esc(d)}</span></div>` : "";
        diaAtual = d;
        const minha = m.autor === como;
        const quem = m.autor === "equipe" ? (m.nome || "Equipe Milena Garbim") : (o.nomeCliente || "Cliente");
        const nova = jaDesenhou && !vistas.has(m.id);
        return `${sep}<div class="chat-msg ${minha ? "minha" : "dele"}${nova ? " nova" : ""}">
          ${!minha ? `<span class="chat-quem">${esc(quem)}</span>` : ""}
          <p>${esc(m.texto).replace(/\n/g, "<br>")}</p>
          <span class="chat-hora">${esc(hora(m.criado_em))}${minha ? ` <span class="chat-lida${m.lida_em ? " sim" : ""}" title="${m.lida_em ? "Lida" : "Enviada"}">${m.lida_em ? "✓✓" : "✓"}</span>` : ""}</span>
        </div>`;
      }).join("") : `<div class="chat-inicio">${icone("chat", "icone-svg grande")}<p>${!aberto ? "Nenhuma mensagem nesta conversa." : como === "cliente" ? "Seu pedido foi confirmado! Mande sua mensagem para a Milena por aqui." : "Nenhuma mensagem ainda. Dê as boas-vindas ao cliente."}</p></div>`;
      lista.forEach((m) => vistas.add(m.id));
      jaDesenhou = true;
      if (noFim || !caixa.dataset.rolou) { caixa.scrollTop = caixa.scrollHeight; caixa.dataset.rolou = "1"; }
    }

    async function atualizar() {
      if (parado) return;
      try {
        const lista = await D.Chat.mensagens(p.id);
        if (parado) return;
        if (lista.some((m) => m.autor === outro && !m.lida_em)) { await D.Chat.marcarLidas(p.id, como); if (o.aoMudar) o.aoMudar(); }
        desenhar(lista);
      } catch (e) { caixa.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; }
    }

    if (form) {
      campo.addEventListener("input", () => { campo.style.height = "auto"; campo.style.height = Math.min(campo.scrollHeight, 140) + "px"; });
      campo.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const texto = campo.value.trim();
        if (!texto) return;
        const b = $(".chat-enviar", form);
        b.disabled = true;
        try {
          await D.Chat.enviar(p.id, texto, como);
          campo.value = ""; campo.style.height = "auto";
          caixa.dataset.rolou = "";
          await atualizar();
          if (o.aoMudar) o.aoMudar();
        } catch (err) { avisar(err.message); }
        finally { b.disabled = false; campo.focus(); }
      });
    }
    alvo.addEventListener("click", (e) => {
      if (e.target.closest("[data-chat-voltar]") && o.aoVoltar) o.aoVoltar();
      if (e.target.closest("[data-chat-fechar]") && o.aoFechar) o.aoFechar();
    });
    const pararOuvir = D.Chat.ouvir(p.id, atualizar);
    atualizar();
    if (campo && matchMedia("(pointer: fine)").matches) setTimeout(() => campo.focus({ preventScroll: true }), 50);
    return { parar() { parado = true; pararOuvir(); } };
  }

  /** A conversa numa janela por cima da página */
  let janela = null;
  function abrir(o) {
    if (janela) janela.fechar();
    const fundo = document.createElement("div");
    fundo.className = "chat-fundo";
    fundo.innerHTML = `<div class="chat-lateral" role="dialog" aria-modal="true"></div>`;
    document.body.appendChild(fundo);
    document.body.classList.add("sem-rolagem");
    const fechar = () => { conversa.parar(); fundo.remove(); document.removeEventListener("keydown", tecla); document.body.classList.remove("sem-rolagem"); janela = null; if (o.aoMudar) o.aoMudar(); };
    const tecla = (e) => { if (e.key === "Escape") fechar(); };
    const conversa = montar($(".chat-lateral", fundo), Object.assign({}, o, { aoFechar: fechar }));
    document.addEventListener("keydown", tecla);
    fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });
    janela = { fechar };
    return janela;
  }

  /**
   * Aba de mensagens (lista de conversas + conversa aberta).
   * o: { como, conversas: async () => [{ pedido, titulo, subtitulo, foto, nomeCliente }], vazio: html, aoMudar }
   * Devolve { abrirConversa(pedidoId), atualizar() }
   */
  function caixaEntrada(raiz, o) {
    raiz.innerHTML = `<div class="caixa-entrada">
      <aside class="ce-lista">
        <div class="ce-busca">${icone("lupa")}<input type="search" placeholder="Buscar conversa" aria-label="Buscar conversa"></div>
        <ul class="ce-itens"><li class="vazio">Carregando conversas...</li></ul>
      </aside>
      <div class="ce-conversa"><div class="ce-vazia">${icone("chat", "icone-svg grande")}<p>Escolha uma conversa para ver as mensagens.</p></div></div>
    </div>`;
    const caixa = $(".caixa-entrada", raiz), lista = $(".ce-itens", raiz), painel = $(".ce-conversa", raiz), busca = $(".ce-busca input", raiz);
    let conversas = [], atual = null, aberta = null, naoLidas = {}, ultimas = {};

    async function atualizar() {
      try {
        const [cs, nl, recentes] = await Promise.all([o.conversas(), D.Chat.naoLidas(o.como), D.Chat.recentes()]);
        conversas = cs; naoLidas = nl; ultimas = {};
        recentes.forEach((m) => { if (!ultimas[m.pedido_id] || m.criado_em > ultimas[m.pedido_id].criado_em) ultimas[m.pedido_id] = m; });
      } catch (e) { lista.innerHTML = `<li class="vazio">${esc(e.message)}</li>`; return; }
      desenharLista();
    }
    function desenharLista() {
      const termo = busca.value.trim().toLowerCase();
      const ordem = (c) => ((ultimas[c.pedido.id] || {}).criado_em || c.pedido.confirmado_em || c.pedido.criado_em || "");
      const filtradas = conversas.filter((c) => !termo || [c.titulo, c.subtitulo, c.pedido.numero].join(" ").toLowerCase().includes(termo))
        .sort((a, b) => (naoLidas[b.pedido.id] ? 1 : 0) - (naoLidas[a.pedido.id] ? 1 : 0) || String(ordem(b)).localeCompare(String(ordem(a))));
      lista.innerHTML = filtradas.length ? filtradas.map((c) => {
        const m = ultimas[c.pedido.id], n = naoLidas[c.pedido.id] || 0, fechada = !D.Chat.aberto(c.pedido);
        const previa = m ? (m.autor === o.como ? "Você: " : "") + m.texto : fechada ? "Conversa encerrada" : "Nenhuma mensagem ainda";
        return `<li><button type="button" class="ce-item${n ? " nova" : ""}${atual === c.pedido.id ? " ativa" : ""}" data-conversa="${esc(c.pedido.id)}">
          ${avatar(c)}
          <span class="ce-texto"><strong>${esc(c.titulo)}</strong><small>${esc(c.subtitulo || "")}</small><em>${esc(previa.slice(0, 80))}</em></span>
          <span class="ce-lado">${m ? `<time>${esc(quando(m.criado_em))}</time>` : ""}${n ? `<span class="selo-chat">${n}</span>` : fechada ? icone("cadeado") : ""}</span>
        </button></li>`;
      }).join("") : `<li class="vazio">${conversas.length ? "Nenhuma conversa encontrada." : o.vazio || "Nenhuma conversa ainda."}</li>`;
    }
    function abrirConversa(id) {
      const c = conversas.find((x) => x.pedido.id === id);
      if (!c) return false;
      if (aberta) aberta.parar();
      atual = id;
      caixa.classList.add("vendo-conversa");
      aberta = montar(painel, Object.assign({}, c, {
        como: o.como,
        aoMudar: () => { atualizar(); if (o.aoMudar) o.aoMudar(); },
        aoVoltar: () => { caixa.classList.remove("vendo-conversa"); if (aberta) aberta.parar(); aberta = null; atual = null; painel.innerHTML = `<div class="ce-vazia">${icone("chat", "icone-svg grande")}<p>Escolha uma conversa para ver as mensagens.</p></div>`; desenharLista(); }
      }));
      desenharLista();
      if (matchMedia("(max-width: 760px)").matches) caixa.scrollIntoView({ block: "start" });
      return true;
    }
    lista.addEventListener("click", (e) => { const b = e.target.closest("[data-conversa]"); if (b) abrirConversa(b.dataset.conversa); });
    busca.addEventListener("input", desenharLista);
    D.Chat.ouvir(null, atualizar);
    const pronto = atualizar();
    return { abrirConversa: async (id) => { await pronto; return abrirConversa(id); }, atualizar };
  }

  window.ChatUI = { abrir, montar, caixaEntrada };
})();
