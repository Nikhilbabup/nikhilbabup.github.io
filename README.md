# Nikhil Babu P — Portfolio

Personal portfolio of a backend, payments and mobile engineer (Node.js, TypeScript, AWS, Electron, Flutter).

- **Home** (`index.html`): experience, projects, skills and contact, with a hand-drawn pixel-art pond scene in the hero.
- **Bunny Arcade** (`arcade.html`): pixel-art mini-games in one place: **Catch the Fish** (`play/game.js`) and **Bug Runner** (`play/runner.js`), with a shared engine for more in `play/kit.js`. Click "Nikhil" on the home page to open it. Both games also run inside banners: click the fishing bunny on the home page, or the bunny on the PoultryPro case study.
- **Case studies** (`projects/`): one page per project, each with its own animated pixel-art banner (`projects/scene.js`).

## Stack
Hand-written HTML, CSS and vanilla JavaScript: no framework, no build step. All artwork is drawn procedurally on `<canvas>` at runtime; animations pause off-screen and respect `prefers-reduced-motion`.

## Run locally
Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Contact
[LinkedIn](https://linkedin.com/in/nikhilbabupurakkal/) · [GitHub](https://github.com/Nikhilbabup)
