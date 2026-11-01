// NEXO: Guardianes de Vértice — game data
// All content is original and generated locally for the browser build.

export const ELEMENTS = {
  fuego:   { name: 'Fuego',   icon: '🔥', color: '#ff6b3d', soft: '#ffb36b', strong: ['planta', 'hielo', 'veneno'], weak: ['agua', 'tierra'] },
  agua:    { name: 'Agua',    icon: '💧', color: '#38bdf8', soft: '#9de5ff', strong: ['fuego', 'tierra'], weak: ['planta', 'rayo'] },
  planta:  { name: 'Planta',  icon: '🌿', color: '#5fd36f', soft: '#b8f3a8', strong: ['agua', 'tierra'], weak: ['fuego', 'hielo', 'veneno'] },
  rayo:    { name: 'Rayo',    icon: '⚡', color: '#facc15', soft: '#fff2a8', strong: ['agua', 'aire'], weak: ['tierra', 'planta'] },
  sombra:  { name: 'Sombra',  icon: '🌑', color: '#a78bfa', soft: '#d8ccff', strong: ['luz', 'sombra'], weak: ['luz'] },
  luz:     { name: 'Luz',     icon: '✦', color: '#fde68a', soft: '#fffbe0', strong: ['sombra', 'veneno'], weak: ['sombra'] },
  tierra:  { name: 'Tierra',  icon: '⛰', color: '#d6a25e', soft: '#f3d4a2', strong: ['fuego', 'rayo', 'veneno'], weak: ['agua', 'planta', 'hielo'] },
  aire:    { name: 'Aire',    icon: '🌀', color: '#7dd3fc', soft: '#d3f2ff', strong: ['planta', 'tierra'], weak: ['rayo', 'hielo'] },
  hielo:   { name: 'Hielo',   icon: '❄', color: '#bae6fd', soft: '#ecfaff', strong: ['planta', 'aire', 'tierra'], weak: ['fuego', 'rayo'] },
  veneno:  { name: 'Veneno',  icon: '☠', color: '#c084fc', soft: '#e6d4ff', strong: ['planta', 'luz'], weak: ['tierra', 'fuego'] },
}

export const RARITIES = {
  comun:      { name: 'Común',      color: '#aebdca', aura: 'rgba(174,189,202,.25)', mult: 1.00, stars: 1, catch: 1.00 },
  poco:       { name: 'Poco común', color: '#6ee7b7', aura: 'rgba(110,231,183,.24)', mult: 1.07, stars: 2, catch: 0.86 },
  raro:       { name: 'Raro',       color: '#60a5fa', aura: 'rgba(96,165,250,.26)', mult: 1.15, stars: 3, catch: 0.72 },
  epico:      { name: 'Épico',      color: '#c084fc', aura: 'rgba(192,132,252,.28)', mult: 1.25, stars: 4, catch: 0.52 },
  legendario: { name: 'Legendario', color: '#fbbf24', aura: 'rgba(251,191,36,.30)', mult: 1.40, stars: 5, catch: 0.32 },
  mitico:     { name: 'Mítico',     color: '#fb7185', aura: 'rgba(251,113,133,.32)', mult: 1.50, stars: 6, catch: 0.18 },
}

export const TRAPS = [
  { id: 'fibra',   name: 'Trampa de Fibra',   icon: '🕸', tier: 1, cost: 45,  bonus: 0.12, color: '#aebdca', desc: 'Para criaturas comunes y niveles bajos. Frágil, pero barata.' },
  { id: 'runa',    name: 'Trampa Rúnica',     icon: '◈', tier: 2, cost: 130, bonus: 0.27, color: '#6ee7b7', desc: 'Grabados de contención. Eficaz contra criaturas poco comunes y raras.' },
  { id: 'prisma',  name: 'Trampa Prisma',     icon: '◇', tier: 3, cost: 310, bonus: 0.43, color: '#60a5fa', desc: 'Cristal de espectro completo. Recomendada para criaturas raras.' },
  { id: 'nexo',    name: 'Sello del Nexo',    icon: '✧', tier: 4, cost: 720, bonus: 0.60, color: '#c084fc', desc: 'Ancla la esencia al plano. Diseñada para criaturas épicas.' },
  { id: 'celestial', name: 'Sello Celestial', icon: '❖', tier: 5, cost: 1500, bonus: 0.78, color: '#fbbf24', desc: 'Reliquia de los guardianes. La única opción seria para leyendas.' },
]

export const SUPPORT_MOVES = {
  fortaleza: { name: 'Fortaleza', kind: 'buff', stat: 'def', amount: 0.28, turns: 3, cost: 8, desc: 'Aumenta la defensa un 28% durante 3 turnos.', icon: '🛡' },
  furia:     { name: 'Furia',     kind: 'buff', stat: 'atk', amount: 0.28, turns: 3, cost: 8, desc: 'Aumenta el ataque un 28% durante 3 turnos.', icon: '⚔' },
  brisa:     { name: 'Brisa Veloz', kind: 'buff', stat: 'spd', amount: 0.30, turns: 3, cost: 7, desc: 'Aumenta la velocidad un 30% durante 3 turnos.', icon: '💨' },
  sanacion:  { name: 'Sanación',  kind: 'heal', amount: 0.28, cost: 12, desc: 'Restaura un 28% de la salud máxima.', icon: '✚' },
  drenaje:   { name: 'Drenaje',   kind: 'drain', power: 48, cost: 12, desc: 'Ataca y recupera la mitad del daño infligido.', icon: '🩸' },
  marca:     { name: 'Marca Débil', kind: 'debuff', stat: 'def', amount: -0.25, turns: 3, cost: 8, desc: 'Reduce la defensa del rival un 25%.', icon: '◎' },
  niebla:    { name: 'Niebla Mental', kind: 'debuff', stat: 'atk', amount: -0.25, turns: 3, cost: 8, desc: 'Reduce el ataque del rival un 25%.', icon: '☁' },
  escudo:    { name: 'Escudo Prisma', kind: 'shield', amount: 0.22, turns: 3, cost: 10, desc: 'Crea una barrera que absorbe el 22% del daño.', icon: '◇' },
}

