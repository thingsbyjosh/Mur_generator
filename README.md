# Coartada · generador de casos de lógica

Generador infinito de puzles de lógica de misterio al estilo "sudoku de asesinato": una cuadrícula
dividida en estancias, un puñado de sospechosos con declaraciones, y una regla final: **el asesino es el
único sospechoso que está en la misma estancia que la víctima**.

Todo el contenido (temas, estancias, objetos, personajes, redacción de pistas) es propio. El nombre
"Coartada" es provisional y está en un único sitio (`index.html`).

## Jugar en local

Es una web estática sin dependencias ni build:

```bash
npm run serve      # o cualquier servidor estático
# abre http://localhost:8080
```

Los parámetros van en la URL, así que un enlace reproduce exactamente el mismo caso:

```
index.html#d=dificil&n=7&s=mi-semilla
```

- `d`: `facil` · `media` · `dificil` · `experto`
- `n`: `auto` o tamaño 4–8
- `s`: semilla (texto libre). «Caso del día» usa `dia-AAAA-MM-DD`.

## Cómo funciona el generador

1. **Escenario**: regiones conexas (estancias) por crecimiento aleatorio, con nombre y color.
2. **Solución**: una permutación (un personaje por fila y columna) tal que exactamente un sospechoso
   comparte estancia con la víctima. Después se colocan objetos en casillas libres.
3. **Pistas**: se enumeran todas las declaraciones verdaderas de 16 tipos (estancia, borde, junto a objeto,
   junto a / izquierda de / encima de otro personaje, misma estancia, y sus negaciones).
4. **Reducción**: se añaden pistas hasta que el solver por backtracking confirma solución única, y luego
   se eliminan las redundantes. El orden de eliminación se sesga según la dificultad pedida (en fácil
   sobreviven las pistas directas; en difícil, las relacionales).
5. **Graduación**: un resolutor lógico por propagación de candidatos (arco-consistencia sobre pistas,
   singles por fila/columna, regla del asesino) mide cuántas rondas hacen falta y si requiere
   hipótesis. De ahí sale una puntuación y una banda. Si el caso no cae en la banda pedida se descarta
   y se genera otro (determinista: misma semilla, mismo caso).

## Scripts

```bash
npm test                  # unicidad, pistas verdaderas, regla del asesino, determinismo
npm run bench -- 20       # estadísticas por dificultad (añade -v para ver cada caso)
npm run gen -- dificil s1 # imprime un caso en texto
```

## Estructura

```
src/core/rng.js        RNG con semilla
src/core/data.js       temas, estancias, objetos, personajes, dificultades
src/core/layout.js     estancias, solución, objetos
src/core/clues.js      tipos de pista (test + texto + enumeración)
src/core/solver.js     conteo de soluciones y resolutor lógico (graduación)
src/core/generator.js  orquestación y bandas de dificultad
src/ui/                interfaz web (sin framework)
scripts/               test, bench y CLI
```

El núcleo (`src/core`) no depende del DOM: sirve igual para la web, para una app móvil (WebView o
React Native) o para generar PDFs/libros por lotes.
