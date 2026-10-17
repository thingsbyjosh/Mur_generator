// Contenido propio: temas, estancias, objetos y personajes.

export const THEMES = [
  {
    id: 'mansion',
    title: 'La mansión',
    roomWord: 'habitación', sameRoomPhrase: 'la misma habitación que',
    rooms: [
      { name: 'Vestíbulo', art: 'el' },
      { name: 'Salón', art: 'el' },
      { name: 'Biblioteca', art: 'la' },
      { name: 'Comedor', art: 'el' },
      { name: 'Cocina', art: 'la' },
      { name: 'Despacho', art: 'el' },
      { name: 'Invernadero', art: 'el' },
      { name: 'Dormitorio', art: 'el' },
      { name: 'Bodega', art: 'la' },
      { name: 'Galería', art: 'la' },
    ],
    items: [
      { id: 'planta', name: 'planta', art: 'una', emoji: '🪴', blocks: true },
      { id: 'reloj', name: 'reloj', art: 'un', emoji: '🕰️', blocks: true },
      { id: 'mesa', name: 'mesa', art: 'una', emoji: '🪵', blocks: true },
      { id: 'libreria', name: 'librería', art: 'una', emoji: '📚', blocks: true },
      { id: 'candelabro', name: 'candelabro', art: 'un', emoji: '🕯️', blocks: true },
      { id: 'piano', name: 'piano', art: 'un', emoji: '🎹', blocks: true },
      { id: 'sofa', name: 'sofá', art: 'un', emoji: '🛋️', blocks: false },
      { id: 'silla', name: 'silla', art: 'una', emoji: '🪑', blocks: false },
      { id: 'cama', name: 'cama', art: 'una', emoji: '🛏️', blocks: false },
    ],
  },
  {
    id: 'tren',
    title: 'El expreso nocturno',
    roomWord: 'vagón', sameRoomPhrase: 'el mismo vagón que',
    rooms: [
      { name: 'Vagón restaurante', art: 'el' },
      { name: 'Coche cama', art: 'el' },
      { name: 'Salón bar', art: 'el' },
      { name: 'Furgón de equipajes', art: 'el' },
      { name: 'Cabina', art: 'la' },
      { name: 'Vagón panorámico', art: 'el' },
      { name: 'Compartimento A', art: 'el' },
      { name: 'Compartimento B', art: 'el' },
    ],
    items: [
      { id: 'baul', name: 'baúl', art: 'un', emoji: '🧳', blocks: true },
      { id: 'mesita', name: 'mesita', art: 'una', emoji: '🪵', blocks: true },
      { id: 'perro', name: 'perro', art: 'un', emoji: '🐕', blocks: true },
      { id: 'reloj', name: 'reloj', art: 'un', emoji: '🕰️', blocks: true },
      { id: 'lampara', name: 'lámpara', art: 'una', emoji: '🪔', blocks: true },
      { id: 'butaca', name: 'butaca', art: 'una', emoji: '🪑', blocks: false },
      { id: 'litera', name: 'litera', art: 'una', emoji: '🛏️', blocks: false },
    ],
  },
  {
    id: 'museo',
    title: 'El museo',
    roomWord: 'sala', sameRoomPhrase: 'la misma sala que',
    rooms: [
      { name: 'Sala egipcia', art: 'la' },
      { name: 'Sala moderna', art: 'la' },
      { name: 'Taquilla', art: 'la' },
      { name: 'Cafetería', art: 'la' },
      { name: 'Almacén', art: 'el' },
      { name: 'Jardín de esculturas', art: 'el' },
      { name: 'Auditorio', art: 'el' },
      { name: 'Archivo', art: 'el' },
    ],
    items: [
      { id: 'estatua', name: 'estatua', art: 'una', emoji: '🗿', blocks: true },
      { id: 'anfora', name: 'ánfora', art: 'un', emoji: '🏺', blocks: true },
      { id: 'planta', name: 'planta', art: 'una', emoji: '🪴', blocks: true },
      { id: 'vitrina', name: 'vitrina', art: 'una', emoji: '💎', blocks: true },
      { id: 'reloj', name: 'reloj', art: 'un', emoji: '🕰️', blocks: true },
      { id: 'banco', name: 'banco', art: 'un', emoji: '🛋️', blocks: false },
      { id: 'taburete', name: 'taburete', art: 'un', emoji: '🪑', blocks: false },
    ],
  },
];

export const ROOM_COLORS = [
  '#fde2e4', '#e2ece9', '#fff1c1', '#dbe7ff', '#ead7f7',
  '#ffe0c2', '#d6f5f5', '#f3f0d7', '#e7e0ff', '#dff5d8',
];
export const ROOM_COLORS_DARK = [
  '#4a2a30', '#243a33', '#4a4020', '#263352', '#3a2a4a',
  '#4a3320', '#204040', '#3d3a24', '#302a4a', '#2a4026',
];

export const PEOPLE = [
  { name: 'Adela', emoji: '👩‍🦰' }, { name: 'Bruno', emoji: '👨‍🦳' },
  { name: 'Clara', emoji: '👩‍⚕️' }, { name: 'Darío', emoji: '👨‍🍳' },
  { name: 'Elena', emoji: '👩‍🏫' }, { name: 'Fermín', emoji: '👨‍🔧' },
  { name: 'Greta', emoji: '👩‍🎤' }, { name: 'Hugo', emoji: '🧑‍💼' },
  { name: 'Inés', emoji: '🧑‍🎨' }, { name: 'Julián', emoji: '👨‍⚖️' },
  { name: 'Lola', emoji: '👩‍🌾' }, { name: 'Mateo', emoji: '🕵️' },
  { name: 'Nora', emoji: '👩‍🔬' }, { name: 'Óscar', emoji: '👨‍🎓' },
  { name: 'Paula', emoji: '👩‍💻' }, { name: 'Ramón', emoji: '👴' },
  { name: 'Sofía', emoji: '👩‍✈️' }, { name: 'Tomás', emoji: '🧔' },
];

export const VICTIM_EMOJI = '💀';

export const WALL_FEATURES = [
  { id: 'ventana', name: 'ventana', art: 'una', outer: true },
  { id: 'puerta', name: 'puerta', art: 'una', outer: false },
];

export const DIFFICULTIES = {
  muyfacil: { label: 'Muy fácil', sizes: [4] },
  facil: { label: 'Fácil', sizes: [4, 5] },
  media: { label: 'Media', sizes: [5, 6] },
  dificil: { label: 'Difícil', sizes: [6, 7] },
  experto: { label: 'Experto', sizes: [7, 8] },
};
