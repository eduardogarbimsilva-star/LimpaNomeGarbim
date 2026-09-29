/* =========================================================
   Milena Garbim · Limpa Nome — janela de chat do pedido
   Usada em Minha conta (cliente) e no Painel (equipe).
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const D = window.Dados, MG = window.MG;
  const { esc, icone, avisar } = MG;
  const hora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  function dia(d) {
    const x = new Date(d), hoje = new Date(), ontem = new Date(Date.now() - 864e5);
    if (x.toDateString() === hoje.toDateString()) return "Hoje";
    if (x.toDateString() === ontem.toDateString()) return "Ontem";
    return x.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: x.getFullYear() === hoje.getFullYear() ? undefined : "numeric" });
  }

  let aberta = null;

  /**
   * opcoes: { pedido, como: "cliente"|"equipe", titulo, subtitulo, foto, aoMudar }
   */
  function abrir(o) {
    if (aberta) aberta.fechar();
    const p = o.pedido, como = o.como, outro = como === "cliente" ? "equipe" : "cliente";
    const el = document.createElement("div");
    el.className = "chat-fundo";
    el.innerHTML = `<section class="chat-janela" role="dialog" aria-modal="true" aria-label="Chat do pedido ${esc(p.numero)}">
      <header class="chat-cab">
        ${o.foto ? `<img src="${esc(o.foto)}" alt="" width="44" height="44">` : `<span class="chat-avatar">${icone("pessoa")}</span>`}
        <div><strong>${esc(o.titulo)}</strong><small>${esc(o.subtitulo || "")}</small></div>
        <button type="button" class="modal-fechar" data-fechar-chat aria-label="Fechar chat">×</button>
      </header>
      <div class="chat-mensagens" aria-live="polite"><p class="vazio">Carregando conversa...</p></div>
      <form class="chat-envio">
        <textarea name="texto" rows="1" maxlength="2000" placeholder="Escreva sua mensagem..." aria-label="Mensagem"></textarea>
        <button type="submit" class="chat-enviar" aria-label="Enviar">${icone("enviar")}</button>
      </form>
      <p class="chat-rodape">${como === "cliente" ? "Conversa privada com a Milena sobre este pedido. Nunca envie senhas por aqui." : "O cliente vê suas mensagens em Minha conta."}</p>
    </section>`;
    document.body.appendChild(el);
    document.body.classList.add("sem-rolagem");
    const caixa = $(".chat-mensagens", el), form = $(".chat-envio", el), campo = form.texto;
    let ultimaAssinatura = "";

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
        const quem = m.autor === "equipe" ? (m.nome || "Equipe Milena Garbim") : (como === "equipe" ? (o.nomeCliente || "Cliente") : "Você");
        return `${sep}<div class="chat-msg ${minha ? "minha" : "dele"}">
          ${!minha ? `<span class="chat-quem">${esc(quem)}</span>` : ""}
          <p>${esc(m.texto).replace(/\n/g, "<br>")}</p>
          <span class="chat-hora">${esc(hora(m.criado_em))}${minha ? ` <span class="chat-lida${m.lida_em ? " sim" : ""}" title="${m.lida_em ? "Lida" : "Enviada"}">${m.lida_em ? "✓✓" : "✓"}</span>` : ""}</span>
        </div>`;
      }).join("") : `<div class="chat-inicio">${icone("chat", "icone-svg grande")}<p>${como === "cliente" ? "Seu pedido foi confirmado! Mande sua mensagem para a Milena por aqui." : "Nenhuma mensagem ainda. Dê as boas-vindas ao cliente."}</p></div>`;
      if (noFim || !caixa.dataset.rolou) { caixa.scrollTop = caixa.scrollHeight; caixa.dataset.rolou = "1"; }
    }

    async function atualizar() {
      try {
        const lista = await D.Chat.mensagens(p.id);
        if (lista.some((m) => m.autor === outro && !m.lida_em)) { await D.Chat.marcarLidas(p.id, como); if (o.aoMudar) o.aoMudar(); }
        desenhar(lista);
      } catch (e) { caixa.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; }
    }

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

    const parar = D.Chat.ouvir(p.id, atualizar);
    function fechar() {
      parar(); el.remove(); document.removeEventListener("keydown", tecla);
      document.body.classList.remove("sem-rolagem");
      aberta = null;
      if (o.aoMudar) o.aoMudar();
    }
    const tecla = (e) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", tecla);
    el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-fechar-chat]")) fechar(); });
    aberta = { fechar };
    atualizar();
    setTimeout(() => campo.focus(), 50);
    return aberta;
  }

  window.ChatUI = { abrir };
})();
