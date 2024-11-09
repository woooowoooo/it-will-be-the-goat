import {context, colors, images, sounds, stateMachines, objects, settings, Drawable} from "./index.js";
// Constants
const RADIUS = 50;
// Linear speed
const GRAVITY = 1000; // px / sec^2
const FRICTION = 500; // px / sec^2
const SENSITIVITY = 1000; // px / sec^2
const MAX_SPEED = 750; // px / sec
// Angular speed
const ANGULAR_GRAVITY = 720; // deg / sec^2
const ANGULAR_DRAG = 1; // 1 / sec somehow
const ANGULAR_SENSITIVITY = 720; // deg / sec^2
const MAX_ANGULAR_SPEED = 180; // deg / sec
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
const COLLISION_RESOLUTION_STEP = 10;
const COLLISION_RESOLUTION_ITERATIONS = 12; // Precision of collision resolution
const COLLISION_DEPTH_STEP = 16;
const COLLISION_DEPTH_ITERATIONS = 3;
const NORMAL_ANGLE_PRECISION = 10;
// Rendering
const DEBUG_X = 200;
const DEBUG_Y = 1260;
const DEBUG_LINE_HEIGHT = 40;
// State variables
export const highScores = new Proxy(JSON.parse(localStorage.getItem("frozenHighScores")) ?? {}, {
	set: function (target, property, value) {
		console.log(`${property} has been set to ${value}`);
		const valid = Reflect.set(...arguments);
		localStorage.setItem("frozenHighScores", JSON.stringify(target));
		return valid;
	}
});
const heldKeys = new Set();
let character = null;
let deaths = 0;
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
	constructor (x = 0, y = 0, rotation = 0) {
		changed = true;
		function draw() {
			const radians = (this.rotation + 45) * Math.PI / 180; // Convert to radians and offset
			const cosOffset = Math.sqrt(2) * RADIUS * Math.cos(radians);
			const sinOffset = Math.sqrt(2) * RADIUS * Math.sin(radians);
			// Base
			context.fillStyle = colors.character;
			const hitbox = new Path2D();
			hitbox.moveTo(this.center.x - cosOffset, this.center.y - sinOffset);
			hitbox.lineTo(this.center.x - sinOffset, this.center.y + cosOffset);
			hitbox.lineTo(this.center.x + cosOffset, this.center.y + sinOffset);
			hitbox.lineTo(this.center.x + sinOffset, this.center.y - cosOffset);
			hitbox.closePath();
			context.fill(hitbox);
			// Platform
			context.fillStyle = colors.accent;
			context.beginPath();
			context.moveTo(...this.transform(-1, 3 / 4));
			context.lineTo(this.center.x - sinOffset, this.center.y + cosOffset);
			context.lineTo(this.center.x + cosOffset, this.center.y + sinOffset);
			context.lineTo(...this.transform(1, 3 / 4));
			context.closePath();
			context.fill();
		}
		super(draw);
		this.center = {x, y};
		this.speed = {x: 0, y: 0};
		this.acceleration = {x: 0, y: 0};
		this.rotation = rotation; // Degrees clockwise (y direction opposite of math graphs)
		this.angularSpeed = 0;
		objects.set("character", this);
	}
	get radians() {
		return this.rotation * Math.PI / 180;
	}
	transform(x, y) {
		return [
			this.center.x + x * RADIUS * Math.cos(this.radians) - y * RADIUS * Math.sin(this.radians),
			this.center.y + x * RADIUS * Math.sin(this.radians) + y * RADIUS * Math.cos(this.radians)
		];
	}
	update(deltaTime) {
		// Apply changes
		if (this.speed.x !== 0 || this.speed.y !== 0) {
			changed = true;
		}
		this.center.x += this.speed.x * deltaTime;
		this.center.y += this.speed.y * deltaTime;
		this.rotation = (this.rotation + this.angularSpeed * deltaTime) % 360;
		// Gravity
		this.speed.y += GRAVITY * deltaTime;
		const contacts = collisionCheck();
		if (contacts.filter(Boolean).length === 1) { // Rotation if one point of contact
			// Fall away from contact point
			const contactAngle = contacts.findIndex(Boolean) * 45 + 225; // 225° is angle of top left corner in Canvas (inverted y-axis) coordinates
			const direction = -Math.cos((contactAngle + this.rotation) * Math.PI / 180);
			this.angularSpeed += direction * ANGULAR_GRAVITY * deltaTime;
		}
		// Angular drag
		if (Math.abs(this.angularSpeed) < Math.abs(ANGULAR_DRAG * this.angularSpeed * deltaTime)) {
			this.angularSpeed = 0;
		} else {
			this.angularSpeed -= ANGULAR_DRAG * this.angularSpeed * deltaTime;
		}
		// Collision
		if (collisionCheck().some(Boolean)) { // Cannot use contacts again because angle change
			const normalAngle = collisionResolve();
			// Normal force
			const normalForce = -GRAVITY * Math.sin(normalAngle);
			this.speed.x += normalForce * Math.cos(normalAngle) * deltaTime;
			this.speed.y += normalForce * Math.sin(normalAngle) * deltaTime;
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
function averageAngles(angles) { // Convert to coordinates, average, convert back to angle (all in radians)
	const x = angles.map(angle => Math.cos(angle)).reduce((a, b) => a + b) / angles.length;
	const y = angles.map(angle => Math.sin(angle)).reduce((a, b) => a + b) / angles.length;
	return Math.atan2(Math.round(y * 100) / 100, Math.round(x * 100) / 100);
}
function collisionCheck() {
	return COLLISION_POINTS.map(([x, y]) => context.isPointInPath(hitbox, ...character.transform(x, y)));
}
function findNormal(x, y) { // For now just return straight up
	// Find collision depth
	let depth = 0;
	let inStroke = false;
	// Rough finding
	while (!inStroke) {
		depth += COLLISION_DEPTH_STEP;
		context.lineWidth = depth;
		context.stroke(hitbox);
		inStroke = context.isPointInStroke(hitbox, x, y);
	}
	// Fine finding
	/* let factor = COLLISION_DEPTH_STEP / 2;
	depth -= factor;
	for (let i = 0; i < COLLISION_DEPTH_ITERATIONS; i++) {
		context.clearRect(0, 0, 1920, 1280);
		context.lineWidth = depth;
		context.stroke(hitbox);
		inStroke = context.isPointInStroke(hitbox, x, y);
		if (inStroke) {
			depth += factor;
		} else {
			depth -= factor;
		}
		factor /= 2;
	}
	depth += factor * 2; // Make sure there exists a free angle in the ring */
	// Find direction
	const freeAngles = [];
	for (let i = 0; i < 360; i += NORMAL_ANGLE_PRECISION) {
		const radians = i * Math.PI / 180;
		if (!context.isPointInPath(hitbox, x + Math.cos(radians) * depth, y + Math.sin(radians) * depth)) {
			freeAngles.push(radians);
		}
	}
	console.log(`${depth.toFixed(2)}, ${x.toFixed(2)}, ${y.toFixed(2)}, ${(averageAngles(freeAngles) * 180 / Math.PI).toFixed(2)}, ${freeAngles.map(angle => Math.round(angle * 180 / Math.PI))}`);
	return averageAngles(freeAngles);
}
function collisionResolve() {
	const normalAngles = collisionCheck()
		.map((collided, i) => [COLLISION_POINTS[i], collided])
		.filter(([_, collided]) => collided)
		.map(([point, _]) => findNormal(...character.transform(...point)));
	const normalAngle = averageAngles(normalAngles);
	// console.log((normalAngle * 180 / Math.PI).toFixed(2));
	// Rough resolution (spam going away from every contact point)
	while (collisionCheck().some(Boolean)) {
		character.center.x += Math.cos(normalAngle) * COLLISION_RESOLUTION_STEP;
		character.center.y += Math.sin(normalAngle) * COLLISION_RESOLUTION_STEP;
	}
	// Fine resolution (binary search)
	let factor = COLLISION_RESOLUTION_STEP;
	for (let i = 0; i < COLLISION_RESOLUTION_ITERATIONS; i++) {
		if (collisionCheck().some(Boolean)) {
			character.center.x += Math.cos(normalAngle) * factor;
			character.center.y += Math.sin(normalAngle) * factor;
		} else {
			character.center.x -= Math.cos(normalAngle) * factor;
			character.center.y -= Math.sin(normalAngle) * factor;
		}
		factor /= 2;
	}
	character.center.y += factor * 2; // Keep character in ground to prevent gravity next update
	return normalAngle;
}
// Game and level management
function drawDebugText() {
	changed = true;
	context.fillStyle = colors.text;
	context.font = "30px monospace";
	const texts = {
		Center: `${character.center.x.toFixed(4)}, ${character.center.y.toFixed(4)}`,
		Speed: `${character.speed.x.toFixed(2)}, ${character.speed.y.toFixed(2)}`,
		Rotation: `${character.rotation.toFixed(2)}°`,
		ASpeed: `${character.angularSpeed.toFixed(2)}°`,
		Contacts: `${collisionCheck().some(Boolean) ? "T" : "F"}: ${collisionCheck().map((value) => value ? "T" : "F")}`,
		Deaths: `${deaths}`,
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
	deaths = 0;
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
		endGame(true);
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
		stateMachines.main.lose("Retry?");
		return;
	}
	highScores.time = Math.min(time, highScores.time ?? Infinity);
	stateMachines.main.lose({
		Deaths: deaths,
		Time: `${time / 1000} seconds`,
		"Fastest Time": `${highScores.time / 1000} seconds`
	});
}
// Game mechanics
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
		endGame(false);
	} else if (key === "r" || key === "R") {
		newLevel(levelNumber);
	}
}
function handleHeld(deltaTime) {
	if (heldKeys.has("ArrowLeft") !== heldKeys.has("ArrowRight")) {
		const direction = heldKeys.has("ArrowLeft") ? -1 : 1;
		character.speed.x += direction * Math.cos(character.radians) * SENSITIVITY * deltaTime;
		character.speed.y += direction * Math.sin(character.radians) * SENSITIVITY * deltaTime;
		if (Math.abs(character.speed.x) > MAX_SPEED) { // TODO: Figure out what to do with vertical speed
			character.speed.x = Math.sign(character.speed.x) * MAX_SPEED;
		}
	}
	if (heldKeys.has("x") || heldKeys.has("x") || heldKeys.has("ArrowUp")) {
		character.angularSpeed += ANGULAR_SENSITIVITY * deltaTime; // Clockwise
		character.angularSpeed = Math.min(character.angularSpeed, MAX_ANGULAR_SPEED);
	}
	if (heldKeys.has("Z") || heldKeys.has("z") || heldKeys.has("ArrowDown")) {
		character.angularSpeed -= ANGULAR_SENSITIVITY * deltaTime; // Counterclockwise
		character.angularSpeed = Math.max(character.angularSpeed, -MAX_ANGULAR_SPEED);
	}
}
export function update(deltaTime) {
	time = window.performance.now() - startTime;
	fps = 1 / deltaTime;
	// Handle held keys
	handleHeld(deltaTime);
	// Update game state
	character.update(deltaTime);
	// Restart upon fall
	if (character.center.y - RADIUS > 1280) {
		deaths++;
		console.log(`You died (death #${deaths})`);
		sounds.death.play();
		newLevel(levelNumber);
	}
	// New level
	if (character.center.x - RADIUS > 1920) {
		newLevel(levelNumber + 1);
	}
	return changed;
}
export function render() {
	changed = false;
}