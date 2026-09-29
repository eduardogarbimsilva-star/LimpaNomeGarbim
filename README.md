# Milena Garbim · Limpa Nome — site, catálogo e painel

Site da **Limpa Nome Garbim**, assessoria de crédito de **Milena Garbim** (fundadora, proprietária e acionista).
HTML, CSS e JavaScript puro — sem build, sem servidor próprio — no mesmo padrão do site da Policoating
(repositório Color-Weg): páginas estáticas, banco de dados no **Supabase** e atendimento fechado pelo **WhatsApp**.

Identidade clara e suave (rosa, nude, champanhe e ameixa), com a marca **MILENA GARBIM** ao lado da foto dela e
a **assinatura** em letra cursiva. As cores ficam em variáveis no início de `assets/css/style.css`.

## Páginas

| Página | Conteúdo |
|---|---|
| `index.html` | Destaque com a foto da Milena, selos, “você se identifica?”, categorias de serviço, passos, seção da Milena, formulário de análise, dúvidas |
| `servicos.html` | **Catálogo**: filtro por categoria, cartões de serviço com preço, prazo, detalhes e botão **Solicitar** |
| `como-funciona.html` | Passo a passo, documentos para ter em mãos e direitos do consumidor |
| `sobre.html` | Milena Garbim, missão/visão/valores e compromissos |
| `duvidas.html` | Perguntas frequentes (editáveis no painel) e alerta contra golpes |
| `conta.html` | **Área do cliente**: entrar com código por e-mail, cadastro PF/PJ, solicitações com andamento e mensagens |
| `admin.html` | **Painel da empresa** (só para a equipe) |
| `privacidade.html` | Política de Privacidade (LGPD) |
| `404.html` | Página de “não encontrado” (usada automaticamente pelo GitHub Pages) |

## Catálogo: categorias e serviços

Cada **categoria** agrupa um ou mais **serviços**:

- **Limpa Nome** → um serviço só (aparece como uma opção).
- **Bacen** → dois métodos (**administrativo** e **judicial**), cada um é um serviço dentro da categoria.
- Negativação indevida, Revisão de juros, Score e crédito, Empresas (CNPJ).

Tudo é editável no painel: nome, descrição, ícone e ordem da categoria; nome, resumo, descrição completa, itens
inclusos, **preço** (vazio = “Sob consulta”, com opção “a partir de”), prazo, **foto**, destaque e visível/oculto
de cada serviço. Categoria sem serviço visível não aparece no site.

## Como funciona o pedido (solicitação)

1. O cliente toca em **Solicitar** nos serviços que quer; eles vão para **Minha solicitação** (ícone da sacola).
2. Ao **Enviar solicitação**, o site pede para **entrar** (código por e-mail, sem senha) e **completar o cadastro**
   (CPF ou CNPJ, telefone, cidade/UF; endereço opcional, com busca por CEP e por CNPJ).
3. A solicitação é **registrada no banco** (o preço é conferido pelo servidor) com um número `MG-AAMMDD-0000`, e o
   **WhatsApp da empresa abre** com o resumo, se o número estiver configurado.
4. A Milena vê o pedido em **Painel → Pedidos** e clica em **Confirmar pedido e abrir o chat**.
   Depois muda a situação (Em andamento → Concluído, Aguardando você, ou Cancelado) e escreve atualizações.
5. O cliente vê tudo em **Minha conta**: barra de progresso (Recebido → Confirmado → Em andamento → Concluído),
   linha do tempo e o **chat com a Milena**.

## Chat do pedido (cliente ↔ vendedora)

- Cada pedido tem o seu chat. Ele **só abre depois que a vendedora confirma o pedido** e **fecha se o pedido for
  cancelado** (o histórico continua visível). Antes disso, o cliente vê o aviso e o botão do WhatsApp.
- As mensagens ficam **só na aba de mensagens**, no estilo WhatsApp / Mercado Livre (lista de conversas de um lado,
  conversa do outro; no celular, a conversa abre em tela cheia com botão de voltar):
  cliente em **Minha conta → Mensagens**; equipe em **Painel → Conversas**. No pedido fica apenas o botão
  **Abrir conversa**, que leva direto para ela. Mensagens novas aparecem primeiro e o total aparece na aba.
- A “Nota da atualização” do pedido é outra coisa: fica na linha do tempo do pedido, não no chat.
- Mensagens chegam na hora (Supabase Realtime); se o Realtime estiver desligado, o site confere a cada 15 segundos.
  Há confirmação de leitura (✓ enviada, ✓✓ lida). Enter envia; Shift+Enter pula linha.
- O cliente vê o **nome no chat** da pessoa da equipe (aba Equipe), nunca o e-mail dela. A Milena já vem como
  “Milena Garbim”.
- Tudo é conferido pelo banco: só o dono do pedido e a equipe leem o chat, e ninguém escreve antes da confirmação.

O **formulário de análise** da página inicial continua existindo para quem não quer criar conta: ele só abre o
WhatsApp com a mensagem pronta (nada é gravado).

