import {context, colors, images, sounds, levels, stateMachines, objects, settings, Drawable} from "./index.js";
// Constants
const RADIUS = 50;
// Linear speed
const GRAVITY = 1500; // px / sec^2
const FRICTION = 500; // px / sec^2
const SPEED = 1000; // px / sec^2
const MAX_SPEED = 750; // px / sec
// Collision
const COLLISION_POINTS = [
	[-1, -1],
	[0, -1],
	[1, -1],
	[1, 0],
	[1, 1],
	[0, 1],
	[-1, 1],
	[-1, 0]
];
const COLLISION_RESOLUTION_STEP = 0.01;
const COLLISION_RESOLUTION_ITERATIONS = 12;
// Rendering
const DEBUG_X = 200;
const DEBUG_Y = 1260;
const DEBUG_LINE_HEIGHT = 40;
// State variables
const heldKeys = new Set();
let character = null;
let changed = true;
// Level variables
let levelNumber = 1;
let level = null;
let hitbox = null;
// Time variables
let startTime = 0;
let time = 0;
let fps = 0;
// Character class
class Character extends Drawable {
	constructor (x = 0, y = 0) {
		changed = true;
		function draw() {
			context.fillStyle = colors.character;
			context.fillRect(this.center.x - RADIUS, this.center.y - RADIUS, 2 * RADIUS, 2 * RADIUS);
		}
		super(draw);
		this.center = {x, y};
		this.speed = {x: 0, y: 0};
		this.acceleration = {x: 0, y: 0};
		objects.set("character", this);
	}
	update(deltaTime) {
		// Apply changes
		if (this.speed.x !== 0 || this.speed.y !== 0) {
			changed = true;
		}
		this.center.x += this.speed.x * deltaTime;
		this.center.y += this.speed.y * deltaTime;
		this.speed.y += GRAVITY * deltaTime; // Gravity
		// Collision
		if (collisionCheck().some(Boolean)) {
			collisionResolve();
			this.speed.y = 0;
			// Friction
			if (Math.abs(this.speed.x) < FRICTION * deltaTime) {
				this.speed.x = 0;
			} else {
				this.speed.x -= Math.sign(this.speed.x) * FRICTION * deltaTime;
			}
		}
	}
}
// Collision
function collisionCheck() {
	return COLLISION_POINTS.map(([x, y]) => context.isPointInPath(hitbox, character.center.x + x * RADIUS, character.center.y + y * RADIUS));
}
function collisionResolve() {
	// Rough resolution
	while (collisionCheck().some(Boolean)) {
		character.center.x -= character.speed.x * COLLISION_RESOLUTION_STEP;
		character.center.y -= character.speed.y * COLLISION_RESOLUTION_STEP;
	}
	// Fine resolution (binary search)
	let factor = COLLISION_RESOLUTION_STEP;
	for (let i = 0; i < COLLISION_RESOLUTION_ITERATIONS; i++) {
		if (collisionCheck().some(Boolean)) {
			character.center.x -= character.speed.x * factor;
			character.center.y -= character.speed.y * factor;
		} else {
			character.center.x += character.speed.x * factor;
			character.center.y += character.speed.y * factor;
		}
		factor /= 2;
	}
	character.center.y += character.speed.y * factor * 2; // Keep character in ground to prevent gravity next update
}
// Game and level management
function drawDebugText() {
	changed = true;
	context.fillStyle = colors.text;
	context.font = "30px monospace";
	const texts = {
		Center: `${character.center.x.toFixed(4)}, ${character.center.y.toFixed(4)}`,
		Speed: `${character.speed.x.toFixed(2)}, ${character.speed.y.toFixed(2)}`,
		Contacts: `${collisionCheck().some(Boolean) ? "T" : "F"}: ${collisionCheck().map((value) => value ? "T" : "F")}`,
		FPS: `${fps.toFixed(2)}`,
		Time: `${time / 1000} seconds`
	};
	let textY = DEBUG_Y - (Object.keys(texts).length - 1) * DEBUG_LINE_HEIGHT;
	for (const [key, value] of Object.entries(texts)) {
		context.textAlign = "right";
		context.fillText(`${key}: `, DEBUG_X, textY);
		context.textAlign = "left";
		context.fillText(value, DEBUG_X, textY);
		textY += DEBUG_LINE_HEIGHT;
	}
}
export function newGame() {
	heldKeys.clear();
	character = new Character();
	changed = true;
	// Level
	newLevel(1);
	// Time
	startTime = window.performance.now();
	time = 0;
	fps = 0;
	// Add objects
	objects.set("background", new Drawable(() => context.drawImage(images[`level${levelNumber}`], 0, 0, 1920, 1280))); // Replaces placeholder background
	if (settings.debug) {
		objects.set("debug", new Drawable(drawDebugText));
	}
}
function newLevel(number) {
	if (levels[`level${number}`] == null) {
		endGame();
		return;
	}
	console.log(`Level ${number}`);
	levelNumber = number;
	level = levels[`level${number}`];
	const pathText = level.getElementById("hitbox").getAttribute("d");
	hitbox = new Path2D(pathText);
	const spawnpoint = level.getElementById("spawnpoint"); // Spawnpoint is bottom center
	character = new Character(Number.parseFloat(spawnpoint.getAttribute("cx")), Number.parseFloat(spawnpoint.getAttribute("cy")) - RADIUS);
}
function endGame(win) {
	if (!win) {
		stateMachines.main.lose("Exited");
		return;
	}
	stateMachines.main.lose({Time: `${time / 1000} seconds`});
}
// Game loop
export function onKeyDown(e) {
	if (!heldKeys.has(e.key)) { // Prevent held key spam
		heldKeys.add(e.key);
		handle(e);
	}
}
export function onKeyUp(e) {
	heldKeys.delete(e.key);
}
export function handle({key}) {
	if (key === "Escape") {
		heldKeys.clear();
		endGame();
	}
}
function handleHeld(deltaTime) {
	if (heldKeys.has("ArrowLeft") !== heldKeys.has("ArrowRight")) {
		const direction = heldKeys.has("ArrowLeft") ? -1 : 1;
		character.speed.x += direction * SPEED * deltaTime;
		if (Math.abs(character.speed.x) > MAX_SPEED) {
			character.speed.x = Math.sign(character.speed.x) * MAX_SPEED;
		}
	}
}
export function update(deltaTime) {
	time = window.performance.now() - startTime;
	fps = 1 / deltaTime;
	// Handle held keys
	handleHeld(deltaTime);
	// Update game state
	character.update(deltaTime);
	// New level
	if (character.center.x - RADIUS > 1920) {
		newLevel(levelNumber + 1);
	}
	return changed;
}
export function render() {
	changed = false;
}