const ELEMENT_POOL = {
  fuego: [
    { name: 'Ascua', power: 38, cost: 4, acc: 100, desc: 'Una chispa ardiente que nunca falla.' },
    { name: 'Llamarada', power: 64, cost: 9, acc: 95, desc: 'Una columna de fuego concentrado.' },
    { name: 'Furia Solar', power: 88, cost: 15, acc: 90, desc: 'Quema el aire alrededor del objetivo.' },
    { name: 'Aliento Ígneo', power: 112, cost: 22, acc: 86, desc: 'Un torrente de magma vivo.' },
    { name: 'Volcán Interior', power: 140, cost: 32, acc: 82, desc: 'Despierta el corazón de un volcán.' },
  ],
  agua: [
    { name: 'Chorro', power: 38, cost: 4, acc: 100, desc: 'Un disparo de agua a presión.' },
    { name: 'Marea', power: 64, cost: 9, acc: 95, desc: 'Una ola que arrastra al rival.' },
    { name: 'Tsunami', power: 88, cost: 15, acc: 90, desc: 'El océano entero se alza.' },
    { name: 'Fosa Abisal', power: 112, cost: 22, acc: 86, desc: 'Arrastra al rival a la presión del abismo.' },
    { name: 'Diluvio Primigenio', power: 140, cost: 32, acc: 82, desc: 'Lluvia de un mundo anterior.' },
  ],
  planta: [
    { name: 'Latigazo', power: 38, cost: 4, acc: 100, desc: 'Un zarcillo cortante.' },
    { name: 'Espinas', power: 64, cost: 9, acc: 95, desc: 'Una lluvia de púas vegetales.' },
    { name: 'Torrente Verde', power: 88, cost: 15, acc: 90, desc: 'La vida salvaje ataca en masa.' },
    { name: 'Bosque Vivo', power: 112, cost: 22, acc: 86, desc: 'Raíces ancestrales emergen del suelo.' },
    { name: 'Floración Final', power: 140, cost: 32, acc: 82, desc: 'Un jardín carnívoro florece en un instante.' },
  ],
  rayo: [
    { name: 'Chispa', power: 38, cost: 4, acc: 100, desc: 'Una descarga rápida y precisa.' },
    { name: 'Rayo', power: 64, cost: 9, acc: 95, desc: 'Un relámpago directo.' },
    { name: 'Tormenta', power: 88, cost: 15, acc: 90, desc: 'La nube descarga su furia.' },
    { name: 'Cadena Arcana', power: 112, cost: 22, acc: 86, desc: 'La electricidad busca cada nervio.' },
    { name: 'Juicio del Cielo', power: 140, cost: 32, acc: 82, desc: 'Un pilar de luz y trueno.' },
  ],
  sombra: [
    { name: 'Toque Umbrío', power: 38, cost: 4, acc: 100, desc: 'Una mano fría desde la oscuridad.' },
    { name: 'Manto Negro', power: 64, cost: 9, acc: 95, desc: 'La sombra devora la luz.' },
    { name: 'Pesadilla', power: 88, cost: 15, acc: 90, desc: 'Miedos antiguos toman forma.' },
    { name: 'Vacío', power: 112, cost: 22, acc: 86, desc: 'Un trozo de nada absoluta.' },
    { name: 'Eclipse Total', power: 140, cost: 32, acc: 82, desc: 'El sol se apaga durante un latido.' },
  ],
  luz: [
    { name: 'Destello', power: 38, cost: 4, acc: 100, desc: 'Un pulso de luz cegadora.' },
    { name: 'Rayo Prisma', power: 64, cost: 9, acc: 95, desc: 'Luz refractada en mil colores.' },
    { name: 'Aurora', power: 88, cost: 15, acc: 90, desc: 'Un cielo imposible se derrama.' },
    { name: 'Juicio Solar', power: 112, cost: 22, acc: 86, desc: 'El mediodía cae como una espada.' },
    { name: 'Gracia Primera', power: 140, cost: 32, acc: 82, desc: 'La luz que creó el Nexo.' },
  ],
  tierra: [
    { name: 'Pedrada', power: 38, cost: 4, acc: 100, desc: 'Una roca lanzada con precisión.' },
    { name: 'Terremoto', power: 64, cost: 9, acc: 95, desc: 'El suelo se rompe bajo el rival.' },
    { name: 'Roca Viva', power: 88, cost: 15, acc: 90, desc: 'Un gigante de piedra despierta.' },
    { name: 'Falla Tectónica', power: 112, cost: 22, acc: 86, desc: 'Dos continentes chocan.' },
    { name: 'Cataclismo', power: 140, cost: 32, acc: 82, desc: 'La montaña entera se derrumba.' },
  ],
  aire: [
    { name: 'Ráfaga', power: 38, cost: 4, acc: 100, desc: 'Un corte de viento afilado.' },
    { name: 'Ventisca', power: 64, cost: 9, acc: 95, desc: 'Una espiral de aire comprimido.' },
    { name: 'Ciclón', power: 88, cost: 15, acc: 90, desc: 'El rival gira sin control.' },
    { name: 'Cielo Roto', power: 112, cost: 22, acc: 86, desc: 'El aire se parte como cristal.' },
    { name: 'Tempestad', power: 140, cost: 32, acc: 82, desc: 'Todos los vientos responden.' },
  ],
  hielo: [
    { name: 'Escarcha', power: 38, cost: 4, acc: 100, desc: 'Cristales de hielo punzantes.' },
    { name: 'Ventisca Gélida', power: 64, cost: 9, acc: 95, desc: 'Una tormenta de nieve afilada.' },
    { name: 'Lanza de Hielo', power: 88, cost: 15, acc: 90, desc: 'Una estalactita colosal.' },
    { name: 'Cero Absoluto', power: 112, cost: 22, acc: 86, desc: 'Detiene el movimiento del aire.' },
    { name: 'Edad Glacial', power: 140, cost: 32, acc: 82, desc: 'Un invierno sin final.' },
  ],
  veneno: [
    { name: 'Aguijón', power: 38, cost: 4, acc: 100, desc: 'Una inyección de toxina.' },
    { name: 'Toxina', power: 64, cost: 9, acc: 95, desc: 'Veneno que corroe la esencia.' },
    { name: 'Niebla Mórbida', power: 88, cost: 15, acc: 90, desc: 'Una nube que no deja respirar.' },
    { name: 'Plaga', power: 112, cost: 22, acc: 86, desc: 'La corrupción se propaga.' },
    { name: 'Apocalipsis Verde', power: 140, cost: 32, acc: 82, desc: 'La vida se vuelve en contra.' },
  ],
}

export const TECHNIQUES = {}

let moveId = 0
for (const [element, moves] of Object.entries(ELEMENT_POOL)) {
  moves.forEach((move, i) => {
    const id = `${element}_${i + 1}`
    TECHNIQUES[id] = {
      id, ...move, element, kind: 'attack', tier: i + 1, accuracy: move.acc ?? 95,
      icon: ELEMENTS[element].icon,
    }
  })
  TECHNIQUES[`${element}_nexo`] = {
    id: `${element}_nexo`, name: `Nexo ${ELEMENTS[element].name}`, element, kind: 'attack',
    power: 165, cost: 38, accuracy: 84, tier: 6, icon: ELEMENTS[element].icon,
    desc: 'Una técnica que crece con el vínculo. Ignora parte de la defensa.',
    pierce: 0.22, scaling: true,
  }
}

for (const [id, move] of Object.entries(SUPPORT_MOVES)) {
  TECHNIQUES[id] = { id, ...move, element: 'neutro', accuracy: 100, tier: 2 }
}

