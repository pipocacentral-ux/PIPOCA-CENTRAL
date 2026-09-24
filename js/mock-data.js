/* ==========================================================================
   PipocaCentral — Mock data
   Dados ILUSTRATIVOS, no lugar do Firestore, só pra este protótipo de
   front-end. Em produção isso vem das coleções descritas na Seção 7.5
   (movies, series, people, news...) via renderização no servidor (6.2).
   Sinopses e biografias abaixo são texto original, escrito para este
   protótipo — não copiadas de nenhuma fonte.
   ========================================================================== */

const MOVIES = [
  { slug: "duna-parte-dois", title: "Duna: Parte Dois", year: 2024, genres: ["Ficção científica", "Aventura"], duration: "2h 46min", rating: "14 anos", director: "Denis Villeneuve", cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson", "Javier Bardem"], synopsis: "Paul Atreides se une aos Fremen no deserto de Arrakis numa jornada que mistura vingança e um futuro que ele teme enxergar com clareza demais.", ratingAvg: 4.6, ratingCount: 3210, platforms: ["HBO Max", "Prime Video"], color: ["#3a2f13", "#171821"] },
  { slug: "oppenheimer", title: "Oppenheimer", year: 2023, genres: ["Drama", "Biografia"], duration: "3h 0min", rating: "16 anos", director: "Christopher Nolan", cast: ["Cillian Murphy", "Emily Blunt", "Robert Downey Jr."], synopsis: "A trajetória do físico J. Robert Oppenheimer, do projeto que criou a bomba atômica ao peso moral que carregou depois disso.", ratingAvg: 4.7, ratingCount: 5480, platforms: ["Prime Video", "Apple TV"], color: ["#2a1414", "#171821"] },
  { slug: "pobres-criaturas", title: "Pobres Criaturas", year: 2023, genres: ["Comédia", "Fantasia"], duration: "2h 21min", rating: "18 anos", director: "Yorgos Lanthimos", cast: ["Emma Stone", "Mark Ruffalo", "Willem Dafoe"], synopsis: "Trazida de volta à vida por um cientista excêntrico, Bella Baxter decide descobrir o mundo — e a si mesma — sem pedir licença a ninguém.", ratingAvg: 4.4, ratingCount: 1870, platforms: ["Star+"], color: ["#1c2e3a", "#171821"] },
  { slug: "divertida-mente-2", title: "Divertida Mente 2", year: 2024, genres: ["Animação", "Família"], duration: "1h 36min", rating: "Livre", director: "Kelsey Mann", cast: ["Amy Poehler", "Maya Hawke"], synopsis: "Com a adolescência batendo à porta, novas emoções chegam à central de comando de Riley e bagunçam tudo o que Alegria tinha sob controle.", ratingAvg: 4.5, ratingCount: 4120, platforms: ["Disney+"], color: ["#3a1c2e", "#171821"] },
  { slug: "wicked", title: "Wicked", year: 2024, genres: ["Musical", "Fantasia"], duration: "2h 40min", rating: "10 anos", director: "Jon M. Chu", cast: ["Cynthia Erivo", "Ariana Grande"], synopsis: "Antes de virar a Bruxa Má do Oeste, Elphaba era só uma garota tentando entender por que o mundo tinha tanto medo dela.", ratingAvg: 4.3, ratingCount: 990, platforms: ["Cinema"], color: ["#1c3a1e", "#171821"] },
  { slug: "anatomia-de-uma-queda", title: "Anatomia de uma Queda", year: 2023, genres: ["Drama", "Suspense"], duration: "2h 32min", rating: "14 anos", director: "Justine Triet", cast: ["Sandra Hüller", "Swann Arlaud"], synopsis: "Depois da morte do marido, Sandra vira suspeita principal — e o julgamento vasculha cada racha silencioso do casamento dos dois.", ratingAvg: 4.5, ratingCount: 1340, platforms: ["Mubi"], color: ["#2e2e2e", "#171821"] },
  { slug: "o-menino-e-a-garca", title: "O Menino e a Garça", year: 2023, genres: ["Animação", "Fantasia"], duration: "2h 4min", rating: "12 anos", director: "Hayao Miyazaki", cast: ["Soma Santoki", "Masaki Suda"], synopsis: "Depois de perder a mãe, Mahito segue uma garça falante até um mundo onde os vivos e os mortos se confundem.", ratingAvg: 4.6, ratingCount: 2050, platforms: ["Max"], color: ["#153a2e", "#171821"] },
  { slug: "barbie", title: "Barbie", year: 2023, genres: ["Comédia", "Fantasia"], duration: "1h 54min", rating: "12 anos", director: "Greta Gerwig", cast: ["Margot Robbie", "Ryan Gosling"], synopsis: "Um dia ruim demais na Terra dos Brinquedos manda Barbie pro mundo real — e nada mais faz o mesmo sentido de antes.", ratingAvg: 4.2, ratingCount: 6100, platforms: ["Max"], color: ["#3a1c34", "#171821"] },
];

const SERIES = [
  { slug: "round-6", title: "Round 6", years: "2021–", seasons: 2, status: "Em exibição", genres: ["Suspense", "Drama"], creators: ["Hwang Dong-hyuk"], cast: ["Lee Jung-jae", "Park Hae-soo"], synopsis: "Centenas de pessoas endividadas aceitam competir em jogos infantis com um detalhe: quem perde, não sai vivo.", ratingAvg: 4.4, ratingCount: 2870, platforms: ["Netflix"], color: ["#3a1414", "#171821"] },
  { slug: "the-bear", title: "The Bear", years: "2022–", seasons: 3, status: "Em exibição", genres: ["Comédia", "Drama"], creators: ["Christopher Storer"], cast: ["Jeremy Allen White", "Ayo Edebiri"], synopsis: "Carmy volta pra Chicago pra tocar o restaurante da família — e o caos da cozinha vira também o caos de lidar com o próprio luto.", ratingAvg: 4.6, ratingCount: 1420, platforms: ["Star+"], color: ["#2e2414", "#171821"] },
  { slug: "succession", title: "Succession", years: "2018–2023", seasons: 4, status: "Finalizada", genres: ["Drama"], creators: ["Jesse Armstrong"], cast: ["Brian Cox", "Jeremy Strong", "Sarah Snook"], synopsis: "Os filhos de um magnata da mídia disputam, sem nenhuma piedade entre si, quem vai herdar o império do pai.", ratingAvg: 4.7, ratingCount: 3980, platforms: ["Max"], color: ["#14202e", "#171821"] },
  { slug: "xogum", title: "Xógum", years: "2024", seasons: 1, status: "Finalizada", genres: ["Drama", "Histórico"], creators: ["Rachel Kondo", "Justin Marks"], cast: ["Hiroyuki Sanada", "Anna Sawai"], synopsis: "No Japão feudal, um navegador inglês naufragado se vê no centro de uma disputa de poder que pode mudar o país inteiro.", ratingAvg: 4.7, ratingCount: 1650, platforms: ["Disney+"], color: ["#2e1c14", "#171821"] },
];

const PEOPLE = [
  { slug: "timothee-chalamet", name: "Timothée Chalamet", role: "Ator", nationality: "Estados Unidos / França", born: "1995", bio: "Ator conhecido por papéis que misturam fragilidade e intensidade, com trabalhos em produções autorais e grandes blockbusters de ficção científica.", knownFor: ["duna-parte-dois"], color: ["#2b2140", "#171821"] },
  { slug: "emma-stone", name: "Emma Stone", role: "Atriz", nationality: "Estados Unidos", born: "1988", bio: "Vencedora de prêmios importantes da indústria, conhecida por trânsitar entre comédia e drama com a mesma naturalidade.", knownFor: ["pobres-criaturas"], color: ["#402121", "#171821"] },
  { slug: "cillian-murphy", name: "Cillian Murphy", role: "Ator", nationality: "Irlanda", born: "1976", bio: "Ator irlandês com uma presença de tela reconhecível, frequente colaborador de produções que exigem intensidade contida.", knownFor: ["oppenheimer"], color: ["#213340", "#171821"] },
  { slug: "zendaya", name: "Zendaya", role: "Atriz", nationality: "Estados Unidos", born: "1996", bio: "Atriz que se firmou tanto em produções de grande escala de ficção científica quanto em dramas televisivos aclamados.", knownFor: ["duna-parte-dois"], color: ["#402136", "#171821"] },
];

const NEWS = [
  { slug: "guia-ficcao-cientifica", title: "5 filmes de ficção científica para maratonar no fim de semana", category: "Listas", date: "2026-09-18", author: "Equipe PipocaCentral", excerpt: "Uma seleção pra quem quer viajar por mundos, tempos e possibilidades sem sair do sofá.", color: ["#14202e", "#171821"] },
  { slug: "trilhas-sonoras-marcantes", title: "Como as trilhas sonoras marcam o cinema", category: "Bastidores", date: "2026-09-15", author: "Equipe PipocaCentral", excerpt: "Por que algumas composições continuam na nossa cabeça muito depois dos créditos subirem.", color: ["#2e1c14", "#171821"] },
  { slug: "guia-classicos-mundiais", title: "Por onde começar a assistir clássicos do cinema mundial", category: "Guia", date: "2026-09-10", author: "Equipe PipocaCentral", excerpt: "Um roteiro de entrada pra quem quer sair do algoritmo e conhecer outras cinematografias.", color: ["#1c2e3a", "#171821"] },
];

/* Ajuda a variar o gradiente de cada card "pôster" sem precisar de imagem real */
function applyCardColor(el, color) {
  if (!color) return;
  el.style.setProperty("--poster-a", color[0]);
  el.style.setProperty("--poster-b", color[1]);
}
