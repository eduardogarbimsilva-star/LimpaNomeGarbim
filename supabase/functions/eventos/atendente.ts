// =========================================================
// Assistente própria (sem custo, sem chave de IA paga)
// Entende o que o cliente escreve por palavras-chave e contexto da conversa,
// indica os serviços do catálogo que combinam com o caso, tira dúvidas comuns
// e organiza um resumo para a Milena. Nunca promete resultado nem preço.
// =========================================================

export type Servico = { id: string; nome: string; resumo: string; categoria: string; perfis?: string[] };
type Msg = { autor: string; texto?: string; pix?: unknown; criado_em: string };

const normal = (t: string) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tem = (t: string, rx: RegExp) => rx.test(t);
const escolher = <T>(lista: T[], semente: number) => lista[Math.abs(semente) % lista.length];

// Situações que a assistente reconhece -> serviços (ids e categorias do catálogo) + explicação curta
const SITUACOES: { chave: string; rx: RegExp; servicos: string[]; categorias: string[]; fala: string }[] = [
  { chave: "indevida", rx: /(nao reconhec|nao fiz|nunca fiz|nao e minha|nao e meu|fraude|golpe|clonad|ja paguei|ja quitei|quitei|paguei e continua|prescrit|caducou|mais de 5 anos|sem aviso|nao fui avisad|nao recebi aviso)/,
    servicos: ["negativacao-indevida"], categorias: ["negativacao-indevida"], fala: "isso pode ser uma negativação indevida — nesses casos é possível pedir a exclusão e, muitas vezes, até indenização" },
  { chave: "bacen", rx: /(bacen|banco central|registrato|scr\b|prejuizo|sistema de informac)/,
    servicos: ["bacen-administrativo", "bacen-judicial"], categorias: ["bacen"], fala: "apontamentos no Bacen (Registrato/SCR) pesam muito na análise dos bancos, mesmo com o nome limpo no Serasa" },
  { chave: "protesto", rx: /(protest|cartorio|cenprot)/,
    servicos: ["limpa-nome", "empresas-cnpj"], categorias: ["limpa-nome", "empresas"], fala: "protesto em cartório (Cenprot) também restringe crédito e precisa ser tratado" },
  { chave: "juros", rx: /(juros|financiament|parcela|consignad|emprestimo|contrato|cheque especial|cartao de credito|fatura|abusiv|taxa alta)/,
    servicos: ["revisao-juros", "pericia-credito"], categorias: ["juros-abusivos", "pericia"], fala: "dá para analisar o contrato e verificar se há juros ou tarifas acima do permitido" },
  { chave: "credito", rx: /(score|credito negad|nega(m|ndo)? (o )?credito|negaram|nao aprova|nao consigo credito|nao libera|limite|rating|banco (nao|recusa|nega)|recusad|reprovad|cadastro positivo)/,
    servicos: ["rating-bancario", "score-credito"], categorias: ["rating", "score"], fala: "quando o crédito não sai mesmo com o nome limpo, normalmente o problema está no rating bancário ou no score" },
  { chave: "empresa", rx: /(cnpj|empresa|mei\b|loja|comercio|fornecedor|licitac|pessoa juridica)/,
    servicos: ["empresas-cnpj", "rating-bancario"], categorias: ["empresas", "rating"], fala: "para empresas, tratamos restrições e protestos no CNPJ e o relacionamento com os bancos" },
  { chave: "negativado", rx: /(serasa|spc|boa vista|negativad|nome sujo|restric|nome no|inadimpl|divida|devendo|cobranc)/,
    servicos: ["limpa-nome"], categorias: ["limpa-nome"], fala: "para retirar o nome do SPC, Serasa, Boa Vista e Cenprot, trabalhamos com medida judicial de urgência" },
];

const PERGUNTAS: { chave: string; rx: RegExp; pergunta: string }[] = [
  { chave: "onde", rx: /(serasa|spc|boa vista|protest|cartorio|cenprot|bacen|registrato|scr\b)/, pergunta: "O que aparece hoje no seu nome: SPC, Serasa, Boa Vista, protesto em cartório ou apontamento no Bacen?" },
  { chave: "quando", rx: /(\d+ ?(anos?|mes(es)?|dias?)|desde|20\d\d|19\d\d|ano passado|esse ano|recente|faz tempo|antig)/, pergunta: "Há quanto tempo essa dívida existe, mais ou menos?" },
  { chave: "reconhece", rx: /(reconhec|nao fiz|minha divida|e minha|e meu|fiz sim|devo|fraude|golpe|ja paguei|quitei)/, pergunta: "Você reconhece essa dívida, ou ela pode ser indevida (não fez, já pagou ou não foi avisado antes)?" },
  { chave: "valor", rx: /(r\$|reais|mil\b|\d{3,}|valor)/, pergunta: "Qual é o valor aproximado das dívidas, somando tudo?" },
];

