# Hogwarts Voxel 🧙‍♂️

Um jogo em primeira pessoa, todo feito de voxels, ambientado em Hogwarts. Escolha sua casa, ande pelo castelo e pelos jardins, lance feitiços, converse com os personagens e ajude-os para conquistar a Taça das Casas.

Roda direto no navegador, sem etapa de build. O Three.js já vem incluído em `lib/`, então o jogo funciona offline.

## Como jogar

Os módulos ES precisam de um servidor HTTP (abrir o `index.html` com duplo clique não funciona). Na pasta do projeto, rode:

```bash
npm start                 # usa npx http-server na porta 8080
# ou
python3 -m http.server 8080
```

Depois abra <http://localhost:8080>.

### Controles

| Tecla | Ação |
|---|---|
| **WASD** | andar |
| **Shift** | correr |
| **Espaço** | pular / nadar para cima |
| **Mouse** | olhar |
| **Clique esquerdo** | lançar o feitiço selecionado (segure para Wingardium Leviosa) |
| **1–8** / roda do mouse | escolher o feitiço (a roda aproxima ou afasta o objeto levitado) |
| **E** / clique direito | conversar com um NPC |
| **1–3** (no diálogo) | escolher uma resposta |
| **Q** | trocar a missão acompanhada |
| **T** (segurar) | acelerar o tempo (ciclo de dia e noite) |
| **M** | ligar/desligar todo o som |
| **N** | ligar/desligar a música |
| **Esc** | pausar |

### Feitiços

| # | Feitiço | Efeito |
|---|---|---|
| 1 | **Lumos** | acende ou apaga a luz na ponta da varinha (útil à noite) |
| 2 | **Estupefaça** | atordoa criaturas e pessoas (cuidado com os professores!) |
| 3 | **Incêndio** | acende braseiros e queima madeira, folhas e abóboras |
| 4 | **Wingardium Leviosa** | levita objetos e **quase qualquer bloco**: segure, carregue e solte (dá até para arremessar) |
| 5 | **Accio** | convoca objetos até você |
| 6 | **Bombarda** | explode blocos |
| 7 | **Reparo** | reconstrói, bloco por bloco, o que foi destruído ou queimado |
| 8 | **Expecto Patronum** | conjura um cervo prateado |

### Som

Todos os sons são sintetizados em tempo real com a Web Audio API, sem nenhum arquivo de áudio:

- um efeito próprio para cada feitiço (e um "fiasco" quando não há alvo), impactos, fogo crepitando, explosões e blocos sendo reconstruídos;
- passos que mudam conforme o chão (grama, pedra, madeira, areia, água), pulos, quedas e mergulhos;
- vozes em "bipes" com o timbre de cada personagem, risadinhas dos diabretes e o coaxar do Trevo;
- sons de missão, pontos, figurinhas e uma fanfarra para a Taça das Casas;
- vento ao ar livre, grilos à noite, som abafado debaixo d'água, eco leve de castelo e uma música original de caixinha de música.

Os sons vêm do lugar certo no espaço (esquerda/direita) e ficam mais baixos com a distância.

### Lugares

Salão Principal (teto enfeitiçado, velas flutuantes e as mesas das casas), Saguão de Entrada com as ampulhetas das casas, pátio com fonte, Biblioteca e Seção Restrita, sala de Defesa Contra as Artes das Trevas, masmorra de Poções, Torre da Grifinória (a escada em espiral leva ao dormitório), Torre de Astronomia, Torre da Corvinal, cabana do Hagrid, estufas, Salgueiro Lutador, Lago Negro (com a Lula Gigante), campo de Quadribol e a Floresta Proibida.

### Personagens e missões

- **Dumbledore** (Salão Principal): dá as boas-vindas e entrega a Taça no final.
- **Hermione** (Biblioteca): recupere o livro da Seção Restrita com *Accio*.
- **Rony** (pátio): faça a pena levitar com *Wingardium Leviosa*.
- **Neville** (margem do lago): traga o Trevo de volta da ilha.
- **Hagrid** (cabana): acenda os três braseiros com *Incêndio*.
- **McGonagall** (sala de aula): atordoe cinco diabretes da Cornualha com *Estupefaça*.
- **Snape** (masmorras): responda à prova de Poções dele.
- **Nick Quase Sem Cabeça** (vagando pelo Salão Principal): dá dicas sobre as 6 figurinhas de Sapo de Chocolate escondidas pelo mapa.

A bússola no topo da tela aponta para o objetivo da missão acompanhada.

## Estrutura do código

```
index.html          HUD, menus e importmap
style.css           estilos da interface
lib/                three.js r160 (módulo ES)
src/main.js         cena, loop, estado do jogo, entrada, missões e ciclo de dia e noite
src/blocks.js       tipos de bloco e atlas de texturas procedural (16×16)
src/world.js        armazenamento voxel, malhas por chunk com oclusão ambiente, raycast DDA
src/hogwarts.js     gerador do mapa (terreno, castelo, jardins)
src/player.js       física e colisão em primeira pessoa (subida automática de degraus, nado)
src/npc.js          NPCs: aparência, IA de caminhada, atordoamento
src/models.js       modelos voxel (personagens, criaturas, itens, varinha, patrono)
src/entities.js     itens de missão, diabretes, blocos levitando, patrono
src/spells.js       feitiços, projéteis e efeitos
src/particles.js    partículas voxel instanciadas
src/audio.js        efeitos sonoros, ambiente e música procedurais (Web Audio)
src/dialogues.js    árvores de diálogo e definições das missões
src/ui.js           HUD, barra de feitiços e caixa de diálogo
```

Para testes automatizados, abra `?test` (pula a tela inicial) e use `window.__debug.step(n)` para avançar a simulação de forma determinística.

---

Projeto de fã, sem fins lucrativos. Harry Potter e seus personagens pertencem a J.K. Rowling e à Warner Bros.
