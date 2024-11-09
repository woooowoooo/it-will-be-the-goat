import {prepend} from './util.js';
export default class Config {
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
};