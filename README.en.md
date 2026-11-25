# microgpt-lab · Prediction and training

[Русский](README.md) · **English**

[Open the lab](https://andrewchaschin.github.io/microgpt-lab/)

In this browser-based lab, a small transformer learns to predict the next letter of a word. Choose a Russian or English word, click **Train on** that word, and compare predictions before and after one training step. Click a block in the diagram to see its formula.

## Run locally

Use npm 10 or later and a supported version of Node.js (`^20.19.0 || ^22.12.0 || >=24.0.0`).

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. Once the dependencies are installed, the lab can run offline.

## Build

```sh
npm run check
npm run lint
npm run build
npm run preview
```

```sh
BASE_PATH=/microgpt-lab npm run build
```

## About the project and license

microgpt-lab is an independent educational project by AndrewChaschin. The model is based on [Andrej Karpathy’s microgpt architecture](https://karpathy.github.io/2026/02/12/microgpt/).

The project is distributed under the [MIT License](LICENSE).
