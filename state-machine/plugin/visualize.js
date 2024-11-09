export default function visualize(fsm, options) {
	return dotify(dotcfg(fsm, options));
}
export function dotcfg(fsm, options = {}) {
	let config = dotcfg.fetch(fsm);
	let name = options.name;
	let rankdir = dotcfg.rankdir(options.orientation);
	let states = dotcfg.states(config, options);
	let transitions = dotcfg.transitions(config, options);
	let result = {};
	if (name) {
		result.name = name;
	}
	if (rankdir) {
		result.rankdir = rankdir;
	}
	if (states && states.length > 0) {
		result.states = states;
	}
	if (transitions && transitions.length > 0) {
		result.transitions = transitions;
	}
	return result;
}
dotcfg.fetch = function (fsm) {
	return (typeof fsm === 'function') ? fsm.prototype._fsm.config : fsm._fsm.config;
};
dotcfg.rankdir = function (orientation) {
	if (orientation === 'horizontal') {
		return 'LR';
	} else if (orientation === 'vertical') {
		return 'TB';
	}
};
dotcfg.states = function (config, options) {
	let states = config.states;
	if (!options.init) { // if not showing init transition, then slice out the implied init :from state
		let index = states.indexOf(config.init.from);
		states = states.slice(0, index).concat(states.slice(index + 1));
	}
	return states;
};
dotcfg.transitions = function (config, options) {
	let init = config.init;
	let output = [];
	if (options.init && init.active) {
		dotcfg.transition(init.name, init.from, init.to, init.dot, config, options, output);
	}
	for (let transition of (config.options.transitions ?? [])) {
		dotcfg.transition(transition.name, transition.from, transition.to, transition.dot, config, options, output);
	}
	return output;
};
dotcfg.transition = function (name, from, to, dot, config, options, output) {
	let wildcard = config.defaults.wildcard;
	if (Array.isArray(from)) {
		for (let from1 of from) {
			dotcfg.transition(name, from1, to, dot, config, options, output);
		}
	} else if (from === wildcard || from === undefined) {
		for (let state of config.states) {
			dotcfg.transition(name, state, to, dot, config, options, output);
		}
	} else if (to === wildcard || to === undefined) {
		dotcfg.transition(name, from, from, dot, config, options, output);
	} else if (typeof to === 'function') {
		// do nothing, can't display conditional transition
	} else {
		output.push({from: from, to: to, label: pad(name), ...dot});
	}
};
function pad(name) {
	return ` ${name} `;
}
function quote(name) {
	return `"${name}"`;
}
export function dotify(dotcfg = {}) {
	let name = dotcfg.name ?? 'fsm';
	let states = dotcfg.states ?? [];
	let transitions = dotcfg.transitions ?? [];
	let rankdir = dotcfg.rankdir;
	let output = [];
	output.push(`digraph ${quote(name)} {`);
	if (rankdir) {
		output.push(`  rankdir=${rankdir};`);
	}
	for (let state of states) {
		output.push(dotify.state(state));
	}
	for (let transition of transitions) {
		output.push(dotify.edge(transition));
	}
	output.push("}");
	return output.join("\n");
}
dotify.state = function (state) {
	return `  ${quote(state)};`;
};
dotify.edge = function (edge) {
	return `  ${quote(edge.from)} -> ${quote(edge.to) + dotify.edge.attr(edge)};`;
};
dotify.edge.attr = function (edge) {
	let keys = Object.keys(edge).sort();
	let output = [];
	for (let key of keys) {
		if (key !== 'from' && key !== 'to') {
			output.push(key + "=" + quote(edge[key]));
		}
	}
	return output.length > 0 ? ` [ ${output.join("; ")} ]` : "";
};