// 50 evolutionary families: 150 creatures, plus 8 mythic beings = 158 total.
const FAMILY_SEED = [
  ['brasal', ['Brasal', 'Pyrovar', 'Ignarok'], 'fuego', 'comun', 'beast', ['#ff7a3c', '#711f12', '#ffd166'], 'pradera', [42, 45, 34, 39], 'Erupción', 'Una cría de brasa que duerme junto a las fogatas. Su cola deja pequeñas constelaciones de chispas.'],
  ['aquil', ['Aquil', 'Marel', 'Levantyr'], 'agua', 'comun', 'aquatic', ['#38bdf8', '#075985', '#c7f5ff'], 'costa', [46, 38, 40, 36], 'Marea', 'Nada entre las olas como si el mar le susurrara secretos. Su aleta brilla cuando va a llover.'],
  ['brot', ['Brot', 'Floragor', 'Sylvant'], 'planta', 'comun', 'plant', ['#5fd36f', '#14532d', '#f9f7b0'], 'pradera', [48, 36, 42, 30], 'Floración', 'Un brote curioso que imita los pasos de quien lo cuida. Sus hojas cambian con las estaciones.'],
  ['volt', ['Volt', 'Chispark', 'Thunderion'], 'rayo', 'comun', 'beast', ['#facc15', '#78350f', '#fff7c2'], 'pradera', [38, 48, 30, 48], 'Descarga', 'Corre más rápido que su propia sombra. Los postes de Vértice parpadean a su paso.'],
  ['umbra', ['Umbra', 'Nocturne', 'Eclipseon'], 'sombra', 'poco', 'spirit', ['#a78bfa', '#2e1065', '#e9d5ff'], 'bosque', [40, 43, 36, 44], 'Eclipse', 'Nació de una sombra que se negó a desaparecer. Colecciona recuerdos ajenos.'],
  ['lumen', ['Lumen', 'Solari', 'Aurorion'], 'luz', 'poco', 'spirit', ['#fde68a', '#b45309', '#fffdf0'], 'pradera', [43, 40, 38, 42], 'Aurora', 'Una chispa de amanecer con forma de criatura. Ilumina los caminos de los perdidos.'],
  ['terra', ['Terra', 'Golemite', 'Titanox'], 'tierra', 'comun', 'golem', ['#d6a25e', '#5b3413', '#ffe6b0'], 'caverna', [56, 42, 54, 20], 'Sismo', 'Duerme durante décadas y despierta cuando el suelo necesita protección.'],
  ['zephyr', ['Zephyr', 'Galeron', 'Tempestad'], 'aire', 'comun', 'bird', ['#7dd3fc', '#0369a1', '#e0f7ff'], 'cumbre', [39, 41, 32, 52], 'Vendaval', 'Planea sobre los acantilados sin mover las alas. Su grito anuncia cambios de clima.'],
  ['cryo', ['Cryo', 'Glaciaron', 'Permafrost'], 'hielo', 'poco', 'beast', ['#bae6fd', '#0c4a6e', '#f0fbff'], 'cumbre', [46, 42, 45, 31], 'Ventisca', 'Su aliento congela el rocío en figuras minúsculas.'],
  ['toxic', ['Toxic', 'Venenox', 'Miasmaw'], 'veneno', 'poco', 'slime', ['#c084fc', '#4c1d95', '#f3e8ff'], 'caverna', [47, 40, 41, 33], 'Toxina', 'Un charco viviente que aprende los sabores del mundo.'],
  ['cindral', ['Cindral', 'Cinderak', 'Magmorth'], 'fuego', 'poco', 'dragon', ['#fb923c', '#7c2d12', '#ffedd5'], 'cumbre', [44, 49, 35, 42], 'Aliento Ígneo', 'Sus escamas guardan el calor de una montaña entera.'],
  ['nix', ['Nix', 'Nixara', 'Nixarion'], 'agua', 'poco', 'serpent', ['#22d3ee', '#164e63', '#cffafe'], 'costa', [43, 46, 37, 43], 'Corriente', 'Una serpiente de agua dulce que sueña con el océano.'],
  ['mosslet', ['Mosslet', 'Mossking', 'Verdantaur'], 'planta', 'comun', 'slime', ['#86efac', '#166534', '#ecfccb'], 'bosque', [52, 32, 47, 24], 'Esporas', 'Un montículo de musgo que ríe con la lluvia.'],
  ['sparkit', ['Sparkit', 'Voltaic', 'Arcron'], 'rayo', 'poco', 'insect', ['#fde047', '#854d0e', '#fefce8'], 'desierto', [35, 50, 28, 55], 'Chispa', 'Un escarabajo de tormenta que se alimenta de estática.'],
  ['shade', ['Shade', 'Nocturling', 'Nightmare'], 'sombra', 'raro', 'spirit', ['#8b5cf6', '#1e1b4b', '#ddd6fe'], 'bosque', [39, 51, 33, 50], 'Pesadilla', 'Se esconde en los sueños de los viajeros y devuelve sus miedos.'],
  ['gleam', ['Gleam', 'Aurelith', 'Seraphix'], 'luz', 'raro', 'bird', ['#fef08a', '#92400e', '#fffef5'], 'cumbre', [42, 47, 36, 50], 'Destello', 'Sus plumas se encienden al amanecer.'],
  ['pebble', ['Pebble', 'Boulder', 'Colossus'], 'tierra', 'comun', 'golem', ['#d4a373', '#603808', '#faedcd'], 'desierto', [58, 39, 57, 16], 'Roca Viva', 'Una piedra con opiniones firmes sobre el paisaje.'],
  ['breeze', ['Breeze', 'Windrel', 'Galeon'], 'aire', 'comun', 'bird', ['#67e8f9', '#0e7490', '#ecfeff'], 'costa', [38, 40, 31, 54], 'Ráfaga', 'Surfea las corrientes térmicas de la costa.'],
  ['frostpup', ['Frostpup', 'Snowpelt', 'Blizzara'], 'hielo', 'comun', 'beast', ['#e0f2fe', '#0369a1', '#ffffff'], 'cumbre', [47, 40, 42, 35], 'Escarcha', 'Un cachorro de nieve que persigue copos sin cansarse.'],
  ['sludge', ['Sludge', 'Oozer', 'Blightmaw'], 'veneno', 'comun', 'slime', ['#a3e635', '#3f6212', '#f7fee7'], 'caverna', [50, 37, 44, 29], 'Aguijón', 'Se filtra por las grietas y emerge donde menos se espera.'],
  ['emberox', ['Emberox', 'Emberwing', 'Phoenixar'], 'fuego', 'raro', 'bird', ['#f97316', '#7c2d12', '#fde68a'], 'desierto', [43, 54, 32, 52], 'Furia Solar', 'Renace de sus cenizas cada cien años, según los nómadas.'],
  ['tidecall', ['Tidecall', 'Coraltide', 'Tidequeen'], 'agua', 'raro', 'aquatic', ['#2dd4bf', '#115e59', '#ccfbf1'], 'costa', [48, 45, 43, 41], 'Tsunami', 'Su canto hace subir la marea. Los pescadores le dejan ofrendas.'],
  ['thornix', ['Thornix', 'Petalith', 'Rosaria'], 'planta', 'raro', 'plant', ['#f472b6', '#831843', '#fce7f3'], 'bosque', [46, 50, 38, 44], 'Espinas', 'Una rosa que aprendió a caminar y a defenderse.'],
  ['arcbolt', ['Arcbolt', 'Stormlet', 'Raijin'], 'rayo', 'raro', 'dragon', ['#fbbf24', '#1e3a8a', '#dbeafe'], 'cumbre', [41, 56, 34, 55], 'Tormenta', 'Un dragón joven que aún no controla los truenos que produce.'],
  ['duskling', ['Duskling', 'Duskphantom', 'Umbrage'], 'sombra', 'raro', 'beast', ['#6d28d9', '#171717', '#c4b5fd'], 'bosque', [45, 52, 37, 47], 'Manto Negro', 'Caza entre dos luces. Su pelaje absorbe el sonido.'],
  ['dawnwing', ['Dawnwing', 'Sundawn', 'Luminarch'], 'luz', 'raro', 'bird', ['#fbbf24', '#b45309', '#fffbeb'], 'pradera', [44, 49, 38, 50], 'Rayo Prisma', 'El primer pájaro que vio el amanecer y nunca lo olvidó.'],
  ['sandclaw', ['Sandclaw', 'Dunewalker', 'Dunescarab'], 'tierra', 'raro', 'insect', ['#eab308', '#713f12', '#fef9c3'], 'desierto', [50, 49, 45, 38], 'Falla', 'Excava ciudades bajo la arena y las olvida al terminar.'],
  ['skyfin', ['Skyfin', 'Skywhisper', 'Cyclonar'], 'aire', 'raro', 'aquatic', ['#5eead4', '#0f766e', '#f0fdfa'], 'costa', [42, 47, 36, 56], 'Ciclón', 'Un pez que nada en el cielo cuando la presión cambia.'],
  ['snowtail', ['Snowtail', 'Glacia', 'Borealwyrm'], 'hielo', 'raro', 'serpent', ['#cffafe', '#155e75', '#ffffff'], 'cumbre', [46, 52, 42, 44], 'Lanza de Hielo', 'Su cola dibuja constelaciones de escarcha en el aire.'],
  ['venomoth', ['Venomoth', 'Blightwing', 'Miasmaris'], 'veneno', 'raro', 'insect', ['#a855f7', '#3b0764', '#f5d0fe'], 'bosque', [44, 50, 39, 50], 'Niebla Mórbida', 'Sus alas esparcen un polvo que hace florecer cosas equivocadas.'],
  ['magmaw', ['Magmaw', 'Obsidrake', 'Vulcanox'], 'fuego', 'epico', 'golem', ['#ef4444', '#450a0a', '#fca5a5'], 'caverna', [58, 56, 52, 28], 'Volcán Interior', 'Una boca de magma con paciencia de montaña.'],
  ['coralisk', ['Coralisk', 'Abyssal', 'Leviathar'], 'agua', 'epico', 'serpent', ['#06b6d4', '#083344', '#a5f3fc'], 'costa', [55, 54, 48, 45], 'Fosa Abisal', 'Los marineros confunden su lomo con una isla.'],
  ['verdant', ['Verdant', 'Sylvanox', 'Worldroot'], 'planta', 'epico', 'plant', ['#22c55e', '#052e16', '#bbf7d0'], 'bosque', [60, 50, 52, 35], 'Bosque Vivo', 'Un árbol que camina una vez cada siglo para buscar agua.'],
  ['voltyx', ['Voltyx', 'Stormlord', 'Astrape'], 'rayo', 'epico', 'beast', ['#f59e0b', '#172554', '#fef3c7'], 'cumbre', [48, 61, 39, 60], 'Juicio del Cielo', 'El cielo lo reconoce como su heredero.'],
  ['phantasm', ['Phantasm', 'Wraithor', 'Ombralis'], 'sombra', 'epico', 'spirit', ['#7c3aed', '#0c0a09', '#e9d5ff'], 'bosque', [49, 60, 41, 57], 'Vacío', 'Una ausencia con voluntad propia.'],
  ['radiance', ['Radiance', 'Luminar', 'Seraphiel'], 'luz', 'epico', 'spirit', ['#fcd34d', '#78350f', '#fffbeb'], 'pradera', [52, 56, 45, 54], 'Juicio Solar', 'Su presencia convierte la noche en un recuerdo.'],
  ['dune', ['Dune', 'Dunewarden', 'Scarabking'], 'tierra', 'epico', 'insect', ['#d97706', '#451a03', '#fde68a'], 'desierto', [61, 54, 54, 42], 'Cataclismo', 'El rey enterrado que despierta cuando la arena canta.'],
  ['cyclone', ['Cyclone', 'Tempest', 'Zephyrion'], 'aire', 'epico', 'bird', ['#22d3ee', '#164e63', '#ecfeff'], 'cumbre', [50, 56, 43, 64], 'Tempestad', 'Su sombra cruza tres valles antes de que llegue el sonido.'],
  ['glacier', ['Glacier', 'Frostwyrm', 'Jotunheim'], 'hielo', 'epico', 'dragon', ['#7dd3fc', '#0c4a6e', '#f8fafc'], 'cumbre', [60, 57, 55, 38], 'Edad Glacial', 'Una era de hielo con alas.'],
  ['blight', ['Blight', 'Miasmoth', 'Pestilence'], 'veneno', 'epico', 'insect', ['#84cc16', '#1a2e05', '#ecfccb'], 'caverna', [53, 58, 47, 49], 'Apocalipsis Verde', 'Donde se posa, la vida cambia de forma.'],
  ['pyrewing', ['Pyrewing', 'Solarwing', 'Helion'], 'fuego', 'legendario', 'bird', ['#f97316', '#7f1d1d', '#fef08a'], 'desierto', [55, 68, 45, 64], 'Corona Solar', 'El sol lo llama hermano. Las tormentas de arena se apartan.'],
  ['mistral', ['Mistral', 'Tidecaller', 'Oceana'], 'agua', 'legendario', 'serpent', ['#0ea5e9', '#082f49', '#e0f2fe'], 'costa', [62, 60, 52, 59], 'Marea Eterna', 'El océano respira con su pecho.'],
  ['petalfin', ['Petalfin', 'Bloomtail', 'Gaia'], 'planta', 'legendario', 'plant', ['#34d399', '#064e3b', '#d1fae5'], 'bosque', [66, 56, 58, 43], 'Corazón Verde', 'Un jardín con memoria. Cada flor guarda una vida.'],
  ['galewing', ['Galewing', 'Skybreaker', 'Aeolus'], 'aire', 'legendario', 'bird', ['#38bdf8', '#0c4a6e', '#f0f9ff'], 'cumbre', [53, 64, 46, 70], 'Cielo Roto', 'El dueño de las corrientes que sostienen el mundo.'],
  ['obsidian', ['Obsidian', 'Voidstone', 'Nullarch'], 'sombra', 'legendario', 'golem', ['#64748b', '#020617', '#cbd5e1'], 'caverna', [68, 63, 62, 37], 'Vacío Absoluto', 'Una estatua de obsidiana que recuerda un universo sin luz.'],
  ['celestia', ['Celestia', 'Starlight', 'Astraea'], 'luz', 'legendario', 'spirit', ['#fde68a', '#92400e', '#ffffff'], 'cumbre', [58, 64, 52, 64], 'Gracia Primera', 'Una constelación que decidió bajar a caminar.'],
  ['abyss', ['Abyss', 'Deepmaw', 'Charybdis'], 'agua', 'epico', 'aquatic', ['#0369a1', '#020617', '#7dd3fc'], 'costa', [62, 59, 55, 48], 'Diluvio Primigenio', 'El fondo del mar tiene dientes.'],
  ['solaris', ['Solaris', 'Sunflare', 'Pyraeus'], 'fuego', 'epico', 'dragon', ['#fbbf24', '#7c2d12', '#fff7ed'], 'desierto', [54, 63, 47, 58], 'Erupción Solar', 'Una estrella con escamas y mal genio.'],
  ['terramaw', ['Terramaw', 'Quakelord', 'Tellurion'], 'tierra', 'legendario', 'golem', ['#a16207', '#1c1917', '#fef3c7'], 'caverna', [72, 60, 66, 32], 'Corazón de Piedra', 'El planeta lo escucha cuando golpea el suelo.'],
  ['venomaw', ['Venomaw', 'Toxaris', 'Nidhogg'], 'veneno', 'legendario', 'serpent', ['#7e22ce', '#1e1b4b', '#f3e8ff'], 'caverna', [64, 64, 54, 51], 'Apocalipsis Verde', 'El veneno del que nacieron los primeros mitos.'],
]

