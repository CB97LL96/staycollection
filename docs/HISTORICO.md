# Histórico

Resumo do que foi feito em cada rodada de trabalho, do mais novo para o mais antigo. O plano e os próximos passos ficam em [PLANO.md](PLANO.md).

## 31/10 a 02/11/2026: do canhoto ao app novo

**Redesenho "Canhoto de ingresso" (31/10)**
- 6 etapas: correção da conta do que devo, reordenação do Devo, faixa de vencidos com desfazer, celular e acessibilidade, o visual do canhoto, ajustes finais.
- A dona achou que só o visual tinha mudado. Veio então uma reestruturação em 3 telas (Hoje, Pedidos, Coleção), com componentes novos.
- Voltaram a aba de CEGs (em tabela por comunidade, com fotos dos photocards) e o "liquidar em lote".

**Fotos de comunidades e grupos**
- Ícones das comunidades e dos grupos de CEG lidos do WhatsApp Web (só título e foto, sem mensagens).
- Fotos maiores em Pedidos e CEGs.
- Segunda rodada, conferindo título e comunidade: 64 de 67 grupos com foto certa.
- Fotos da Hyunchan enviadas pela dona.

**Coleção**
- Tabela de photocards repetidos.
- "Confirmar cards": o número do pedido decide o palpite ("round 3", "fansign 2"), aviso do que falta no catálogo e botão para marcar todos de uma dupla.

**App novo do zero (01/11)**
- Proposta: o card do catálogo vira a unidade de tudo, com 4 abas (Início, Coleção, Contas, CEGs) e o fluxo "Nova compra".
- Feito primeiro como protótipo só leitura em `/novo.html`, depois com gravação (sempre com desfazer).
- Virou o `index.html`. O antigo ficou em `/antigo.html`.
- Trazido do antigo: sugestões do robô, edição e exclusão de registros, cadastros.
- A aba CEGs começa pelas comunidades.
- Dados: "Nana" virou "Anaju" no star's minsung cegs (mesma pessoa).

**Visual com o `/impeccable` (01 e 02/11)**
- `document`: DESIGN.md refeito para o app novo.
- `critique`: 22/40. O mais grave: "a confirmar" vencida entrava no "Devo agora" e "sem valor" contava como zero.
- `polish`: o total passou a somar só o que é certo, a conta mostra a origem antes do valor, contraste AA, foco preso na folha lateral.
- Visual novo escolhido entre 4 prévias: **"O encarte do álbum"**, com papel couché, tinta preta, Archivo, réguas grossas e cor por era. Regra da dona: sem termos de álbum nos textos, no máximo o nome da era na Coleção.
- Revisão final com correções: barra de abas, estados como adesivos de tinta, botão flutuante, ícones desenhados, filtros recolhidos.
- DESIGN.md reescrito para o encarte.

**Adiado para o backlog**
- Ler as mensagens dos grupos desde setembro atrás de cobranças que faltam.
- Deixar o nome dos grupos igual ao do WhatsApp.
- Procurar grupos de CEG fora da lista "cegs".
