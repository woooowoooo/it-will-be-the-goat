import {camelize, prepend} from '../util.js';
export default function (options = {}) {
	let past = camelize(options.name || options.past || 'history');
	let future = camelize( options.future || 'future');
	let clear = prepend('clear', past);
	let back = prepend(past, 'back');
	let forward = prepend(past, 'forward');
	let canBack = prepend('can', back);
	let canForward = prepend('can', forward);
	let max = options.max;
	let plugin = {
		configure: function (config) {
			config.addTransitionLifecycleNames(back);
			config.addTransitionLifecycleNames(forward);
		},
		init: function (instance) {
			instance[past] = [];
			instance[future] = [];
		},
		lifecycle: function (instance, lifecycle) {
			if (lifecycle.event === 'onEnterState') {
				instance[past].push(lifecycle.to);
				if (max && instance[past].length > max) {
					instance[past].shift();
				}
				if (lifecycle.transition !== back && lifecycle.transition !== forward) {
					instance[future].length = 0;
				}
			}
		},
		methods: {},
		properties: {}
	};
	plugin.methods[clear] = function () {
		this[past].length = 0;
		this[future].length = 0;
	};
	plugin.properties[canBack] = {
		get: function () {
			return this[past].length > 1;
		}
	};
	plugin.properties[canForward] = {
		get: function () {
			return this[future].length > 0;
		}
	};
	plugin.methods[back] = function () {
		if (!this[canBack]) {
			throw Error('no history');
		}
		let from = this[past].pop();
		let to = this[past].pop();
		this[future].push(from);
		this._fsm.transit(back, from, to, []);
	};
	plugin.methods[forward] = function () {
		if (!this[canForward]) {
			throw Error('no history');
		}
		let from = this.state;
		let to = this[future].pop();
		this._fsm.transit(forward, from, to, []);
	};
	return plugin;
};