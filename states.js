import StateMachine from "./state-machine/module.js";
import {
	canvas, context, colors, images, sounds, stateMachines, objects, settings,
	clear, clearSounds, render, loadResources,
	Drawable, MuteButton, TextButton, TextToggle, Slider
} from "./index.js";
import {newGame, onKeyDown, onKeyUp, update, render as gameRender} from "./game.js";
// State machine
const stateMachine = new StateMachine({
	init: "boot",
	transitions: [{
		name: "toMenu",
		from: ["boot", "menu", "settings", "help", "credits", "gameOver"],
		to: "menu"
	}, {
		name: "start",
		from: "menu",
		to: "game"
	}, {
		name: "toSettings",
		from: "menu",
		to: "settings"
	}, {
		name: "toHelp",
		from: "menu",
		to: "help"
	}, {
		name: "toCredits",
		from: "menu",
		to: "credits"
	}, {
		name: "lose",
		from: "game",
		to: "gameOver"
	}, {
		name: "retry",
		from: "gameOver",
		to: "game"
	}],
	methods: {
		onTransition(lifecycle) {
			console.log(`Transition: ${lifecycle.transition}\tNew State: ${lifecycle.to}`);
		},
		onAfterTransition() {
			render();
		},
		async onBoot() {
			// Loading screen
			objects.set("background", new Drawable(() => {
				context.fillStyle = "black";
				context.fillRect(0, 0, 1920, 1280);
			}));
			objects.set("loading", new Drawable(() => {
				context.fillStyle = "white";
				context.fontSize = 16;
				context.textAlign = "center";
				context.fillText("LOADING", 960, 400);
				context.fontSize = 8;
				context.fillText("If this doesn't go away,", 960, 800);
				context.fillText("refresh the page.", 960, 960);
			}));
			render();
			await loadResources();
			console.log("Resources loaded.", images, sounds);
			objects.delete("loading");
			// Prompt for user interaction so autoplay won't get blocked
			objects.set("prompt", new Drawable(() => {
				context.fillStyle = "white";
				context.fontSize = 8;
				context.textAlign = "center";
				context.fillText("Loading finished.", 960, 400);
				context.fillText("CLICK ANYWHERE", 960, 800);
				context.fillText("TO CONTINUE", 960, 960);
			}));
			canvas.addEventListener("click", stateMachine.toMenu, {once: true});
		},
		onMenu() {
			clear();
			sounds.goldbergAria.play();
			objects.set("background", new Drawable(() => context.drawImage(images.background, 0, 0, 1920, 1280)));
			objects.set("title", new Drawable(() => {
				context.fillStyle = colors.text;
				context.fontSize = 16;
				context.fillText("“it will be the goat”", 960, 360);
			}));
			objects.set("start", new TextButton(960, 560, "Start", stateMachine.start, 640));
			objects.set("settings", new TextButton(960, 720, "Settings", stateMachine.toSettings, 640));
			objects.set("help", new TextButton(960, 880, "Help", stateMachine.toHelp, 640));
			objects.set("credits", new TextButton(960, 1040, "Credits", stateMachine.toCredits, 640));
			objects.set("mute", new MuteButton());
		},
		onSettings() {
			clear();
			objects.set("background", new Drawable(() => context.drawImage(images.background, 0, 0, 1920, 1280)));
			const debugOffset = settings.debug ? 180 : 0;
			objects.set("text", new Drawable(() => {
				context.fillStyle = colors.text;
				context.textAlign = "right";
				context.fillText("Debug:", 600, 240 + 88);
				context.fillText("Volume:", 600, 480 + 20 + debugOffset);
			}));
			if (settings.debug) {
				objects.set("debugFPSText", new Drawable(() => context.fillText("Limit FPS:", 600, 420 + 88)));
				objects.set("debugFPS", new TextToggle(1200, 420, "debugFPS"));
			}
			objects.set("debug", new TextToggle(1200, 240, "debug"));
			objects.set("volume", new Slider(1200, 480 + debugOffset, 960, "volume", 0, 100, 10, false, () => {
				for (const sound of Object.values(sounds)) {
					sound.volume = settings.volume / 100;
				}
			}));
			objects.set("return", new TextButton(960, 880, "Return", stateMachine.toMenu, 640));
			objects.set("mute", new MuteButton());
		},
		onHelp() {
			clear();
			objects.set("background", new Drawable(() => context.drawImage(images.background, 0, 0, 1920, 1280)));
			objects.set("help", new Drawable(() => {
				context.fillStyle = colors.text;
				context.fontSize = 6;
				context.fillText("This game is a work-in-progress. There will be bugs!", 960, 280);
			}));
			objects.set("return", new TextButton(960, 880, "Return", stateMachine.toMenu, 640));
			objects.set("mute", new MuteButton());
		},
		onCredits() {
			clear();
			objects.set("background", new Drawable(() => context.drawImage(images.background, 0, 0, 1920, 1280)));
			objects.set("credits", new Drawable(() => {
				context.fillStyle = colors.text;
				context.fontSize = 12;
				context.fillText("Everything", 960, 240);
				context.fontSize = 8;
				context.fillText("woooowoooo", 960, 340);
				context.fontSize = 10;
				context.fillText("Music", 560, 560);
				context.fillText("Font", 1360, 560);
				context.fontSize = 6;
				context.fillText("Goldberg Variations: Aria, Var. 1", 560, 640);
				context.fillText("Raleway", 1360, 640);
				context.fontSize = 4;
				context.fillText("Johann Sebastian Bach", 560, 700);
				context.fillText("(performed by Kimiko Ishizaka)", 560, 740);
				context.fillText("Matt McInerney", 1360, 700);
				context.fillText("(The League of Moveable Type)", 1360, 740);
			}));
			objects.set("return", new TextButton(960, 880, "Return", stateMachine.toMenu, 640));
			objects.set("mute", new MuteButton());
		},
		onGame() {
			clear();
			clearSounds();
			sounds.goldbergVar1.play();
			window.addEventListener("keydown", onKeyDown);
			window.addEventListener("keyup", onKeyUp);
			objects.set("background", new Drawable(() => context.drawImage(images.background, 0, 0, 1920, 1280))); // Placeholder, replaced in game
			objects.set("mute", new MuteButton());
			objects.set("game", new Drawable(gameRender));
			newGame();
			lastTime = window.performance.now();
			requestAnimationFrame(loop);
		},
		onGameOver(_, text) {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			clearSounds();
			objects.set("endScreen", new Drawable(() => {
				context.fillStyle = "rgba(0, 0, 0, 0.5)";
				context.fillRect(0, 0, 1920, 1280);
				context.fillStyle = "white";
				context.fontSize = 16;
				context.textAlign = "center";
				context.fillText("GAME OVER", 960, 400);
				context.fontSize = 8;
				let textY = 540;
				if (typeof text === "string") {
					context.fillText(text, 960, textY);
					return;
				}
				for (const [key, value] of Object.entries(text)) {
					context.textAlign = "right";
					context.fillText(`${key}: `, 960, textY);
					context.textAlign = "left";
					context.fillText(value, 960, textY);
					textY += 100;
				}
			}));
			objects.set("menu", new TextButton(672, 880, "Menu", stateMachine.toMenu, 480));
			objects.set("retry", new TextButton(1248, 880, "Retry", stateMachine.retry, 480));
		}
	}
});
stateMachines.main = stateMachine;
// Main loop
const DEBUG_FPS = 5;
const FRAME_TIME = 1 / DEBUG_FPS;
const MAX_DELTA_TIME = 1 / 5;
let lastTime = window.performance.now();
function loop(time) {
	let deltaTime = (time - lastTime) / 1000; // Convert to seconds
	// Lock to low framerate when debugging
	if (settings.debug && settings.debugFPS && deltaTime < FRAME_TIME) {
		requestAnimationFrame(loop);
		return;
	}
	lastTime = time;
	// Update game state (input handling is done in game.js)
	let changed = false;
	while (deltaTime > 0) { // Update multiple times if time change is too large
		// Break on game loss
		if (!stateMachine.is("game")) {
			return;
		}
		changed |= update(Math.min(MAX_DELTA_TIME, deltaTime)); // ||= would short-circuit
		deltaTime -= MAX_DELTA_TIME;
	}
	// Render if anything changed
	if (changed) {
		render();
	}
	requestAnimationFrame(loop);
}