const MYTHIC_SEED = [
  ['myth_chronos', 'Chronos', 'luz', 'mitico', 'spirit', ['#fef3c7', '#78350f', '#ffffff'], 'cumbre', [70, 68, 58, 72], 'Reloj de Arena', 'El guardián del instante. Cada segundo de su cuerpo es una decisión.'],
  ['myth_eterion', 'Eterion', 'aire', 'mitico', 'dragon', ['#a5f3fc', '#164e63', '#f0fdff'], 'cumbre', [64, 74, 55, 78], 'Aliento del Vacío', 'Nació entre dos nubes que nunca debieron tocarse.'],
  ['myth_nyx', 'Nyx Primigenia', 'sombra', 'mitico', 'spirit', ['#c4b5fd', '#020617', '#ede9fe'], 'bosque', [66, 72, 56, 69], 'Noche Original', 'Antes de la primera luz, ya existía su silencio.'],
  ['myth_ouroboros', 'Ouroboros', 'veneno', 'mitico', 'serpent', ['#d8b4fe', '#3b0764', '#faf5ff'], 'caverna', [78, 66, 64, 55], 'Ciclo Eterno', 'Se devora y renace. Su veneno es memoria.'],
  ['myth_nexo', 'Nexo Primigenio', 'luz', 'mitico', 'golem', ['#fde68a', '#1e1b4b', '#ffffff'], 'pradera', [82, 72, 72, 50], 'Génesis', 'La criatura que sostiene la frontera entre los mundos.'],
  ['myth_abaddon', 'Abaddon', 'fuego', 'mitico', 'dragon', ['#f87171', '#450a0a', '#fecaca'], 'caverna', [74, 79, 62, 62], 'Sol Negro', 'Un incendio con la forma de una promesa rota.'],
  ['myth_lumina', 'Lumina Prime', 'luz', 'mitico', 'bird', ['#fef9c3', '#854d0e', '#ffffff'], 'pradera', [68, 70, 60, 76], 'Amanecer Eterno', 'La primera criatura que aprendió a volar hacia el futuro.'],
  ['myth_gaia', 'Gaia Prime', 'tierra', 'mitico', 'plant', ['#86efac', '#052e16', '#f0fdf4'], 'bosque', [88, 62, 74, 38], 'Raíz del Mundo', 'Su respiración es el crecimiento de los bosques.'],
]

function mkFamily(seed, index) {
  const [id, names, element, rarity, shape, palette, habitat, base, sig, lore] = seed
  return {
    id, names, element, rarity, shape, palette, habitat, base, sig, lore,
    index,
    evoLevels: [16, 36],
  }
}

export const FAMILIES = FAMILY_SEED.map(mkFamily)
export const MYTHICS = MYTHIC_SEED.map((seed, i) => ({
  ...mkFamily(seed, 50 + i),
  names: [seed[1]],
  mythic: true,
  evoLevels: [],
}))

export const CREATURES = []
export const CREATURE_BY_ID = {}

function buildMoves(family, stage) {
  const element = family.element
  const pool = ELEMENT_POOL[element]
  const support = ['fortaleza', 'furia', 'brisa', 'sanacion', 'marca', 'escudo']
  const sigId = `sig_${family.id}_${stage + 1}`
  const sigNames = family.mythic
    ? [family.sig]
    : [
        `${family.sig} de ${family.names[0]}`,
        `${family.sig} Mayor`,
        `${family.sig} Cataclísmica`,
      ]
  TECHNIQUES[sigId] = {
    id: sigId, name: sigNames[stage], element, kind: 'attack', tier: 4 + stage,
    power: 72 + stage * 28, cost: 12 + stage * 5, accuracy: 92,
    desc: `Técnica de linaje de ${family.names[stage]}. El vínculo aumenta su poder.`,
    icon: ELEMENTS[element].icon, signature: true, scaling: true,
  }
  const learnset = [
    { level: 1, id: `${element}_1` },
    { level: 3, id: support[family.index % support.length] },
    { level: 7, id: `${element}_2` },
    { level: 11, id: sigId },
    { level: 18, id: `${element}_3` },
    { level: 24, id: support[(family.index + 2) % support.length] },
    { level: 34, id: `${element}_4` },
    { level: 46, id: `${element}_5` },
    { level: 60, id: `${element}_nexo` },
    { level: 80, id: support[(family.index + 4) % support.length] },
  ]
  if (stage > 0) {
    learnset.push({ level: 16, id: `sig_${family.id}_2` })
    learnset.push({ level: 36, id: `sig_${family.id}_3` })
  }
  return learnset
}

