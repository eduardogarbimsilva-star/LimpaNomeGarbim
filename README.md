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
4. A equipe acompanha em **Painel → Pedidos**: muda a situação (Recebido → Em análise → Aguardando você →
   Em andamento → Concluído, ou Cancelado) e escreve atualizações.
5. O cliente vê tudo em **Minha conta**: barra de progresso, linha do tempo e um campo para responder à equipe.

O **formulário de análise** da página inicial continua existindo para quem não quer criar conta: ele só abre o
WhatsApp com a mensagem pronta (nada é gravado).

## Painel da empresa (`admin.html`)

| Aba | O que faz | Quem vê |
|---|---|---|
| Pedidos | Resumo por situação, busca, dados do cliente, serviços, andamento, mudar situação e mandar mensagem, excluir | Todos da equipe (excluir: só administrador) |
| Clientes | Lista com busca, nº de pedidos e **exportar planilha** (CSV que abre no Excel) | Todos da equipe |
| Catálogo | Categorias e serviços (criar, editar, ocultar, excluir, foto, preço) | Administrador |
| Textos | Todos os textos principais do site, por página. `*palavra*` destaca em rosa itálico | Administrador |
| Fotos | Foto principal e foto do rosto da Milena (a foto é reduzida antes de enviar) | Administrador |
| Dúvidas | Perguntas e respostas: editar, reordenar, adicionar, remover | Administrador |
| Contato e links | WhatsApp, telefone, e-mail, CNPJ, horário, endereço e redes sociais | Administrador |
| Equipe | Adicionar pessoas como **Administrador** ou **Atendente** | Administrador |

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