## Painel da empresa (`admin.html`)

| Aba | O que faz | Quem vê |
|---|---|---|
| Pedidos | Resumo por situação, busca, **confirmar pedido**, dados do cliente, serviços, andamento, mudar situação e escrever atualização, abrir chat, excluir | Todos da equipe (excluir: só administrador) |
| Conversas | Todos os chats de pedidos, com as mensagens novas primeiro | Todos da equipe |
| Clientes | Lista com busca, nº de pedidos e **exportar planilha** (CSV que abre no Excel) | Todos da equipe |
| Catálogo | Categorias e serviços (criar, editar, ocultar, excluir, foto, preço) | Administrador |
| Textos | Todos os textos principais do site, por página. `*palavra*` destaca em rosa itálico | Administrador |
| Fotos | Foto principal e foto do rosto da Milena (a foto é reduzida antes de enviar) | Administrador |
| Dúvidas | Perguntas e respostas: editar, reordenar, adicionar, remover | Administrador |
| Contato e links | WhatsApp, telefone, e-mail, CNPJ, horário, endereço e redes sociais | Administrador |
| Equipe | Adicionar pessoas como **Administrador** ou **Atendente** e o **nome que aparece no chat** | Administrador |

A pessoa da equipe entra em **Minha conta** com o e-mail liberado e vê o botão **Painel da empresa** (há também o
link “Área da equipe” no rodapé).

## Modo demonstração x modo real

Enquanto `supabase.url` e `supabase.anonKey` estiverem vazios em [`assets/js/config.js`](assets/js/config.js), o site
roda em **modo demonstração**: o código de login aparece na tela, tudo fica salvo **só no navegador** e o primeiro
e-mail que entrar no painel vira administrador. Serve para testar e mostrar. **Não divulgue o site nesse modo.**

## Ativar o modo real (Supabase — plano gratuito)

1. Crie uma conta em <https://supabase.com> e um projeto (região *South America (São Paulo)*).
2. **SQL Editor → New query**: cole todo o [`supabase/setup.sql`](supabase/setup.sql) e clique em **Run**.
   Isso cria tabelas, regras de segurança (cada cliente só vê os próprios dados), funções, a pasta de fotos e o
   catálogo inicial. Pode rodar de novo quando o arquivo for atualizado — não apaga nada.
3. O próprio `setup.sql` já libera **millenagarbim@gmail.com** como administradora do painel. Outras pessoas
   são liberadas depois, pela aba **Equipe**.
4. **Authentication → Sign In / Providers → Email**: deixe o e-mail habilitado.
5. **Authentication → Emails → Templates**: em **Confirm signup** e em **Magic Link**, cole o conteúdo de
   [`supabase/emails/codigo-acesso.html`](supabase/emails/codigo-acesso.html) (assunto sugerido:
   `Seu código de acesso · Milena Garbim`). O modelo usa `{{ .Token }}`, `{{ .Email }}` e `{{ .SiteURL }}`.
6. **Authentication → URL Configuration**: em **Site URL** coloque o endereço do site e, em **Redirect URLs**,
   o mesmo endereço com `/**` no fim.
7. **Project Settings → API**: copie a **Project URL** e a chave pública **anon / publishable** para
   `assets/js/config.js` (`supabase.url` e `supabase.anonKey`). A chave pública é feita para ficar no site; a
   segurança vem das regras do passo 2. **Nunca** coloque a chave `service_role` / secreta no site.
8. **Tamanho do código**: projetos novos mandam 8 dígitos. Se mudar em *Authentication → Email → Email OTP Length*,
   mude também `tamanhoCodigo` no `config.js`.
9. Para produção, configure um SMTP próprio em **Authentication → Emails → SMTP Settings** (o envio padrão do
   Supabase tem limite de poucos e-mails por hora).

## Publicar no GitHub Pages

1. **Settings → Pages → Deploy from a branch**, escolha a branch e a pasta `/ (root)`.
2. Com domínio próprio: crie o arquivo `CNAME` com o domínio e aponte o DNS para o GitHub Pages.

## Estrutura dos arquivos

```
assets/css/style.css     estilos (cores em :root)
assets/js/config.js      Supabase e dados de contato iniciais
assets/js/padrao.js      conteúdo inicial: textos, catálogo, dúvidas e ícones (o painel sobrescreve)
assets/js/dados.js       banco de dados / modo demonstração (conta, pedidos, catálogo, painel)
assets/js/main.js        todas as páginas: textos do painel, catálogo, Minha solicitação, formulário
assets/js/conta.js       Minha conta
assets/js/admin.js       Painel
assets/js/chat.js        janela do chat do pedido (Minha conta e Painel)
assets/js/br.js          CPF/CNPJ, máscaras, CEP (ViaCEP) e CNPJ (BrasilAPI)
supabase/setup.sql       banco de dados
supabase/emails/         modelo do e-mail com o código
```

## Cuidados com o conteúdo