function statsFor(base, level, stage, rarity) {
  const stageMult = [1, 1.28, 1.6][stage]
  const rarityMult = RARITIES[rarity].mult
  return {
    hp: Math.round((base[0] * 2.1 + level * 6.4) * stageMult * rarityMult),
    atk: Math.round((base[1] + level * 1.85) * stageMult * rarityMult),
    def: Math.round((base[2] + level * 1.55) * stageMult * rarityMult),
    spd: Math.round((base[3] + level * 1.35) * stageMult * rarityMult),
  }
}

function registerCreature(family, stage) {
  const isMythic = !!family.mythic
  const id = isMythic ? family.id : `${family.id}-${stage + 1}`
  const name = family.names[stage]
  const prev = stage > 0 ? `${family.id}-${stage}` : null
  const next = !isMythic && stage < family.names.length - 1 ? `${family.id}-${stage + 2}` : null
  const evoLevel = stage < family.evoLevels.length ? family.evoLevels[stage] : null
  const record = {
    id, name, family: family.id, stage, prev, next, evoLevel,
    element: family.element, rarity: family.rarity, shape: family.shape,
    palette: family.palette, habitat: family.habitat, lore: family.lore,
    base: family.base, sig: family.sig, mythic: isMythic,
    learnset: buildMoves(family, stage),
    statsAt: (level) => statsFor(family.base, level, stage, family.rarity),
  }
  CREATURES.push(record)
  CREATURE_BY_ID[id] = record
  return record
}

for (const family of FAMILIES) {
  for (let stage = 0; stage < family.names.length; stage++) registerCreature(family, stage)
}
for (const family of MYTHICS) registerCreature(family, 0)

export const STARTER_IDS = ['brasal-1', 'aquil-1', 'brot-1']

export const ZONES = [
  {
    id: 'pradera', name: 'Pradera de Vértice', short: 'Pradera', subtitle: 'Donde comienza todo vínculo',
    x: 1500, y: 1330, r: 690, level: [2, 9], tier: 1,
    palette: ['#1d3b2a', '#2b5a38', '#3f7b48', '#7aa65a'], accent: '#ffd166',
    elements: ['planta', 'fuego', 'rayo', 'luz'], weather: 'clear',
    desc: 'Colinas suaves, molinos antiguos y criaturas que aún confían en los humanos.',
  },
  {
    id: 'bosque', name: 'Bosque Umbrío', short: 'Bosque', subtitle: 'Los árboles recuerdan tu nombre',
    x: 690, y: 800, r: 620, level: [5, 15], tier: 2,
    palette: ['#101f1a', '#173328', '#214b36', '#41694a'], accent: '#7dd3a1',
    elements: ['planta', 'sombra', 'veneno', 'aire'], weather: 'fog',
    desc: 'Un bosque húmedo donde la luz llega en fragmentos y las sombras tienen hambre.',
  },
  {
    id: 'desierto', name: 'Desierto Solaris', short: 'Desierto', subtitle: 'El sol guarda secretos de oro',
    x: 2490, y: 1060, r: 610, level: [10, 22], tier: 3,
    palette: ['#4a2e1a', '#7a4a24', '#a86e32', '#d8a052'], accent: '#ffe29a',
    elements: ['fuego', 'tierra', 'rayo', 'luz'], weather: 'sand',
    desc: 'Dunas infinitas, ruinas enterradas y espejismos que a veces muerden.',
  },
  {
    id: 'costa', name: 'Costa de Cristal', short: 'Costa', subtitle: 'El océano canta en dos tonos',
    x: 1760, y: 1930, r: 590, level: [8, 18], tier: 2,
    palette: ['#0c2f3f', '#10506a', '#1b7890', '#5ec4c4'], accent: '#b8fbff',
    elements: ['agua', 'aire', 'hielo', 'luz'], weather: 'rain',
    desc: 'Playas de arena blanca y acantilados de cristal que reflejan mundos imposibles.',
  },
  {
    id: 'caverna', name: 'Cavernas de Cuarzo', short: 'Cavernas', subtitle: 'Bajo la piedra, algo respira',
    x: 650, y: 1690, r: 540, level: [15, 28], tier: 3,
    palette: ['#191a2e', '#29264a', '#403566', '#6d5b9b'], accent: '#c4b5fd',
    elements: ['tierra', 'veneno', 'sombra', 'fuego'], weather: 'none',
    desc: 'Galerías de cuarzo y ríos subterráneos. Los ecos no siempre son tuyos.',
  },
  {
    id: 'cumbre', name: 'Cumbre de los Ecos', short: 'Cumbre', subtitle: 'Más cerca del Nexo que del suelo',
    x: 1720, y: 490, r: 570, level: [22, 38], tier: 4,
    palette: ['#273449', '#3d536d', '#68839f', '#c6d8e8'], accent: '#e0f2fe',
    elements: ['aire', 'hielo', 'rayo', 'luz'], weather: 'snow',
    desc: 'Picos nevados suspendidos sobre las nubes. Aquí las leyendas dejan huellas.',
  },
]

export const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]))

export const WORLD = { w: 3200, h: 2400 }

export const POIS = [
  { id: 'ranch', type: 'ranch', name: 'Rancho Vértice', x: 1290, y: 1270, icon: '⌂', color: '#ffd166', desc: 'Tu hogar. Descansa, entrena y cuida de tu equipo.' },
  { id: 'coliseo', type: 'arena', name: 'Coliseo de Cristal', x: 1850, y: 1350, icon: '⚔', color: '#a5f3fc', desc: 'Duelos contra entrenadores de todo el Nexo.' },
  { id: 'village', type: 'village', name: 'Aldea Brisa', x: 1470, y: 1530, icon: '⛺', color: '#fbbf24', desc: 'Mercado, misiones y rumores de viajeros.' },
  { id: 'dungeon_bosque', type: 'dungeon', dungeon: 'bosque', name: 'Santuario Umbrío', x: 520, y: 610, icon: '◈', color: '#a78bfa', desc: 'Mazmorra de 3 pisos. Nivel recomendado 8+.' },
  { id: 'dungeon_solaris', type: 'dungeon', dungeon: 'solaris', name: 'Ruinas Solaris', x: 2550, y: 870, icon: '◈', color: '#fbbf24', desc: 'Mazmorra de 3 pisos. Nivel recomendado 16+.' },
  { id: 'dungeon_coral', type: 'dungeon', dungeon: 'coral', name: 'Abismo de Coral', x: 1870, y: 2090, icon: '◈', color: '#38bdf8', desc: 'Mazmorra de 3 pisos. Nivel recomendado 24+.' },
  { id: 'dungeon_cumbre', type: 'dungeon', dungeon: 'cumbre', name: 'Cumbre de los Ecos', x: 1710, y: 260, icon: '◈', color: '#e0f2fe', desc: 'Mazmorra de 3 pisos. Nivel recomendado 34+.' },
  { id: 'dungeon_caverna', type: 'dungeon', dungeon: 'caverna', name: 'Caverna Primigenia', x: 560, y: 1850, icon: '◈', color: '#c084fc', desc: 'Mazmorra de 4 pisos. Nivel recomendado 46+.' },
  { id: 'dungeon_nexo', type: 'dungeon', dungeon: 'nexo', name: 'Corazón del Nexo', x: 1500, y: 1110, icon: '✧', color: '#fde68a', hidden: true, desc: 'El sello final. Solo se abre ante un verdadero guardián.' },
]

