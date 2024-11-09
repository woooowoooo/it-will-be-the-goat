// Canvas
const canvas = document.getElementById("game");
canvas.width = 1920;
canvas.height = 1280;
const context = canvas.getContext("2d");
context.imageSmoothingEnabled = false;
// Colors
const colors = {
	background1: "hsl(220, 25%, 90%)",
	background2: "hsl(210, 15%, 75%)",
	character: "hsl(210, 65%, 85%)",
	accent: "hsl(30, 90%, 55%)",
	widget1: "hsl(0, 0%, 80%)",
	widget2: "hsl(0, 0%, 70%)",
	widget3: "hsl(0, 0%, 60%)",
	text: "black"
};
// Variables
const mouse = {
	x: 0,
	y: 0
};
const images = {};
const sounds = {};
const levels = {};
const stateMachines = {
	main: null
};
const objects = new Map();
// Settings
const defaultSettings = {
	debug: false,
	debugFPS: false,
	muted: false,
	volume: 100
};
const settings = new Proxy(JSON.parse(localStorage.getItem("frozenSettings")) ?? defaultSettings, {
	get: function (_, property) {
		return Reflect.get(...arguments) ?? defaultSettings[property];
	},
	set: function (target, property, value) {
		console.log(`${property} has been set to ${value}`);
		const valid = Reflect.set(...arguments);
		localStorage.setItem("frozenSettings", JSON.stringify(target));
		return valid;
	}
});
// Helper functions
Object.defineProperty(context, "fontSize", {
	set: size => {
		context.font = `500 ${size * 10}px Raleway, sans-serif`; // TODO: Update font
	}
});
export function clear() {
	context.clearRect(0, 0, 1920, 1280);
	for (const object of Array.from(objects.values()).filter(object => object.clear != null)) {
		object.clear();
	}
	objects.clear();
}
export function clearSounds() {
	for (const sound of Object.values(sounds)) {
		sound.pause();
		sound.currentTime = 0;
	}
}
export function render() {
	context.clearRect(0, 0, 1920, 1280);
	for (const object of objects.values()) {
		object.draw();
	}
}
function getMousePosition(event) {
	const bounds = canvas.getBoundingClientRect();
	mouse.x = (event.clientX - bounds.left) * 1920 / (bounds.right - bounds.left);
	mouse.y = (event.clientY - bounds.top) * 1280 / (bounds.bottom - bounds.top);
}
function wrapClickEvent(callback, hitbox, checkCondition) {
	// TODO: Figure out a way to use {once: true}
	function fullCallback() {
		if (context.isPointInPath(hitbox, mouse.x, mouse.y) && checkCondition()) {
			callback();
			canvas.removeEventListener("click", fullCallback);
		}
	};
	canvas.addEventListener("click", fullCallback);
	return fullCallback;
}
canvas.addEventListener("click", getMousePosition);
// Loading assets
export async function loadResources() {
	const imageData = {
		background: "svg",
		soundOff: "png",
		soundOn: "png"
	};
	const soundData = {
		goldbergAria: "mp3",
		goldbergVar1: "mp3",
		death: "mp3"
	};
	const levelAmount = 4;
	const promises = [];
	const initialize = function (cache, id, path, type, eventType) {
		cache[id] = document.createElement(type);
		cache[id].src = path;
		promises.push(new Promise(resolve => {
			cache[id].addEventListener(eventType, resolve, {once: true});
		}));
	};
	for (const [name, extension] of Object.entries(imageData)) {
		initialize(images, name, `images/${name}.${extension}`, "img", "load");
	}
	for (const [name, extension] of Object.entries(soundData)) {
		initialize(sounds, name, `sounds/${name}.${extension}`, "audio", "canplaythrough");
		sounds[name].preload = "auto";
		sounds[name].muted = settings.muted;
		sounds[name].volume = settings.volume / 100;
	}
	for (let i = 1; i <= levelAmount; i++) {
		promises.push(new Promise(async resolve => { // "Inline" SVG for hitbox
			const levelFile = await window.fetch(`levels/level${i}.svg`).then(response => response.text());
			levels[`level${i}`] = (new DOMParser()).parseFromString(levelFile, "image/svg+xml");
			resolve();
		}));
		initialize(images, `level${i}`, `levels/level${i}.svg`, "img", "load"); // Image element for graphical rendering
	}
	return Promise.all(promises);
}
// UI Elements
export class Drawable {
	constructor (draw) {
		this.draw = draw;
	}
}
class Button extends Drawable {
	constructor (hitbox, draw, callback) {
		super(draw);
		this.callback = callback;
		this.hitbox = hitbox;
		this.state = stateMachines.main.state;
		this.fullCallback = wrapClickEvent(callback, hitbox, () => stateMachines.main.state === this.state);
	}
	clear() {
		canvas.removeEventListener("click", this.fullCallback);
	}
}
export class MuteButton extends Button {
	constructor () {
		const [X, Y, DX, DY] = [1920 - 96, 1280 - 96, 96, 96];
		const hitbox = new Path2D();
		hitbox.rect(X, Y, DX, DY);
		hitbox.closePath();
		function draw() {
			context.drawImage(images[settings.muted ? "soundOff" : "soundOn"], X, Y, DX, DY);
		}
		function callback() {
			settings.muted = !settings.muted;
			console.log(settings.muted ? "Muted" : "Unmuted");
			for (const sound of Object.values(sounds)) {
				sound.muted = settings.muted;
			}
			objects.set("mute", new MuteButton());
			render();
		}
		super(hitbox, draw, callback);
	}
}
export class TextButton extends Button {
	constructor (x, y, text, callback, width) {
		const hitbox = new Path2D();
		hitbox.rect(x - width / 2, y, width, 128);
		hitbox.closePath();
		function draw() {
			context.fillStyle = colors.widget1;
			context.fill(hitbox);
			context.fillStyle = colors.widget3;
			context.fillRect(x - width / 2, y + 112, width, 16);
			context.fillStyle = colors.text;
			context.fontSize = 8;
			context.textAlign = "center";
			context.fillText(text, x, y + 88);
		}
		super(hitbox, draw, callback);
	}
}
export class TextToggle extends TextButton {
	constructor (x, y, settingName) {
		function callback() {
			settings[settingName] = !settings[settingName];
			objects.set(settingName, new TextToggle(x, y, settingName));
			render();
		}
		super(x, y, settings[settingName], callback, 480);
	}
}
export class Slider extends Drawable {
	static THICKNESS = 12;
	static HEIGHT = 36;
	constructor (x, y, width, settingName, start, end, step = 1, intValues = true, callback) {
		function draw() {
			// Slider bar
			context.fillStyle = colors.widget2;
			context.fillRect(x - width / 2, y - Slider.THICKNESS / 3, width, Slider.THICKNESS * 2 / 3);
			// Tick marks
			const divisions = (end - start) / step;
			for (let i = 0; i <= divisions; i++) {
				context.fillRect(x - width / 2 + i * width / divisions - Slider.THICKNESS / 2, y - Slider.HEIGHT / 3, Slider.THICKNESS, Slider.HEIGHT * 2 / 3);
			}
			// End ticks
			context.fillStyle = colors.widget3;
			context.fillRect(x - width / 2 - Slider.THICKNESS / 2, y - Slider.HEIGHT / 2, Slider.THICKNESS, Slider.HEIGHT);
			context.fillRect(x + width / 2 - Slider.THICKNESS / 2, y - Slider.HEIGHT / 2, Slider.THICKNESS, Slider.HEIGHT);
			// Slider
			context.fillStyle = colors.accent;
			const position = (settings[settingName] - start) / (end - start) * width + x - width / 2;
			context.fillRect(position - 20, y - 32, 40, 64);
			context.fontSize = 6;
			context.fillStyle = colors.text;
			context.textAlign = "right";
			context.fillText(start, x - width / 2 - 40, y + 20);
			context.textAlign = "left";
			context.fillText(end, x + width / 2 + 40, y + 20);
			context.textAlign = "center";
		}
		super(draw);
		// Add sliding
		let isSliding = false;
		const hitbox = new Path2D();
		hitbox.rect(x - width / 2 - 20, y - 32, width + 40, 64);
		hitbox.closePath();
		this.onMouseDown = e => {
			getMousePosition(e);
			if (context.isPointInPath(hitbox, mouse.x, mouse.y)) {
				isSliding = true;
				this.update(e);
			}
		};
		this.update = e => {
			getMousePosition(e);
			if (isSliding) {
				let value = (mouse.x - (x - width / 2)) / width * (end - start) + start;
				let constrainedValue = Math.max(start, Math.min(end, value));
				settings[settingName] = intValues ? Math.round(constrainedValue) : constrainedValue;
				if (callback != null) {
					callback();
				}
				render();
			}
		};
		this.onMouseUp = e => {
			isSliding = false;
			this.update(e);
		};
		canvas.addEventListener("mousedown", this.onMouseDown);
		canvas.addEventListener("mousemove", this.update);
		canvas.addEventListener("mouseup", this.onMouseUp);
	}
	clear() {
		canvas.removeEventListener("mousedown", this.onMouseDown);
		canvas.removeEventListener("mousemove", this.update);
		canvas.removeEventListener("mouseup", this.onMouseUp);
	}
}
export class TextInput extends Button {
	constructor (x, y, width, settingName) {
		let self; // I'm sorry
		const hitbox = new Path2D();
		hitbox.rect(x, y - 32, width, 64);
		hitbox.closePath();
		function draw() {
			context.fillStyle = "white";
			context.fillRect(x, y + 32, width, 8);
			context.fontSize = 6;
			context.textAlign = "left";
			context.fillText(self.buffer, x, y + 20, width);
			if (self.focused) {
				context.fillRect(x + context.measureText(self.buffer).width, y - 28, 8, 56);
			}
		};
		function onKeyDown(e) {
			if (e.key === "Enter") {
				if (settingName != null) {
					settings[settingName] = self.buffer;
				}
				window.removeEventListener("keydown", onKeyDown);
				self.focused = false;
				self.fullCallback = wrapClickEvent(focus, hitbox, () => stateMachines.main.state === self.state);
			} else if (e.key === "Backspace") {
				self.buffer = self.buffer.slice(0, -1);
			} else if (e.key.length === 1) {
				self.buffer += e.key;
			}
			render();
		};
		function focus() {
			window.addEventListener("keydown", onKeyDown);
			self.focused = true;
			render();
		}
		super(hitbox, draw, focus);
		this.buffer = settings[settingName] ?? "";
		this.focused = false;
		self = this;
	}
}
export {canvas, context, colors, images, sounds, levels, stateMachines, objects, settings};