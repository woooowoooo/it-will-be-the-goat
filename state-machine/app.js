import {camelize} from './util.js';
import Config from './config.js';
import JSM from './jsm.js';
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
};