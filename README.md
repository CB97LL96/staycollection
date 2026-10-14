# staycollection

gestão de coleção e cegs de uma stay com tdah

Começou como o artefato "Coleção SKZ" no claude.ai e está sendo migrado para rodar no Vercel.

## O que tem aqui

- `index.html`: o app inteiro (HTML, CSS e JS num arquivo só, sem build).
- `colecao.json`: catálogo de photocards (fonte: CraftenSKZ / StrayKidsPCCollector).
- `sprites/`: as folhas de imagens do catálogo usadas pelo `colecao.json`.

## Situação da migração

O código e o catálogo já funcionam fora do claude.ai. **Os dados ainda não.**
Cobranças, itens, envios, CEGs, comunidades, fotos etc. ficam no banco do
artefato (`window.claude.use("db")` e `use("assets")`), que só existe dentro do
claude.ai. Fora dele a página mostra o aviso "A base fica guardada no claude.ai".

Próximos passos:

1. Escolher e criar o backend (banco + login + fotos).
2. Trocar `window.claude.use(...)` por esse backend.
3. Exportar os dados do artefato e importar no backend novo.
4. Importar o repositório no Vercel (site estático, sem configuração).

## Pendências

- **Redesenhar a página de Cobranças.** É a parte mais importante do app, e a
  usabilidade está confusa. O redesenho começou no artefato em 14/10/2026,
  mas não chegou a ser publicado, então o `index.html` daqui ainda tem a
  versão antiga. A ideia que estava em andamento: cartões de cobrança
  agrupados e um fluxo parecido com um checkout. Idear antes de implementar.

## Cuidado: o repositório é público

Nunca commitar dados pessoais: chaves Pix, nomes, grupos de WhatsApp,
comprovantes, exports do banco. Backups ficam fora do git (veja `.gitignore`).

## Rodar localmente

```sh
python3 -m http.server 8000
```

e abrir http://localhost:8000