export const NPCS = [
  { id: 'sol', name: 'Maestra Sol', role: 'Guardiana del Rancho', x: 1350, y: 1230, color: '#ffd166', quest: 'q_bond', lines: ['El Nexo no elige a los fuertes, elige a los que escuchan.', 'Cada criatura guarda una versión distinta de ti.'] },
  { id: 'bram', name: 'Bram', role: 'Botánico nervioso', x: 1430, y: 1510, color: '#86efac', quest: 'q_herbs', lines: ['Las plantas de la pradera están inquietas. ¿Me ayudas?', 'No toques la flor azul. En serio.'] },
  { id: 'kael', name: 'Kael', role: 'Campeón del Coliseo', x: 1870, y: 1320, color: '#a5f3fc', quest: 'q_arena', lines: ['En la arena no importa el nivel. Importa el siguiente movimiento.', '¿Crees que puedes hacerme sombra?'] },
  { id: 'nara', name: 'Nara', role: 'Vigía del bosque', x: 780, y: 900, color: '#c084fc', quest: 'q_shadow', lines: ['El bosque no está enfermo. Está recordando algo.', 'Las sombras que ves no son las que debes temer.'] },
  { id: 'ivo', name: 'Ivo', role: 'Arqueólogo solar', x: 2350, y: 1050, color: '#fbbf24', quest: 'q_relic', lines: ['Las ruinas no se excavaron solas, te lo aseguro.', 'Un artefacto raro vale más que diez victorias.'] },
  { id: 'lys', name: 'Lys', role: 'Cartógrafa de mareas', x: 1700, y: 1880, color: '#7dd3fc', quest: 'q_storm', lines: ['El clima cambia antes de que cambie el cielo.', 'Si ves una ola inmóvil, corre.'] },
  { id: 'orin', name: 'Orin', role: 'Escalador de ecos', x: 1780, y: 570, color: '#e0f2fe', quest: 'q_echo', lines: ['La cumbre te devuelve tus palabras. Procura decir algo que valga la pena.', 'Los dragones de aquí respetan a quien no huye.'] },
  { id: 'mika', name: 'Mika', role: 'Mercader de rarezas', x: 1520, y: 1550, color: '#fb7185', quest: 'q_codex10', lines: ['Compro historias, vendo reliquias, intercambio secretos.', 'Un códice completo vale una fortuna. O una vida.'] },
]

export const DUNGEONS = {
  bosque: {
    id: 'bosque', name: 'Santuario Umbrío', zone: 'bosque', element: 'sombra', floors: 3,
    level: 8, boss: 'shade-2', bossName: 'Nocturne, el Silencio', color: '#a78bfa',
    desc: 'Un templo devorado por raíces negras. El aire huele a lluvia vieja.',
    loot: ['runa', 'prisma', 'relic_shadow_mask', 'relic_moon_bell'],
  },
  solaris: {
    id: 'solaris', name: 'Ruinas Solaris', zone: 'desierto', element: 'fuego', floors: 3,
    level: 16, boss: 'emberox-2', bossName: 'Pyrewing, el Heredero', color: '#fbbf24',
    desc: 'Una ciudad de oro enterrada por el sol. Las paredes todavía están calientes.',
    loot: ['prisma', 'nexo', 'relic_ember_heart', 'relic_sun_shard'],
  },
  coral: {
    id: 'coral', name: 'Abismo de Coral', zone: 'costa', element: 'agua', floors: 3,
    level: 24, boss: 'coralisk-2', bossName: 'Abyssal, la Marea', color: '#38bdf8',
    desc: 'Bajo la costa, un arrecife vivo late como un corazón.',
    loot: ['nexo', 'relic_tide_pearl', 'relic_aegis_scale', 'relic_swift_feather'],
  },
  cumbre: {
    id: 'cumbre', name: 'Cumbre de los Ecos', zone: 'cumbre', element: 'aire', floors: 3,
    level: 34, boss: 'galewing-2', bossName: 'Skybreaker, el Viento Roto', color: '#e0f2fe',
    desc: 'Un observatorio suspendido entre relámpagos. Cada paso suena dos veces.',
    loot: ['nexo', 'celestial', 'relic_storm_core', 'relic_void_eye'],
  },
  caverna: {
    id: 'caverna', name: 'Caverna Primigenia', zone: 'caverna', element: 'tierra', floors: 4,
    level: 46, boss: 'obsidian-2', bossName: 'Voidstone, el Olvido', color: '#c084fc',
    desc: 'La primera cueva del mundo. Sus paredes están cubiertas de nombres olvidados.',
    loot: ['celestial', 'relic_titan_gauntlet', 'relic_nexus_crown', 'relic_xp_charm'],
  },
  nexo: {
    id: 'nexo', name: 'Corazón del Nexo', zone: 'pradera', element: 'luz', floors: 4,
    level: 58, boss: 'myth_nexo', bossName: 'Nexo Primigenio', color: '#fde68a',
    desc: 'El lugar donde el mundo se dobla sobre sí mismo. Solo los guardianes pueden entrar.',
    loot: ['celestial', 'relic_nexus_crown', 'relic_capture_lens', 'relic_void_eye'],
    hidden: true,
  },
}

export const ITEMS = {
  potion:   { id: 'potion', name: 'Néctar de Vértice', icon: '🧪', price: 80, desc: 'Restaura el 45% de la salud de una criatura.', heal: 0.45, color: '#6ee7b7' },
  elixir:   { id: 'elixir', name: 'Elixir de Nexo', icon: '⚗', price: 240, desc: 'Restaura toda la salud y elimina estados.', heal: 1, cure: true, color: '#60a5fa' },
  revive:   { id: 'revive', name: 'Semilla de Retorno', icon: '🌱', price: 320, desc: 'Revive a una criatura debilitada con el 50% de salud.', revive: 0.5, color: '#fbbf24' },
  ration:   { id: 'ration', name: 'Ración de viaje', icon: '🍯', price: 35, desc: 'Recupera salud fuera de combate y sube un poco el vínculo.', heal: 0.22, bond: 2, color: '#f59e0b' },
  incense:  { id: 'incense', name: 'Incienso de encuentro', icon: '🕯', price: 180, desc: 'Atrae una criatura rara de la zona actual.', rare: true, color: '#c084fc' },
}

export const RELICS = [
  { id: 'relic_ember_heart', name: 'Corazón de Brasa', icon: '🔥', rarity: 'raro', desc: '+14% daño de Fuego. Las llamas te reconocen.', bonus: { dmg: 0.14 }, element: 'fuego' },
  { id: 'relic_tide_pearl', name: 'Perla de Marea', icon: '🫧', rarity: 'raro', desc: '+14% daño de Agua. Escuchas la marea interior.', bonus: { dmg: 0.14 }, element: 'agua' },
  { id: 'relic_ancient_seed', name: 'Semilla Ancestral', icon: '🌱', rarity: 'raro', desc: '+14% daño de Planta y +8% salud máxima.', bonus: { dmg: 0.14, hp: 0.08 }, element: 'planta' },
  { id: 'relic_storm_core', name: 'Núcleo de Tormenta', icon: '⚡', rarity: 'epico', desc: '+12% velocidad y +8% daño de Rayo.', bonus: { spd: 0.12, dmg: 0.08 }, element: 'rayo' },
  { id: 'relic_shadow_mask', name: 'Máscara Umbría', icon: '🌑', rarity: 'raro', desc: '+12% daño de Sombra y +6% captura.', bonus: { dmg: 0.12, capture: 0.06 }, element: 'sombra' },
  { id: 'relic_sun_shard', name: 'Esquirla Solar', icon: '✦', rarity: 'epico', desc: '+14% daño de Luz y +10% experiencia.', bonus: { dmg: 0.14, xp: 0.10 }, element: 'luz' },
  { id: 'relic_titan_gauntlet', name: 'Guantelete de Titán', icon: '⛰', rarity: 'epico', desc: '+12% ataque. Cada golpe pesa como una montaña.', bonus: { atk: 0.12 } },
  { id: 'relic_aegis_scale', name: 'Escama de Égida', icon: '🛡', rarity: 'raro', desc: '+14% defensa y +8% salud máxima.', bonus: { def: 0.14, hp: 0.08 } },
  { id: 'relic_swift_feather', name: 'Pluma Veloz', icon: '🪶', rarity: 'raro', desc: '+15% velocidad. El viento abre paso.', bonus: { spd: 0.15 } },
  { id: 'relic_capture_lens', name: 'Lente de Captura', icon: '🔭', rarity: 'epico', desc: '+12% probabilidad de captura.', bonus: { capture: 0.12 } },
  { id: 'relic_xp_charm', name: 'Tótem de Vínculo', icon: '🔮', rarity: 'epico', desc: '+25% experiencia obtenida.', bonus: { xp: 0.25 } },
  { id: 'relic_nexus_crown', name: 'Corona del Nexo', icon: '♛', rarity: 'legendario', desc: '+10% a todas las estadísticas. Un fragmento de autoridad.', bonus: { all: 0.10 } },
  { id: 'relic_void_eye', name: 'Ojo del Vacío', icon: '◉', rarity: 'legendario', desc: '+18% encuentros raros y +8% captura.', bonus: { rare: 0.18, capture: 0.08 } },
  { id: 'relic_moon_bell', name: 'Campana Lunar', icon: '🌙', rarity: 'raro', desc: '+15% a todas las estadísticas durante la noche.', bonus: { night: 0.15 } },
]

