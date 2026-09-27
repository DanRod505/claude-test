// Árvores de diálogo e missões. `g` é o objeto do jogo (ver main.js).

export const QUEST_ORDER = ['book', 'feather', 'trevor', 'braziers', 'pixies', 'quiz'];

export const QUESTS = {
  intro: {
    title: 'Bem-vindo a Hogwarts',
    objective: () => ({ text: 'Fale com Dumbledore no Salão Principal', npc: 'dumbledore' }),
  },
  book: {
    title: 'O livro da Seção Restrita', giver: 'hermione',
    objective: (g) => g.inv.has('book')
      ? { text: 'Devolva o livro para Hermione', npc: 'hermione' }
      : { text: 'Use Accio (5) no livro em cima da estante da Seção Restrita', entity: 'book' },
  },
  feather: {
    title: 'É Levi-Ô-sa', giver: 'ron',
    objective: (g) => g.flags.featherLifted
      ? { text: 'Conte ao Rony que a pena voou', npc: 'ron' }
      : { text: 'Levite a pena no pátio com Wingardium Leviosa (4)', entity: 'feather' },
  },
  trevor: {
    title: 'Cadê o Trevo?', giver: 'neville',
    objective: (g) => g.inv.has('trevor')
      ? { text: 'Leve o Trevo de volta para o Neville', npc: 'neville' }
      : { text: 'Encontre o sapo Trevo na ilha do lago (Accio funciona!)', entity: 'trevor' },
  },
  braziers: {
    title: 'Luz para o Canino', giver: 'hagrid',
    objective: (g) => g.flags.braziersLit >= 3
      ? { text: 'Volte a falar com Hagrid', npc: 'hagrid' }
      : { text: `Acenda os braseiros com Incêndio (3): ${g.flags.braziersLit}/3`, entity: 'brazier' },
  },
  pixies: {
    title: 'Diabretes à solta', giver: 'mcgonagall',
    objective: (g) => g.flags.pixiesStunned >= 5
      ? { text: 'Avise a Professora McGonagall', npc: 'mcgonagall' }
      : { text: `Atordoe diabretes com Estupefaça (2): ${g.flags.pixiesStunned}/5`, entity: 'pixie' },
  },
  quiz: {
    title: 'A prova de Snape', giver: 'snape',
    objective: () => ({ text: 'Responda corretamente às perguntas do Professor Snape', npc: 'snape' }),
  },
  cup: {
    title: 'A Taça das Casas',
    objective: () => ({ text: 'Volte ao Salão Principal e fale com Dumbledore', npc: 'dumbledore' }),
  },
};

const bye = { text: 'Até mais.', end: true };

