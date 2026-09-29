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

  let editando = false;
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
  const PASSOS = ["recebido", "em_analise", "em_andamento", "concluido"];
  function progresso(p) {
    if (p.status === "cancelado") return "";
    const atual = p.status === "aguardando_cliente" ? 2 : PASSOS.indexOf(p.status);
    return `<ol class="progresso">${PASSOS.map((s, i) => `<li class="${i <= atual ? "feito" : ""}${i === atual ? " atual" : ""}"><span></span>${esc(D.STATUS[s].nome)}</li>`).join("")}</ol>`;
  }

  async function desenharPedidos() {
    const alvo = $("#conta-pedidos");
    alvo.innerHTML = `<p class="vazio">Carregando suas solicitações...</p>`;
    let lista = [];
    try { lista = await C.listarPedidos(); } catch (e) { alvo.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
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
          <form class="form-mensagem" data-mensagem="${esc(p.id)}">
            <label class="campo"><span>Mandar mensagem para a equipe</span><textarea name="texto" rows="2" maxlength="1000" placeholder="Escreva sua dúvida ou resposta..."></textarea></label>
            <div class="botoes-form"><button type="submit" class="btn btn-primario">Enviar mensagem</button>
            <a class="btn btn-contorno-rosa" data-whats="Olá! Quero falar sobre a minha solicitação ${esc(p.numero)}.">WhatsApp</a></div>
          </form>
        </div>
      </details>`;
    }).join("");
    D.site().then((s) => {   // links de WhatsApp dos pedidos
      const n = String(s.contatos.whatsapp || "").replace(/\D/g, "");
      $$("#conta-pedidos [data-whats]").forEach((a) => { if (n) { a.href = "https://wa.me/" + n + "?text=" + encodeURIComponent(a.dataset.whats); a.target = "_blank"; a.rel = "noopener"; } else a.hidden = true; });
    });
  }
  $("#conta-pedidos").addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-mensagem]");
    if (!f) return;
    e.preventDefault();
    const b = $("button[type=submit]", f);
    b.disabled = true;
    try { await C.enviarMensagem(f.dataset.mensagem, f.texto.value); avisar("Mensagem enviada para a equipe."); await desenharPedidos(); }
    catch (err) { avisar(err.message); b.disabled = false; }
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
    desenharPedidos();
    D.Painel.meuPapel().then((papel) => { $("#link-painel").hidden = !papel; }).catch(() => {});
  }

  window.ContaPronta.then(() => decidir(false)).catch(() => mostrar("conta-entrar"));
})();