export const RELIC_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]))

export const CHAPTERS = [
  {
    id: 0, title: 'El Despertar del Nexo', subtitle: 'Un vínculo que no puede romperse',
    objective: 'Habla con la Maestra Sol en el Rancho Vértice.', type: 'talk', target: 'sol',
    intro: [
      'El Nexo late bajo Vértice. No es un lugar, ni una energía: es la costura que mantiene unidos a los mundos.',
      'Las criaturas lo sienten antes que nosotros. Por eso eligen a sus guardianes.',
      'La Maestra Sol te espera en el Rancho Vértice. Lleva contigo a tu primer compañero.',
    ],
    outro: [
      'Sol sostiene una piedra de cuarzo que brilla al ritmo de tu criatura.',
      '«El Nexo te ha reconocido. A partir de hoy, cada criatura que captures será una puerta, no un trofeo.»',
    ],
    reward: { coins: 220, traps: { runa: 2 }, xp: 80 },
  },
  {
    id: 1, title: 'Primer Vínculo', subtitle: 'Una trampa no es una jaula',
    objective: 'Captura 2 criaturas salvajes usando trampas.', type: 'captures', count: 2,
    intro: ['Un guardián sin equipo es una canción sin eco.', 'Domina las trampas. La fuerza abre caminos, pero el vínculo los conserva.'],
    outro: ['Las dos nuevas criaturas duermen junto al fuego del rancho.', 'Sol sonríe: «Ahora escucha. El bosque lleva tres noches llamando a alguien.»'],
    reward: { coins: 300, traps: { prisma: 1 }, xp: 140 },
  },
  {
    id: 2, title: 'Susurros en el Bosque', subtitle: 'La sombra que aprendió a recordar',
    objective: 'Supera el Santuario Umbrío y derrota a Nocturne.', type: 'dungeon', target: 'bosque',
    intro: [
      'En el Bosque Umbrío, los árboles han empezado a repetir nombres que nadie pronunció.',
      'Nara, la vigía, cree que una criatura está devorando los recuerdos del lugar.',
      'Entra en el Santuario Umbrío. Si el silencio te llama por tu nombre, no respondas.',
    ],
    outro: [
      'Nocturne se disuelve en una lluvia de polvo violeta. Bajo sus garras aparece un fragmento de espejo.',
      'El reflejo no muestra tu rostro, sino una ciudad flotante bajo un eclipse.',
      '«La Orden del Eclipse ya está aquí», susurra Nara.',
    ],
    reward: { coins: 520, shards: 3, traps: { nexo: 1 }, xp: 260 },
  },
  {
    id: 3, title: 'La Arena de Cristal', subtitle: 'Donde el orgullo tiene forma de trueno',
    objective: 'Gana 1 duelo en el Coliseo de Cristal.', type: 'arenaWins', count: 1,
    intro: [
      'El Coliseo de Cristal reúne entrenadores de todos los rincones del Nexo.',
      'Kael, su campeón, asegura que el verdadero poder no se mide en niveles sino en decisiones.',
      'Gana un duelo. El Coliseo recuerda a todos sus campeones; también a los que caen.',
    ],
    outro: [
      'El público grita tu nombre. Kael aplaude desde el palco, sin sorpresa.',
      '«El eclipse no es un fenómeno. Es un ejército», dice. «Y acaba de despertar.»',
    ],
    reward: { coins: 650, shards: 5, traps: { prisma: 2 }, xp: 320 },
  },
  {
    id: 4, title: 'Tormenta Perfecta', subtitle: 'El clima también tiene memoria',
    objective: 'Captura una criatura durante una tormenta, lluvia o nieve.', type: 'weatherCapture', count: 1,
    intro: [
      'Lys, cartógrafa de mareas, ha detectado una anomalía: el clima de Vértice está respondiendo a una voluntad.',
      'Durante las tormentas aparecen criaturas que no pertenecen a esta estación.',
      'Captura una bajo la lluvia, la nieve o la arena. El cielo está intentando decir algo.',
    ],
    outro: [
      'La criatura capturada tiene escamas que brillan como relámpagos congelados.',
      'Lys traza una línea en su mapa: todas las anomalías apuntan a las Ruinas Solaris.',
    ],
    reward: { coins: 720, shards: 6, traps: { nexo: 1 }, xp: 380 },
  },
  {
    id: 5, title: 'Ruinas de Solaris', subtitle: 'El oro recuerda a sus dueños',
    objective: 'Explora las Ruinas Solaris y derrota a Pyrewing.', type: 'dungeon', target: 'solaris',
    intro: [
      'Bajo las dunas, una ciudad de oro espera desde antes de los primeros guardianes.',
      'Ivo ha encontrado inscripciones que hablan de un «sol artificial» capaz de abrir el Nexo.',
      'Pyrewing custodia la entrada. No permitirá que nadie toque el corazón de la ruina.',
    ],
    outro: [
      'El sol artificial se apaga al derrotar a Pyrewing. En su interior hay una coordenada: 00° 00′ — el centro del Nexo.',
      'Ivo no se atreve a mirar. «Ese lugar no está en ningún mapa. Está debajo de todos.»',
    ],
    reward: { coins: 980, shards: 9, traps: { nexo: 2 }, xp: 520 },
  },
  {
    id: 6, title: 'El Abismo Responde', subtitle: 'Bajo la marea, una puerta',
    objective: 'Supera el Abismo de Coral y derrota a Abyssal.', type: 'dungeon', target: 'coral',
    intro: [
      'La marea de la Costa de Cristal se ha detenido. No retrocede: espera.',
      'Bajo el arrecife, el Abismo de Coral late con una luz que no es biológica.',
      'Abyssal, la Marea, protege la segunda llave. La Orden del Eclipse también la busca.',
    ],
    outro: [
      'La marea vuelve de golpe, como si el mar hubiera estado conteniendo la respiración.',
      'Abyssal deja caer una llave de coral negro. En su superficie, un eclipse grabado.',
    ],
    reward: { coins: 1240, shards: 12, traps: { celestial: 1 }, xp: 700 },
  },
  {
    id: 7, title: 'Ecos en la Cumbre', subtitle: 'La voz que responde no es la tuya',
    objective: 'Supera la Cumbre de los Ecos y derrota a Skybreaker.', type: 'dungeon', target: 'cumbre',
    intro: [
      'Orin ha oído tu nombre en la cumbre. Pero aún no has subido.',
      'El observatorio de los antiguos guardianes sigue activo, apuntando a una grieta en el cielo.',
      'Skybreaker guarda la tercera llave. Si cae, la Orden podrá abrir el Corazón del Nexo.',
    ],
    outro: [
      'Al derrotar a Skybreaker, la grieta del cielo se ensancha. Al otro lado hay una ciudad invertida.',
      'La Orden del Eclipse ya tiene dos llaves. La tercera está en tus manos.',
      'Kael te espera en el Coliseo. Esta vez, no será un duelo amistoso.',
    ],
    reward: { coins: 1580, shards: 16, traps: { celestial: 1 }, xp: 960 },
  },
  {
    id: 8, title: 'La Orden del Eclipse', subtitle: 'Cuando el campeón elige bando',
    objective: 'Gana 3 duelos en el Coliseo para romper el rango de la Orden.', type: 'arenaWins', count: 3,
    intro: [
      'Kael ya no sonríe. La Orden del Eclipse le ha ofrecido un mundo donde las criaturas nunca mueren.',
      'Para detenerlo, debes derrotar a sus tres lugartenientes en el Coliseo.',
      'Cada victoria debilita el sello que mantiene abierta la grieta.',
    ],
    outro: [
      'Kael cae de rodillas, pero no está derrotado. «No entiendes. El Nexo se está muriendo. La Orden no lo rompe: intenta salvarlo.»',
      'Antes de desaparecer, te entrega su insignia. La cuarta llave estaba siempre contigo.',
    ],
    reward: { coins: 2200, shards: 22, traps: { celestial: 2 }, xp: 1400 },
  },
  {
    id: 9, title: 'Corazón del Nexo', subtitle: 'El último guardián eres tú',
    objective: 'Entra en el Corazón del Nexo y enfrenta al Nexo Primigenio.', type: 'dungeon', target: 'nexo',
    intro: [
      'La grieta conduce al Corazón del Nexo: un lugar sin arriba ni abajo, hecho de recuerdos.',
      'La Orden no era el enemigo. El Nexo Primigenio ha estado absorbiendo mundos para no colapsar.',
      'No queda nadie a quien salvar si el Nexo se apaga. Tampoco si sigue comiendo.',
      'Entra. Tu equipo ha llegado hasta aquí por algo más que obediencia.',
    ],
    outro: [
      'El Nexo Primigenio no grita al caer. Susurra: «Gracias».',
      'Las grietas se cierran una a una. Vértice vuelve a tener un cielo que no se rompe.',
      'En el Rancho, Sol prepara té para un equipo que ya no es el mismo. La historia continúa en cada criatura que aún no has conocido.',
    ],
    reward: { coins: 5000, shards: 60, traps: { celestial: 5 }, xp: 4000, title: 'Guardián del Nexo' },
  },
]

