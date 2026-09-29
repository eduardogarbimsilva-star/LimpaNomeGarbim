/* =========================================================
   Milena Garbim · Limpa Nome — Painel da empresa
   Pedidos, clientes, catálogo, textos, fotos, dúvidas, contato e equipe
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const D = window.Dados, A = D.Painel, C = D.Conta, MG = window.MG, BR = window.BR;
  const { esc, fmt, brl, icone, avisar, modal } = MG;
  const PADRAO = window.PADRAO;
  const dataHora = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const mostrar = (id) => ["adm-carregando", "adm-entrar", "adm-negado", "adm-painel"].forEach((x) => { $("#" + x).hidden = x !== id; });
  const painel = (aba) => $(`[data-painel="${aba}"]`);
  async function comBotao(b, fn) {
    const t = b.innerHTML; b.disabled = true;
    try { await fn(); } catch (e) { avisar(e.message); } finally { b.disabled = false; b.innerHTML = t; }
  }

  let papel = null, ehAdmin = false;

  /* =========================================================
     Abas
     ========================================================= */
  const carregadas = new Set();
  const CARREGAR = {};
  function abrirAba(aba) {
    $$(".abas-painel [data-aba]").forEach((b) => { b.classList.toggle("ativo", b.dataset.aba === aba); b.setAttribute("aria-selected", b.dataset.aba === aba); });
    $$("[data-painel]").forEach((p) => { p.hidden = p.dataset.painel !== aba; });
    if (!carregadas.has(aba) && CARREGAR[aba]) { carregadas.add(aba); CARREGAR[aba](); }
    try { sessionStorage.setItem("mg_aba", aba); } catch (e) { /* ok */ }
  }
  $$(".abas-painel [data-aba]").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.aba)));

  /* =========================================================
     PEDIDOS
     ========================================================= */
  let pedidos = [];
  const seloStatus = (s) => { const st = D.STATUS[s] || { nome: s, cor: "cinza" }; return `<span class="selo-status st-${st.cor}">${esc(st.nome)}</span>`; };
  const nomeCliente = (c) => (c && (c.tipo === "pj" ? c.razao_social : c.nome)) || (c && c.email) || "Cliente";

  CARREGAR.pedidos = async function () {
    const p = painel("pedidos");
    p.innerHTML = `<div class="adm-resumo" id="ped-resumo"></div>
      <div class="adm-barra">
        <input type="search" id="ped-busca" placeholder="Buscar por número, nome, e-mail, CPF/CNPJ ou serviço" aria-label="Buscar pedidos">
        <select id="ped-status" aria-label="Situação"><option value="">Todas as situações</option>${Object.entries(D.STATUS).map(([k, s]) => `<option value="${k}">${esc(s.nome)}</option>`).join("")}</select>
        <button type="button" class="btn btn-contorno-rosa" id="ped-atualizar">Atualizar</button>
      </div>
      <p class="adm-contagem" id="ped-contagem"></p>
      <div id="ped-lista"></div>`;
    $("#ped-busca").addEventListener("input", desenharPedidos);
    $("#ped-status").addEventListener("change", desenharPedidos);
    $("#ped-atualizar").addEventListener("click", recarregarPedidos);
    $("#ped-resumo").addEventListener("click", (e) => { const b = e.target.closest("[data-st]"); if (b) { $("#ped-status").value = b.dataset.st; desenharPedidos(); } });
    $("#ped-lista").addEventListener("submit", salvarAndamento);
    $("#ped-lista").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-excluir-pedido]");
      if (!b) return;
      const ped = pedidos.find((x) => x.id === b.dataset.excluirPedido);
      if (!confirm(`Excluir o pedido ${ped.numero}? Isso não pode ser desfeito.`)) return;
      await comBotao(b, async () => { await A.excluirPedido(ped.id); avisar("Pedido excluído."); await recarregarPedidos(); });
    });
    await recarregarPedidos();
  };
  async function recarregarPedidos() {
    try { pedidos = await A.pedidos(); } catch (e) { avisar(e.message); pedidos = []; }
    const abertos = new Set($$("#ped-lista details[open]").map((d) => d.dataset.pedido));
    desenharPedidos(abertos);
  }
  function desenharPedidos(abertos) {
    abertos = abertos instanceof Set ? abertos : new Set($$("#ped-lista details[open]").map((d) => d.dataset.pedido));
    const cont = {};
    pedidos.forEach((p) => { cont[p.status] = (cont[p.status] || 0) + 1; });
    $("#ped-resumo").innerHTML = Object.entries(D.STATUS).map(([k, s]) => `<button type="button" class="resumo-item st-${s.cor}" data-st="${k}"><strong>${cont[k] || 0}</strong>${esc(s.nome)}</button>`).join("");
    const termo = semAcento($("#ped-busca").value.trim()), st = $("#ped-status").value, termoDig = BR.so(termo);
    const lista = pedidos.filter((p) => {
      if (st && p.status !== st) return false;
      if (!termo) return true;
      const c = p.cliente || {};
      const texto = semAcento([p.numero, c.nome, c.razao_social, c.responsavel, c.email, c.cidade, (p.itens || []).map((i) => i.nome).join(" ")].join(" "));
      return texto.includes(termo) || (termoDig.length >= 3 && BR.so([c.cpf, c.cnpj, c.telefone].join(" ")).includes(termoDig));
    });
    $("#ped-contagem").textContent = pedidos.length ? `${lista.length} de ${pedidos.length} pedidos` : "";
    $("#ped-lista").innerHTML = lista.length ? lista.map((p) => cartaoPedido(p, abertos.has(p.id))).join("")
      : `<div class="cartao centro caixa-aviso">${icone("sacola", "icone-svg grande")}<h3>${pedidos.length ? "Nenhum pedido encontrado" : "Nenhum pedido ainda"}</h3><p>${pedidos.length ? "Mude a busca ou a situação." : "Quando um cliente enviar uma solicitação pelo site, ela aparece aqui."}</p></div>`;
  }
  function cartaoPedido(p, aberto) {
    const c = p.cliente || {}, itens = p.itens || [];
    const tel = BR.so(c.telefone);
    const zap = tel ? `https://wa.me/55${tel}?text=${encodeURIComponent(`Olá, ${String(c.tipo === "pj" ? c.responsavel : c.nome || "").split(" ")[0]}! Aqui é da equipe Milena Garbim, sobre a sua solicitação ${p.numero}.`)}` : "";
    const naoLidas = chatNaoLidas[p.id] || 0;
    return `<details class="pedido-cartao adm-pedido"${aberto ? " open" : ""} data-pedido="${esc(p.id)}">
      <summary>
        <div><strong>${esc(p.numero)}</strong><small>${esc(dataHora(p.criado_em))} · ${esc(nomeCliente(c))}</small></div>
        <div class="adm-pedido-dir"><span class="selo-msg" data-selo-novas${naoLidas ? "" : " hidden"}>${icone("chat")}<b>${naoLidas}</b> ${naoLidas === 1 ? "nova" : "novas"}</span>${!p.confirmado_em && p.status !== "cancelado" ? `<span class="selo-msg selo-confirmar">Aguardando confirmação</span>` : ""}${p.total ? `<span class="adm-valor">${brl(p.total)}</span>` : ""}${seloStatus(p.status)}</div>
      </summary>
      <div class="pedido-corpo adm-pedido-corpo">
        <div class="adm-col">
          <h4>Cliente</h4>
          <dl class="lista-dados compacta">
            <div><dt>${c.tipo === "pj" ? "Empresa" : "Nome"}</dt><dd>${esc(nomeCliente(c))}${c.tipo === "pj" && c.responsavel ? ` (${esc(c.responsavel)})` : ""}</dd></div>
            <div><dt>${c.tipo === "pj" ? "CNPJ" : "CPF"}</dt><dd>${esc(c.cnpj || c.cpf || "—")}</dd></div>
            <div><dt>E-mail</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "—"}</dd></div>
            <div><dt>Telefone</dt><dd>${esc(c.telefone || "—")}${zap ? ` · <a href="${esc(zap)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</dd></div>
            <div><dt>Cidade</dt><dd>${esc([c.cidade, c.uf].filter(Boolean).join("/") || "—")}</dd></div>
          </dl>
          <h4>Serviços</h4>
          <ul class="pedido-itens">${itens.map((it) => `<li><span><small>${esc(it.categoria || "")}</small>${esc(it.nome)}</span><span>${it.preco ? (it.a_partir ? "a partir de " : "") + brl(it.preco) : "Sob consulta"}</span></li>`).join("")}</ul>
          ${p.observacoes ? `<p class="pedido-obs"><strong>Observação do cliente:</strong> ${esc(p.observacoes)}</p>` : ""}
        </div>
        <div class="adm-col">
          ${blocoChatAdmin(p, naoLidas)}
          <h4>Andamento</h4>
          <ol class="linha-tempo">${(p.andamento || []).map((a) => `<li class="lt-${esc(a.autor)}"><div class="lt-cab"><strong>${a.autor === "cliente" ? "Cliente" : a.autor === "equipe" ? esc(a.nome || "Equipe") : "Site"}</strong><time>${esc(dataHora(a.data))}</time></div>${a.status ? `<p class="lt-status">Situação: ${seloStatus(a.status)}</p>` : ""}${a.texto ? `<p>${fmt(a.texto)}</p>` : ""}</li>`).join("")}</ol>
          <form class="form-andamento" data-andamento="${esc(p.id)}">
            <label class="campo"><span>Situação</span><select name="status">${Object.entries(D.STATUS).map(([k, s]) => `<option value="${k}"${k === p.status ? " selected" : ""}>${esc(s.nome)}</option>`).join("")}</select></label>
            <label class="campo"><span>Mensagem para o cliente <small>(aparece em Minha conta)</small></span><textarea name="texto" rows="3" maxlength="1000" placeholder="Ex.: Recebemos seus documentos e já iniciamos a negociação com o banco."></textarea></label>
            <div class="botoes-form"><button type="submit" class="btn btn-primario">Salvar atualização</button>${ehAdmin ? `<button type="button" class="btn-texto perigo" data-excluir-pedido="${esc(p.id)}">${icone("lixo")}Excluir pedido</button>` : ""}</div>
          </form>
        </div>
      </div>
    </details>`;
  }
  function blocoChatAdmin(p, n) {
    if (D.Chat.aberto(p)) return `<div class="chat-bloco aberto"><div>${icone("chat")}<div><strong>Chat com o cliente</strong><small>Aberto desde ${esc(dataHora(p.confirmado_em))}.</small></div></div>
      <div class="botoes-form"><button type="button" class="btn btn-primario" data-chat-pedido="${esc(p.id)}">${icone("chat")}Abrir chat<span class="selo-chat" data-selo-botao${n ? "" : " hidden"}>${n}</span></button></div></div>`;
    if (p.status === "cancelado") return `<div class="chat-bloco"><div>${icone("cadeado")}<div><strong>Chat fechado</strong><small>Pedido cancelado.</small></div></div></div>`;
    return `<div class="chat-bloco confirmar"><div>${icone("check")}<div><strong>Confirme o pedido para abrir o chat</strong><small>Ao confirmar, o cliente é avisado em Minha conta e já pode conversar com você.</small></div></div>
      <div class="botoes-form"><button type="button" class="btn btn-primario" data-confirmar-pedido="${esc(p.id)}">${icone("check")}Confirmar pedido e abrir o chat</button></div></div>`;
  }
  function abrirChatPedido(id) {
    const p = pedidos.find((x) => x.id === id);
    if (!p) return;
    window.ChatUI.abrir({ pedido: p, como: "equipe", titulo: nomeCliente(p.cliente), subtitulo: `Pedido ${p.numero} · ${(p.itens || []).map((i) => i.nome).join(", ")}`, nomeCliente: String(nomeCliente(p.cliente)).split(" ")[0], aoMudar: atualizarChatNaoLidas });
  }
  document.addEventListener("click", async (e) => {
    const chat = e.target.closest("[data-chat-pedido]");
    if (chat) { abrirChatPedido(chat.dataset.chatPedido); return; }
    const conf = e.target.closest("[data-confirmar-pedido]");
    if (conf) {
      await comBotao(conf, async () => {
        await A.atualizarPedido(conf.dataset.confirmarPedido, "confirmado", "Pedido confirmado! Agora você pode conversar com a Milena pelo chat, aqui em Minha conta.");
        avisar("Pedido confirmado. O chat está aberto.");
        await recarregarPedidos();
      });
    }
  });

  /* ---------- Mensagens não lidas (aviso nas abas) ---------- */
  let chatNaoLidas = {};
  async function atualizarChatNaoLidas() {
    try { chatNaoLidas = await D.Chat.naoLidas("equipe"); } catch (e) { return; }
    const total = Object.values(chatNaoLidas).reduce((a, b) => a + b, 0);
    const aba = $('.abas-painel [data-aba="conversas"]');
    if (aba) { let selo = $(".selo-chat", aba); if (total && !selo) aba.insertAdjacentHTML("beforeend", `<span class="selo-chat">${total}</span>`); else if (total) selo.textContent = total; else if (selo) selo.remove(); }
    document.title = (total ? `(${total}) ` : "") + document.title.replace(/^\(\d+\) /, "");
    $$("#ped-lista [data-pedido]").forEach((d) => {   // só os selos: não apaga o que estiver sendo digitado
      const n = chatNaoLidas[d.dataset.pedido] || 0, selo = $("[data-selo-novas]", d), botao = $("[data-selo-botao]", d);
      if (selo) { selo.hidden = !n; $("b", selo).textContent = n; selo.lastChild.textContent = n === 1 ? " nova" : " novas"; }
      if (botao) { botao.hidden = !n; botao.textContent = n; }
    });
    if (carregadas.has("conversas") && !painel("conversas").hidden) desenharConversas();
  }

  async function salvarAndamento(e) {
    const f = e.target.closest("[data-andamento]");
    if (!f) return;
    e.preventDefault();
    const b = $("button[type=submit]", f), p = pedidos.find((x) => x.id === f.dataset.andamento);
    await comBotao(b, async () => {
      const novo = f.status.value !== p.status ? f.status.value : null;
      await A.atualizarPedido(p.id, novo, f.texto.value);
      avisar("Atualização salva. O cliente vê em Minha conta.");
      await recarregarPedidos();
    });
  }

  /* =========================================================
     CONVERSAS (chats dos pedidos confirmados)
     ========================================================= */
  CARREGAR.conversas = async function () {
    painel("conversas").innerHTML = `<p class="adm-dica">Cada pedido confirmado tem um chat com o cliente. As conversas com mensagem nova aparecem primeiro.</p><div id="conv-lista"></div>`;
    $("#conv-lista").addEventListener("click", (e) => { const b = e.target.closest("[data-chat-pedido]"); if (b) e.stopPropagation(), abrirChatPedido(b.dataset.chatPedido); });
    if (!pedidos.length) { try { pedidos = await A.pedidos(); } catch (e) { avisar(e.message); } }
    await desenharConversas();
  };
  async function desenharConversas() {
    let msgs = [];
    try { msgs = await D.Chat.recentes(); } catch (e) { avisar(e.message); }
    const ultima = {};
    msgs.forEach((m) => { if (!ultima[m.pedido_id] || m.criado_em > ultima[m.pedido_id].criado_em) ultima[m.pedido_id] = m; });
    const lista = pedidos.filter((p) => D.Chat.aberto(p) || ultima[p.id])
      .sort((a, b) => (chatNaoLidas[b.id] || 0) - (chatNaoLidas[a.id] || 0) || String((ultima[b.id] || {}).criado_em || b.confirmado_em || "").localeCompare(String((ultima[a.id] || {}).criado_em || a.confirmado_em || "")));
    $("#conv-lista").innerHTML = lista.length ? `<ul class="conversas">${lista.map((p) => {
      const m = ultima[p.id], n = chatNaoLidas[p.id] || 0;
      return `<li><button type="button" class="conversa${n ? " nova" : ""}" data-chat-pedido="${esc(p.id)}">
        <span class="chat-avatar">${esc(String(nomeCliente(p.cliente)).charAt(0).toUpperCase())}</span>
        <span class="conversa-texto"><strong>${esc(nomeCliente(p.cliente))}</strong><small>${esc(p.numero)} · ${esc((p.itens || []).map((i) => i.nome).join(", "))}</small>
          <em>${m ? (m.autor === "equipe" ? "Você: " : "") + esc(m.texto.slice(0, 90)) : "Nenhuma mensagem ainda"}</em></span>
        <span class="conversa-lado">${m ? `<time>${esc(dataHora(m.criado_em))}</time>` : ""}${n ? `<span class="selo-chat">${n}</span>` : ""}${!D.Chat.aberto(p) ? `<span class="selo-status st-cinza">Fechado</span>` : ""}</span>
      </button></li>`;
    }).join("")}</ul>` : `<div class="cartao centro caixa-aviso">${icone("chat", "icone-svg grande")}<h3>Nenhuma conversa ainda</h3><p>Confirme um pedido na aba Pedidos para abrir o chat com o cliente.</p></div>`;
  }

  /* =========================================================
     CLIENTES
     ========================================================= */
  let clientes = [];
  CARREGAR.clientes = async function () {
    const p = painel("clientes");
    p.innerHTML = `<div class="adm-barra">
        <input type="search" id="cli-busca" placeholder="Buscar por nome, e-mail, CPF/CNPJ, telefone ou cidade" aria-label="Buscar clientes">
        <button type="button" class="btn btn-contorno-rosa" id="cli-csv">${icone("doc")}Exportar planilha</button>
      </div>
      <p class="adm-contagem" id="cli-contagem"></p>
      <div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Cliente</th><th>CPF/CNPJ</th><th>Contato</th><th>Cidade</th><th>Pedidos</th><th>Cadastro</th></tr></thead><tbody id="cli-lista"></tbody></table></div>`;
    $("#cli-busca").addEventListener("input", desenharClientes);
    $("#cli-csv").addEventListener("click", exportarClientes);
    $("#cli-lista").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ver-pedidos]");
      if (!b) return;
      abrirAba("pedidos");
      const busca = $("#ped-busca");
      if (busca) { busca.value = b.dataset.verPedidos; desenharPedidos(); }
    });
    try { [clientes] = await Promise.all([A.clientes(), pedidos.length ? null : A.pedidos().then((l) => { pedidos = l; })]); }
    catch (e) { avisar(e.message); clientes = []; }
    desenharClientes();
  };
  const qtdPedidos = (c) => pedidos.filter((p) => (p.cliente || {}).email === c.email).length;
  function filtrarClientes() {
    const termo = semAcento($("#cli-busca").value.trim()), dig = BR.so(termo);
    return clientes.filter((c) => !termo || semAcento([c.nome, c.razao_social, c.nome_fantasia, c.responsavel, c.email, c.cidade].join(" ")).includes(termo)
      || (dig.length >= 3 && BR.so([c.cpf, c.cnpj, c.telefone].join(" ")).includes(dig)));
  }
  function desenharClientes() {
    const lista = filtrarClientes();
    $("#cli-contagem").textContent = `${lista.length} de ${clientes.length} clientes`;
    $("#cli-lista").innerHTML = lista.map((c) => {
      const n = qtdPedidos(c);
      return `<tr><td><strong>${esc(nomeCliente(c))}</strong>${c.tipo === "pj" && c.responsavel ? `<small>${esc(c.responsavel)}</small>` : ""}${!c.tipo ? `<small class="sem-cadastro">cadastro incompleto</small>` : ""}</td>
        <td>${esc(c.cpf || c.cnpj || "—")}</td>
        <td><a href="mailto:${esc(c.email)}">${esc(c.email)}</a><small>${esc(c.telefone || "")}</small></td>
        <td>${esc([c.cidade, c.uf].filter(Boolean).join("/") || "—")}</td>
        <td>${n ? `<button type="button" class="btn-texto" data-ver-pedidos="${esc(c.email)}">${n} ${n === 1 ? "pedido" : "pedidos"}</button>` : "—"}</td>
        <td>${c.criado_em ? esc(new Date(c.criado_em).toLocaleDateString("pt-BR")) : "—"}</td></tr>`;
    }).join("") || `<tr><td colspan="6" class="vazio">Nenhum cliente encontrado.</td></tr>`;
  }
  function exportarClientes() {
    const cols = [["Tipo", (c) => (c.tipo === "pj" ? "Empresa" : c.tipo === "pf" ? "Pessoa física" : "")], ["Nome / Razão social", nomeCliente], ["Responsável", (c) => c.responsavel],
      ["CPF", (c) => c.cpf], ["CNPJ", (c) => c.cnpj], ["E-mail", (c) => c.email], ["Telefone", (c) => c.telefone], ["CEP", (c) => c.cep],
      ["Endereço", (c) => [c.logradouro, c.numero, c.complemento].filter(Boolean).join(", ")], ["Bairro", (c) => c.bairro], ["Cidade", (c) => c.cidade], ["UF", (c) => c.uf],
      ["Pedidos", qtdPedidos], ["Cadastro", (c) => (c.criado_em ? new Date(c.criado_em).toLocaleDateString("pt-BR") : "")]];
    const cel = (v) => { let t = String(v == null ? "" : v); if (/^[=+\-@]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
    const csv = "﻿" + [cols.map((c) => cel(c[0])).join(";"), ...filtrarClientes().map((c) => cols.map(([, f]) => cel(f(c))).join(";"))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `clientes-milena-garbim-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* =========================================================
     CATÁLOGO
     ========================================================= */
  let CAT = { categorias: [], servicos: [] };
  CARREGAR.catalogo = async function () {
    const p = painel("catalogo");
    p.innerHTML = `<div class="adm-barra">
        <p class="adm-dica">Cada <strong>categoria</strong> agrupa um ou mais <strong>serviços</strong>. Ex.: “Limpa Nome” tem um serviço; “Bacen” tem dois métodos. Só aparece no site o que estiver visível.</p>
        <button type="button" class="btn btn-primario" id="cat-nova">${icone("mais")}Nova categoria</button>
      </div>
      <div id="cat-lista"></div>`;
    $("#cat-nova").addEventListener("click", () => formCategoria({ ativo: true, icone: "estrela", ordem: CAT.categorias.length + 1 }));
    $("#cat-lista").addEventListener("click", acaoCatalogo);
    await recarregarCatalogo();
  };
  async function recarregarCatalogo() {
    try { CAT = await A.catalogo(); } catch (e) { avisar(e.message); }
    const orfaos = CAT.servicos.filter((s) => !CAT.categorias.some((c) => c.id === s.categoria));
    $("#cat-lista").innerHTML = CAT.categorias.map((c) => {
      const lista = CAT.servicos.filter((s) => s.categoria === c.id);
      return `<section class="adm-cat${c.ativo ? "" : " oculto"}" data-cat="${esc(c.id)}">
        <header>
          <span class="ic">${icone(c.icone)}</span>
          <div><h3>${esc(c.nome)} ${c.ativo ? "" : `<span class="selo-status st-cinza">Oculta</span>`}</h3><p>${esc(c.descricao || "")}</p></div>
          <div class="adm-botoes">
            <button type="button" class="btn btn-contorno-rosa" data-acao="novo-servico">${icone("mais")}Serviço</button>
            <button type="button" class="btn-texto" data-acao="editar-cat">${icone("lapis")}Editar</button>
            <button type="button" class="btn-texto perigo" data-acao="excluir-cat">${icone("lixo")}Excluir</button>
          </div>
        </header>
        <ul class="adm-servicos">${lista.map((s) => `<li class="${s.ativo ? "" : "oculto"}" data-serv="${esc(s.id)}">
            ${s.foto ? `<img src="${esc(s.foto)}" alt="" width="56" height="42">` : `<span class="sem-foto">${icone("foto")}</span>`}
            <div><strong>${esc(s.nome)}</strong><small>${typeof s.preco === "number" && s.preco > 0 ? (s.aPartir ? "a partir de " : "") + brl(s.preco) : "Sob consulta"}${s.prazo ? " · " + esc(s.prazo) : ""}${s.destaque ? " · ★ destaque" : ""}</small></div>
            <button type="button" class="adm-visivel ${s.ativo ? "on" : ""}" data-acao="alternar-serv">${s.ativo ? "Visível" : "Oculto"}</button>
            <button type="button" class="btn-texto" data-acao="editar-serv">${icone("lapis")}Editar</button>
            <button type="button" class="btn-texto perigo" data-acao="excluir-serv" aria-label="Excluir ${esc(s.nome)}">${icone("lixo")}</button>
          </li>`).join("") || `<li class="vazio">Nenhum serviço nesta categoria. Clique em “+ Serviço”.</li>`}</ul>
      </section>`;
    }).join("") + (orfaos.length ? `<p class="aviso-cliente">${orfaos.length} serviço(s) sem categoria: ${orfaos.map((s) => esc(s.nome)).join(", ")}.</p>` : "")
      || `<div class="cartao centro caixa-aviso"><h3>Catálogo vazio</h3><p>Crie a primeira categoria.</p></div>`;
  }
  async function acaoCatalogo(e) {
    const b = e.target.closest("[data-acao]");
    if (!b) return;
    const catId = b.closest("[data-cat]").dataset.cat, cat = CAT.categorias.find((c) => c.id === catId);
    const servEl = b.closest("[data-serv]"), serv = servEl && CAT.servicos.find((s) => s.id === servEl.dataset.serv);
    const acao = b.dataset.acao;
    if (acao === "editar-cat") return formCategoria(cat);
    if (acao === "novo-servico") return formServico({ categoria: catId, ativo: true, aPartir: true, itens: [], ordem: CAT.servicos.filter((s) => s.categoria === catId).length + 1 });
    if (acao === "editar-serv") return formServico(serv);
    if (acao === "excluir-cat") {
      if (!confirm(`Excluir a categoria "${cat.nome}"?`)) return;
      return comBotao(b, async () => { await A.excluirCategoria(catId); avisar("Categoria excluída."); await recarregarCatalogo(); });
    }
    if (acao === "excluir-serv") {
      if (!confirm(`Excluir o serviço "${serv.nome}"? Pedidos antigos continuam com o nome dele.`)) return;
      return comBotao(b, async () => { await A.excluirServico(serv.id); avisar("Serviço excluído."); await recarregarCatalogo(); });
    }
    if (acao === "alternar-serv") return comBotao(b, async () => { await A.salvarServico(Object.assign({}, serv, { ativo: !serv.ativo })); await recarregarCatalogo(); });
  }

  function formCategoria(c) {
    const novo = !c.id;
    const m = modal(`<h2>${novo ? "Nova categoria" : "Editar categoria"}</h2>
      <form class="form-modal" novalidate>
        <label class="campo"><span>Nome</span><input name="nome" maxlength="60" required value="${esc(c.nome || "")}" placeholder="Ex.: Bacen"></label>
        <label class="campo"><span>Descrição curta</span><textarea name="descricao" rows="3" maxlength="300">${esc(c.descricao || "")}</textarea></label>
        <fieldset class="campo"><legend>Ícone</legend><div class="escolha-icone">${(PADRAO.iconesCategoria || []).map((i) => `<label title="${esc(i)}"><input type="radio" name="icone" value="${esc(i)}"${i === (c.icone || "estrela") ? " checked" : ""}>${icone(i)}</label>`).join("")}</div></fieldset>
        <div class="campos">
          <label class="campo"><span>Ordem no site</span><input name="ordem" type="number" min="0" max="999" value="${esc(c.ordem ?? 0)}"></label>
          <label class="aceite"><input type="checkbox" name="ativo"${c.ativo !== false ? " checked" : ""}><span>Visível no site</span></label>
        </div>
        <div class="botoes-form"><button type="submit" class="btn btn-primario">Salvar</button><button type="button" class="btn-texto" data-fechar>Cancelar</button></div>
      </form>`);
    $("form", m).addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      comBotao($("button[type=submit]", f), async () => {
        await A.salvarCategoria(Object.assign({}, c, { nome: f.nome.value, descricao: f.descricao.value.trim(), icone: (f.icone.value || "estrela"), ordem: +f.ordem.value || 0, ativo: f.ativo.checked }));
        m.closest(".modal-fundo").remove();
        avisar("Categoria salva.");
        await recarregarCatalogo();
      });
    });
  }

  function formServico(s) {
    const novo = !s.id;
    let foto = s.foto || "";
    const m = modal(`<h2>${novo ? "Novo serviço" : "Editar serviço"}</h2>
      <form class="form-modal" novalidate>
        <div class="campos">
          <label class="campo campo-cheio"><span>Nome do serviço</span><input name="nome" maxlength="80" required value="${esc(s.nome || "")}" placeholder="Ex.: Bacen — Método administrativo"></label>
          <label class="campo"><span>Categoria</span><select name="categoria">${CAT.categorias.map((c) => `<option value="${esc(c.id)}"${c.id === s.categoria ? " selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label>
          <label class="campo"><span>Prazo estimado <small>(opcional)</small></span><input name="prazo" maxlength="60" value="${esc(s.prazo || "")}" placeholder="Ex.: 30 a 90 dias"></label>
          <label class="campo campo-cheio"><span>Resumo (aparece no cartão)</span><textarea name="resumo" rows="2" maxlength="300">${esc(s.resumo || "")}</textarea></label>
          <label class="campo campo-cheio"><span>Descrição completa (aparece em “Detalhes”)</span><textarea name="descricao" rows="4" maxlength="2000">${esc(s.descricao || "")}</textarea></label>
          <label class="campo campo-cheio"><span>O que está incluso <small>(um por linha)</small></span><textarea name="itens" rows="3" maxlength="1000">${esc((s.itens || []).join("\n"))}</textarea></label>
          <label class="campo"><span>Preço em R$ <small>(vazio = “Sob consulta”)</small></span><input name="preco" type="number" min="0" step="0.01" inputmode="decimal" value="${typeof s.preco === "number" ? s.preco : ""}"></label>
          <label class="aceite"><input type="checkbox" name="aPartir"${s.aPartir !== false ? " checked" : ""}><span>Mostrar “a partir de” antes do preço</span></label>
          <div class="campo campo-cheio"><span class="rotulo-campo">Foto <small>(opcional)</small></span>
            <div class="foto-campo"><div class="foto-previa">${foto ? `<img src="${esc(foto)}" alt="">` : icone("foto")}</div>
              <div><label class="btn btn-contorno-rosa">${icone("foto")}Escolher foto<input type="file" accept="image/*" name="arquivo" hidden></label>
              <button type="button" class="btn-texto" data-tirar-foto${foto ? "" : " hidden"}>Remover foto</button></div></div></div>
          <label class="campo"><span>Ordem na categoria</span><input name="ordem" type="number" min="0" max="999" value="${esc(s.ordem ?? 0)}"></label>
          <div class="campo"><label class="aceite"><input type="checkbox" name="destaque"${s.destaque ? " checked" : ""}><span>Destaque (“Mais procurado”)</span></label>
          <label class="aceite"><input type="checkbox" name="ativo"${s.ativo !== false ? " checked" : ""}><span>Visível no site</span></label></div>
        </div>
        <div class="botoes-form"><button type="submit" class="btn btn-primario">Salvar serviço</button><button type="button" class="btn-texto" data-fechar>Cancelar</button></div>
      </form>`);
    m.classList.add("modal-largo");
    const f = $("form", m);
    f.arquivo.addEventListener("change", async () => {
      const arq = f.arquivo.files[0];
      if (!arq) return;
      $(".foto-previa", m).innerHTML = `<span class="carregando">Enviando...</span>`;
      try { foto = await A.enviarFoto(arq, "servicos"); $(".foto-previa", m).innerHTML = `<img src="${esc(foto)}" alt="">`; $("[data-tirar-foto]", m).hidden = false; }
      catch (e) { avisar(e.message); $(".foto-previa", m).innerHTML = foto ? `<img src="${esc(foto)}" alt="">` : icone("foto"); }
    });
    $("[data-tirar-foto]", m).addEventListener("click", (e) => { foto = ""; $(".foto-previa", m).innerHTML = icone("foto"); e.target.hidden = true; });
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      comBotao($("button[type=submit]", f), async () => {
        await A.salvarServico(Object.assign({}, s, {
          nome: f.nome.value, categoria: f.categoria.value, prazo: f.prazo.value.trim(), resumo: f.resumo.value.trim(), descricao: f.descricao.value.trim(),
          itens: f.itens.value.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 12),
          preco: f.preco.value === "" ? null : +f.preco.value, aPartir: f.aPartir.checked, foto,
          ordem: +f.ordem.value || 0, destaque: f.destaque.checked, ativo: f.ativo.checked
        }));
        m.closest(".modal-fundo").remove();
        avisar("Serviço salvo.");
        await recarregarCatalogo();
      });
    });
  }

  /* =========================================================
     TEXTOS
     ========================================================= */
  CARREGAR.textos = async function () {
    const p = painel("textos");
    let salvo = {};
    try { salvo = (await A.lerSite()).textos || {}; } catch (e) { avisar(e.message); }
    const grupos = {};
    Object.entries(PADRAO.textos).forEach(([k, t]) => { (grupos[t.grupo] = grupos[t.grupo] || []).push([k, t]); });
    p.innerHTML = `<p class="adm-dica">Edite e clique em <strong>Salvar textos</strong>. Para destacar uma palavra em rosa itálico, coloque entre asteriscos: <code>*limpo*</code>. Campo vazio volta ao texto original.</p>
      <form id="form-textos" class="adm-textos">
        ${Object.entries(grupos).map(([g, itens]) => `<fieldset class="adm-grupo"><legend>${esc(g)}</legend>${itens.map(([k, t]) => {
          const v = typeof salvo[k] === "string" && salvo[k].trim() ? salvo[k] : t.valor;
          return `<label class="campo"><span>${esc(t.rotulo)} <button type="button" class="btn-texto" data-restaurar="${esc(k)}">restaurar original</button></span>
            ${t.longo ? `<textarea name="${esc(k)}" rows="3" maxlength="1200">${esc(v)}</textarea>` : `<input name="${esc(k)}" maxlength="200" value="${esc(v)}">`}</label>`;
        }).join("")}</fieldset>`).join("")}
        <div class="barra-salvar"><button type="submit" class="btn btn-primario">Salvar textos</button></div>
      </form>`;
    const f = $("#form-textos");
    f.addEventListener("click", (e) => { const b = e.target.closest("[data-restaurar]"); if (b) f.elements[b.dataset.restaurar].value = PADRAO.textos[b.dataset.restaurar].valor; });
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      comBotao($("button[type=submit]", f), async () => {
        const textos = {};
        Object.keys(PADRAO.textos).forEach((k) => { const v = f.elements[k].value.replace(/\r/g, "").trim(); if (v && v !== PADRAO.textos[k].valor) textos[k] = v; });
        await A.salvarSite("textos", textos);
        avisar("Textos salvos! Já aparecem no site.");
      });
    });
  };

  /* =========================================================
     FOTOS
     ========================================================= */
  const FOTOS_ROTULOS = { retrato: ["Foto principal da Milena", "Topo da página inicial e Quem somos. Vertical (4:5) fica melhor."], avatar: ["Foto do rosto", "Marca do cabeçalho, formulário e Minha conta. Quadrada, com o rosto centralizado."] };
  CARREGAR.fotos = async function () {
    const p = painel("fotos");
    let salvo = {};
    try { salvo = (await A.lerSite()).fotos || {}; } catch (e) { avisar(e.message); }
    const atual = Object.assign({}, PADRAO.fotos, salvo);
    p.innerHTML = `<p class="adm-dica">A foto é reduzida automaticamente antes de enviar. Use fotos nítidas e bem iluminadas.</p>
      <div class="grade-2">${Object.entries(FOTOS_ROTULOS).map(([k, [t, dica]]) => `<div class="cartao adm-foto" data-foto-chave="${k}">
        <div class="foto-previa ${k}"><img src="${esc(atual[k])}" alt=""></div>
        <h3>${esc(t)}</h3><p>${esc(dica)}</p>
        <div class="botoes-form"><label class="btn btn-primario">${icone("foto")}Trocar foto<input type="file" accept="image/*" hidden></label>
        <button type="button" class="btn-texto" data-restaurar-foto${salvo[k] ? "" : " hidden"}>Voltar à original</button></div>
      </div>`).join("")}</div>`;
    async function gravar(chave, valor) {
      const fotos = Object.assign({}, (await A.lerSite()).fotos || {});
      if (valor) fotos[chave] = valor; else delete fotos[chave];
      await A.salvarSite("fotos", fotos);
    }
    $$("[data-foto-chave]", p).forEach((card) => {
      const k = card.dataset.fotoChave, inp = $("input[type=file]", card);
      inp.addEventListener("change", async () => {
        const arq = inp.files[0];
        if (!arq) return;
        const img = $(".foto-previa img", card);
        img.style.opacity = .4;
        try { const url = await A.enviarFoto(arq, "milena"); await gravar(k, url); img.src = url; $("[data-restaurar-foto]", card).hidden = false; avisar("Foto trocada no site."); }
        catch (e) { avisar(e.message); }
        finally { img.style.opacity = 1; inp.value = ""; }
      });
      $("[data-restaurar-foto]", card).addEventListener("click", async (e) => {
        try { await gravar(k, null); $(".foto-previa img", card).src = PADRAO.fotos[k]; e.target.hidden = true; avisar("Foto original restaurada."); } catch (err) { avisar(err.message); }
      });
    });
  };

  /* =========================================================
     DÚVIDAS
     ========================================================= */
  CARREGAR.duvidas = async function () {
    const p = painel("duvidas");
    let lista = PADRAO.faq;
    try { const s = await A.lerSite(); if (Array.isArray(s.faq) && s.faq.length) lista = s.faq; } catch (e) { avisar(e.message); }
    lista = lista.map((x) => Object.assign({}, x));
    function desenhar() {
      p.innerHTML = `<p class="adm-dica">As 5 primeiras aparecem na página inicial; todas aparecem em Dúvidas.</p>
        <form id="form-faq"><ol class="adm-faq">${lista.map((f, i) => `<li data-i="${i}">
          <label class="campo"><span>Pergunta</span><input name="p" maxlength="200" value="${esc(f.p)}"></label>
          <label class="campo"><span>Resposta</span><textarea name="r" rows="3" maxlength="1500">${esc(f.r)}</textarea></label>
          <div class="adm-botoes"><button type="button" class="btn-texto" data-mover="-1"${i ? "" : " disabled"}>↑ Subir</button><button type="button" class="btn-texto" data-mover="1"${i < lista.length - 1 ? "" : " disabled"}>↓ Descer</button><button type="button" class="btn-texto perigo" data-tirar>${icone("lixo")}Remover</button></div>
        </li>`).join("")}</ol>
        <div class="barra-salvar"><button type="button" class="btn btn-contorno-rosa" data-nova>${icone("mais")}Nova pergunta</button><button type="button" class="btn-texto" data-padrao>Voltar às originais</button><button type="submit" class="btn btn-primario">Salvar dúvidas</button></div></form>`;
    }
    const ler = () => { $$(".adm-faq li", p).forEach((li) => { lista[+li.dataset.i] = { p: li.querySelector("[name=p]").value, r: li.querySelector("[name=r]").value }; }); };
    desenhar();
    p.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-i]"), i = li ? +li.dataset.i : -1;
      if (e.target.closest("[data-mover]")) { ler(); const j = i + +e.target.closest("[data-mover]").dataset.mover; [lista[i], lista[j]] = [lista[j], lista[i]]; desenhar(); }
      else if (e.target.closest("[data-tirar]")) { ler(); lista.splice(i, 1); desenhar(); }
      else if (e.target.closest("[data-nova]")) { ler(); lista.push({ p: "", r: "" }); desenhar(); const l = $$(".adm-faq [name=p]", p).pop(); l && l.focus(); }
      else if (e.target.closest("[data-padrao]")) { if (confirm("Voltar às perguntas originais? As suas alterações serão perdidas.")) { lista = PADRAO.faq.map((x) => Object.assign({}, x)); desenhar(); } }
    });
    p.addEventListener("submit", (e) => {
      e.preventDefault();
      ler();
      const limpa = lista.map((f) => ({ p: f.p.trim(), r: f.r.trim() })).filter((f) => f.p && f.r);
      if (!limpa.length) return avisar("Deixe pelo menos uma pergunta com resposta.");
      comBotao($("button[type=submit]", p), async () => { await A.salvarSite("faq", limpa); lista = limpa; desenhar(); avisar("Dúvidas salvas!"); });
    });
  };

  /* =========================================================
     CONTATO E LINKS
     ========================================================= */
  CARREGAR.contato = async function () {
    const p = painel("contato");
    const s = await D.site();
    const c = s.contatos, r = c.redes || {};
    const campo = (n, rot, v, extra = "") => `<label class="campo"><span>${rot}</span><input name="${n}" value="${esc(v || "")}" ${extra}></label>`;
    p.innerHTML = `<form id="form-contato" class="cartao" novalidate>
      <div class="campos">
        ${campo("whatsapp", "WhatsApp (55 + DDD + número, só números)", c.whatsapp, 'inputmode="numeric" placeholder="5516999999999" maxlength="13"')}
        ${campo("telefone", "Telefone mostrado no site", c.telefone, 'placeholder="(16) 99999-9999" maxlength="20"')}
        ${campo("email", "E-mail de contato", c.email, 'type="email" maxlength="120"')}
        ${campo("cnpj", "CNPJ (rodapé)", c.cnpj, 'maxlength="18"')}
        ${campo("horario", "Horário de atendimento", c.horario, 'maxlength="80"')}
        ${campo("endereco", "Endereço / área de atendimento", c.endereco, 'maxlength="120"')}
      </div>
      <h3>Redes sociais <small>(deixe vazio para esconder)</small></h3>
      <div class="campos">
        ${campo("instagram", "Instagram", r.instagram, 'inputmode="url" placeholder="https://www.instagram.com/..."')}
        ${campo("facebook", "Facebook", r.facebook, 'inputmode="url"')}
        ${campo("tiktok", "TikTok", r.tiktok, 'inputmode="url"')}
        ${campo("youtube", "YouTube", r.youtube, 'inputmode="url"')}
      </div>
      <div class="botoes-form"><button type="submit" class="btn btn-primario">Salvar contato e links</button></div>
    </form>`;
    const f = $("#form-contato");
    f.whatsapp.addEventListener("input", () => { f.whatsapp.value = BR.so(f.whatsapp.value).slice(0, 13); });
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const zap = BR.so(f.whatsapp.value);
      if (zap && !/^55\d{10,11}$/.test(zap)) return avisar("WhatsApp: use 55 + DDD + número. Ex.: 5516999999999");
      if (f.email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) return avisar("E-mail inválido.");
      if (f.cnpj.value && !BR.cnpjValido(f.cnpj.value)) return avisar("CNPJ inválido.");
      const url = (v) => { v = v.trim(); if (!v) return ""; if (!/^https:\/\//i.test(v)) v = "https://" + v.replace(/^http:\/\//i, ""); return v; };
      comBotao($("button[type=submit]", f), async () => {
        await A.salvarSite("contatos", {
          whatsapp: zap, telefone: f.telefone.value.trim(), email: f.email.value.trim(), cnpj: f.cnpj.value ? BR.mascaras.cnpj(f.cnpj.value) : "",
          horario: f.horario.value.trim(), endereco: f.endereco.value.trim(),
          redes: { instagram: url(f.instagram.value), facebook: url(f.facebook.value), tiktok: url(f.tiktok.value), youtube: url(f.youtube.value) }
        });
        avisar("Contato e links salvos!");
      });
    });
  };

  /* =========================================================
     EQUIPE
     ========================================================= */
  let equipeAtual = [];
  CARREGAR.equipe = async function () {
    const p = painel("equipe");
    async function desenhar() {
      let lista = [];
      try { lista = await A.equipe(); } catch (e) { avisar(e.message); }
      equipeAtual = lista;
      p.innerHTML = `<p class="adm-dica"><strong>Administrador:</strong> tudo no painel. <strong>Atendente:</strong> Pedidos, Conversas e Clientes. A pessoa entra em “Minha conta” com o e-mail cadastrado aqui. O <strong>nome no chat</strong> é o que o cliente vê (o e-mail nunca aparece para ele).</p>
        <div class="tabela-rolagem"><table class="tabela"><thead><tr><th>E-mail</th><th>Nome no chat</th><th>Cargo</th><th></th></tr></thead><tbody>
        ${lista.map((m) => { const eu = m.email === C.usuario.email; return `<tr data-email="${esc(m.email)}"><td>${esc(m.email)}${eu ? " <small>(você)</small>" : ""}</td>
          <td>${eu ? esc(m.nome || "Equipe Milena Garbim") : `<input data-nome value="${esc(m.nome || "")}" maxlength="60" placeholder="Ex.: Ana" aria-label="Nome no chat">`}</td>
          <td>${eu ? (m.papel === "admin" ? "Administrador" : "Atendente") : `<select data-papel aria-label="Cargo"><option value="admin"${m.papel === "admin" ? " selected" : ""}>Administrador</option><option value="atendente"${m.papel === "atendente" ? " selected" : ""}>Atendente</option></select>`}</td>
          <td>${eu ? "" : `<button type="button" class="btn-texto perigo" data-remover-membro>${icone("lixo")}Remover</button>`}</td></tr>`; }).join("")}
        </tbody></table></div>
        <form id="form-membro" class="adm-barra">
          <input type="email" name="email" placeholder="e-mail da pessoa" required aria-label="E-mail">
          <input name="nome" placeholder="nome no chat" maxlength="60" aria-label="Nome no chat">
          <select name="papel" aria-label="Cargo"><option value="atendente">Atendente</option><option value="admin">Administrador</option></select>
          <button type="submit" class="btn btn-primario">${icone("mais")}Adicionar</button>
        </form>`;
    }
    p.addEventListener("change", async (e) => {
      if (!e.target.matches("[data-papel], [data-nome]")) return;
      const tr = e.target.closest("tr"), m = equipeAtual.find((x) => x.email === tr.dataset.email) || {};
      const papelNovo = $("[data-papel]", tr) ? $("[data-papel]", tr).value : m.papel, nome = $("[data-nome]", tr) ? $("[data-nome]", tr).value : m.nome;
      try { await A.salvarMembro(tr.dataset.email, papelNovo, nome); m.papel = papelNovo; m.nome = nome; avisar("Equipe atualizada."); } catch (err) { avisar(err.message); }
    });
    p.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-remover-membro]");
      if (!b) return;
      const email = b.closest("tr").dataset.email;
      if (!confirm(`Remover ${email} da equipe?`)) return;
      try { await A.removerMembro(email); avisar("Removido da equipe."); await desenhar(); } catch (err) { avisar(err.message); }
    });
    p.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      comBotao($("button[type=submit]", f), async () => { await A.salvarMembro(f.email.value, f.papel.value, f.nome.value); avisar("Pessoa adicionada à equipe."); await desenhar(); });
    });
    await desenhar();
  };

  /* =========================================================
     Início
     ========================================================= */
  window.ContaPronta.then(async () => {
    $("#adm-demo").hidden = D.online;
    if (!C.usuario) return mostrar("adm-entrar");
    papel = await A.meuPapel();
    if (!papel) { $("#adm-email").textContent = C.usuario.email; return mostrar("adm-negado"); }
    ehAdmin = papel === "admin";
    $("#adm-papel").textContent = ehAdmin ? "Administrador" : "Atendente";
    $("#adm-usuario").textContent = C.usuario.email;
    if (!ehAdmin) $$("[data-so-admin]").forEach((b) => b.remove());
    mostrar("adm-painel");
    let aba = "pedidos";
    try { const s = sessionStorage.getItem("mg_aba"); if (s && $(`.abas-painel [data-aba="${s}"]`)) aba = s; } catch (e) { /* ok */ }
    abrirAba(aba);
    atualizarChatNaoLidas();
    D.Chat.ouvir(null, atualizarChatNaoLidas);
  });
})();
