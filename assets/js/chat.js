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
  const RAPIDAS = {
    cliente: ["Olá, Milena! 😊", "Enviei os documentos", "Qual é o prazo?", "Tenho uma dúvida", "Obrigada! 💕"],
    equipe: ["Olá! Recebi seu pedido 😊", "Pode me enviar uma foto do documento (frente e verso)?", "Já estou analisando e te retorno em breve.", "Consegui um ótimo acordo! Posso te explicar?", "Tudo certo por aqui ✅"]
  };
  const EMOJIS = ["😊", "🙏", "💕", "🌸", "✅", "👍", "👏", "🎉", "📄", "📷", "⏳", "💬"];
  const CLIPE = '<svg class="icone-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/></svg>';
  function ampliarFoto(url) {
    const m = MG.modal(`<img class="foto-ampliada" src="${esc(url)}" alt="Foto enviada no chat"><a class="btn btn-contorno-rosa" href="${esc(url)}" target="_blank" rel="noopener" download>Abrir em tamanho real</a>`);
    m.classList.add("modal-foto-chat");
  }
  /* ---------- PIX: código "copia e cola" (padrão BR Code do Banco Central) e QR Code ---------- */
  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  function crc16(txt) {
    let crc = 0xffff;
    for (let i = 0; i < txt.length; i++) {
      crc ^= txt.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }
  const campo = (id, v) => id + String(v.length).padStart(2, "0") + v;
  /** chave: CPF/CNPJ (só números), e-mail, telefone (+55...) ou chave aleatória */
  function normalizarChave(chave, tipo) {
    const c = String(chave || "").trim();
    const so = c.replace(/\D/g, "");
    if (tipo === "email") return c.toLowerCase();
    if (tipo === "aleatoria") return c.toLowerCase();
    if (tipo === "cpf" || tipo === "cnpj") return so;
    if (tipo === "celular") return "+" + (so.startsWith("55") && so.length >= 12 ? so : "55" + so);
    if (/@/.test(c)) return c.toLowerCase();
    const dig = c.replace(/\D/g, "");
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return c.toLowerCase();
    if (/^\+/.test(c) || ((dig.length === 12 || dig.length === 13) && dig.startsWith("55"))) return "+" + dig;
    if (dig.length === 11 && window.BR && BR.cpfValido && BR.cpfValido(dig)) return dig;
    if (dig.length === 10 || dig.length === 11) return "+55" + dig;   // celular com DDD
    return dig.length === 14 ? dig : c;
  }
  function pixCodigo({ chave, tipo, nome, cidade, valor, descricao, txid }) {
    const k = normalizarChave(chave, tipo);
    const desc = semAcento(descricao || "").replace(/[^\w .,-]/g, "").slice(0, Math.max(0, 72 - k.length));
    const conta = campo("00", "br.gov.bcb.pix") + campo("01", k) + (desc ? campo("02", desc) : "");
    const ref = (semAcento(txid || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25)) || "***";
    let payload = campo("00", "01") + campo("26", conta) + campo("52", "0000") + campo("53", "986") +
      campo("54", Number(valor).toFixed(2)) + campo("58", "BR") +
      campo("59", semAcento(nome || "Milena Garbim").replace(/[^\w ]/g, "").toUpperCase().slice(0, 25)) +
      campo("60", semAcento(cidade || "Sao Paulo").replace(/[^\w ]/g, "").toUpperCase().slice(0, 15)) +
      campo("62", campo("05", ref)) + "6304";
    return payload + crc16(payload);
  }
  let qrLib = null;
  function carregarQR() {
    if (window.qrcode) return Promise.resolve();
    if (!qrLib) qrLib = new Promise((ok, erro) => { const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"; sc.onload = ok; sc.onerror = () => { qrLib = null; erro(new Error("Não foi possível gerar o QR Code agora.")); }; document.head.appendChild(sc); });
    return qrLib;
  }
  async function qrSvg(texto) {
    await carregarQR();
    const qr = window.qrcode(0, "M"); qr.addData(texto); qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const SITUACAO_PIX = { pendente: "Aguardando pagamento", pago: "Pago ✓", cancelado: "Cancelado" };
  function cartaoPix(m, como) {
    const x = m.pix || {}, st = x.status || "pendente";
    return `<div class="chat-pix pix-${esc(st)}" data-pix="${esc(m.id)}">
      <div class="pix-cab"><span class="pix-logo">PIX</span><div><strong>${esc(brl(x.valor))}</strong>${x.descricao ? `<small>${esc(x.descricao)}</small>` : ""}</div><span class="pix-status">${esc(SITUACAO_PIX[st] || st)}</span></div>
      ${st === "pendente" ? `<div class="pix-qr" data-qr="${esc(x.codigo || "")}"><span class="chat-foto-carregando">Gerando QR Code...</span></div>
      <button type="button" class="btn btn-primario pix-copiar" data-copiar-pix="${esc(x.codigo || "")}">Copiar código PIX</button>
      <small class="pix-ajuda">${como === "cliente" ? "Abra o app do seu banco → PIX → “Ler QR Code” ou “Pix Copia e Cola”. Depois de pagar, mande o comprovante aqui." : "O cliente paga pelo app do banco. Confira o recebimento e marque como pago."}</small>` : ""}
      ${como === "equipe" ? `<div class="pix-acoes">${st !== "pago" ? `<button type="button" class="btn-texto" data-marcar-pix="pago">Marcar como pago</button>` : ""}${st === "pendente" ? `<button type="button" class="btn-texto perigo" data-marcar-pix="cancelado">Cancelar cobrança</button>` : ""}${st !== "pendente" ? `<button type="button" class="btn-texto" data-marcar-pix="pendente">Voltar para pendente</button>` : ""}</div>` : ""}
    </div>`;
  }

  /** Janela da equipe para gerar a cobrança PIX dentro da conversa */
  async function abrirPix(p, aoEnviar) {
    let pix = {};
    try { pix = ((await D.site()).contatos || {}).pix || {}; } catch (e) { /* segue */ }
    if (!pix.chave) {
      MG.modal(`<h2>Cadastre sua chave PIX</h2><p>Para gerar cobranças no chat, informe a chave PIX, o nome do recebedor e a cidade em <strong>Painel → Contato e links</strong>.</p><div class="botoes-form"><a class="btn btn-primario" href="/admin#contato" data-fechar data-ir-contato>Ir para Contato e links</a></div>`);
      return;
    }
    const m = MG.modal(`<h2>Cobrança PIX</h2>
      <p class="adm-dica">O cliente recebe no chat o QR Code e o código “copia e cola”. O valor cai direto na chave <strong>${esc(pix.chave)}</strong>.</p>
      <form class="form-modal" novalidate>
        <div class="campos">
          <label class="campo"><span>Valor (R$)</span><input name="valor" type="number" min="1" step="0.01" inputmode="decimal" required placeholder="Ex.: 350,00"></label>
          <label class="campo"><span>Descrição <small>(opcional)</small></span><input name="descricao" maxlength="60" value="Pedido ${esc(p.numero)}"></label>
        </div>
        <div class="pix-previa" hidden></div>
        <div class="botoes-form"><button type="submit" class="btn btn-primario">Enviar cobrança no chat</button><button type="button" class="btn-texto" data-fechar>Cancelar</button></div>
      </form>`);
    const f = m.querySelector("form"), previa = m.querySelector(".pix-previa");
    const codigoAtual = () => pixCodigo({ chave: pix.chave, tipo: pix.tipo, nome: pix.nome, cidade: pix.cidade, valor: +f.valor.value, descricao: f.descricao.value, txid: p.numero });
    f.valor.addEventListener("input", async () => {
      if (!(+f.valor.value > 0)) { previa.hidden = true; return; }
      previa.hidden = false;
      try { previa.innerHTML = `<div class="pix-qr">${await qrSvg(codigoAtual())}</div><small>Prévia do QR Code de ${esc(brl(+f.valor.value))}</small>`; } catch (e) { previa.textContent = e.message; }
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const valor = Math.round(+f.valor.value * 100) / 100;
      if (!(valor > 0)) return avisar("Informe o valor da cobrança.");
      const b = f.querySelector("button[type=submit]"); b.disabled = true;
      try { await D.Chat.enviarPix(p.id, valor, f.descricao.value.trim(), codigoAtual()); m.closest(".modal-fundo").remove(); avisar("Cobrança PIX enviada no chat."); if (aoEnviar) aoEnviar(); }
      catch (err) { avisar(err.message); b.disabled = false; }
    });
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
        ${como === "equipe" && aberto ? `<div class="chat-ferramentas"><button type="button" class="chat-ia-botao${p.ia_ativa === false ? "" : " ligada"}" data-alternar-ia title="Assistente virtual nesta conversa">🤖 <span>${p.ia_ativa === false ? "IA desligada" : "IA ligada"}</span></button><button type="button" class="chat-pix-botao" data-abrir-pix title="Gerar cobrança PIX">${icone("cartao")}<span>Pagamento</span></button></div>` : ""}
        ${o.aoFechar ? `<button type="button" class="modal-fechar" data-chat-fechar aria-label="Fechar">×</button>` : ""}
      </header>
      <div class="chat-mensagens" aria-live="polite"><p class="vazio">Carregando conversa...</p></div>
      ${aberto ? `<div class="chat-rapidas" aria-label="Respostas rápidas">${RAPIDAS[como].map((t) => `<button type="button" data-rapida="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      <div class="chat-emojis" hidden>${EMOJIS.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join("")}</div>
      <div class="chat-previa" hidden><img alt=""><div><strong>Foto pronta para enviar</strong><small>Escreva uma legenda (opcional) e toque em enviar.</small></div><button type="button" class="modal-fechar" data-tirar-foto aria-label="Tirar foto">×</button></div>
      <form class="chat-envio">
        <label class="chat-anexar" title="Enviar foto (opcional)">${CLIPE}<input type="file" accept="image/*" hidden aria-label="Enviar foto"></label>
        <button type="button" class="chat-emoji-botao" data-abrir-emojis aria-label="Emojis">😊</button>
        <textarea name="texto" rows="1" maxlength="2000" placeholder="Escreva sua mensagem..." aria-label="Mensagem"></textarea>
        <button type="submit" class="chat-enviar" aria-label="Enviar">${icone("enviar")}</button>
      </form>
      <p class="chat-rodape">${como === "cliente" ? "Conversa privada sobre este pedido. A assistente virtual responde na hora e a Milena acompanha tudo. Nunca envie senhas por aqui." : "O cliente vê suas mensagens em Minha conta → Mensagens. Ao responder, a assistente virtual sai da conversa."}</p>`
      : `<p class="chat-fechado">${icone("cadeado")}Pedido cancelado: a conversa foi encerrada.</p>`}
    </section>`;
    const caixa = $(".chat-mensagens", alvo), form = $(".chat-envio", alvo), campo = form && form.texto;
    let ultimaAssinatura = null, parado = false;
    const vistas = new Set();   // só as mensagens novas fazem a animação de chegada
    let jaDesenhou = false;

    function desenhar(lista) {
      const assinatura = lista.map((m) => m.id + (m.lida_em ? "l" : "") + (m.pix ? m.pix.status : "")).join(",");
      if (assinatura === ultimaAssinatura) return;
      ultimaAssinatura = assinatura;
      const noFim = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 80;
      let diaAtual = "";
      caixa.innerHTML = lista.length ? lista.map((m) => {
        const d = dia(m.criado_em), sep = d !== diaAtual ? `<div class="chat-dia"><span>${esc(d)}</span></div>` : "";
        diaAtual = d;
        const nova = jaDesenhou && !vistas.has(m.id);
        if (m.autor === "sistema") return `${sep}<div class="chat-sistema${nova ? " nova" : ""}"><span>${esc(m.texto)}</span></div>`;
        const minha = m.autor === como;
        const ia = m.autor === "ia";
        const quem = ia ? "🤖 " + (m.nome || "Assistente da Milena") : m.autor === "equipe" ? (m.nome || "Equipe Milena Garbim") : (o.nomeCliente || "Cliente");
        if (m.pix) return `${sep}<div class="chat-msg ${minha ? "minha" : "dele"} com-pix${nova ? " nova" : ""}">${!minha ? `<span class="chat-quem">${esc(quem)}</span>` : ""}${cartaoPix(m, como)}<span class="chat-hora">${esc(hora(m.criado_em))}</span></div>`;
        return `${sep}<div class="chat-msg ${minha ? "minha" : "dele"}${ia ? " da-ia" : ""}${nova ? " nova" : ""}">
          ${!minha ? `<span class="chat-quem">${esc(quem)}</span>` : ""}
          ${m.anexo ? `<button type="button" class="chat-foto" data-anexo="${esc(m.anexo)}" aria-label="Ver foto"><span class="chat-foto-carregando">${icone("foto")}</span></button>` : ""}
          ${m.texto ? `<p>${esc(m.texto).replace(/\n/g, "<br>")}</p>` : ""}
          <span class="chat-hora">${esc(hora(m.criado_em))}${minha ? ` <span class="chat-lida${m.lida_em ? " sim" : ""}" title="${m.lida_em ? "Lida" : "Enviada"}">${m.lida_em ? "✓✓" : "✓"}</span>` : ""}</span>
        </div>`;
      }).join("") : `<div class="chat-inicio">${icone("chat", "icone-svg grande")}<p>${!aberto ? "Nenhuma mensagem nesta conversa." : como === "cliente" ? "Mande sua mensagem por aqui: a assistente virtual responde na hora e a Milena acompanha a conversa." : "Nenhuma mensagem ainda. Dê as boas-vindas ao cliente."}</p></div>`;
      lista.forEach((m) => vistas.add(m.id));
      $$(".pix-qr[data-qr]", caixa).forEach((el) => { const cod = el.dataset.qr; el.removeAttribute("data-qr"); if (cod) qrSvg(cod).then((svg) => { el.innerHTML = svg; }).catch((e) => { el.innerHTML = `<small>${esc(e.message)}</small>`; }); });
      $$(".chat-foto[data-anexo]", caixa).forEach((b) => {
        D.Chat.urlFoto(b.dataset.anexo).then((url) => {
          const img = new Image();
          img.alt = "Foto enviada"; img.onload = () => { const perto = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 260; b.innerHTML = ""; b.appendChild(img); b.dataset.url = url; if (perto) caixa.scrollTop = caixa.scrollHeight; };
          img.src = url;
        }).catch(() => { b.innerHTML = `<span class="chat-foto-carregando">Foto indisponível</span>`; });
      });
      jaDesenhou = true;
      if (noFim || !caixa.dataset.rolou) { caixa.scrollTop = caixa.scrollHeight; caixa.dataset.rolou = "1"; }
    }

    async function atualizar() {
      if (parado) return;
      try {
        const lista = await D.Chat.mensagens(p.id);
        if (parado) return;
        if (lista.some((m) => m.autor !== como && m.autor !== "sistema" && !m.lida_em)) { await D.Chat.marcarLidas(p.id, como); if (o.aoMudar) o.aoMudar(); }
        desenhar(lista);
      } catch (e) { caixa.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; }
    }

    let fotoEscolhida = null;
    const previa = $(".chat-previa", alvo), emojis = $(".chat-emojis", alvo);
    function tirarFoto() { fotoEscolhida = null; if (previa) { previa.hidden = true; $("img", previa).removeAttribute("src"); } const inp = $(".chat-anexar input", alvo); if (inp) inp.value = ""; }
    if (form) {
      $(".chat-anexar input", alvo).addEventListener("change", (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (!/^image\//.test(f.type)) { avisar("Escolha uma foto (JPG, PNG ou WEBP)."); return tirarFoto(); }
        if (f.size > 15 * 1024 * 1024) { avisar("Foto muito grande (máx. 15 MB)."); return tirarFoto(); }
        fotoEscolhida = f;
        $("img", previa).src = URL.createObjectURL(f);
        previa.hidden = false;
        campo.focus({ preventScroll: true });
      });
      alvo.addEventListener("click", (e) => {
        const r = e.target.closest("[data-rapida]");
        if (r) { campo.value = r.dataset.rapida; campo.dispatchEvent(new Event("input")); campo.focus({ preventScroll: true }); return; }
        if (e.target.closest("[data-abrir-emojis]")) { emojis.hidden = !emojis.hidden; return; }
        const em = e.target.closest("[data-emoji]");
        if (em) { const i = campo.selectionStart ?? campo.value.length; campo.value = campo.value.slice(0, i) + em.dataset.emoji + campo.value.slice(i); emojis.hidden = true; campo.focus({ preventScroll: true }); return; }
        if (e.target.closest("[data-tirar-foto]")) tirarFoto();
      });
      campo.addEventListener("input", () => { campo.style.height = "auto"; campo.style.height = Math.min(campo.scrollHeight, 140) + "px"; });
      campo.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const texto = campo.value.trim();
        if (!texto && !fotoEscolhida) return;
        const b = $(".chat-enviar", form);
        b.disabled = true; b.classList.add("enviando");
        try {
          await D.Chat.enviar(p.id, texto, como, fotoEscolhida);
          if (como === "equipe" && p.ia_ativa !== false) { p.ia_ativa = false; marcarIA(); }
          campo.value = ""; campo.style.height = "auto"; tirarFoto();
          caixa.dataset.rolou = "";
          await atualizar();
          if (o.aoMudar) o.aoMudar();
        } catch (err) { avisar(err.message); }
        finally { b.disabled = false; b.classList.remove("enviando"); campo.focus({ preventScroll: true }); }
      });
    }
    function marcarIA() {
      const b = $("[data-alternar-ia]", alvo);
      if (!b) return;
      b.classList.toggle("ligada", p.ia_ativa !== false);
      $("span", b).textContent = p.ia_ativa === false ? "IA desligada" : "IA ligada";
    }
    alvo.addEventListener("click", async (e) => {
      const cp = e.target.closest("[data-copiar-pix]");
      if (cp) {
        try { await navigator.clipboard.writeText(cp.dataset.copiarPix); cp.textContent = "Código copiado! ✓"; setTimeout(() => { cp.textContent = "Copiar código PIX"; }, 2500); }
        catch (err) { window.prompt("Copie o código PIX:", cp.dataset.copiarPix); }
        return;
      }
      const mp = e.target.closest("[data-marcar-pix]");
      if (mp) { try { await D.Chat.marcarPix(mp.closest("[data-pix]").dataset.pix, mp.dataset.marcarPix); ultimaAssinatura = null; await atualizar(); } catch (err) { avisar(err.message); } return; }
      if (e.target.closest("[data-abrir-pix]")) { abrirPix(p, () => { p.ia_ativa = false; marcarIA(); caixa.dataset.rolou = ""; atualizar(); if (o.aoMudar) o.aoMudar(); }); return; }
      const ib = e.target.closest("[data-alternar-ia]");
      if (ib) {
        const ligar = p.ia_ativa === false;
        ib.disabled = true;
        try { await D.Chat.alternarIA(p.id, ligar); p.ia_ativa = ligar; marcarIA(); caixa.dataset.rolou = ""; await atualizar(); avisar(ligar ? "Assistente virtual religada nesta conversa." : "Assistente virtual desligada nesta conversa."); }
        catch (err) { avisar(err.message); } finally { ib.disabled = false; }
        return;
      }
      const foto = e.target.closest(".chat-foto[data-url]");
      if (foto) { ampliarFoto(foto.dataset.url); return; }
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
        const previa = m ? (m.autor === o.como ? "Você: " : m.autor === "ia" ? "🤖 " : "") + (m.pix ? "💳 Cobrança PIX" : m.texto || "📷 Foto") : fechada ? "Conversa encerrada" : "Nenhuma mensagem ainda";
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

  window.ChatUI = { abrir, montar, caixaEntrada, pixCodigo, qrSvg };
})();
