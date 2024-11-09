import {Exception, hook} from './util.js';
let UNOBSERVED = [null, []];
export default class JSM {
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
};