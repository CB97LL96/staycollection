---
name: Coleção SKZ
description: Canhotos de ingresso numa mesa lavanda fria; cozy, pouca estimulação, o que vence primeiro aparece primeiro.
colors:
  mesa: "#E4E2EC"
  canhoto: "#F4F3F8"
  afundado: "#DAD7E5"
  picote: "#B9B5CB"
  tinta: "#1F2D3D"
  tinta-suave: "#46546A"
  petroleo: "#25495C"
  tijolo: "#A8472F"
  musgo: "#46603F"
  mesa-escura: "#1A1C26"
  canhoto-escuro: "#242736"
  tinta-escura: "#E6E7EE"
  petroleo-claro: "#8FB8C8"
  tijolo-claro: "#E39379"
typography:
  corpo:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  total:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    letterSpacing: "-0.02em"
  data-do-canhoto:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "26px"
    fontWeight: 800
rounded:
  canhoto: "10px"
  pilula: "999px"
  botao: "8px"
spacing:
  canhoto-data: "78px"
  canhoto-data-celular: "62px"
  alvo-toque: "44px"
components:
  canhoto:
    backgroundColor: "{colors.canhoto}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.canhoto}"
  botao-primario:
    backgroundColor: "{colors.petroleo}"
    textColor: "{colors.canhoto}"
    rounded: "{rounded.botao}"
    height: "44px"
  pilula-cobrada:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.canhoto}"
    rounded: "{rounded.pilula}"
  carimbo-vencido:
    textColor: "{colors.tijolo}"
    rounded: "6px"
---

# Design System: Coleção SKZ

## Overview

Cada cobrança é um canhoto de ingresso com a data na frente: o que vence antes aparece primeiro. O app é de uma pessoa só, usado quase todo dia no celular e no computador para conferir quanto deve, a quem e até quando. A régua é "cozy e que não superestimula": papel fosco sobre uma mesa lavanda fria, tinta azul-petróleo, nenhum acento que grite. Recusa o painel de finanças padrão e o pastel fofo da versão anterior. A linguagem de CEG fica intacta (GOM, taxa RF, copiar pix, pedir envio).

## Colors

Duas famílias frias e um único acento quente.

- **Mesa (#E4E2EC)**: fundo da página. **Canhoto (#F4F3F8)**: papel-cartão das linhas de cobrança e envio. **Afundado (#DAD7E5)**: áreas rebaixadas.
- **Tinta (#1F2D3D)** e **tinta suave (#46546A)**: texto. **Petróleo (#25495C)**: botões e aba ativa.
- **Tijolo (#A8472F)**: o único acento quente, usado SÓ em vencido (data, carimbo, faixa "Vencidos", total atrasado).
- **Musgo (#46603F)**: pago, bem discreto.
- Escuro: mesa #1A1C26, canhoto #242736, tinta #E6E7EE, petróleo claro #8FB8C8, tijolo claro #E39379. Sem neon, sem contraste agressivo.
- Estado de confirmação nunca depende de cor (ver Components).

## Typography

Fonte de sistema, sem serifa e sem fonte baixada (a página carrega mais leve). Algarismos tabulares em valores e datas. O total de Hoje é 40px/800; a data do canhoto, 26px/800; o corpo, 15px. Escala curta, só pesos 400, 600, 700 e 800.

## Layout

Três telas: Hoje (agir), Pedidos (uma lista por comunidade, com cobranças, envio e itens) e Coleção. Cadastros (CEGs, Comunidades, Repasses) ficam escondidos dentro de Pedidos. Antes desta estrutura: Hoje: faixa "Vencidos" no topo (gaveta com contador e soma), depois o total "pra pagar", depois os canhotos por prazo. Devo: dívida por prazo primeiro; as sugestões do robô ficam recolhidas no fim, com "aceitar as novas de alta confiança". Cobranças: quatro resumos e seções por status, com a conta de "o que devo" igual à de Hoje e Devo (Pendente mais "A confirmar" já vencido).

O canhoto é uma grade de bloco de data (78px, 62px no celular), picote, título e origem, e valor com ação. Em container estreito a ação desce para baixo do título. Itens e Coleção ficam em linhas simples, sem enfeite. Alvos de toque de 44px no celular.

## Elevation & Depth

Sem sombra. A profundidade vem de borda de 1px na cor do picote e da diferença entre mesa e canhoto. Hover só escurece a borda (180 ms, ease-out). `prefers-reduced-motion` desliga transições.

## Shapes

Canhoto com cantos de 10px e duas "mordidas" semicirculares na costura, alinhadas ao picote pontilhado de 2px entre a data e o resto. Pílulas totalmente arredondadas; botões de 8px.

## Components

- **Canhoto** (`.task`, `.crow`, `.dv`): bloco de data, picote pontilhado, mordidas em cima e embaixo, borda de 1px.
- **Pílula cheia** = confirmada ("cobrada", a GOM já cobrou). **Pílula tracejada** = suposto ("a confirmar"). A diferença é de forma, não de cor.
- **Carimbo de vencido** (`.due.late`): texto em caixa alta, borda de 2px em tijolo, giro de -2 graus. É o único lugar com carimbo; os outros prazos são texto quieto.
- **Faixa "Vencidos"**: título e soma em tijolo, sem caixa, os canhotos vencidos logo abaixo.
- **Botão primário** (`.cta`): petróleo, 8px, 44px de altura no celular.
- **Desfazer**: toda mudança de status (select de Itens e Cobranças, botões tenho/quero da Coleção) mostra um aviso com "desfazer" por 6 segundos.
- **Chip-resumo das fontes** no cabeçalho: uma pílula ("fontes em dia", "alguma fonte está atrasada") que abre a lista por fonte.

## Do's and Don'ts

- Faça: ordenar por prazo, mostrar a origem antes do valor, manter o "suposto" separado do "certo" na forma da pílula.
- Faça: usar tijolo apenas para vencido; usar petróleo para ação.
- Não: fundo rosado em linhas vencidas, sombras pesadas, carimbo fora de vencido, picote em Itens ou Coleção.
- Não: soma de "suposto" com "certo" sem dizer; o total de "o que devo" diz quantas "a confirmar" já vencidas ele inclui.
- Não: fontes externas, gradientes, emoji como ícone, borda lateral colorida acima de 1px.
