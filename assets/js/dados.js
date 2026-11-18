/* =========================================================
   Milena Garbim · Limpa Nome — dados do site

   Tudo que é salvo passa por aqui:
   - Conta do cliente (login com código por e-mail, cadastro, pedidos)
   - Catálogo de serviços (categorias e serviços)
   - Textos, fotos, dúvidas e contatos editados pelo painel
   - Funções do painel (pedidos, clientes, equipe)

   Funciona de dois jeitos:
   1) Supabase configurado em config.js -> dados no banco, código enviado por e-mail.
   2) Sem Supabase -> "modo demonstração": o código aparece na tela e tudo fica
      salvo só neste navegador (bom para testar; não publique assim para clientes).
   ========================================================= */
(function () {
  "use strict";

  const CFG = window.SITE_CONFIG || {};
  const SB = CFG.supabase || {};
  const ONLINE = !!(SB.url && SB.anonKey);
  const PADRAO = window.PADRAO || { textos: {}, categorias: [], servicos: [], faq: [], fotos: {} };
  const K = {
    sessao: "mg_demo_sessao", perfis: "mg_demo_perfis", pedidos: "mg_demo_pedidos", codigo: "mg_demo_codigo",
    categorias: "mg_demo_categorias", servicos: "mg_demo_servicos", site: "mg_demo_site", equipe: "mg_demo_equipe",
    mensagens: "mg_demo_mensagens"
  };

  const ler = (k, p) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? p; } catch (e) { return p; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error("Não foi possível salvar neste navegador (espaço cheio ou modo privado)."); } };
  const copia = (v) => JSON.parse(JSON.stringify(v));
  const normalizarEmail = (e) => String(e || "").trim().toLowerCase();
  const so = (v) => String(v || "").replace(/\D/g, "");

  /* ---------- Cliente Supabase (carregado só quando configurado) ---------- */
  let clientePromise = null;
  function supabase() {
    if (!ONLINE) return Promise.reject(new Error("Servidor não configurado."));
    if (!clientePromise) {
      clientePromise = new Promise((resolve, reject) => {
        const criar = () => resolve(window.supabase.createClient(SB.url, SB.anonKey));
        if (window.supabase && window.supabase.createClient) return criar();
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        s.onload = criar;
        s.onerror = () => { clientePromise = null; reject(new Error("Não foi possível conectar ao servidor. Verifique sua internet.")); };
        document.head.appendChild(s);
      });
    }
    return clientePromise;
  }

  const DUPLICADO = {
    cpf: "Este CPF já está cadastrado em outra conta. Entre com o e-mail dessa conta ou fale com a gente pelo WhatsApp.",
    cnpj: "Este CNPJ já está cadastrado em outra conta. Entre com o e-mail dessa conta ou fale com a gente pelo WhatsApp.",
    email: "Este e-mail já está cadastrado. Use \"Entrar\" em vez de \"Criar conta\"."
  };
  function traduzirErro(erro) {
    const msg = String((erro && erro.message) || erro || "");
    if ((erro && erro.code === "23505") || /duplicate key|unique constraint/i.test(msg)) {
      const k = /cpf/i.test(msg) ? "cpf" : /cnpj/i.test(msg) ? "cnpj" : /email/i.test(msg) ? "email" : null;
      return new Error(k ? DUPLICADO[k] : "Esses dados já estão cadastrados.");
    }
    if ((erro && erro.code === "23514") || /check constraint/i.test(msg)) return new Error("Alguns dados estão inválidos. Confira e tente novamente.");
    if (/row-level security|permission denied|42501/i.test(msg)) return new Error("Você não tem permissão para fazer isso.");
    if (/signups? not allowed|user not found/i.test(msg)) return new Error("Não encontramos uma conta com este e-mail. Clique em \"Criar conta\".");
    if (/expired|invalid/i.test(msg) && /token|otp/i.test(msg)) return new Error("Código inválido ou expirado. Confira ou peça um novo código.");
    if (/rate limit|security purposes|only request/i.test(msg)) return new Error("Muitas tentativas. Aguarde um minuto antes de pedir outro código.");
    if (/CADASTRO_INCOMPLETO/.test(msg)) return new Error("Complete seu cadastro antes de enviar a solicitação.");
    if (/SEM_ITENS/.test(msg)) return new Error("Sua solicitação está vazia.");
    if (/CHAT_FECHADO/.test(msg)) return new Error("Este pedido foi cancelado: o chat está fechado.");
    if (/SERVICO_INDISPONIVEL/.test(msg)) return new Error("Um dos serviços escolhidos não está mais disponível. Atualize a página.");
    if (/Failed to fetch|NetworkError/i.test(msg)) return new Error("Sem conexão com o servidor. Verifique sua internet.");
    return new Error(msg || "Ocorreu um erro. Tente novamente.");
  }
  async function rodar(promessa) {
    const { data, error } = await promessa;
    if (error) throw traduzirErro(error);
    return data;
  }

  /* ---------- Situações do pedido ---------- */
  /** Situações que contam como pedido aceito pela vendedora (liberam o chat) */
  const CONFIRMADOS = ["confirmado", "aguardando_cliente", "em_andamento", "concluido"];
  // O chat abre assim que o pedido é feito: a assistente virtual atende até a equipe responder
  const chatAberto = (p) => !!(p && p.status !== "cancelado");
  const STATUS = {
    recebido: { nome: "Recebido", cor: "rosa" },
    em_analise: { nome: "Em análise", cor: "champanhe" },
    confirmado: { nome: "Confirmado", cor: "ok" },
    aguardando_cliente: { nome: "Aguardando você", cor: "alerta" },
    em_andamento: { nome: "Em andamento", cor: "champanhe" },
    concluido: { nome: "Concluído", cor: "ok" },
    cancelado: { nome: "Cancelado", cor: "cinza" }
  };

  /* =========================================================
     Conteúdo público: site (textos, fotos, dúvidas, contatos) e catálogo
     ========================================================= */
  function mesclarSite(salvo) {
    salvo = salvo || {};
    const contatos = Object.assign({
      whatsapp: CFG.whatsapp || "", telefone: CFG.telefone || "", email: CFG.email || "", cnpj: CFG.cnpj || "",
      horario: CFG.horario || "", endereco: CFG.endereco || ""
    }, salvo.contatos || {});
    contatos.redes = Object.assign({}, CFG.redes || {}, (salvo.contatos || {}).redes || {});
    const textos = {};
    Object.keys(PADRAO.textos).forEach((k) => { textos[k] = PADRAO.textos[k].valor; });
    Object.entries(salvo.textos || {}).forEach(([k, v]) => { if (typeof v === "string" && v.trim()) textos[k] = v; });
    return {
      contatos, textos,
      fotos: Object.assign({}, PADRAO.fotos, salvo.fotos || {}),
      faq: Array.isArray(salvo.faq) && salvo.faq.length ? salvo.faq : PADRAO.faq,
      direitos: Array.isArray(salvo.direitos) && salvo.direitos.length ? salvo.direitos : (PADRAO.direitos || []),
      depoimentos: Array.isArray(salvo.depoimentos) ? salvo.depoimentos : (PADRAO.depoimentos || []),
      aparencia: Object.assign({}, PADRAO.aparencia || {}, salvo.aparencia || {}, {
        secoes: Object.assign({}, (PADRAO.aparencia || {}).secoes || {}, (salvo.aparencia || {}).secoes || {}),
        aviso: Object.assign({}, (PADRAO.aparencia || {}).aviso || {}, (salvo.aparencia || {}).aviso || {})
      }),
      personalizado: salvo
    };
  }

  let sitePromise = null;
  function site() {
    if (!sitePromise) {
      sitePromise = (async () => {
        if (!ONLINE) return mesclarSite(ler(K.site, {}));
        try {
          // leitura direta pela API (rápida, sem carregar a biblioteca do Supabase)
          const r = await fetch(SB.url + "/rest/v1/configuracoes?id=eq.1&select=dados", { headers: { apikey: SB.anonKey, Authorization: "Bearer " + SB.anonKey } });
          const d = r.ok ? await r.json() : [];
          return mesclarSite((d[0] || {}).dados);
        } catch (e) { return mesclarSite({}); }
      })();
    }
    return sitePromise;
  }

  const achatar = (r) => Object.assign({}, r.dados || {}, { id: r.id, ordem: r.ordem ?? 0, ativo: r.ativo !== false }, r.categoria ? { categoria: r.categoria } : {});
  const porOrdem = (a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.nome).localeCompare(String(b.nome));

  function catalogoDemo() {
    let cats = ler(K.categorias, null), servs = ler(K.servicos, null);
    if (!cats) { cats = copia(PADRAO.categorias); gravar(K.categorias, cats); }
    if (!servs) { servs = copia(PADRAO.servicos); gravar(K.servicos, servs); }
    // Atualização do catálogo de demonstração: novos serviços padrão e perfis (PF/PJ) e situações
    const versao = ler("mg_demo_catalogo_v", 0);
    if (versao < 3) {
      PADRAO.categorias.forEach((c) => {
        const x = cats.find((y) => y.id === c.id);
        if (!x) cats.push(copia(c));
        else {
          x.ordem = c.ordem;   // nova ordem: Limpa Nome, Bacen, Perícia, Rating...
          if (/negocia/i.test(x.descricao || "")) x.descricao = c.descricao;
        }
      });
      PADRAO.servicos.forEach((p) => {
        const s = servs.find((x) => x.id === p.id);
        if (!s) servs.push(copia(p));
        else {
          if (!s.perfis && p.perfis) Object.assign(s, { perfis: copia(p.perfis), situacoes: copia(p.situacoes || []) });
          // textos antigos que falavam em "negociar" (a empresa trabalha com medida judicial)
          if (/negocia/i.test([s.resumo, s.descricao].concat(s.itens || []).join(" ")) && versao < 3) Object.assign(s, { resumo: p.resumo, descricao: p.descricao, itens: copia(p.itens || []), perfis: copia(p.perfis || []) });
        }
      });
      try { gravar(K.categorias, cats); gravar(K.servicos, servs); gravar("mg_demo_catalogo_v", 3); } catch (e) { /* navegador sem espaço: usa só nesta visita */ }
    }
    return { categorias: cats, servicos: servs };
  }

  /** Catálogo completo. somenteAtivos=true para o site (o painel vê tudo) */
  async function catalogo(somenteAtivos = true) {
    let cats, servs;
    if (ONLINE) {
      try {
        const cab = { headers: { apikey: SB.anonKey, Authorization: "Bearer " + SB.anonKey } };
        let token = null;
        if (!somenteAtivos) { const sb = await supabase(); token = (await sb.auth.getSession()).data.session; if (token) cab.headers.Authorization = "Bearer " + token.access_token; }
        const [rc, rs] = await Promise.all([
          fetch(SB.url + "/rest/v1/categorias?select=*", cab), fetch(SB.url + "/rest/v1/servicos?select=*", cab)
        ]);
        if (!rc.ok || !rs.ok) throw new Error("catálogo");
        cats = (await rc.json()).map(achatar); servs = (await rs.json()).map(achatar);
      } catch (e) {
        if (!somenteAtivos) throw new Error("Não foi possível carregar o catálogo. Confira se o setup.sql foi rodado no Supabase.");
        cats = copia(PADRAO.categorias); servs = copia(PADRAO.servicos);
      }
    } else ({ categorias: cats, servicos: servs } = catalogoDemo());
    if (somenteAtivos) {
      cats = cats.filter((c) => c.ativo !== false);
      const ids = new Set(cats.map((c) => c.id));
      servs = servs.filter((s) => s.ativo !== false && ids.has(s.categoria));
    }
    return { categorias: cats.sort(porOrdem), servicos: servs.sort(porOrdem) };
  }

  /* =========================================================
     Chat do pedido (cliente <-> vendedora)
     ========================================================= */
  const cacheFotos = {};
  const Chat = {
    aberto: chatAberto,
    async mensagens(pedidoId) {
      if (!ONLINE) return ler(K.mensagens, []).filter((m) => m.pedido_id === pedidoId);
      const sb = await supabase();
      return (await rodar(sb.from("mensagens").select("*").eq("pedido_id", pedidoId).order("criado_em").limit(500))) || [];
    },
    /** como: "cliente" | "equipe"; foto: arquivo de imagem (opcional) */
    async enviar(pedidoId, texto, como, foto) {
      texto = String(texto || "").trim().slice(0, 2000);
      if (!texto && !foto) throw new Error("Escreva a mensagem.");
      let anexo = null;
      if (foto) {
        const blob = await reduzirFoto(foto, 1400);
        if (ONLINE) {
          const sb = await supabase();
          anexo = `${pedidoId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
          await rodar(sb.storage.from("chat").upload(anexo, blob, { contentType: "image/jpeg" }));
        } else anexo = await blobParaDataUrl(await reduzirFoto(foto, 900));
      }
      if (ONLINE) { const sb = await supabase(); return rodar(sb.rpc("enviar_mensagem", { p_pedido: pedidoId, p_texto: texto, p_como: como, p_anexo: anexo })); }
      const todos = ler(K.pedidos, []), p = todos.find((x) => x.id === pedidoId);
      if (!p || (como === "cliente" && p.cliente_id !== (usuarioAtual || {}).email)) throw new Error("Pedido não encontrado.");
      if (!chatAberto(p)) throw new Error("Este pedido foi cancelado: o chat está fechado.");
      let nome = null;
      if (como === "equipe") { const m = ler(K.equipe, []).find((x) => x.email === (usuarioAtual || {}).email); nome = (m && m.nome) || "Equipe Milena Garbim"; }
      const msg = { id: "m" + Date.now() + Math.random().toString(36).slice(2, 6), pedido_id: pedidoId, autor: como, nome, texto, anexo, criado_em: new Date().toISOString(), lida_em: null };
      const lista = ler(K.mensagens, []); lista.push(msg); gravar(K.mensagens, lista);
      p.atualizado_em = msg.criado_em;
      if (como === "equipe") p.ia_ativa = false;   // a equipe respondeu: a assistente sai da conversa
      gravar(K.pedidos, todos);
      // demonstração: simula a resposta automática da assistente (no site real quem responde é a IA no servidor)
      if (como === "cliente" && p.ia_ativa !== false) setTimeout(() => demoMensagem(pedidoId, "ia", "Recebi sua mensagem! A Milena foi avisada e responde por aqui o quanto antes. (Demonstração: com o Supabase ligado, quem responde aqui é a assistente com IA.)"), 1500);
      return msg;
    },
    /** Equipe liga/desliga a assistente virtual da conversa */
    async alternarIA(pedidoId, ativa) {
      if (ONLINE) { const sb = await supabase(); await rodar(sb.rpc("alternar_ia", { p_pedido: pedidoId, p_ativa: !!ativa })); return; }
      const todos = ler(K.pedidos, []), p = todos.find((x) => x.id === pedidoId);
      if (!p) throw new Error("Pedido não encontrado.");
      p.ia_ativa = !!ativa; gravar(K.pedidos, todos);
      demoMensagem(pedidoId, "sistema", ativa ? "A assistente virtual voltou a acompanhar esta conversa." : "A assistente virtual saiu da conversa.");
    },
    /** Cobrança PIX no chat (valor informado pela equipe) */
    async enviarPix(pedidoId, valor, descricao, codigo) {
      if (ONLINE) { const sb = await supabase(); return rodar(sb.rpc("enviar_pix", { p_pedido: pedidoId, p_valor: valor, p_descricao: descricao || null, p_codigo: codigo })); }
      const todos = ler(K.pedidos, []), p = todos.find((x) => x.id === pedidoId);
      if (!p) throw new Error("Pedido não encontrado.");
      const m = ler(K.equipe, []).find((x) => x.email === (usuarioAtual || {}).email);
      const msg = demoMensagem(pedidoId, "equipe", "Pagamento via PIX: " + valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + (descricao ? " — " + descricao : ""),
        { nome: (m && m.nome) || "Equipe Milena Garbim", pix: { valor, descricao: descricao || null, codigo, status: "pendente" } });
      p.ia_ativa = false; gravar(K.pedidos, ler(K.pedidos, []).map((x) => (x.id === pedidoId ? Object.assign(x, { ia_ativa: false }) : x)));
      return msg;
    },
    async marcarPix(mensagemId, status) {
      if (ONLINE) { const sb = await supabase(); await rodar(sb.rpc("marcar_pix", { p_mensagem: mensagemId, p_status: status })); return; }
      const lista = ler(K.mensagens, []), m = lista.find((x) => x.id === mensagemId);
      if (!m || !m.pix) throw new Error("Cobrança não encontrada.");
      m.pix = Object.assign({}, m.pix, { status, atualizado_em: new Date().toISOString() }); gravar(K.mensagens, lista);
    },
    /** Endereço para mostrar a foto do chat (no banco: link temporário e protegido) */
    async urlFoto(anexo) {
      if (!anexo) return "";
      if (!ONLINE || /^data:/.test(anexo)) return anexo;
      if (cacheFotos[anexo] && cacheFotos[anexo].ate > Date.now()) return cacheFotos[anexo].url;
      const sb = await supabase();
      const { data, error } = await sb.storage.from("chat").createSignedUrl(anexo, 3600);
      if (error) throw traduzirErro(error);
      cacheFotos[anexo] = { url: data.signedUrl, ate: Date.now() + 3000 * 1000 };
      return data.signedUrl;
    },
    async marcarLidas(pedidoId, como) {
      if (ONLINE) { const sb = await supabase(); await sb.rpc("marcar_lidas", { p_pedido: pedidoId, p_como: como }); return; }
      const lista = ler(K.mensagens, []);
      let mudou = false;
      lista.forEach((m) => { if (m.pedido_id === pedidoId && m.autor !== como && !m.lida_em) { m.lida_em = new Date().toISOString(); mudou = true; } });
      if (mudou) gravar(K.mensagens, lista);
    },
    /** Não lidas por pedido, do ponto de vista de quem lê: { pedidoId: n } */
    async naoLidas(como) {
      let lista;
      if (ONLINE) {
        const sb = await supabase();
        // equipe: só o que o cliente escreveu conta como "nova"; cliente: tudo o que não é dele
        let q = sb.from("mensagens").select("pedido_id").is("lida_em", null);
        q = como === "equipe" ? q.eq("autor", "cliente") : q.neq("autor", "cliente").neq("autor", "sistema");
        lista = (await rodar(q.limit(1000))) || [];
      } else {
        const meus = como === "cliente" ? new Set(ler(K.pedidos, []).filter((p) => p.cliente_id === (usuarioAtual || {}).email).map((p) => p.id)) : null;
        lista = ler(K.mensagens, []).filter((m) => !m.lida_em && m.autor !== como && m.autor !== "sistema" && (como === "cliente" || m.autor === "cliente") && (!meus || meus.has(m.pedido_id)));
      }
      const r = {};
      lista.forEach((m) => { r[m.pedido_id] = (r[m.pedido_id] || 0) + 1; });
      return r;
    },
    /** Últimas mensagens de todos os pedidos (painel: lista de conversas) */
    async recentes() {
      if (!ONLINE) return ler(K.mensagens, []).slice(-1000);
      const sb = await supabase();
      return (await rodar(sb.from("mensagens").select("*").order("criado_em", { ascending: false }).limit(1000))) || [];
    },
    /** Avisa quando chegar mensagem nova (tempo real + consulta de segurança). Devolve a função para parar. */
    ouvir(pedidoId, aoChegar) {
      let parado = false, canal = null;
      const tique = setInterval(() => { if (!parado) aoChegar(); }, ONLINE ? 15000 : 3000);
      const aoGuardar = (e) => { if (e.key === K.mensagens) aoChegar(); };
      if (!ONLINE) window.addEventListener("storage", aoGuardar);
      else supabase().then((sb) => {
        if (parado) return;
        const filtro = pedidoId ? { event: "*", schema: "public", table: "mensagens", filter: "pedido_id=eq." + pedidoId } : { event: "*", schema: "public", table: "mensagens" };
        canal = sb.channel("chat-" + (pedidoId || "todos") + "-" + Date.now()).on("postgres_changes", filtro, () => aoChegar()).subscribe();
      }).catch(() => {});
      return () => {
        parado = true; clearInterval(tique);
        window.removeEventListener("storage", aoGuardar);
        if (canal) supabase().then((sb) => sb.removeChannel(canal)).catch(() => {});
      };
    }
  };

  function demoMensagem(pedidoId, autor, texto, extra) {
    const msg = Object.assign({ id: "m" + Date.now() + Math.random().toString(36).slice(2, 6), pedido_id: pedidoId, autor, nome: autor === "ia" ? "Assistente da Milena" : null, texto, anexo: null, criado_em: new Date().toISOString(), lida_em: null }, extra || {});
    try { const lista = ler(K.mensagens, []); lista.push(msg); gravar(K.mensagens, lista); } catch (e) { /* sem espaço */ }
    return msg;
  }

  /* =========================================================
     Notificações no celular/computador da equipe (Web Push)
     ========================================================= */
  const Push = {
    suportado: () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    async registro() { return navigator.serviceWorker.register("sw.js"); },
    async inscricaoAtual() {
      if (!Push.suportado()) return null;
      const reg = await navigator.serviceWorker.getRegistration();
      return reg ? reg.pushManager.getSubscription() : null;
    },
    /** paraCliente: true = avisos do cliente (respostas e situação do pedido); false = equipe */
    async ativar(paraCliente) {
      if (!Push.suportado()) throw new Error("Este navegador não recebe notificações. No iPhone: abra o site no Safari, toque em Compartilhar → “Adicionar à Tela de Início” e ative por lá.");
      if (!CFG.pushChavePublica) throw new Error("Notificações ainda não configuradas.");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("As notificações foram bloqueadas. Libere nas configurações do navegador para este site.");
      const reg = await Push.registro();
      await navigator.serviceWorker.ready;
      const chave = Uint8Array.from(atob(CFG.pushChavePublica.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((CFG.pushChavePublica.length + 3) % 4)), (c) => c.charCodeAt(0));
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave }));
      await Push.gravar(sub, paraCliente);
      return sub;
    },
    async gravar(sub, paraCliente) {
      if (!ONLINE || !sub || !usuarioAtual) return;
      const sb = await supabase();
      const json = sub.toJSON();
      await rodar(sb.from("push_inscricoes").upsert({ endpoint: json.endpoint, email: (usuarioAtual.email || "").toLowerCase(), inscricao: json, aparelho: navigator.userAgent.slice(0, 120), cliente_id: paraCliente ? usuarioAtual.id : null }));
    },
    /** Já tem permissão e inscrição no navegador: garante que está gravada no banco. Devolve true se está ativa. */
    async sincronizar(paraCliente) {
      if (!Push.suportado() || Notification.permission !== "granted") return false;
      const sub = await Push.inscricaoAtual();
      if (!sub) return false;
      try { await Push.gravar(sub, paraCliente); return true; } catch (e) { return false; }
    },
    async desativar() {
      const sub = await Push.inscricaoAtual();
      if (!sub) return;
      if (ONLINE) { const sb = await supabase(); await sb.from("push_inscricoes").delete().eq("endpoint", sub.endpoint); }
      await sub.unsubscribe();
    }
  };

  /* =========================================================
     Conta do cliente
     ========================================================= */
  let usuarioAtual = null, perfilAtual = null;
  const ouvintes = [];
  const avisarOuvintes = () => ouvintes.forEach((fn) => { try { fn(usuarioAtual, perfilAtual); } catch (e) { console.error(e); } });

  function numeroPedido() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return "MG-" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + String(Math.floor(1000 + Math.random() * 9000));
  }
  function precoItem(s) { return typeof s.preco === "number" && s.preco > 0 ? s.preco : null; }

  const Conta = {
    get usuario() { return usuarioAtual; },
    get perfil() { return perfilAtual; },
    aoMudar(fn) { ouvintes.push(fn); },

    perfilCompleto(p) {
      p = p || perfilAtual;
      if (!p || !p.tipo || !p.telefone || !p.cidade || !p.uf) return false;
      return p.tipo === "pj" ? !!(p.razao_social && p.cnpj && p.responsavel) : !!(p.nome && p.cpf);
    },
    nomeExibicao(p) {
      p = p || perfilAtual;
      if (!p || !(p.nome || p.responsavel)) return usuarioAtual ? usuarioAtual.email.split("@")[0] : "";
      return String(p.tipo === "pj" ? p.responsavel : p.nome).split(" ")[0];
    },

    async enviarCodigo(email, criar) {
      email = normalizarEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
      if (ONLINE) {
        const sb = await supabase();
        let jaTinhaConta = false;
        if (criar) { const r = await sb.rpc("email_ja_cadastrado", { e: email }); jaTinhaConta = !r.error && r.data === true; }
        const voltarPara = location.origin + "/conta";
        const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: voltarPara } });
        if (error) throw traduzirErro(error);
        return { jaTinhaConta };
      }
      const perfis = ler(K.perfis, {});
      const jaTinhaConta = !!(criar && perfis[email] && perfis[email].tipo);
      const codigo = String(Math.floor(10000000 + Math.random() * 90000000)).slice(0, CFG.tamanhoCodigo || 8);
      gravar(K.codigo, { email, codigo, expira: Date.now() + 10 * 60 * 1000, tentativas: 0 });
      return { codigoDemo: codigo, jaTinhaConta };
    },

    async verificarCodigo(email, codigo) {
      email = normalizarEmail(email);
      codigo = so(codigo);
      if (codigo.length < 6) throw new Error("Digite o código recebido por e-mail.");
      if (ONLINE) {
        const sb = await supabase();
        const { data, error } = await sb.auth.verifyOtp({ email, token: codigo, type: "email" });
        if (error) throw traduzirErro(error);
        usuarioAtual = { id: data.user.id, email: data.user.email };
      } else {
        const salvo = ler(K.codigo, null);
        if (!salvo || salvo.email !== email || Date.now() > salvo.expira) throw new Error("Código expirado. Peça um novo código.");
        if (salvo.tentativas >= 5) throw new Error("Muitas tentativas. Peça um novo código.");
        if (salvo.codigo !== codigo) { salvo.tentativas++; gravar(K.codigo, salvo); throw new Error("Código incorreto. Confira e tente novamente."); }
        localStorage.removeItem(K.codigo);
        const perfis = ler(K.perfis, {});
        if (!perfis[email]) { perfis[email] = { email, criado_em: new Date().toISOString() }; gravar(K.perfis, perfis); }
        gravar(K.sessao, { email });
        usuarioAtual = { id: email, email };
      }
      await this.carregarPerfil();
      avisarOuvintes();
      return usuarioAtual;
    },

    async iniciar() {
      try {
        if (ONLINE) {
          const sb = await supabase();
          const u = ((await sb.auth.getSession()).data.session || {}).user;
          usuarioAtual = u ? { id: u.id, email: u.email } : null;
        } else {
          const s = ler(K.sessao, null);
          usuarioAtual = s ? { id: s.email, email: s.email } : null;
        }
        if (usuarioAtual) await this.carregarPerfil();
      } catch (e) { console.warn("Conta:", e.message); usuarioAtual = null; }
      avisarOuvintes();
      return usuarioAtual;
    },

    async sair() {
      if (ONLINE) { const sb = await supabase(); await sb.auth.signOut(); }
      else localStorage.removeItem(K.sessao);
      usuarioAtual = null; perfilAtual = null;
      avisarOuvintes();
    },

    async carregarPerfil() {
      if (!usuarioAtual) return null;
      if (ONLINE) {
        const sb = await supabase();
        perfilAtual = (await rodar(sb.from("clientes").select("*").eq("id", usuarioAtual.id).maybeSingle())) || { email: usuarioAtual.email };
      } else perfilAtual = ler(K.perfis, {})[usuarioAtual.email] || { email: usuarioAtual.email };
      return perfilAtual;
    },

    async salvarPerfil(dados) {
      if (!usuarioAtual) throw new Error("Entre na sua conta para salvar os dados.");
      const registro = Object.assign({}, dados, { email: usuarioAtual.email });
      if (ONLINE) {
        const sb = await supabase();
        perfilAtual = await rodar(sb.from("clientes").upsert(Object.assign(registro, { id: usuarioAtual.id })).select().single());
      } else {
        const perfis = ler(K.perfis, {});
        for (const [email, p] of Object.entries(perfis)) {
          if (email === usuarioAtual.email) continue;
          if (registro.cpf && so(p.cpf) === so(registro.cpf)) throw new Error(DUPLICADO.cpf);
          if (registro.cnpj && so(p.cnpj) === so(registro.cnpj)) throw new Error(DUPLICADO.cnpj);
        }
        perfis[usuarioAtual.email] = Object.assign({}, perfis[usuarioAtual.email], registro, { atualizado_em: new Date().toISOString() });
        gravar(K.perfis, perfis);
        perfilAtual = perfis[usuarioAtual.email];
      }
      avisarOuvintes();
      return perfilAtual;
    },

    /** Registra a solicitação. itens: [id do serviço]. O preço vem do catálogo (no banco, conferido pelo servidor). */
    async criarPedido(ids, observacoes) {
      if (!usuarioAtual) throw new Error("Entre na sua conta para enviar a solicitação.");
      if (!ids.length) throw new Error("Sua solicitação está vazia.");
      if (ONLINE) {
        const sb = await supabase();
        const r = await rodar(sb.rpc("criar_pedido", { p_itens: ids, p_obs: observacoes || null }));
        const x = (Array.isArray(r) ? r[0] : r) || {};
        return { id: x.pedido_id, numero: x.numero_pedido, total: +x.valor || 0 };
      }
      if (!this.perfilCompleto()) throw new Error("Complete seu cadastro antes de enviar a solicitação.");
      const { servicos, categorias } = await catalogo(true);
      const itens = ids.map((id) => {
        const s = servicos.find((x) => x.id === id);
        if (!s) throw new Error("Um dos serviços escolhidos não está mais disponível. Atualize a página.");
        const c = categorias.find((x) => x.id === s.categoria) || {};
        return { id: s.id, nome: s.nome, categoria: c.nome || "", preco: precoItem(s), a_partir: !!s.aPartir };
      });
      const agora = new Date().toISOString();
      const pedido = {
        id: "p" + Date.now(), numero: numeroPedido(), cliente_id: usuarioAtual.email, cliente: copia(perfilAtual),
        itens, observacoes: observacoes || null, total: itens.reduce((t, i) => t + (i.preco || 0), 0),
        status: "recebido", andamento: [{ data: agora, autor: "sistema", status: "recebido", texto: "Solicitação recebida pelo site." }],
        criado_em: agora, atualizado_em: agora
      };
      pedido.ia_ativa = true;
      const todos = ler(K.pedidos, []);
      todos.unshift(pedido);
      gravar(K.pedidos, todos);
      // demonstração: boas-vindas automáticas da assistente no chat do pedido
      demoMensagem(pedido.id, "ia", "Olá! Recebemos o seu pedido " + pedido.numero + ". 💕 A Milena já foi avisada e vai responder por aqui. Enquanto isso, conte um pouco: o que aparece hoje no seu nome (SPC, Serasa, Boa Vista, protesto ou Bacen)?");
      return { id: pedido.id, numero: pedido.numero, total: pedido.total };
    },

    /** Cliente cancela o próprio pedido (motivo obrigatório) */
    async cancelarPedido(id, motivo) {
      motivo = String(motivo || "").trim();
      if (motivo.length < 10) throw new Error("Explique o motivo do cancelamento (pelo menos 10 letras).");
      if (ONLINE) { const sb = await supabase(); await rodar(sb.rpc("cancelar_pedido", { p_id: id, p_motivo: motivo })); return; }
      const todos = ler(K.pedidos, []), p = todos.find((x) => x.id === id && x.cliente_id === (usuarioAtual || {}).email);
      if (!p) throw new Error("Pedido não encontrado.");
      if (["em_andamento", "concluido", "cancelado"].includes(p.status)) throw new Error("Este pedido não pode mais ser cancelado por aqui. Fale com a Milena pelo chat.");
      p.status = "cancelado"; p.ia_ativa = false; p.atualizado_em = new Date().toISOString();
      p.andamento.push({ data: p.atualizado_em, autor: "cliente", status: "cancelado", texto: "Cancelado pelo cliente. Motivo: " + motivo });
      gravar(K.pedidos, todos);
      demoMensagem(id, "sistema", "Pedido cancelado pelo cliente. Motivo: " + motivo);
    },

    async listarPedidos() {
      if (!usuarioAtual) return [];
      if (ONLINE) {
        const sb = await supabase();
        return (await rodar(sb.from("pedidos").select("*").eq("cliente_id", usuarioAtual.id).order("criado_em", { ascending: false }).limit(50))) || [];
      }
      return ler(K.pedidos, []).filter((p) => p.cliente_id === usuarioAtual.email);
    }
  };

  /* =========================================================
     Painel (equipe)
     ========================================================= */
  const slug = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

  /** Reduz a foto no navegador antes de enviar (máx. 1400px, JPEG) */
  function reduzirFoto(arquivo, max = 1400) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(arquivo.type)) return reject(new Error("Escolha um arquivo de imagem (JPG, PNG ou WEBP)."));
      const img = new Image(), url = URL.createObjectURL(arquivo);
      img.onload = () => {
        const esc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível ler a imagem."))), "image/jpeg", 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler a imagem.")); };
      img.src = url;
    });
  }
  const blobParaDataUrl = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

  const Painel = {
    /** "admin", "atendente" ou null */
    async meuPapel() {
      if (!usuarioAtual) return null;
      if (!ONLINE) {
        const eq = ler(K.equipe, null);
        if (!eq || !eq.length) { gravar(K.equipe, [{ email: usuarioAtual.email, papel: "admin", nome: CFG.proprietaria || null }]); return "admin"; }   // demonstração: o primeiro a entrar vira administrador
        const m = eq.find((x) => x.email === usuarioAtual.email);
        return m ? m.papel : null;
      }
      const sb = await supabase();
      const { data, error } = await sb.rpc("meu_papel");
      return error ? null : data || null;
    },

    /* ---- Dupla verificação (app autenticador) ---- */
    /** { precisa: false } quando a sessão já está confirmada (ou no modo demonstração) */
    async mfaSituacao() {
      if (!ONLINE) return { precisa: false };
      const sb = await supabase();
      const [{ data: nivel, error: e1 }, { data: fatores, error: e2 }] = await Promise.all([sb.auth.mfa.getAuthenticatorAssuranceLevel(), sb.auth.mfa.listFactors()]);
      if (e1 || e2) throw traduzirErro(e1 || e2);
      const verificados = ((fatores && fatores.totp) || []).filter((f) => f.status === "verified");
      return { precisa: nivel.currentLevel !== "aal2", cadastrado: verificados.length > 0, fatorId: verificados[0] && verificados[0].id };
    },
    /** Novo cadastro no app: devolve { fatorId, qr (imagem), segredo } */
    async mfaCadastrar() {
      const sb = await supabase();
      const { data: fatores } = await sb.auth.mfa.listFactors();
      for (const f of ((fatores && fatores.all) || []).filter((x) => x.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", issuer: "Milena Garbim", friendlyName: "Painel " + new Date().toISOString().slice(0, 16) });
      if (error) throw traduzirErro(error);
      return { fatorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
    },
    async mfaConfirmar(fatorId, codigo) {
      const sb = await supabase();
      let error = null;
      // a internet do celular às vezes troca de endereço entre o pedido e a confirmação: tenta de novo sozinho
      for (let i = 0; i < 3; i++) { ({ error } = await sb.auth.mfa.challengeAndVerify({ factorId: fatorId, code: String(codigo).replace(/\D/g, "") })); if (!error || !/IP address/i.test(error.message)) break; }
      if (error && /IP address/i.test(error.message)) throw new Error("Sua internet mudou de endereço no meio da confirmação. Tente de novo (de preferência no Wi-Fi).");
      if (error) throw new Error(/invalid|expired/i.test(error.message) ? "Código incorreto ou vencido. Confira o app e digite o código atual." : error.message);
    },
    async resetar2fa(email) {
      const sb = await supabase();
      await rodar(sb.rpc("resetar_2fa", { p_email: email }));
    },

    /* ---- Pedidos ---- */
    async pedidos() {
      if (!ONLINE) return ler(K.pedidos, []);
      const sb = await supabase();
      return (await rodar(sb.from("pedidos").select("*").order("criado_em", { ascending: false }).limit(500))) || [];
    },
    async atualizarPedido(id, status, texto) {
      if (status && !STATUS[status]) throw new Error("Situação inválida.");
      texto = String(texto || "").trim().slice(0, 1000);
      if (ONLINE) { const sb = await supabase(); return rodar(sb.rpc("atualizar_pedido", { p_id: id, p_status: status || null, p_texto: texto || null })); }
      const todos = ler(K.pedidos, []), p = todos.find((x) => x.id === id);
      if (!p) throw new Error("Pedido não encontrado.");
      const mudou = status && status !== p.status;
      if (!mudou && !texto) throw new Error("Escolha uma nova situação ou escreva uma mensagem.");
      if (mudou) p.status = status;
      if (mudou && CONFIRMADOS.includes(status) && !p.confirmado_em) p.confirmado_em = new Date().toISOString();
      const eu = ler(K.equipe, []).find((x) => x.email === usuarioAtual.email);
      p.andamento.push({ data: new Date().toISOString(), autor: "equipe", nome: (eu && eu.nome) || "Equipe Milena Garbim", status: mudou ? status : undefined, texto: texto || undefined });
      p.atualizado_em = new Date().toISOString();
      gravar(K.pedidos, todos);
    },
    async excluirPedido(id) {
      if (ONLINE) { const sb = await supabase(); return rodar(sb.from("pedidos").delete().eq("id", id)); }
      gravar(K.pedidos, ler(K.pedidos, []).filter((p) => p.id !== id));
    },

    /* ---- Clientes ---- */
    async clientes() {
      if (!ONLINE) return Object.values(ler(K.perfis, {}));
      const sb = await supabase();
      return (await rodar(sb.from("clientes").select("*").order("criado_em", { ascending: false }).limit(2000))) || [];
    },

    /* ---- Catálogo ---- */
    catalogo: () => catalogo(false),
    async salvarCategoria(c) {
      c = Object.assign({}, c);
      c.nome = String(c.nome || "").trim();
      if (!c.nome) throw new Error("Dê um nome à categoria.");
      c.id = c.id || slug(c.nome) || "cat-" + Date.now();
      const { id, ordem = 0, ativo = true, ...dados } = c;
      if (ONLINE) { const sb = await supabase(); await rodar(sb.from("categorias").upsert({ id, ordem: +ordem || 0, ativo: !!ativo, dados })); return id; }
      const { categorias } = catalogoDemo();
      const i = categorias.findIndex((x) => x.id === id);
      const reg = Object.assign({ id, ordem: +ordem || 0, ativo: !!ativo }, dados);
      i >= 0 ? (categorias[i] = reg) : categorias.push(reg);
      gravar(K.categorias, categorias);
      return id;
    },
    async excluirCategoria(id) {
      const { servicos } = await catalogo(false);
      if (servicos.some((s) => s.categoria === id)) throw new Error("Mova ou exclua os serviços desta categoria antes de excluí-la.");
      if (ONLINE) { const sb = await supabase(); return rodar(sb.from("categorias").delete().eq("id", id)); }
      gravar(K.categorias, catalogoDemo().categorias.filter((c) => c.id !== id));
    },
    async salvarServico(s) {
      s = Object.assign({}, s);
      s.nome = String(s.nome || "").trim();
      if (!s.nome) throw new Error("Dê um nome ao serviço.");
      if (!s.categoria) throw new Error("Escolha a categoria do serviço.");
      if (s.preco !== null && s.preco !== undefined && s.preco !== "" && !(+s.preco >= 0)) throw new Error("Preço inválido.");
      s.preco = s.preco === "" || s.preco === null || s.preco === undefined ? null : Math.round(+s.preco * 100) / 100;
      s.id = s.id || (slug(s.nome) + "-" + Date.now().toString(36).slice(-4));
      const { id, categoria, ordem = 0, ativo = true, ...dados } = s;
      if (ONLINE) { const sb = await supabase(); await rodar(sb.from("servicos").upsert({ id, categoria, ordem: +ordem || 0, ativo: !!ativo, dados })); return id; }
      const { servicos } = catalogoDemo();
      const i = servicos.findIndex((x) => x.id === id);
      const reg = Object.assign({ id, categoria, ordem: +ordem || 0, ativo: !!ativo }, dados);
      i >= 0 ? (servicos[i] = reg) : servicos.push(reg);
      gravar(K.servicos, servicos);
      return id;
    },
    async excluirServico(id) {
      if (ONLINE) { const sb = await supabase(); return rodar(sb.from("servicos").delete().eq("id", id)); }
      gravar(K.servicos, catalogoDemo().servicos.filter((s) => s.id !== id));
    },
    async restaurarCatalogoPadrao() {
      if (ONLINE) throw new Error("No modo real, use o setup.sql para recriar o catálogo inicial.");
      localStorage.removeItem(K.categorias); localStorage.removeItem(K.servicos);
    },

    /* ---- Site (textos, fotos, dúvidas, contatos) ---- */
    async lerSite() {
      if (!ONLINE) return ler(K.site, {});
      const sb = await supabase();
      const d = await rodar(sb.from("configuracoes").select("dados").eq("id", 1).maybeSingle());
      return (d && d.dados) || {};
    },
    /** parte: "textos" | "fotos" | "faq" | "contatos" | "direitos" | "aparencia" | "depoimentos" */
    async salvarSite(parte, valor) {
      const atual = await this.lerSite();
      atual[parte] = valor;
      if (ONLINE) { const sb = await supabase(); await rodar(sb.from("configuracoes").upsert({ id: 1, dados: atual })); }
      else gravar(K.site, atual);
      sitePromise = null;
      return atual;
    },
    /** Envia uma foto e devolve o endereço dela */
    async enviarFoto(arquivo, pasta = "fotos") {
      const blob = await reduzirFoto(arquivo);
      if (!ONLINE) {
        if (blob.size > 900 * 1024) return blobParaDataUrl(await reduzirFoto(arquivo, 900));
        return blobParaDataUrl(blob);
      }
      const sb = await supabase();
      const caminho = `${pasta}/${Date.now()}-${slug(arquivo.name.replace(/\.[^.]+$/, "")) || "foto"}.jpg`;
      await rodar(sb.storage.from("site").upload(caminho, blob, { contentType: "image/jpeg", upsert: false }));
      return sb.storage.from("site").getPublicUrl(caminho).data.publicUrl;
    },

    /* ---- Equipe ---- */
    async equipe() {
      if (!ONLINE) return ler(K.equipe, []);
      const sb = await supabase();
      return (await rodar(sb.from("equipe").select("*").order("criado_em"))) || [];
    },
    async salvarMembro(email, papel, nome) {
      email = normalizarEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
      if (!["admin", "atendente"].includes(papel)) throw new Error("Cargo inválido.");
      if (email === (usuarioAtual || {}).email) throw new Error("Você não pode mudar o próprio cargo.");
      nome = String(nome || "").trim().slice(0, 60) || null;
      if (ONLINE) { const sb = await supabase(); return rodar(sb.from("equipe").upsert({ email, papel, nome })); }
      const eq = ler(K.equipe, []), antigo = eq.find((m) => m.email === email) || {};
      const resto = eq.filter((m) => m.email !== email);
      resto.push({ email, papel, nome, criado_em: antigo.criado_em || new Date().toISOString() });
      gravar(K.equipe, resto);
    },
    async removerMembro(email) {
      if (email === (usuarioAtual || {}).email) throw new Error("Você não pode remover a si mesmo.");
      if (ONLINE) { const sb = await supabase(); return rodar(sb.from("equipe").delete().eq("email", email)); }
      gravar(K.equipe, ler(K.equipe, []).filter((m) => m.email !== email));
    }
  };

  window.Dados = { online: ONLINE, STATUS, CONFIRMADOS, site, catalogo, Conta, Painel, Chat, Push, slug };
  window.ContaPronta = Conta.iniciar();
})();