export const DIALOGUES = {
  dumbledore: {
    start: (g) => {
      if (g.questState('intro') !== 'done') return 'welcome';
      if (g.questState('cup') === 'done') return 'after';
      if (g.doneCount() >= QUEST_ORDER.length) return 'cup';
      return 'progress';
    },
    nodes: {
      welcome: {
        text: 'Ah, {name}! Bem-vindo(a) a Hogwarts. O Chapéu Seletor mandou você para a {house} — uma escolha excelente, devo dizer.',
        options: [{ text: 'Obrigado(a), professor!', next: 'welcome2' }],
      },
      welcome2: {
        text: 'Hogwarts está cheia de gente precisando de uma mão... e de uma varinha. Hermione está na Biblioteca, Rony no pátio, Neville perto do lago, Hagrid na cabana dele, a Professora McGonagall na sala de Defesa Contra as Artes das Trevas e o Professor Snape nas masmorras de Poções.',
        options: [
          { text: 'Como faço feitiços?', next: 'spells' },
          { text: 'Vou ajudar todos eles!', next: 'go', do: (g) => { g.completeQuest('intro', 10); g.startQuest('cup', true); } },
        ],
      },
      spells: {
        text: 'Sua varinha conhece oito feitiços. Escolha com as teclas 1 a 8 ou com a roda do mouse, e lance com o botão esquerdo. Wingardium Leviosa exige que você segure o botão... e um pouco de paciência. Ah, e Reparo conserta quase tudo o que Bombarda estraga.',
        options: [{ text: 'Entendi!', next: 'welcome2' }],
      },
      go: {
        text: 'Esplêndido. Quando tiver ajudado a todos, volte aqui. Tenho a impressão de que a Taça das Casas deste ano será... interessante.',
        options: [{ text: 'Até logo, professor.', end: true }],
      },
      progress: {
        text: (g) => `Você já ajudou ${g.doneCount()} de ${QUEST_ORDER.length} pessoas. "São as nossas escolhas que revelam o que realmente somos, muito mais do que as nossas qualidades."`,
        options: [
          { text: 'Quem ainda precisa de ajuda?', next: 'pending' },
          { text: 'Aceita um sorvete de limão?', next: 'lemon' },
          bye,
        ],
      },
      pending: {
        text: (g) => {
          const names = { book: 'Hermione (Biblioteca)', feather: 'Rony (pátio)', trevor: 'Neville (lago)', braziers: 'Hagrid (cabana)', pixies: 'McGonagall (sala de aula)', quiz: 'Snape (masmorras)' };
          const left = QUEST_ORDER.filter((q) => g.questState(q) !== 'done').map((q) => names[q]);
          return `Ainda precisam de você: ${left.join(', ')}.`;
        },
        options: [{ text: 'Obrigado(a)!', end: true }],
      },
      lemon: {
        text: 'Sorvete de limão! Um doce trouxa de que gosto muitíssimo. Aliás, já foi senha do meu escritório... mas isso fica entre nós.',
        options: [{ text: 'Hehe. Até mais!', end: true }],
      },
      cup: {
        text: 'A hora chegou! Pela coragem, pela astúcia, pela sabedoria e pela lealdade que você demonstrou ajudando tanta gente... concedo cem pontos à {house}!',
        options: [{ text: '(Segurar a respiração)', end: true, do: (g) => { g.completeQuest('cup', 100); g.showCup(); } }],
      },
      after: {
        text: 'A Taça é de vocês. Mas lembre-se: Hogwarts sempre estará aqui para receber de volta aqueles que precisarem dela.',
        options: [bye],
      },
    },
  },

  hermione: {
    start: (g) => {
      const s = g.questState('book');
      if (s === 'done') return 'after';
      if (g.inv.has('book')) return 'return';
      if (s === 'active') return 'remind';
      return 'intro';
    },
    nodes: {
      intro: {
        text: 'Ah, oi! Desculpe, estou um pouco nervosa. Deixei um livro em cima de uma estante lá no fundo, na Seção Restrita, e não alcanço de jeito nenhum!',
        options: [
          { text: 'Eu pego pra você.', next: 'accepted', do: (g) => g.startQuest('book') },
          { text: 'Por que você não usa Accio?', next: 'why' },
        ],
      },
      why: {
        text: 'A Madame Pince está de olho em mim! Se me pegar perto da Seção Restrita de novo, adeus biblioteca. Mas ninguém vai desconfiar de você.',
        options: [{ text: 'Tá bom, eu pego.', next: 'accepted', do: (g) => g.startQuest('book') }],
      },
      accepted: {
        text: 'Obrigada! Selecione Accio (tecla 5), aponte a varinha para o livro e clique. Ele fica em cima da primeira estante do fundo, depois da cerquinha.',
        options: [bye],
      },
      remind: {
        text: 'Ainda não achou? Fica em cima da estante do fundo, na Seção Restrita. Accio, tecla 5!',
        options: [bye],
      },
      return: {
        text: 'Você conseguiu! Muito obrigada! Ah, e se o Rony perguntar: é Levi-Ô-sa, não Levio-SÁ.',
        options: [{ text: 'De nada!', end: true, do: (g) => { g.inv.delete('book'); g.completeQuest('book', 50); } }],
      },
      after: {
        text: (g) => g.pick([
          'Sabia que o teto do Salão Principal é enfeitiçado para parecer o céu lá fora? Li em "Hogwarts: Uma História".',
          'Você já fez a lição de Poções? O Snape vai perguntar sobre bezoares, tenho certeza.',
          'Estou pensando em fundar uma sociedade para os direitos dos elfos domésticos. Quer participar?',
        ]),
        options: [bye],
      },
    },
  },

  ron: {
    start: (g) => {
      const s = g.questState('feather');
      if (s === 'done') return 'after';
      if (s === 'active' && g.flags.featherLifted) return 'return';
      if (s === 'active') return 'remind';
      return 'intro';
    },
    nodes: {
      intro: {
        text: 'E aí! Tô tentando fazer essa pena voar faz uma hora. Wingardium Levio-SÁ! ...Nada. Você consegue?',
        options: [
          { text: 'Deixa comigo.', next: 'accepted', do: (g) => g.startQuest('feather') },
          { text: 'Não seria Levi-Ô-sa?', next: 'leviosa' },
        ],
      },
      leviosa: {
        text: 'Ah, não começa você também! Já basta a Hermione. Vai, mostra como se faz então.',
        options: [{ text: 'Observe e aprenda.', next: 'accepted', do: (g) => g.startQuest('feather') }],
      },
      accepted: {
        text: 'A pena tá ali no pedestal de mármore. Seleciona Wingardium Leviosa (tecla 4), mira nela e SEGURA o botão. Levanta bem alto!',
        options: [bye],
      },
      remind: {
        text: 'A pena, cara! Segura o botão com Wingardium Leviosa e levanta ela bem alto.',
        options: [bye],
      },
      return: {
        text: 'UAU! Você fez a pena voar mais alto que a minha vassoura! Quer um Feijãozinho de Todos os Sabores? ...Melhor não, esse é de cera de ouvido.',
        options: [{ text: 'Valeu, Rony!', end: true, do: (g) => g.completeQuest('feather', 50) }],
      },
      after: {
        text: (g) => g.pick([
          'Topa uma partida de xadrez de bruxo depois? Aviso logo: eu nunca perco.',
          'Aranhas. Por que tinham que ser aranhas? Nunca vou pra Floresta Proibida, nunca!',
          'Tô morrendo de fome. Será que já tem banquete no Salão Principal?',
        ]),
        options: [bye],
      },
    },
  },

  neville: {
    start: (g) => {
      const s = g.questState('trevor');
      if (s === 'done') return 'after';
      if (g.inv.has('trevor')) return 'return';
      if (s === 'active') return 'remind';
      return 'intro';
    },
    nodes: {
      intro: {
        text: 'V-você viu o Trevo? Meu sapo! Ele fugiu de novo... acho que foi parar naquela ilhazinha no meio do lago.',
        options: [
          { text: 'Eu trago ele de volta.', next: 'accepted', do: (g) => g.startQuest('trevor') },
          { text: 'Por que você não vai buscar?', next: 'squid' },
        ],
      },
      squid: {
        text: 'A Lula Gigante! E... eu não sei nadar muito bem. Por favor?',
        options: [{ text: 'Tá bom, eu vou.', next: 'accepted', do: (g) => g.startQuest('trevor') }],
      },
      accepted: {
        text: 'Obrigado! Dá pra usar Accio (tecla 5) daqui da margem... ou nadar até lá, se tiver coragem. Grifinória, né?',
        options: [bye],
      },
      remind: {
        text: 'Ele deve estar na ilhazinha. Mira bem com Accio — ou nada até lá (segure Espaço para subir na água).',
        options: [bye],
      },
      return: {
        text: 'TREVO! Obrigado, obrigado! A vovó ia ficar uma fera se eu perdesse ele de novo.',
        options: [{ text: 'Cuida bem dele!', end: true, do: (g) => { g.inv.delete('trevor'); g.completeQuest('trevor', 50); } }],
      },
      after: {
        text: 'Sabia que as estufas ficam logo ali perto do caminho? Herbologia é a minha matéria favorita.',
        options: [bye],
      },
    },
  },

  hagrid: {
    start: (g) => {
      const s = g.questState('braziers');
      if (s === 'done') return 'after';
      if (s === 'active' && g.flags.braziersLit >= 3) return 'return';
      if (s === 'active') return 'remind';
      return 'intro';
    },
    nodes: {
      intro: {
        text: 'Olá! Você é aluno novo, né? Escuta, ando tendo problemas pra acender os braseiros aqui fora. O Canino tem um medo danado do escuro, sabe? Consegue acender os três com Incêndio?',
        options: [
          { text: 'Claro, Hagrid!', next: 'accepted', do: (g) => g.startQuest('braziers') },
          { text: 'Você não pode usar magia?', next: 'nomagic' },
        ],
      },
      nomagic: {
        text: 'Eu? Ah... bem... não devo, sabe. Não devia ter dito isso. Não devia ter dito isso! Então, vai me ajudar?',
        options: [{ text: 'Vou sim.', next: 'accepted', do: (g) => g.startQuest('braziers') }],
      },
      accepted: {
        text: 'Beleza! São os três braseiros de ferro ao redor da cabana. Incêndio é a tecla 3 — mira direitinho, hein.',
        options: [bye],
      },
      remind: {
        text: (g) => `${g.flags.braziersLit} de 3 braseiros acesos. Os que faltam tão aqui por perto da cabana!`,
        options: [bye],
      },
      return: {
        text: 'Olha só que beleza! O Canino tá abanando o rabo que nem doido. Toma aqui um bolo de pedra — cuidado com os dentes.',
        options: [{ text: 'Obrigado(a), Hagrid!', end: true, do: (g) => g.completeQuest('braziers', 50) }],
      },
      after: {
        text: (g) => g.pick([
          'Fica longe da Floresta Proibida, viu? Tem coisas lá dentro que... bom, deixa pra lá.',
          'Sempre quis ter um dragão. Um dia, quem sabe!',
          'Já viu as abóboras? Tão crescendo que é uma beleza. Não pergunte como.',
        ]),
        options: [bye],
      },
    },
  },

  mcgonagall: {
    start: (g) => {
      const s = g.questState('pixies');
      if (s === 'done') return 'after';
      if (s === 'active' && g.flags.pixiesStunned >= 5) return 'return';
      if (s === 'active') return 'remind';
      return 'intro';
    },
    nodes: {
      intro: {
        text: 'Ah, que bom que chegou. Algum professor irresponsável soltou diabretes da Cornualha nesta sala. Preciso que alguém competente os imobilize. Cinco deles, com Estupefaça.',
        options: [
          { text: 'Pode deixar, professora.', next: 'accepted', do: (g) => g.startQuest('pixies') },
          { text: 'Por que a senhora mesma não faz?', next: 'why' },
        ],
      },
      why: {
        text: 'Porque, jovem, estou corrigindo duzentas redações sobre como transformar besouros em botões. Agora, vá.',
        options: [{ text: 'Sim, professora!', next: 'accepted', do: (g) => g.startQuest('pixies') }],
      },
      accepted: {
        text: 'Estupefaça é a tecla 2. E, por Merlin, não acerte os colegas.',
        options: [bye],
      },
      remind: {
        text: (g) => `Diabretes imobilizados: ${g.flags.pixiesStunned} de 5. Não tenho o dia todo.`,
        options: [bye],
      },
      return: {
        text: 'Muito bem. Muito bem mesmo. E não conte ao Professor Dumbledore que eu disse "muito bem".',
        options: [{ text: 'Meus lábios estão selados.', end: true, do: (g) => g.completeQuest('pixies', 50) }],
      },
      after: {
        text: 'Um gato malhado na janela hoje de manhã? Que coincidência curiosa. Tenha um bom dia.',
        options: [bye],
      },
    },
  },

  snape: {
    start: (g) => (g.questState('quiz') === 'done' ? 'after' : 'intro'),
    nodes: {
      intro: {
        text: 'Ora, ora. Um aluno da {house} na minha masmorra. Veio aprender alguma coisa... ou apenas ocupar espaço?',
        options: [
          { text: 'Quero provar que sei Poções.', next: 'q1', do: (g) => g.startQuest('quiz') },
          { text: 'Só estou de passagem.', next: 'pass' },
        ],
      },
      pass: { text: 'Então passe. Rápido.', options: [{ text: '(Sair de fininho)', end: true }] },
      q1: {
        text: 'O que eu obteria se adicionasse raiz de asfódelo em pó a uma infusão de losna?',
        options: [
          { text: 'Poção Polissuco.', next: 'wrong' },
          { text: 'A Poção do Morto-Vivo.', next: 'q2' },
          { text: 'Uma dor de cabeça?', next: 'wrong' },
        ],
      },
      q2: {
        text: 'Hm. E onde você procuraria se eu lhe pedisse um bezoar?',
        options: [
          { text: 'No estômago de uma cabra.', next: 'q3' },
          { text: 'Na Gemialidades Weasley.', next: 'wrong' },
          { text: 'No bolso do Neville.', next: 'wrong' },
        ],
      },
      q3: {
        text: 'E qual é a diferença entre acônito lapelo e mata-lobos?',
        options: [
          { text: 'Um é veneno e o outro, antídoto.', next: 'wrong' },
          { text: 'Mata-lobos cura lobisomens.', next: 'wrong' },
          { text: 'Nenhuma: são a mesma planta.', next: 'win' },
        ],
      },
      wrong: {
        text: 'Errado. Cinco pontos a menos para a {house}. Volte quando tiver aberto um livro.',
        options: [{ text: '(Engolir em seco)', end: true, do: (g) => g.addPoints(-5, 'Resposta errada para Snape') }],
      },
      win: {
        text: (g) => (g.house === 'sonserina'
          ? '...Correto. Como era de se esperar de um sonserino. Cinquenta pontos para a Sonserina.'
          : '...Correto. Parece que nem todos da {house} são completamente inúteis. Cinquenta pontos.'),
        options: [{ text: 'Obrigado(a), professor.', end: true, do: (g) => g.completeQuest('quiz', 50) }],
      },
      after: {
        text: (g) => g.pick(['Não tenho mais nada a lhe dizer. Saia.', 'Sempre.', 'Se tocar em um único ingrediente do meu armário, será detenção por um mês.']),
        options: [bye],
      },
    },
  },

  nick: {
    start: () => 'intro',
    nodes: {
      intro: {
        text: 'Boa tarde! Sir Nicholas de Mimsy-Porpington, a seu dispor. Fantasma residente da Torre da Grifinória.',
        options: [
          { text: 'Por que te chamam de "Quase Sem Cabeça"?', next: 'head' },
          { text: 'Alguma dica sobre o castelo?', next: 'tip' },
          bye,
        ],
      },
      head: {
        text: 'Quarenta e cinco golpes com um machado cego, e ainda assim ela ficou presa por um fiapo de pele! Por isso não me deixam entrar no Clube dos Caçadores Sem Cabeça. Um absurdo!',
        options: [{ text: 'Que injustiça!', next: 'intro' }],
      },
      tip: {
        text: (g) => `Dizem que há ${g.cardsTotal} figurinhas de Sapo de Chocolate escondidas: no alto das torres, no campo de Quadribol, nas estufas, sob a mesa dos professores... e até na Floresta Proibida! Você já achou ${g.flags.cards}.`,
        options: [{ text: 'Vou procurar!', next: 'intro' }],
      },
    },
  },
};