export const SIDEQUESTS = [
  { id: 'q_herbs', npc: 'bram', title: 'Hierbas del alba', desc: 'Captura 3 criaturas de tipo Planta para estudiar su polen.', type: 'captureElement', element: 'planta', count: 3, reward: { coins: 260, traps: { runa: 2 }, xp: 100 } },
  { id: 'q_arena', npc: 'kael', title: 'El Coliseo espera', desc: 'Gana 1 duelo en el Coliseo de Cristal.', type: 'arenaWins', count: 1, reward: { coins: 320, shards: 2, xp: 120 } },
  { id: 'q_shadow', npc: 'nara', title: 'Sombras en el bosque', desc: 'Supera el Santuario Umbrío.', type: 'dungeon', target: 'bosque', reward: { coins: 400, shards: 3, xp: 200 } },
  { id: 'q_relic', npc: 'ivo', title: 'Reliquia perdida', desc: 'Encuentra 2 reliquias en mazmorras o cofres.', type: 'relics', count: 2, reward: { coins: 480, shards: 4, xp: 240 } },
  { id: 'q_storm', npc: 'lys', title: 'Cazador de tormentas', desc: 'Captura una criatura durante lluvia, nieve o tormenta de arena.', type: 'weatherCapture', count: 1, reward: { coins: 360, traps: { prisma: 1 }, xp: 180 } },
  { id: 'q_rare', npc: 'bram', title: 'La trampa perfecta', desc: 'Captura una criatura Rara o superior.', type: 'captureRarity', count: 1, minRarity: 'raro', reward: { coins: 520, traps: { prisma: 2 }, xp: 260 } },
  { id: 'q_echo', npc: 'orin', title: 'Ecos de la cumbre', desc: 'Supera la Cumbre de los Ecos.', type: 'dungeon', target: 'cumbre', reward: { coins: 800, shards: 8, xp: 450 } },
  { id: 'q_codex10', npc: 'mika', title: 'Coleccionista', desc: 'Registra 10 especies distintas en el Códice.', type: 'codex', count: 10, reward: { coins: 450, shards: 3, xp: 220 } },
  { id: 'q_bond', npc: 'sol', title: 'Un vínculo verdadero', desc: 'Lleva a una criatura al nivel 15.', type: 'level', count: 15, reward: { coins: 380, traps: { runa: 2 }, xp: 250 } },
  { id: 'q_water', npc: 'lys', title: 'Guardiana del mar', desc: 'Captura 5 criaturas de tipo Agua.', type: 'captureElement', element: 'agua', count: 5, reward: { coins: 600, traps: { prisma: 2 }, xp: 300 } },
  { id: 'q_arena3', npc: 'kael', title: 'Sin piedad', desc: 'Gana 3 duelos en el Coliseo.', type: 'arenaWins', count: 3, reward: { coins: 900, shards: 8, xp: 500 } },
  { id: 'q_dungeon3', npc: 'nara', title: 'Explorador del Nexo', desc: 'Supera 3 mazmorras distintas.', type: 'dungeons', count: 3, reward: { coins: 1100, shards: 10, xp: 600 } },
  { id: 'q_legend', npc: 'orin', title: 'La leyenda vive', desc: 'Captura una criatura Legendaria o Mítica.', type: 'captureRarity', count: 1, minRarity: 'legendario', reward: { coins: 2000, shards: 20, xp: 1200 } },
  { id: 'q_codex50', npc: 'mika', title: 'Códice del Nexo', desc: 'Registra 50 especies distintas.', type: 'codex', count: 50, reward: { coins: 2400, shards: 25, xp: 1500 } },
]

export const SIDEQUEST_BY_ID = Object.fromEntries(SIDEQUESTS.map(q => [q.id, q]))

export const TRAINERS = [
  { name: 'Aria Nova', title: 'Domadora de brisas', color: '#7dd3fc', team: ['zephyr-2', 'breeze-2', 'skyfin-2'] },
  { name: 'Rook', title: 'Puño de hierro', color: '#d6a25e', team: ['pebble-2', 'terra-2', 'sandclaw-2'] },
  { name: 'Selene', title: 'Voz del eclipse', color: '#a78bfa', team: ['umbra-2', 'shade-2', 'duskling-2'] },
  { name: 'Vega', title: 'Lanza solar', color: '#fbbf24', team: ['lumen-2', 'dawnwing-2', 'emberox-2'] },
  { name: 'Marea', title: 'Canto abisal', color: '#38bdf8', team: ['aquil-2', 'tidecall-2', 'nix-2'] },
  { name: 'Ciro', title: 'Tormenta errante', color: '#facc15', team: ['volt-2', 'sparkit-2', 'arcbolt-2'] },
  { name: 'Thalia', title: 'Jardín viviente', color: '#5fd36f', team: ['brot-2', 'mosslet-2', 'thornix-2'] },
  { name: 'Kael', title: 'Campeón del Coliseo', color: '#a5f3fc', team: ['cryo-2', 'gleam-2', 'galewing-2'] },
  { name: 'Nyx', title: 'Heraldo del vacío', color: '#c084fc', team: ['phantasm-2', 'obsidian-2', 'duskling-2'] },
  { name: 'Ignis', title: 'Corazón de magma', color: '#ff6b3d', team: ['cindral-2', 'magmaw-2', 'solaris-2'] },
]

export const WEATHERS = {
  clear: { name: 'Despejado', icon: '☀', color: '#ffd166', tint: 'rgba(255,210,120,.04)', desc: 'Criaturas activas y soleadas.' },
  rain:  { name: 'Lluvia', icon: '🌧', color: '#7dd3fc', tint: 'rgba(40,90,160,.16)', desc: 'Aumenta la aparición de Agua y Planta.' },
  storm: { name: 'Tormenta', icon: '⛈', color: '#a78bfa', tint: 'rgba(60,40,120,.20)', desc: 'Rayo y Sombra emergen. Captura más difícil.' },
  fog:   { name: 'Niebla', icon: '🌫', color: '#cbd5e1', tint: 'rgba(190,205,215,.12)', desc: 'Sombra y Veneno acechan.' },
  sand:  { name: 'Tormenta de arena', icon: '🌪', color: '#fbbf24', tint: 'rgba(180,120,50,.18)', desc: 'Tierra y Fuego se vuelven salvajes.' },
  snow:  { name: 'Nevada', icon: '❄', color: '#e0f2fe', tint: 'rgba(180,220,255,.16)', desc: 'Hielo y Aire despiertan.' },
  eclipse: { name: 'Eclipse', icon: '◐', color: '#c084fc', tint: 'rgba(50,20,90,.34)', desc: 'Rarezas extremas. El Nexo está inquieto.' },
}

export const TIPS = [
  'Las trampas de mayor rango funcionan mejor contra criaturas raras. No gastes un Sello Celestial en un común.',
  'Debilitar a una criatura antes de lanzar la trampa aumenta mucho la probabilidad de captura.',
  'El clima cambia cada pocos minutos y altera qué criaturas aparecen.',
  'Las evoluciones se desbloquean al nivel 16 y 36. Puedes posponerlas desde el Rancho.',
  'Cada criatura aprende técnicas nuevas al subir de nivel. Revisa su ficha en el equipo.',
  'Las reliquias equipadas potencian estadísticas y pueden cambiar una batalla entera.',
  'En las mazmorras, los nodos ocultos suelen contener reliquias raras.',
  'El Coliseo acepta duelos por código: comparte tu enlace con otro guardián.',
  'La noche favorece a las criaturas de Sombra y a las apariciones legendarias.',
  'Puedes cambiar de criatura en combate sin perder el turno si tu velocidad es mayor.',
]

export const SAVE_KEY = 'nexo_guardians_save_v1'
export const SAVE_VERSION = 1
