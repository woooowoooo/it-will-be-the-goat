# About
"Frozen Game" (temporary title) is a game where you are a square that slides over ice.
Play it at https://woooowoooo.github.io/frozen-game/!
View the source code [here](https://github.com/woooowoooo/frozen-game).

Made for [Crimson Game Jam 2024](https://itch.io/jam/crimson-game-jam).
My entry is located [here](https://woooowoooo.itch.io/frozen-game).
As of right now, this entry contains only the parts finished before the submission deadline.
Alternatively, you can download release v0.1 from GitHub to get essentially the same version.
**This version is buggy, outdated, and nigh-unplayable.**

# Levels
Levels are stored as SVGs in the `levels` folder.
The hitbox is a path with the id `"hitbox"`.
The spawn point (bottom center of spawned character) is stored as a circle (with unspecified radius, defaulting to 0) with the id `"spawnpoint"`.

To add a custom level, add your level to the `levels` folder as `levelN.svg` (with `N` being the number after the current last level) and increment `levelNumber` in `index.js`.