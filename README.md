# Crossing Watch

A single-player third-person browser RPG. Protect the waybeacons, open the bridge and break the fog at its source. After the first two chapters, take nine field orders across both banks. Their 45 assignments include hauling relics, reading rune stones, reviving scouts and fighting named champions. Two automated runs using the map’s collision geometry reached the ending in 33 and 58 minutes of active play with melee and survival builds respectively.

## Play

Use WASD or the arrow keys to move. Hold the right mouse button to orbit and scroll to zoom. E interacts. Tab or a click selects a target, 1 toggles auto-attack and F strikes once. Use 2 for Seal after level two, 3 to heal, and Space or 4 to roll. On level-up, choose a card with the mouse or 1–3, then press **Accept upgrade**. Touch controls are available. Choose one of three talents at each level up to level 10. Completed encounters and deliveries are saved in the browser. Players returning after the Ash Sentinel can resume at the ferry.

## Local development

Use Node.js 22.12 or later and a browser with WebGL 2.

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite produces a static site in `dist/`. Its design brief is available at `/onepage.html`.

## Credits

Models and animations are by Quaternius (CC0). Camera, terrain, foliage, shadow and combat rendering use code by Levy Street under the MIT license. See [asset credits](public/ART-CREDITS.txt), the [Levy Street license](public/LICENSE-LEVY-STREET.txt) and the [Three.js license](public/LICENSE-THREE.txt).
