# Pokédex — Generations I–VIII

A minimal, responsive static guide to 905 Pokémon, built with HTML, CSS, and vanilla JavaScript. Profiles and artwork are bundled locally, without a runtime API dependency.

## Run locally

```sh
npm run dev
```

Open http://127.0.0.1:4173. Node.js 18+ is required. No npm packages need to be installed. The site has no build step.

## Features

- All 905 species from Generations I–VIII, including Hisui.
- Animated renders from Project Pokémon, with official artwork for species unavailable in the supplied animation pages.
- Nine additional animations selectable in Marshadow, Reshiram, and Zekrom profiles.
- Automatic pagination as you scroll, search by name or number, and type filtering.
- Grid and sortable stats table views, with the selected view saved on the current device.
- Profiles with measurements, abilities, current type weaknesses, gender ratios, base stats, and evolution chains across all eight generations.
- Favorites saved on the current device.
- Responsive layouts, keyboard-operable controls, and a sticky red navigation and search bar.

## Data and artwork

Data comes from [PokéAPI](https://pokeapi.co/). Refresh with `npm run refresh-data`; this requires Python 3, Pillow (`pip install Pillow`), and internet access. Run `npm run check` to verify the bundled catalog.

Artwork comes from the eight generation pages and miscellaneous animation page in [Project Pokémon's sprite index](https://projectpokemon.org/home/docs/spriteindex_148/). These are pre-rendered animated images, not interactive 3D meshes. The catalog uses default species forms; alternate and shiny animations from the miscellaneous page are selectable within the relevant profiles. `scripts/sprite-sources.json` records source URLs, image metadata, and artwork fallbacks. Data refresh caches API responses in `.sites-runtime/api-cache`.

Serve `dist/` on any static host when ready. Detail links use hashes, so no server rewrite rule is required. Fonts load from Google Fonts with system fallbacks.

## Deploy on GitHub Pages

The ready-to-publish website is in `dist/`; no build or package installation is needed. All local URLs are relative, so assets and Pokémon detail links work under `/Pokedex/`.

1. Open repository **Settings → Pages** and select **GitHub Actions** as the source.
2. Open **Actions → Deploy GitHub Pages → Run workflow**, select `main`, and run it.
3. After the workflow succeeds, visit https://Ikkyuuuu.github.io/Pokedex/.

Deployment runs only when manually requested. The workflow validates the catalog, uploads only `dist/`, and publishes it using the official GitHub Pages actions. To deploy later changes, push them to `main` and run the workflow again.

## Design reference

[Pokédex Pokémon app on Figma Community](https://www.figma.com/community/file/1202971127473077147/pokedex-pokemon-app).

Pokémon characters and assets belong to Nintendo, Game Freak, and The Pokémon Company. This is an unofficial fan project.