O texto evita promessas que o setor não pode cumprir (“apagar dívida”, “score garantido”) e deixa claro que a
empresa não é órgão de proteção ao crédito. Ao editar pelo painel, mantenha esse tom: é o que diferencia uma
assessoria séria e evita problemas com o Código de Defesa do Consumidor. Depoimentos só devem ser publicados se
forem reais e autorizados pelos clientes. As frases atribuídas à Milena são sugestões: troque pelas palavras dela
em **Painel → Textos**.

## Recursos inspirados em sites de referência

| Referência | O que tem de marcante | Como foi aplicado aqui |
|---|---|---|
| **Serasa** (Limpa Nome) e **Nubank** | Ferramentas simples que dão uma resposta na hora | **Diagnóstico em 30 segundos**: 3 perguntas, serviço indicado, botão Solicitar, WhatsApp com o resumo e Compartilhar |
| **Apple** | Frases grandes que “acendem” conforme a rolagem | **Manifesto**: “Dívida não define ninguém…” acendendo palavra por palavra (texto editável no painel) |
| **Glossier / marcas de beleza no Instagram** | Selos redondos e giratórios, tom próximo e feminino | **Selo giratório** “Nome limpo • Crédito de volta • Diagnóstico grátis” no topo |
| **Nubank / Natura** | Conteúdo educativo fácil de compartilhar e indicação entre amigas | **Dicas da Milena** (carrossel com botão Compartilhar em cada dica) e **Indique para uma amiga** (WhatsApp e copiar link) |
| **Stripe** | Bordas com gradiente em movimento, acabamento “premium” | Borda animada no **serviço em destaque** e no **diagnóstico** |
| **Apps (iFood, Mercado Livre, bancos)** | Atalhos fixos na parte de baixo da tela do celular | **Barra de atalhos no celular**: Diagnóstico, Serviços, Minha conta, WhatsApp |
| **WhatsApp / Mercado Livre** | Conversa com lista, fotos e respostas rápidas | **Chat** com fotos (opcional), respostas rápidas, emojis e foto ampliada |
| **Airbnb** | Galeria de fotos com setas e miniaturas | **Serviços com até 6 fotos** e galeria nos detalhes |
| Sites premiados (Awwwards) | Transições entre páginas e botões “magnéticos” | Transição suave ao trocar de página e botões que seguem o mouse |

**Prévia no WhatsApp/Instagram/Facebook:** ao mandar o link do site, aparece a imagem
`assets/img/compartilhar.jpg` (1200×630) com a foto e a marca da Milena. Se o endereço do site mudar (domínio próprio),
troque o endereço no `og:image` das páginas.

## Fotos no chat

Cliente e equipe podem mandar fotos (opcional) na conversa: documentos, comprovantes, prints. No banco, elas ficam
na pasta **privada** `chat`, separada por pedido: só o cliente do pedido e a equipe conseguem ver, por links que
expiram. Rode o `setup.sql` atualizado para criar essa pasta.

## Assistente virtual com IA

Botão **“Dúvidas? Pergunte à assistente”** no canto da tela (no celular, a bolinha com a foto da Milena). Ela tira
dúvidas sobre nome sujo, Bacen, score, prazos e os serviços, e termina com botões para o próximo passo
(Diagnóstico, Serviços, WhatsApp da Milena, Minha conta). Ela se apresenta como IA, não promete resultados, não pede
CPF nem senhas e passa para a Milena quando o caso pede.

**Dois modos:**
- **Modo IA** (quando a função estiver ligada): respostas do **Claude Opus 5.5** (Anthropic), escritas em tempo real.
  O conhecimento vem do próprio site — serviços, preços, dúvidas e contatos editados no painel — atualizado a cada 5 min.
- **Modo básico** (hoje, sem banco): responde com as dúvidas frequentes e os serviços do site, sem custo.

**Ligar a IA (depois do Supabase):**
1. Crie uma chave em <https://console.anthropic.com> (**API Keys**) e coloque créditos na conta (a cobrança é por uso).
2. No Supabase: **Edge Functions → Deploy a new function**, nome `assistente`, cole o conteúdo de
   [`supabase/functions/assistente/index.ts`](supabase/functions/assistente/index.ts) e publique.
3. **Edge Functions → Secrets**: crie `ANTHROPIC_API_KEY` com a sua chave. **Nunca** coloque essa chave no site.
4. Com domínio próprio, crie também o secret `ORIGENS_PERMITIDAS` com o endereço do site (ex.: `https://limpanomegarbim.com.br`).
5. Pronto: o site encontra a função sozinho pelo `supabase.url` do `config.js`.

**Custos e proteções:** cada visitante pode mandar até 40 mensagens a cada 10 minutos; o histórico enviado é limitado
às últimas 20 mensagens; o conhecimento fixo usa cache para ficar mais barato. Se a IA recusar um assunto, a API tenta
automaticamente outro modelo recomendado; se tudo falhar, a assistente oferece o WhatsApp.

**Para melhorar com o tempo:** as regras de conversa estão em `INSTRUCOES`, no começo da função. É só ajustar o texto
(tom, o que pode ou não dizer) e publicar de novo.