function catalogoIndicado(texto: string, servicos: Servico[]) {
  const achados: { fala: string; nomes: string[] }[] = [];
  const usados = new Set<string>();
  for (const s of SITUACOES) {
    if (!tem(texto, s.rx)) continue;
    const lista = servicos.filter((x) => (s.servicos.includes(x.id) || s.categorias.includes(x.categoria)) && !usados.has(x.id));
    lista.forEach((x) => usados.add(x.id));
    achados.push({ fala: s.fala, nomes: lista.slice(0, 2).map((x) => x.nome) });
    if (achados.length >= 2) break;
  }
  return achados;
}

/** Resposta da assistente própria para a última mensagem do cliente */
export function responderSemIA(pedido: any, historico: Msg[], servicos: Servico[], horario: string): string | null {
  const doCliente = historico.filter((m) => m.autor === "cliente" && m.texto);
  if (!doCliente.length) return null;
  // mensagens do cliente desde a última fala da assistente/equipe
  let i = historico.length - 1; const novas: string[] = [];
  while (i >= 0 && historico[i].autor === "cliente") { if (historico[i].texto) novas.unshift(historico[i].texto!); i--; }
  const agora = normal(novas.join(" \n "));
  const tudo = normal(doCliente.map((m) => m.texto).join(" \n ") + " " + (pedido.observacoes ?? ""));
  const semente = doCliente.length;
  const falasIa = historico.filter((m) => m.autor === "ia").map((m) => m.texto ?? "");
  const jaDisse = (t: string) => falasIa.some((f) => f.includes(t));
  const nome = String((pedido.cliente?.tipo === "pj" ? pedido.cliente?.responsavel : pedido.cliente?.nome) || "").trim().split(/\s+/)[0] || "";
  const partes: string[] = [];

  // 1) pedidos diretos
  if (tem(agora, /(falar com (a )?(milena|alguem|uma pessoa|atendente|humano)|atendente|humano|pessoa de verdade|ligar|me liga|telefone|whats)/)) {
    return `Claro${nome ? ", " + nome : ""}! A Milena já foi avisada e vai responder pessoalmente por aqui o quanto antes (atendimento: ${horario}). Se for urgente, pode chamar também no WhatsApp (16) 98838-1117.`;
  }
  if (tem(agora, /(quanto custa|qual o valor|qual valor|preco|valor do servico|quanto fica|quanto e|cobram|honorario|taxa)/) && !tem(agora, /(valor da divida|valor das dividas)/)) {
    partes.push("O valor depende de cada caso: a Milena analisa a sua situação e envia uma proposta por escrito, com tudo explicado, antes de qualquer pagamento.");
  }
  if (tem(agora, /(pix|boleto|pagar|pagamento|cartao de credito para pagar|parcelar o servico)/) && !tem(agora, /(ja paguei|paguei a divida)/)) {
    partes.push("O pagamento é enviado pela própria Milena aqui no chat (QR Code PIX), só depois que você aprovar a proposta. Nunca pague para outra pessoa ou outro número.");
  }
  if (tem(agora, /(quanto tempo|demora|prazo|quando sai|quando limpa|rapido|urgente)/)) {
    partes.push("O prazo varia conforme o caso; a medida judicial de urgência costuma ser o caminho mais rápido. A Milena informa a previsão na proposta. Depois de uma dívida paga, o credor tem até 5 dias úteis para tirar o nome.");
  }
  if (tem(agora, /(documento|rg|cnh|comprovante|print|foto do|contrato em maos|o que preciso)/)) {
    partes.push("Pode ir separando: documento com foto (RG ou CNH), contratos ou boletos das dívidas e comprovantes do que já foi pago. A Milena vai dizer exatamente o que enviar — por segurança, nunca mande senhas.");
  }
  if (tem(agora, /(e seguro|confiavel|golpe\?|e verdade|funciona mesmo|garant)/)) {
    partes.push("Aqui tudo é combinado por escrito, e a Milena acompanha cada caso pessoalmente. Não prometemos resultado garantido — o que garantimos é análise honesta e transparência em cada etapa.");
  }

  // 2) situação do cliente -> serviços indicados
  const indicados = catalogoIndicado(agora || tudo, servicos);
  if (indicados.length && !partes.length) {
    const a = indicados[0];
    let frase = `Entendi${nome ? ", " + nome : ""}. Pelo que você contou, ${a.fala}.`;
    const nomes = [...new Set(indicados.flatMap((x) => x.nomes))];
    if (nomes.length) {
      const nosPedidos = (pedido.itens ?? []).map((x: any) => x.nome);
      const novos = nomes.filter((n) => !nosPedidos.includes(n));
      frase += novos.length
        ? ` Além do que você pediu, ${novos.length > 1 ? "os serviços" : "o serviço"} ${novos.map((n) => `“${n}”`).join(" e ")} também pode${novos.length > 1 ? "m" : ""} combinar com o seu caso — a Milena confirma na análise.`
        : ` O serviço ${nomes.map((n) => `“${n}”`).join(" e ")} que você escolheu é o caminho indicado; a Milena confirma na análise.`;
    }
    partes.push(frase);
  }

  // 3) agradecimentos e saudações
  if (!partes.length && tem(agora, /^(obrigad|valeu|brigad|ok\b|certo|beleza|blz|ta bom|entendi|perfeito)/)) {
    return escolher([
      "Por nada! 💕 A Milena vai continuar a conversa por aqui. Se lembrar de mais algum detalhe, é só escrever.",
      "Combinado! Qualquer novidade, me conte por aqui que eu repasso tudo para a Milena.",
    ], semente);
  }
  if (!partes.length && tem(agora, /^(oi|ola|bom dia|boa tarde|boa noite|opa|e ai)\b/) && agora.length < 25) {
    partes.push(`Oi${nome ? ", " + nome : ""}! 😊 Estou aqui para adiantar o seu atendimento enquanto a Milena não responde.`);
  }

  // 4) próxima pergunta (uma de cada vez, só o que ainda não foi respondido nem perguntado)
  const proxima = PERGUNTAS.find((q) => !tem(tudo, q.rx) && !jaDisse(q.pergunta));
  if (proxima) partes.push(proxima.pergunta);
  else if (!jaDisse("Resumo para a Milena")) {
    const temas = SITUACOES.filter((s) => tem(tudo, s.rx)).map((s) => s.chave);
    const rotulos: Record<string, string> = { indevida: "possível negativação indevida", bacen: "apontamento no Bacen", protesto: "protesto em cartório", juros: "juros/contrato", credito: "crédito negado/score", empresa: "empresa (CNPJ)", negativado: "nome negativado" };
    partes.push(`Obrigada pelas informações! Já organizei tudo para a Milena. Resumo para a Milena: ${temas.length ? temas.map((t) => rotulos[t]).join(", ") : "detalhes na conversa"}; serviços pedidos: ${(pedido.itens ?? []).map((x: any) => x.nome).join(", ") || "—"}. Ela responde por aqui em breve.`);
  }

  if (!partes.length && tem(agora, /(r\$|reais|\bmil\b|\d{3,})/)) partes.push("Anotado o valor, obrigada!");
  if (!partes.length) {
    partes.push(escolher([
      "Anotei aqui para a Milena! Se puder, conte um pouco mais sobre o seu caso — quanto mais detalhes, mais rápido ela consegue te orientar.",
      "Recebi! A Milena vai ler tudo com atenção e responder por aqui. Tem mais algum detalhe que ajude a entender a sua situação?",
    ], semente));
  }
  const resposta = partes.join(" ");
  // não repete exatamente a mesma resposta
  if (falasIa.length && falasIa[falasIa.length - 1] === resposta) return null;
  return resposta;
}

/** Boas-vindas da assistente própria, já citando o que foi pedido */
export function boasVindasSemIA(pedido: any): string {
  const nome = String((pedido.cliente?.tipo === "pj" ? pedido.cliente?.responsavel : pedido.cliente?.nome) || "").trim().split(/\s+/)[0] || "";
  const itens = (pedido.itens ?? []).map((x: any) => x.nome);
  return `Olá${nome ? ", " + nome : ""}! Recebemos o seu pedido ${pedido.numero}${itens.length ? ` (${itens.join(", ")})` : ""}. 💕 Sou a assistente da Milena e vou adiantar o seu atendimento enquanto ela analisa o caso. Para começar: o que aparece hoje no seu nome — SPC, Serasa, Boa Vista, protesto em cartório ou apontamento no Bacen?`;
}
