// ---------------------------------------------------------------------------
// Lumen Isles — open-world story, exploration and side quests
// ---------------------------------------------------------------------------
// All text is authored in Spanish first, with an English translation. The
// player's chosen language (localStorage: lumen-lang) is respected.

const LANGUAGES = ['es', 'en', 'pt', 'fr'];

export function currentLang() {
  try {
    const saved = localStorage.getItem('lumen-lang');
    if (LANGUAGES.includes(saved)) return saved;
  } catch { /* storage may be blocked */ }
  return 'es';
}

export function txt(value) {
  if (typeof value === 'string') return value;
  const lang = currentLang();
  return value[lang] || value.es || value.en || '';
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export const ZONES = [
  {
    id: 'sunmeadow', name: { es: 'Pradera del Sol', en: 'Sunmeadow' }, color: '#e7c95c',
    center: { x: 0, z: 6 }, radius: 24,
    lore: {
      es: 'El corazón abierto de las islas. Aquí empieza cada cuaderno de campo.',
      en: 'The open heart of the isles. Every field journal begins here.',
    },
  },
  {
    id: 'pond', name: { es: 'Estanque Susurrante', en: 'Whispering Pond' }, color: '#5fc7df',
    center: { x: 34, z: 30 }, radius: 22,
    lore: {
      es: 'El agua guarda voces antiguas. Al amanecer suenan como campanas bajo el musgo.',
      en: 'The water keeps old voices. At dawn they ring like bells beneath the moss.',
    },
  },
  {
    id: 'grove', name: { es: 'Bosque Ancestral', en: 'Ancient Grove' }, color: '#9be06e',
    center: { x: 0, z: -62 }, radius: 26,
    lore: {
      es: 'El santuario del Guardián Verde. Las raíces recuerdan a cada visitante.',
      en: 'The Verdant Guardian’s shrine. The roots remember every visitor.',
    },
  },
  {
    id: 'thicket', name: { es: 'Matorral del Oeste', en: 'West Thicket' }, color: '#75b36a',
    center: { x: -52, z: -10 }, radius: 26,
    lore: {
      es: 'Un laberinto de helechos y piedras que cantan cuando nadie mira.',
      en: 'A maze of ferns and stones that sing when no one is watching.',
    },
  },
  {
    id: 'bloomfield', name: { es: 'Campo de Flores', en: 'Bloomfield' }, color: '#f29bb5',
    center: { x: 8, z: 52 }, radius: 25,
    lore: {
      es: 'Flores imposibles brotan en hileras. Los jardineros juran que caminan de noche.',
      en: 'Impossible flowers grow in tidy rows. The gardeners swear they walk at night.',
    },
  },
  {
    id: 'cinder', name: { es: 'Hondonada de Brasas', en: 'Cinder Hollow' }, color: '#f08a52',
    center: { x: -26, z: -40 }, radius: 20,
    lore: {
      es: 'La tierra respira calor. Aquí se forjaron las primeras flautas.',
      en: 'The earth breathes heat. The first flutes were forged here.',
    },
  },
  {
    id: 'tide', name: { es: 'Costa de Vidrio', en: 'Tideglass Shore' }, color: '#6fded0',
    center: { x: 62, z: 8 }, radius: 22,
    lore: {
      es: 'El mar pule cristales que guardan un destello de cada amanecer.',
      en: 'The sea polishes crystals that hold a glint of every sunrise.',
    },
  },
  {
    id: 'moonrise', name: { es: 'Colina de la Luna', en: 'Moonrise Rise' }, color: '#a99aee',
    center: { x: -58, z: -48 }, radius: 22,
    lore: {
      es: 'La única colina donde la luna se queda un rato después del alba.',
      en: 'The one hill where the moon lingers a while after dawn.',
    },
  },
];

export function zoneAt(x, z) {
  let best = ZONES[0];
  let bestScore = Infinity;
  for (const zone of ZONES) {
    const d = Math.hypot(x - zone.center.x, z - zone.center.z);
    if (d <= zone.radius && d / zone.radius < bestScore) {
      best = zone;
      bestScore = d / zone.radius;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const NPCS = [
  {
    id: 'nima', profile: 'nima', name: { es: 'Nima, la Archivera', en: 'Nima the Archivist' },
    role: { es: 'Guía de la historia', en: 'Story guide' },
    x: 9.5, z: 11, defaultQuest: 'cartographer',
    lines: {
      es: [
        'Cada criatura que escuchas escribe una línea en el cuaderno del mundo. Yo solo ordeno las páginas.',
        'Hay ocho regiones en estas islas. Los antiguos faros guardan lo que cada una recuerda.',
      ],
      en: [
        'Every creature you hear writes a line in the world’s journal. I merely keep the pages in order.',
        'There are eight regions in these isles. The old waystones keep what each one remembers.',
      ],
    },
  },
  {
    id: 'lys', profile: 'lys', name: { es: 'Lys, la Pescadora', en: 'Lys the Angler' },
    role: { es: 'Guardiana del estanque', en: 'Keeper of the pond' },
    x: 38, z: 24, defaultQuest: 'deepSong',
    lines: {
      es: [
        'El estanque canta distinto cuando alguien necesita ayuda. Hoy suena… preocupado.',
        'Los Dropplet guardan piedras de colores. Si encuentras una, no se la quites: pregúntale su nombre.',
      ],
      en: [
        'The pond sings differently when someone needs help. Today it sounds… worried.',
        'Dropplets keep coloured stones. If you find one, don’t take it — ask its name.',
      ],
    },
  },
  {
    id: 'tilo', profile: 'tilo', name: { es: 'Tilo, el Jardinero', en: 'Tilo the Gardener' },
    role: { es: 'Cuidador de Bloomfield', en: 'Bloomfield caretaker' },
    x: 12, z: 44, defaultQuest: 'lostChimes',
    lines: {
      es: [
        'Planté un jardín para que las criaturas tuvieran donde dormir. Ahora las flores no duermen.',
        'Tres campanillas de viento se soltaron del invernadero. Sin su música, las semillas no germinan.',
      ],
      en: [
        'I planted a garden so creatures would have somewhere to sleep. Now the flowers refuse to sleep.',
        'Three wind chimes escaped the greenhouse. Without their music, the seeds won’t sprout.',
      ],
    },
  },
  {
    id: 'orin', profile: 'orin', name: { es: 'Orin, Guardián del Umbral', en: 'Orin, Threshold Warden' },
    role: { es: 'Vigía del santuario', en: 'Shrine watcher' },
    x: 6, z: -50, defaultQuest: 'echoStones',
    lines: {
      es: [
        'El Guardián no duerme: espera. Hay una diferencia, y los años me la han enseñado.',
        'Cuatro medallas abren las puertas del Coliseo. Cuatro raíces abren las del santuario.',
      ],
      en: [
        'The Guardian does not sleep: it waits. There is a difference, and the years have taught it to me.',
        'Four badges open the Colosseum gates. Four roots open the shrine’s.',
      ],
    },
  },
  {
    id: 'mica', profile: 'mica', name: { es: 'Mica, la Comerciante', en: 'Mica the Trader' },
    role: { es: 'Mercado y rumores', en: 'Market and rumours' },
    x: -10, z: 9, defaultQuest: 'shinyHunt',
    lines: {
      es: [
        'No pregunto de dónde vienen mis curiosidades. Tú tampoco deberías preguntar a dónde van.',
        'Un brillo distinto no es un error de la luz. Es una criatura presumiendo.',
      ],
      en: [
        'I don’t ask where my curios come from. You shouldn’t ask where they go.',
        'A different shimmer isn’t a trick of the light. It’s a creature showing off.',
      ],
    },
  },
  {
    id: 'sol', profile: 'sol', name: { es: 'Sol, la Exploradora', en: 'Sol the Pathfinder' },
    role: { es: 'Rastreadora del oeste', en: 'Western pathfinder' },
    x: -38, z: -6, defaultQuest: 'emberTrace',
    lines: {
      es: [
        'He cartografiado cada sendero del oeste. El único que no aparece dos veces es el de la Hondonada.',
        'Algo con patas de brasa pasa por aquí al anochecer. No deja huellas: deja ceniza tibia.',
      ],
      en: [
        'I’ve mapped every western trail. The only one that never repeats is the Hollow’s.',
        'Something with ember feet passes here at dusk. It leaves no tracks — only warm ash.',
      ],
    },
  },
  {
    id: 'keeper', profile: 'keeper', name: { es: 'Custodio Vero', en: 'Steward Vero' },
    role: { es: 'Maestro del Coliseo', en: 'Colosseum master' },
    x: 2, z: 39, defaultQuest: null,
    lines: {
      es: [
        'El Coliseo no corona al más fuerte, sino al que escucha mejor a su equipo.',
        'Trae una medalla y abriré las puertas. Trae un amigo y las abriremos juntos.',
      ],
      en: [
        'The Colosseum doesn’t crown the strongest. It crowns the one who listens best to their team.',
        'Bring one badge and I’ll open the gates. Bring a friend and we’ll open them together.',
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Main story
// ---------------------------------------------------------------------------

export const MAIN_CHAPTERS = [
  {
    id: 'blankJournal',
    title: { es: 'El cuaderno en blanco', en: 'The Blank Journal' },
    desc: {
      es: 'Nima dice que el mundo solo recuerda a quien lo escucha. Hazte amigo de tres criaturas distintas y vuelve a hablar con ella.',
      en: 'Nima says the world only remembers those who listen. Befriend three different creatures, then speak with her again.',
    },
    objectives: [
      { type: 'caught', count: 3 },
      { type: 'talk', npcs: ['nima'] },
    ],
    reward: { lumen: 120, potions: 2 },
  },
  {
    id: 'fourSeals',
    title: { es: 'Los cuatro sellos', en: 'The Four Seals' },
    desc: {
      es: 'Cuatro gimnasios guardan las llaves del santuario. Consigue dos medallas y activa el faro de cuatro regiones.',
      en: 'Four gyms guard the shrine’s keys. Earn two badges and light the waystone of four regions.',
    },
    objectives: [
      { type: 'badges', count: 2 },
      { type: 'zones', count: 4 },
      { type: 'talk', npcs: ['orin'] },
    ],
    reward: { lumen: 220, potions: 3, resonance: 0.02 },
  },
  {
    id: 'guardian',
    title: { es: 'El Guardián Verde', en: 'The Verdant Guardian' },
    desc: {
      es: 'El santuario del norte ha despertado. Vence al Guardián para que el bosque vuelva a respirar… y descubre qué hay detrás de su silencio.',
      en: 'The northern shrine has woken. Defeat the Guardian so the grove can breathe again… and discover what lies behind its silence.',
    },
    objectives: [{ type: 'boss' }],
    reward: { lumen: 300, potions: 3, skin: 'starcrown' },
  },
  {
    id: 'dawnShards',
    title: { es: 'Fragmentos del primer alba', en: 'Shards of the First Dawn' },
    desc: {
      es: 'El Guardián era solo la primera puerta. Tres fragmentos del alba cayeron en las islas; actívalos y reúne cuatro medallas.',
      en: 'The Guardian was only the first door. Three dawn shards fell across the isles; wake them and collect four badges.',
    },
    objectives: [
      { type: 'landmarks', ids: ['shardWest', 'shardTide', 'shardCinder'] },
      { type: 'badges', count: 4 },
    ],
    reward: { lumen: 420, potions: 5, skin: 'moonweave-mantle' },
  },
  {
    id: 'moonAndSun',
    title: { es: 'La luna y el sol', en: 'The Moon and the Sun' },
    desc: {
      es: 'Lunari camina solo bajo la luna. Solaris desciende solo cuando el bosque está en paz. Hazte amigo de ambos y vuelve a Nima.',
      en: 'Lunari walks only under the moon. Solaris descends only when the grove is at peace. Befriend both, then return to Nima.',
    },
    objectives: [
      { type: 'species', ids: ['lunari', 'solaris'] },
      { type: 'talk', npcs: ['nima'] },
    ],
    reward: { lumen: 600, potions: 6, resonance: 0.04 },
  },
  {
    id: 'worldRemembers',
    title: { es: 'El mundo recuerda', en: 'The World Remembers' },
    desc: {
      es: 'Reúne a las diez especies, completa cuatro historias secundarias y celebra el ritual en el santuario. Entonces el cuaderno será de todos.',
      en: 'Gather all ten species, finish four side stories, and hold the ritual at the shrine. Then the journal will belong to everyone.',
    },
    objectives: [
      { type: 'allSpecies' },
      { type: 'sideDone', count: 4 },
      { type: 'landmarks', ids: ['shardWest', 'shardTide', 'shardCinder'] },
    ],
    reward: { lumen: 1000, potions: 10, skin: 'founder-crown', resonance: 0.05 },
  },
];

// ---------------------------------------------------------------------------
// Side quests
// ---------------------------------------------------------------------------

export const SIDE_QUESTS = [
  {
    id: 'lostChimes', giver: 'tilo',
    title: { es: 'Las campanillas perdidas', en: 'The Lost Chimes' },
    desc: {
      es: 'Tres campanillas de viento cayeron entre las flores de Bloomfield. Devuélvelas al jardín.',
      en: 'Three wind chimes fell among Bloomfield’s flowers. Return them to the garden.',
    },
    objectives: [{ type: 'landmarks', ids: ['chimeA', 'chimeB', 'chimeC'] }],
    reward: { lumen: 180, potions: 3 },
  },
  {
    id: 'deepSong', giver: 'lys',
    title: { es: 'La canción del fondo', en: 'The Deep Song' },
    desc: {
      es: 'Lys oye una nota triste bajo el estanque. Hazte amigo de un Dropplet y escucha lo que sabe.',
      en: 'Lys hears a sad note beneath the pond. Befriend a Dropplet and listen to what it knows.',
    },
    objectives: [{ type: 'species', ids: ['dropplet'] }],
    reward: { lumen: 200, potions: 2 },
  },
  {
    id: 'echoStones', giver: 'orin',
    title: { es: 'Piedras que cantan', en: 'Stones That Sing' },
    desc: {
      es: 'Tres piedras de eco rodean el santuario. Tócalas en cualquier orden y escucha su respuesta.',
      en: 'Three echo stones surround the shrine. Touch them in any order and listen for their answer.',
    },
    objectives: [{ type: 'landmarks', ids: ['echoA', 'echoB', 'echoC'] }],
    reward: { lumen: 260, potions: 3, resonance: 0.02 },
  },
  {
    id: 'nightWatch', giver: 'nima',
    title: { es: 'Vigilia de luna', en: 'Moonwatch' },
    desc: {
      es: 'Nima quiere registrar a Lunari. Espera a la noche y hazte amigo de la zorra de la luna.',
      en: 'Nima wants to record Lunari. Wait for night and befriend the moon-fox.',
    },
    objectives: [{ type: 'species', ids: ['lunari'] }],
    reward: { lumen: 340, potions: 4 },
  },
  {
    id: 'shinyHunt', giver: 'mica',
    title: { es: 'Un brillo distinto', en: 'A Different Shimmer' },
    desc: {
      es: 'Mica pagará bien por ver una criatura variocolor. Cada una es única en el mundo.',
      en: 'Mica pays well to see a shiny creature. Every single one is unique in the world.',
    },
    objectives: [{ type: 'shiny', count: 1 }],
    reward: { lumen: 500, potions: 3, resonance: 0.03 },
  },
  {
    id: 'emberTrace', giver: 'sol',
    title: { es: 'Rastro de brasas', en: 'Ember Trace' },
    desc: {
      es: 'Sol encontró ceniza tibia en la Hondonada. Sigue el rastro y hazte amigo de un Emberpup.',
      en: 'Sol found warm ash in the Hollow. Follow the trail and befriend an Emberpup.',
    },
    objectives: [{ type: 'species', ids: ['emberpup'] }],
    reward: { lumen: 220, potions: 2 },
  },
  {
    id: 'cartographer', giver: 'nima',
    title: { es: 'La octava región', en: 'The Eighth Region' },
    desc: {
      es: 'Activa los ocho faros de las islas. Nima quiere completar su mapa antes del ritual.',
      en: 'Light all eight waystones. Nima wants her map finished before the ritual.',
    },
    objectives: [{ type: 'zones', count: 8 }],
    reward: { lumen: 300, potions: 4, resonance: 0.02 },
  },
  {
    id: 'colosseumCrown', giver: 'keeper',
    title: { es: 'La corona del Coliseo', en: 'The Colosseum Crown' },
    desc: {
      es: 'Gana un duelo contra otro jugador en el Coliseo. La corona solo se hereda entre rivales.',
      en: 'Win a duel against another player in the Colosseum. The crown passes only between rivals.',
    },
    objectives: [{ type: 'pvpWins', count: 1 }],
    reward: { lumen: 700, potions: 5, skin: 'patron-ring' },
  },
  {
    id: 'firstFriend', giver: 'mica',
    title: { es: 'Seis amigos, una historia', en: 'Six Friends, One Story' },
    desc: {
      es: 'Mica dice que seis especies bastan para que una isla deje de estar sola.',
      en: 'Mica says six species are enough to make an island stop feeling alone.',
    },
    objectives: [{ type: 'caught', count: 6 }],
    reward: { lumen: 180, potions: 2 },
  },
];

// ---------------------------------------------------------------------------
// Exploration landmarks
// ---------------------------------------------------------------------------

export const LANDMARKS = [
  {
    id: 'waySun', kind: 'waystone', zone: 'sunmeadow',
    name: { es: 'Faro de la Pradera', en: 'Meadow Waystone' },
    x: -12, z: 18,
    lore: { es: 'La primera luz del día se guarda aquí desde antes de que hubiera nombres.', en: 'The day’s first light has been kept here since before there were names.' },
  },
  {
    id: 'wayPond', kind: 'waystone', zone: 'pond',
    name: { es: 'Faro del Estanque', en: 'Pond Waystone' },
    x: 47, z: 34,
    lore: { es: 'Quien toca el faro huele a lluvia limpia durante un día entero.', en: 'Anyone who touches the stone smells clean rain for a whole day.' },
  },
  {
    id: 'wayGrove', kind: 'waystone', zone: 'grove',
    name: { es: 'Faro del Bosque', en: 'Grove Waystone' },
    x: -13, z: -57,
    lore: { es: 'El Guardián respondió una vez a este faro. Su voz tardó tres inviernos en volver.', en: 'The Guardian once answered this stone. Its voice took three winters to return.' },
  },
  {
    id: 'wayThicket', kind: 'waystone', zone: 'thicket',
    name: { es: 'Faro del Matorral', en: 'Thicket Waystone' },
    x: -50, z: 3,
    lore: { es: 'Las ramas se apartaron para dejarlo caer. Nunca volvieron a cerrarse.', en: 'The branches parted to let it fall. They never closed again.' },
  },
  {
    id: 'wayBloom', kind: 'waystone', zone: 'bloomfield',
    name: { es: 'Faro de las Flores', en: 'Bloom Waystone' },
    x: 20, z: 58,
    lore: { es: 'Poliniza recuerdos. Por eso las flores de este campo huelen a infancia.', en: 'It pollinates memories. That is why this field’s flowers smell like childhood.' },
  },
  {
    id: 'wayCinder', kind: 'waystone', zone: 'cinder',
    name: { es: 'Faro de Brasas', en: 'Cinder Waystone' },
    x: -31, z: -33,
    lore: { es: 'Sigue caliente. Los herreros de flautas lo usaban para templar la plata.', en: 'Still warm. Flute-smiths once used it to temper silver.' },
  },
  {
    id: 'wayTide', kind: 'waystone', zone: 'tide',
    name: { es: 'Faro de Vidrio', en: 'Glass Waystone' },
    x: 63, z: 21,
    lore: { es: 'Un cristal por cada amanecer que el mar ha visto. Hay más de los que caben.', en: 'One crystal for every sunrise the sea has seen. There are more than fit.' },
  },
  {
    id: 'wayMoon', kind: 'waystone', zone: 'moonrise',
    name: { es: 'Faro de la Luna', en: 'Moon Waystone' },
    x: -60, z: -40,
    lore: { es: 'De día está frío. De noche guarda el calor de una mano que ya no está.', en: 'By day it is cold. At night it keeps the warmth of a hand that is gone.' },
  },
  {
    id: 'shardWest', kind: 'shard', zone: 'thicket',
    name: { es: 'Fragmento del Alba I', en: 'Dawn Shard I' },
    x: -40, z: -22,
    lore: { es: 'El primer fragmento canta con la voz de todas las hojas a la vez.', en: 'The first shard sings with the voice of every leaf at once.' },
  },
  {
    id: 'shardTide', kind: 'shard', zone: 'tide',
    name: { es: 'Fragmento del Alba II', en: 'Dawn Shard II' },
    x: 56, z: 2,
    lore: { es: 'El segundo fragmento muestra un amanecer que aún no ha ocurrido.', en: 'The second shard shows a sunrise that has not happened yet.' },
  },
  {
    id: 'shardCinder', kind: 'shard', zone: 'cinder',
    name: { es: 'Fragmento del Alba III', en: 'Dawn Shard III' },
    x: -19, z: -48,
    lore: { es: 'El tercer fragmento está tibio, como si acabara de nacer.', en: 'The third shard is warm, as if it had just been born.' },
  },
  {
    id: 'chimeA', kind: 'chime', zone: 'bloomfield',
    name: { es: 'Campanilla de ámbar', en: 'Amber Chime' },
    x: 2, z: 55,
    lore: { es: 'Suena a risa de niño. Tilo la reconocerá.', en: 'It sounds like a child’s laugh. Tilo will know it.' },
  },
  {
    id: 'chimeB', kind: 'chime', zone: 'bloomfield',
    name: { es: 'Campanilla de jade', en: 'Jade Chime' },
    x: 18, z: 48,
    lore: { es: 'Suena a lluvia sobre un tejado de hojas.', en: 'It sounds like rain on a roof of leaves.' },
  },
  {
    id: 'chimeC', kind: 'chime', zone: 'bloomfield',
    name: { es: 'Campanilla de coral', en: 'Coral Chime' },
    x: 25, z: 60,
    lore: { es: 'Suena a despedida, pero no a una triste.', en: 'It sounds like a goodbye, but not a sad one.' },
  },
  {
    id: 'echoA', kind: 'echo', zone: 'grove',
    name: { es: 'Piedra de eco I', en: 'Echo Stone I' },
    x: -8, z: -51,
    lore: { es: 'Repite el último paso de quien la tocó.', en: 'It repeats the last footstep of whoever touched it.' },
  },
  {
    id: 'echoB', kind: 'echo', zone: 'grove',
    name: { es: 'Piedra de eco II', en: 'Echo Stone II' },
    x: 10, z: -55,
    lore: { es: 'Guarda una canción de cuna en una lengua que ya nadie habla.', en: 'It keeps a lullaby in a language no one speaks anymore.' },
  },
  {
    id: 'echoC', kind: 'echo', zone: 'grove',
    name: { es: 'Piedra de eco III', en: 'Echo Stone III' },
    x: 2, z: -61,
    lore: { es: 'Cuando las tres suenan juntas, el santuario recuerda su nombre.', en: 'When the three ring together, the shrine remembers its name.' },
  },
];

export const LANDMARK_IDS = LANDMARKS.map((l) => l.id);

export function landmarkById(id) {
  return LANDMARKS.find((l) => l.id === id) || null;
}

export function sideQuestById(id) {
  return SIDE_QUESTS.find((q) => q.id === id) || null;
}

export function npcById(id) {
  return NPCS.find((n) => n.id === id) || null;
}

export function mainChapter(index) {
  return MAIN_CHAPTERS[Math.max(0, Math.min(MAIN_CHAPTERS.length - 1, index))] || null;
}

// ---------------------------------------------------------------------------
// Objective evaluation
// ---------------------------------------------------------------------------

export function objectiveDone(objective, ctx) {
  if (!objective || !ctx) return false;
  switch (objective.type) {
    case 'caught':
      return (ctx.caught?.length || 0) >= objective.count;
    case 'talk':
      return (objective.npcs || []).every((id) => ctx.talked?.includes(id));
    case 'zones':
      return (ctx.zones?.length || 0) >= objective.count;
    case 'badges':
      return (ctx.badges?.length || 0) >= objective.count;
    case 'boss':
      return !!ctx.bossDefeated;
    case 'landmarks':
      return (objective.ids || []).every((id) => ctx.landmarks?.includes(id));
    case 'species':
      return (objective.ids || []).every((id) => ctx.caught?.includes(id));
    case 'allSpecies':
      return (ctx.caught?.length || 0) >= (ctx.speciesCount || 10);
    case 'sideDone':
      return (ctx.sideDone?.length || 0) >= objective.count;
    case 'shiny':
      return (ctx.shinyFound || 0) >= (objective.count || 1);
    case 'pvpWins':
      return (ctx.pvpWins || 0) >= (objective.count || 1);
    default:
      return false;
  }
}

function listNames(ids, ctx) {
  const lang = currentLang();
  return ids.map((id) => {
    const npc = npcById(id);
    if (npc) return txt(npc.name);
    const lm = landmarkById(id);
    if (lm) return txt(lm.name);
    const mon = ctx?.speciesNames?.[id];
    if (mon) return typeof mon === 'string' ? mon : txt(mon);
    return id;
  }).join(', ');
}

export function objectiveLabel(objective, ctx = {}) {
  const lang = currentLang();
  const es = lang === 'es';
  switch (objective.type) {
    case 'caught':
      return es
        ? `Amigos distintos: ${Math.min(ctx.caught?.length || 0, objective.count)} / ${objective.count}`
        : `Different friends: ${Math.min(ctx.caught?.length || 0, objective.count)} / ${objective.count}`;
    case 'talk':
      return es
        ? `Habla con: ${listNames(objective.npcs || [], ctx)}`
        : `Talk to: ${listNames(objective.npcs || [], ctx)}`;
    case 'zones':
      return es
        ? `Regiones descubiertas: ${Math.min(ctx.zones?.length || 0, objective.count)} / ${objective.count}`
        : `Regions discovered: ${Math.min(ctx.zones?.length || 0, objective.count)} / ${objective.count}`;
    case 'badges':
      return es
        ? `Medallas de gimnasio: ${Math.min(ctx.badges?.length || 0, objective.count)} / ${objective.count}`
        : `Gym badges: ${Math.min(ctx.badges?.length || 0, objective.count)} / ${objective.count}`;
    case 'boss':
      return es ? 'Vence al Guardián Verde' : 'Defeat the Verdant Guardian';
    case 'landmarks':
      return es
        ? `Lugares activados: ${(objective.ids || []).filter((id) => ctx.landmarks?.includes(id)).length} / ${(objective.ids || []).length}`
        : `Places awakened: ${(objective.ids || []).filter((id) => ctx.landmarks?.includes(id)).length} / ${(objective.ids || []).length}`;
    case 'species':
      return es
        ? `Especies aliadas: ${listNames(objective.ids || [], ctx)}`
        : `Allied species: ${listNames(objective.ids || [], ctx)}`;
    case 'allSpecies':
      return es
        ? `Especies registradas: ${Math.min(ctx.caught?.length || 0, ctx.speciesCount || 10)} / ${ctx.speciesCount || 10}`
        : `Species recorded: ${Math.min(ctx.caught?.length || 0, ctx.speciesCount || 10)} / ${ctx.speciesCount || 10}`;
    case 'sideDone':
      return es
        ? `Historias secundarias: ${Math.min(ctx.sideDone?.length || 0, objective.count)} / ${objective.count}`
        : `Side stories: ${Math.min(ctx.sideDone?.length || 0, objective.count)} / ${objective.count}`;
    case 'shiny':
      return es ? 'Encuentra una criatura variocolor' : 'Find a shiny creature';
    case 'pvpWins':
      return es ? 'Gana un duelo en el Coliseo' : 'Win a duel in the Colosseum';
    default:
      return '';
  }
}

export function sideQuestAvailable(quest, ctx) {
  if (ctx.sideDone?.includes(quest.id)) return false;
  if (ctx.sideActive?.includes(quest.id)) return true;
  if (quest.id === 'colosseumCrown') return (ctx.badges?.length || 0) >= 1;
  if (quest.id === 'nightWatch') return !!ctx.bossDefeated;
  return true;
}

export function sideQuestComplete(quest, ctx) {
  return (quest.objectives || []).every((o) => objectiveDone(o, ctx));
}
