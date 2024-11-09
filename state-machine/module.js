/* I DID NOT CREATE THIS LIBRARY.
The original source code is at https://github.com/jakesgordon/javascript-state-machine.
My fork is at https://github.com/woooowoooo/javascript-state-machine.
Updated to use modern JS syntax. */
// util.js
class Exception {
	constructor (message, transition, from, to, current) {
		this.message = message;
		this.transition = transition;
		this.from = from;
		this.to = to;
		this.current = current;
	}
}
function camelize(label) {
	if (label.length === 0) {
		return label;
	}
	let words = label.split(/[_-]/);
	// single word with first character already lowercase, return untouched
	if ((words.length === 1) && (words[0][0].toLowerCase() === words[0][0])) {
		return label;
	}
	let result = words[0].toLowerCase();
	for (let word of words.slice(1)) {
		result += word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
	}
	return result;
}
function prepend(prepend, label) {
	label = camelize(label);
	return prepend + label[0].toUpperCase() + label.substring(1);
}
function hook(fsm, name, additional) {
	let plugins = fsm.config.plugins;
	let args = [fsm.context];
	if (additional) {
		args = args.concat(additional);
	}
	for (let plugin of plugins) {
		let method = plugin[name];
		if (method) {
			method.apply(plugin, args);
		}
	}
}
// config.js
class Config {
	constructor (options = {}, StateMachine) {
		this.options = options; // preserving original options can be useful (e.g visualize plugin)
		this.defaults = StateMachine.defaults;
		this.states = [];
		this.transitions = [];
		this.map = {};
		this.map[this.defaults.wildcard] = {};
		this.lifecycle = this.configureLifecycle();
		this.init = this.configureInitTransition(options.init);
		this.data = this.configureData(options.data);
		this.methods = options.methods ?? {};
		this.configureTransitions(options.transitions);
		this.plugins = this.configurePlugins(options.plugins, StateMachine.plugin);
	}
	addState(name) {
		if (!this.map[name]) {
			this.states.push(name);
			this.addStateLifecycleNames(name);
			this.map[name] = {};
		}
	}
	addStateLifecycleNames(name) {
		this.lifecycle.onEnter[name] = prepend('onEnter', name);
		this.lifecycle.onLeave[name] = prepend('onLeave', name);
		this.lifecycle.on[name] = prepend('on', name);
	}
	addTransition(name) {
		if (this.transitions.indexOf(name) < 0) {
			this.transitions.push(name);
			this.addTransitionLifecycleNames(name);
		}
	}
	addTransitionLifecycleNames(name) {
		this.lifecycle.onBefore[name] = prepend('onBefore', name);
		this.lifecycle.onAfter[name] = prepend('onAfter', name);
		this.lifecycle.on[name] = prepend('on', name);
	}
	mapTransition(transition) {
		let {name, from, to} = transition;
		this.addState(from);
		if (typeof to !== 'function') {
			this.addState(to);
		}
		this.addTransition(name);
		this.map[from][name] = transition;
		return transition;
	}
	configureLifecycle() {
		return {
			onBefore: {transition: 'onBeforeTransition'},
			onAfter: {transition: 'onAfterTransition'},
			onEnter: {state: 'onEnterState'},
			onLeave: {state: 'onLeaveState'},
			on: {transition: 'onTransition'}
		};
	}
	configureInitTransition(init) {
		if (typeof init === 'string') {
			return this.mapTransition({...this.defaults.init, to: init, active: true});
		} else if (typeof init === 'object') {
			return this.mapTransition({...this.defaults.init, ...init, active: true});
		} else {
			this.addState(this.defaults.init.from);
			return this.defaults.init;
		}
	}
	configureData(data) {
		if (typeof data === 'function') {
			return data;
		} else if (typeof data === 'object') {
			return (() => data);
		} else {
			return (() => {});
		}
	}
	configurePlugins(plugins = [], builtin) { // builtin is unused?
		for (let n in plugins) {
			let plugin = plugins[n];
			if (typeof plugin === 'function') {
				let plugin = plugin();
				plugins[n] = plugin;
			}
			if (plugin.configure) {
				plugin.configure(this);
			}
		}
		return plugins;
	}
	configureTransitions(transitions = []) {
		let wildcard = this.defaults.wildcard;
		for (let transition of transitions) {
			let from = Array.isArray(transition.from) ? transition.from : [transition.from ?? wildcard];
			let to = transition.to ?? wildcard;
			for (let element of from) {
				this.mapTransition({name: transition.name, from: element, to: to});
			}
		}
	}
	transitionFor(state, transition) {
		return this.map[state][transition] ?? this.map[this.defaults.wildcard][transition];
	}
	transitionsFor(state) {
		return Object.keys(this.map[state]).concat(Object.keys(this.map[this.defaults.wildcard]));
	}
	allStates() {
		return this.states;
	}
	allTransitions() {
		return this.transitions;
	}
}
// jsm.js
let UNOBSERVED = [null, []];
class JSM {
	constructor (context, config) {
		this.context = context;
		this.config = config;
		this.state = config.init.from;
		this.observers = [context];
	}
	init(args) {
		Object.assign(this.context, this.config.data.apply(this.context, args));
		hook(this, 'init');
		if (this.config.init.active) {
			return this.fire(this.config.init.name, []);
		}
		return null;
	}
	is(state) {
		return Array.isArray(state) ? (state.indexOf(this.state) >= 0) : (this.state === state);
	}
	isPending() {
		return this.pending;
	}
	can(transition) {
		return !this.isPending() && Boolean(this.seek(transition));
	}
	cannot(transition) {
		return !this.can(transition);
	}
	allStates() {
		return this.config.allStates();
	}
	allTransitions() {
		return this.config.allTransitions();
	}
	transitions() {
		return this.config.transitionsFor(this.state);
	}
	seek(transition, args) {
		let entry = this.config.transitionFor(this.state, transition);
		let to = entry && entry.to;
		if (typeof to === 'function') {
			return to.apply(this.context, args);
		} else if (to === this.config.defaults.wildcard) {
			return this.state;
		} else {
			return to;
		}
	}
	fire(transition, args) {
		return this.transit(transition, this.state, this.seek(transition, args), args);
	}
	transit(transition, from, to, args) {
		let lifecycle = this.config.lifecycle;
		let changed = this.config.options.observeUnchangedState ?? (from !== to);
		if (!to) {
			return this.context.onInvalidTransition(transition, from, to);
		}
		if (this.isPending()) {
			return this.context.onPendingTransition(transition, from, to);
		}
		this.config.addState(to); // might need to add this state if it's unknown (e.g. conditional transition or goto)
		this.beginTransit();
		args.unshift({ // this context will be passed to each lifecycle event observer
			transition: transition,
			from: from,
			to: to,
			fsm: this.context
		});
		return this.observeEvents([
			this.observersForEvent(lifecycle.onBefore.transition),
			this.observersForEvent(lifecycle.onBefore[transition]),
			changed ? this.observersForEvent(lifecycle.onLeave.state) : UNOBSERVED,
			changed ? this.observersForEvent(lifecycle.onLeave[from]) : UNOBSERVED,
			this.observersForEvent(lifecycle.on.transition),
			changed ? ['doTransit', [this]] : UNOBSERVED,
			changed ? this.observersForEvent(lifecycle.onEnter.state) : UNOBSERVED,
			changed ? this.observersForEvent(lifecycle.onEnter[to]) : UNOBSERVED,
			changed ? this.observersForEvent(lifecycle.on[to]) : UNOBSERVED,
			this.observersForEvent(lifecycle.onAfter.transition),
			this.observersForEvent(lifecycle.onAfter[transition]),
			this.observersForEvent(lifecycle.on[transition])
		], args);
	}
	beginTransit() {
		this.pending = true;
	}
	endTransit(result) {
		this.pending = false;
		return result;
	}
	failTransit(result) {
		this.pending = false;
		throw result;
	}
	doTransit(lifecycle) {
		this.state = lifecycle.to;
	}
	observe(args) {
		if (args.length === 2) {
			let observer = {};
			observer[args[0]] = args[1];
			this.observers.push(observer);
		} else {
			this.observers.push(args[0]);
		}
	}
	observersForEvent(event) { // TODO: this could be cached
		let result = [];
		for (let observer of this.observers) {
			if (observer[event]) {
				result.push(observer);
			}
		}
		return [event, result, true];
	}
	observeEvents(events, args, previousEvent, previousResult) {
		if (events.length === 0) {
			return this.endTransit(previousResult === undefined ? true : previousResult);
		}
		let [event, observers, pluggable] = events[0];
		args[0].event = event;
		if (event && pluggable && event !== previousEvent) {
			hook(this, 'lifecycle', args);
		}
		if (observers.length === 0) {
			events.shift();
			return this.observeEvents(events, args, event, previousResult);
		} else {
			let observer = observers.shift();
			let result = observer[event](...args);
			if (result && typeof result.then === 'function') {
				return result
					.then(this.observeEvents.bind(this, events, args, event))
					.catch(this.failTransit.bind(this));
			} else if (result === false) {
				return this.endTransit(false);
			} else {
				return this.observeEvents(events, args, event, result);
			}
		}
	}
	onInvalidTransition(transition, from, to) {
		throw new Exception("transition is invalid in current state", transition, from, to, this.state);
	}
	onPendingTransition(transition, from, to) {
		throw new Exception("transition is invalid while previous transition is still in progress", transition, from, to, this.state);
	}
}
// app.js
export const version = '3.0.1';
export function apply(instance, options) {
	build(instance, new Config(options, StateMachine));
	instance._fsm();
	return instance;
}
function build(target, config) {
	if ((typeof target !== 'object') || Array.isArray(target)) {
		throw Error('StateMachine can only be applied to objects');
	}
	for (let plugin of config.plugins) { // pluginHelper.build
		if (plugin.methods) {
			Object.assign(target, plugin.methods);
		}
		if (plugin.properties) {
			Object.defineProperties(target, plugin.properties);
		}
	}
	Object.defineProperty(target, 'state', { // PublicProperties
		configurable: false,
		enumerable: true,
		get: () => target._fsm.state,
		set: () => {
			throw Error('use transitions to change state');
		}
	});
	Object.assign(target, { // PublicMethods
		is: state => target._fsm.is(state),
		can: transition => target._fsm.can(transition),
		cannot: transition => target._fsm.cannot(transition),
		observe: () => target._fsm.observe(arguments),
		transitions: () => target._fsm.transitions(),
		allTransitions: () => target._fsm.allTransitions(),
		allStates: () => target._fsm.allStates(),
		onInvalidTransition: (t, from, to) => target._fsm.onInvalidTransition(t, from, to),
		onPendingTransition: (t, from, to) => target._fsm.onPendingTransition(t, from, to)
	});
	Object.assign(target, config.methods);
	for (let transition of config.allTransitions()) {
		target[camelize(transition)] = function () {
			return target._fsm.fire(transition, [].slice.call(arguments));
		};
	}
	target._fsm = function () {
		target._fsm = new JSM(target, config);
		target._fsm.init(arguments);
	};
}
export default class StateMachine {
	constructor (options) {
		return apply(this ?? {}, options);
	}
	static defaults = {
		wildcard: '*',
		init: {
			name: 'init',
			from: 'none'
		}
	};
	static factory() {
		let cstor = (typeof arguments[0] === 'function') ? arguments[0] : () => this._fsm(...arguments);
		let options = arguments[(typeof arguments[0] === 'function') ? 1 : 0] ?? {};
		let config = new Config(options, StateMachine);
		build(cstor.prototype, config);
		cstor.prototype._fsm.config = config; // convenience access to shared config without needing an instance
		return cstor;
	};
}