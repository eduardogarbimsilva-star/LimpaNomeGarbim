/* =========================================================
   Milena Garbim · Limpa Nome — Minha conta
   Entrar com código por e-mail, cadastro PF/PJ e acompanhamento das solicitações
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const D = window.Dados, C = D.Conta, BR = window.BR, MG = window.MG;
  const { esc, fmt, brl, icone, avisar } = MG;
  const params = new URLSearchParams(location.search);
  const voltar = /^[a-z-]+\.html$/.test(params.get("voltar") || "") ? params.get("voltar") : "";
  const querEnviar = params.get("enviar") === "1";
  const dataHora = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const data = (d) => new Date(d).toLocaleDateString("pt-BR");

  const TELAS = ["conta-carregando", "conta-entrar", "conta-cadastro", "conta-painel"];
  const mostrar = (id) => TELAS.forEach((t) => { $("#" + t).hidden = t !== id; });
  $("#conta-demo").hidden = D.online;

  /* =========================================================
     Entrar / criar conta
     ========================================================= */
  let modo = "entrar", emailAtual = "";
  $$(".abas-login [data-modo]").forEach((b) => b.addEventListener("click", () => {
    modo = b.dataset.modo;
    $$(".abas-login [data-modo]").forEach((x) => x.classList.toggle("ativo", x === b));
    $("#aceite-criar").hidden = modo !== "criar";
    $("#btn-codigo").textContent = modo === "criar" ? "Criar conta e receber código" : "Receber código por e-mail";
  }));
  if (params.get("criar") === "1") $('.abas-login [data-modo="criar"]').click();

  $("#c-email").addEventListener("blur", (e) => {
    const s = BR.sugerirEmail(e.target.value.trim());
    const dica = $("#dica-email");
    dica.hidden = !s;
    if (s) dica.innerHTML = `Você quis dizer <button type="button" class="btn-texto">${esc(s)}</button>?`;
  });
  $("#dica-email").addEventListener("click", (e) => {
    if (!e.target.matches("button")) return;
    $("#c-email").value = e.target.textContent; $("#dica-email").hidden = true;
  });

  async function pedirCodigo(email, botao) {
    const original = botao.textContent;
    botao.disabled = true; botao.textContent = "Enviando...";
    try {
      const r = await C.enviarCodigo(email, modo === "criar");
      emailAtual = email.trim().toLowerCase();
      $("#c-email-mostra").textContent = emailAtual;
      $("#codigo-demo").hidden = !r.codigoDemo;
      if (r.codigoDemo) $("#codigo-demo").innerHTML = `Modo demonstração — seu código: <strong>${esc(r.codigoDemo)}</strong>`;
      if (r.jaTinhaConta) avisar("Este e-mail já tem cadastro. Enviamos o código para você entrar.");
      $("#form-email").hidden = true; $("#form-codigo").hidden = false;
      $("#c-codigo").value = ""; $("#c-codigo").focus();
    } catch (e) { avisar(e.message); }
    finally { botao.disabled = false; botao.textContent = original; }
  }
  $("#form-email").addEventListener("submit", (e) => {
    e.preventDefault();
    if (modo === "criar" && !e.target.aceite.checked) return avisar("Para criar a conta, aceite a Política de Privacidade.");
    pedirCodigo(e.target.email.value, $("#btn-codigo"));
  });
  $("#c-reenviar").addEventListener("click", (e) => pedirCodigo(emailAtual, e.target));
  $("#c-trocar").addEventListener("click", () => { $("#form-codigo").hidden = true; $("#form-email").hidden = false; $("#c-email").focus(); });
  $("#form-codigo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = $("button[type=submit]", e.target);
    b.disabled = true;
    try { await C.verificarCodigo(emailAtual, e.target.codigo.value); await decidir(true); }
    catch (err) { avisar(err.message); }
    finally { b.disabled = false; }
  });

  /* =========================================================
     Cadastro
     ========================================================= */
  const form = $("#conta-cadastro");
  $$("[data-mascara]", form).forEach((inp) => inp.addEventListener("input", () => { inp.value = BR.mascaras[inp.dataset.mascara](inp.value); }));
  function tipoCadastro() { return form.tipo.value; }
  function alternarTipo() {
    const pj = tipoCadastro() === "pj";
    $$("[data-pf]", form).forEach((el) => { el.hidden = pj; });
    $$("[data-pj]", form).forEach((el) => { el.hidden = !pj; });
  }
  $$("input[name=tipo]", form).forEach((r) => r.addEventListener("change", alternarTipo));

  form.cep.addEventListener("blur", async () => {
    if (BR.so(form.cep.value).length !== 8) return;
    try {
      const d = await BR.buscarCep(form.cep.value);
      ["logradouro", "bairro", "cidade"].forEach((k) => { if (d[k]) form[k].value = d[k]; });
      if (d.uf) form.uf.value = d.uf;
      form.numero.focus();
    } catch (e) { avisar(e.message); }
  });
  $("#k-buscar-cnpj").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const d = await BR.buscarCnpj(form.cnpj.value);
      form.razao_social.value = d.razao_social || "";
      form.nome_fantasia.value = d.nome_fantasia || "";
      if (d.cep) form.cep.value = BR.mascaras.cep(d.cep);
      ["logradouro", "numero", "complemento", "bairro", "cidade"].forEach((k) => { if (d[k]) form[k].value = d[k]; });
      if (d.uf) form.uf.value = d.uf;
      if (d.telefone && !form.telefone.value) form.telefone.value = BR.mascaras.telefone(d.telefone);
      if (d.situacao && d.situacao !== "ATIVA") avisar("Atenção: situação do CNPJ na Receita: " + d.situacao);
    } catch (err) { avisar(err.message); }
    finally { e.target.disabled = false; }
  });

  function preencherCadastro(p) {
    p = p || {};
    const tipo = p.tipo || "pf";
    $$("input[name=tipo]", form).forEach((r) => { r.checked = r.value === tipo; });
    ["nome", "cpf", "cnpj", "razao_social", "nome_fantasia", "responsavel", "telefone", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"]
      .forEach((k) => { if (form[k]) form[k].value = p[k] || ""; });
    alternarTipo();
  }

  function lerCadastro() {
    const L = (k, max) => BR.limpar(form[k].value, max);
    const pj = tipoCadastro() === "pj";
    const d = {
      tipo: pj ? "pj" : "pf",
      nome: pj ? null : L("nome", 100), cpf: pj ? null : BR.mascaras.cpf(form.cpf.value),
      cnpj: pj ? BR.mascaras.cnpj(form.cnpj.value) : null, razao_social: pj ? L("razao_social", 150) : null,
      nome_fantasia: pj ? L("nome_fantasia", 150) || null : null, responsavel: pj ? L("responsavel", 100) : null,
      telefone: BR.mascaras.telefone(form.telefone.value), cep: BR.so(form.cep.value) ? BR.mascaras.cep(form.cep.value) : null,
      logradouro: L("logradouro", 150) || null, numero: L("numero", 20) || null, complemento: L("complemento", 80) || null,
      bairro: L("bairro", 80) || null, cidade: L("cidade", 80), uf: form.uf.value
    };
    if (!pj && !BR.nomeValido(d.nome)) throw new Error("Informe seu nome completo (nome e sobrenome).");
    if (!pj && !BR.cpfValido(d.cpf)) throw new Error("CPF inválido. Confira os números.");
    if (pj && !BR.cnpjValido(d.cnpj)) throw new Error("CNPJ inválido. Confira os números.");
    if (pj && d.razao_social.length < 3) throw new Error("Informe a razão social.");
    if (pj && !BR.nomeValido(d.responsavel)) throw new Error("Informe o nome completo do responsável.");
    if (!BR.telefoneValido(d.telefone)) throw new Error("Telefone inválido. Use DDD + número (celular começa com 9).");
    if (d.cep && !BR.cepValido(d.cep)) throw new Error("CEP inválido.");
    if (d.cidade.length < 2) throw new Error("Informe a cidade.");
    if (!BR.UFS.includes(d.uf)) throw new Error("Selecione o estado.");
    return d;
  }

  let editando = false, ouvindo = null;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = $("button[type=submit]", form);
    try {
      const d = lerCadastro();
      b.disabled = true;
      await C.salvarPerfil(d);
      avisar("Cadastro salvo!");
      editando = false;
      if (querEnviar && window.Solicitacao && window.Solicitacao.ids().length) { location.href = "servicos.html?solicitacao=1"; return; }
      await decidir();
    } catch (err) { avisar(err.message); }
    finally { b.disabled = false; }
  });
  $("#k-cancelar").addEventListener("click", () => { editando = false; decidir(); });

  /* =========================================================
     Área logada
     ========================================================= */
  $$(".abas [data-aba]").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.aba)));
  function abrirAba(aba) {
    $$(".abas [data-aba]").forEach((x) => { x.classList.toggle("ativo", x.dataset.aba === aba); x.setAttribute("aria-selected", x.dataset.aba === aba); });
    $$("[data-painel]").forEach((p) => { p.hidden = p.dataset.painel !== aba; });
  }
  $("#conta-sair").addEventListener("click", async () => { await C.sair(); location.href = "index.html"; });

  function seloStatus(s) {
    const st = D.STATUS[s] || { nome: s, cor: "cinza" };
    return `<span class="selo-status st-${st.cor}">${esc(st.nome)}</span>`;
  }
  function linhaTempo(p) {
    return `<ol class="linha-tempo">${(p.andamento || []).map((a) => {
      const quem = a.autor === "cliente" ? "Você" : a.autor === "equipe" ? "Equipe Milena Garbim" : "Site";
      return `<li class="lt-${esc(a.autor)}"><div class="lt-cab"><strong>${esc(quem)}</strong><time>${esc(dataHora(a.data))}</time></div>
        ${a.status ? `<p class="lt-status">Situação: ${seloStatus(a.status)}</p>` : ""}${a.texto ? `<p>${fmt(a.texto)}</p>` : ""}</li>`;
    }).join("")}</ol>`;
  }
  const PASSOS = ["recebido", "confirmado", "em_andamento", "concluido"];
  const POSICAO = { recebido: 0, em_analise: 0, confirmado: 1, aguardando_cliente: 2, em_andamento: 2, concluido: 3 };
  function progresso(p) {
    if (p.status === "cancelado") return "";
    const atual = POSICAO[p.status] ?? 0;
    return `<ol class="progresso">${PASSOS.map((s, i) => `<li class="${i <= atual ? "feito" : ""}${i === atual ? " atual" : ""}"><span></span>${esc(D.STATUS[s].nome)}</li>`).join("")}</ol>`;
  }

  async function desenharPedidos() {
    const alvo = $("#conta-pedidos");
    alvo.innerHTML = `<p class="vazio">Carregando suas solicitações...</p>`;
    let lista = [];
    try { [lista] = await Promise.all([C.listarPedidos(), D.Chat.naoLidas("cliente").then((r) => { naoLidas = r; }).catch(() => {})]); }
    catch (e) { alvo.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
    pedidosAtuais = lista;
    if (!lista.length) {
      alvo.innerHTML = `<div class="cartao centro caixa-aviso">${icone("sacola", "icone-svg grande")}<h3>Nenhuma solicitação ainda</h3><p>Escolha os serviços no catálogo e envie a sua solicitação. Você acompanha tudo por aqui.</p><a href="servicos.html" class="btn btn-primario">Ver serviços</a></div>`;
      return;
    }
    alvo.innerHTML = lista.map((p, i) => {
      const itens = p.itens || [];
      return `<details class="pedido-cartao"${i === 0 ? " open" : ""} data-pedido="${esc(p.id)}">
        <summary>
          <div><strong>${esc(p.numero)}</strong><small>${esc(data(p.criado_em))} · ${itens.length} ${itens.length === 1 ? "serviço" : "serviços"}</small></div>
          ${seloStatus(p.status)}
        </summary>
        <div class="pedido-corpo">
          ${progresso(p)}
          ${p.status === "aguardando_cliente" ? `<p class="aviso-cliente">${icone("alerta")}A equipe está aguardando uma resposta sua. Veja a última mensagem abaixo.</p>` : ""}
          <ul class="pedido-itens">${itens.map((it) => `<li><span><small>${esc(it.categoria || "")}</small>${esc(it.nome)}</span><span>${it.preco ? (it.a_partir ? "a partir de " : "") + brl(it.preco) : "Sob consulta"}</span></li>`).join("")}</ul>
          ${p.observacoes ? `<p class="pedido-obs"><strong>Sua observação:</strong> ${esc(p.observacoes)}</p>` : ""}
          <h4>Andamento</h4>
          ${linhaTempo(p)}
          ${blocoChat(p)}
        </div>
      </details>`;
    }).join("");
    D.site().then((s) => {   // links de WhatsApp dos pedidos
      const n = String(s.contatos.whatsapp || "").replace(/\D/g, "");
      $$("#conta-pedidos [data-whats]").forEach((a) => { if (n) { a.href = "https://wa.me/" + n + "?text=" + encodeURIComponent(a.dataset.whats); a.target = "_blank"; a.rel = "noopener"; } else a.hidden = true; });
    });
  }
  /* ---------- Chat com a Milena (abre depois que ela confirma o pedido) ---------- */
  let pedidosAtuais = [], naoLidas = {}, fotoMilena = "assets/img/milena-garbim-avatar.jpg";
  D.site().then((s) => { fotoMilena = s.fotos.avatar || fotoMilena; });
  function blocoChat(p) {
    const whats = `<a class="btn btn-contorno-rosa" data-whats="Olá! Quero falar sobre a minha solicitação ${esc(p.numero)}.">WhatsApp</a>`;
    if (D.Chat.aberto(p)) {
      const n = naoLidas[p.id] || 0;
      return `<div class="chat-bloco aberto"><div>${icone("chat")}<div><strong>Chat com a Milena</strong><small>Seu pedido foi confirmado. Converse direto com ela por aqui.</small></div></div>
        <div class="botoes-form"><button type="button" class="btn btn-primario" data-abrir-chat="${esc(p.id)}">${icone("chat")}Conversar com a Milena${n ? `<span class="selo-chat" data-selo-chat="${esc(p.id)}">${n}</span>` : ""}</button>${whats}</div></div>`;
    }
    if (p.status === "cancelado") return `<div class="chat-bloco"><div>${icone("cadeado")}<div><strong>Chat encerrado</strong><small>Este pedido foi cancelado. Se precisar, fale com a gente pelo WhatsApp.</small></div></div><div class="botoes-form">${whats}</div></div>`;
    return `<div class="chat-bloco"><div>${icone("cadeado")}<div><strong>Chat com a Milena</strong><small>O chat abre assim que a Milena confirmar o seu pedido. Enquanto isso, se precisar, chame no WhatsApp.</small></div></div><div class="botoes-form">${whats}</div></div>`;
  }
  async function atualizarNaoLidas() {
    try { naoLidas = await D.Chat.naoLidas("cliente"); } catch (e) { return; }
    $$("[data-abrir-chat]").forEach((b) => {
      const n = naoLidas[b.dataset.abrirChat] || 0;
      let selo = $(".selo-chat", b);
      if (n && !selo) { b.insertAdjacentHTML("beforeend", `<span class="selo-chat">${n}</span>`); }
      else if (n) selo.textContent = n; else if (selo) selo.remove();
    });
    const total = Object.values(naoLidas).reduce((a, b) => a + b, 0);
    const aba = $('.abas [data-aba="pedidos"]');
    if (aba) aba.innerHTML = "Minhas solicitações" + (total ? ` <span class="selo-chat">${total}</span>` : "");
  }
  function abrirChat(id) {
    const p = pedidosAtuais.find((x) => x.id === id);
    if (!p || !D.Chat.aberto(p)) return;
    window.ChatUI.abrir({ pedido: p, como: "cliente", titulo: "Milena Garbim", subtitulo: "Pedido " + p.numero, foto: fotoMilena, aoMudar: atualizarNaoLidas });
  }
  $("#conta-pedidos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-abrir-chat]");
    if (b) abrirChat(b.dataset.abrirChat);
  });

  function desenharDados() {
    const p = C.perfil || {};
    const linha = (r, v) => v ? `<div><dt>${esc(r)}</dt><dd>${esc(v)}</dd></div>` : "";
    const end = [p.logradouro && `${p.logradouro}${p.numero ? ", " + p.numero : ""}${p.complemento ? " - " + p.complemento : ""}`, p.bairro, p.cidade && `${p.cidade}/${p.uf}`, p.cep].filter(Boolean).join(" · ");
    $("#conta-dados").innerHTML = `<dl class="lista-dados">
      ${p.tipo === "pj" ? linha("Razão social", p.razao_social) + linha("Nome fantasia", p.nome_fantasia) + linha("CNPJ", p.cnpj) + linha("Responsável", p.responsavel) : linha("Nome", p.nome) + linha("CPF", p.cpf)}
      ${linha("E-mail", C.usuario.email)}${linha("Telefone", p.telefone)}${linha("Endereço", end)}
    </dl><button type="button" class="btn btn-contorno-rosa" id="editar-dados">${icone("lapis")}Editar meus dados</button>`;
    $("#editar-dados").addEventListener("click", () => { editando = true; decidir(); });
  }

  /* =========================================================
     Qual tela mostrar
     ========================================================= */
  async function decidir(acabouDeEntrar) {
    if (!C.usuario) { mostrar("conta-entrar"); return; }
    if (voltar) { location.href = voltar; return; }
    if (!C.perfilCompleto() || editando) {
      // a equipe pode ir direto ao painel sem cadastro de cliente
      preencherCadastro(C.perfil);
      $("#k-cancelar").hidden = !editando;
      mostrar("conta-cadastro");
      if (!editando) D.Painel.meuPapel().then((papel) => {
        if (papel && !$("#aviso-equipe")) form.insertAdjacentHTML("afterbegin", `<p id="aviso-equipe" class="aviso-cliente">${icone("painel")}Você é da equipe. <a href="admin.html">Ir para o painel</a> — o cadastro abaixo é só para quem também é cliente.</p>`);
      });
      return;
    }
    if (acabouDeEntrar && querEnviar && window.Solicitacao && window.Solicitacao.ids().length) { location.href = "servicos.html?solicitacao=1"; return; }
    $("#conta-nome").textContent = C.nomeExibicao();
    $("#conta-email").textContent = C.usuario.email;
    mostrar("conta-painel");
    desenharDados();
    await desenharPedidos();
    atualizarNaoLidas();
    if (!ouvindo) ouvindo = D.Chat.ouvir(null, atualizarNaoLidas);
    const pedirChat = params.get("chat");
    if (pedirChat) abrirChat(pedirChat);
    D.Painel.meuPapel().then((papel) => { $("#link-painel").hidden = !papel; }).catch(() => {});
  }

  window.ContaPronta.then(() => decidir(false)).catch(() => mostrar("conta-entrar"));
})();
