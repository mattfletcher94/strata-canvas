//#region src/store.ts
function e(e) {
	return {
		_type: "store",
		_name: e.name,
		_responsibility: e.responsibility,
		_initialState: () => structuredClone(e.state),
		_queries: e.queries,
		_projections: e.projections
	};
}
//#endregion
//#region src/service.ts
function t(e) {
	let t = {
		_type: "service",
		_name: e.name,
		_responsibility: e.responsibility,
		_setup: e.setup,
		_teardown: e.teardown,
		_config: void 0,
		with(e) {
			return {
				...t,
				_config: e
			};
		}
	};
	return t;
}
//#endregion
//#region src/orchestrator.ts
function n(e) {
	return {
		_type: "orchestrator",
		_name: e.name,
		_responsibility: e.responsibility,
		_deps: e.deps,
		_queries: e.queries,
		_commands: e.commands,
		_reactions: e.reactions,
		_liveQueries: e.liveQueries
	};
}
//#endregion
//#region src/reaction.ts
function r(e) {
	return e;
}
//#endregion
//#region src/live-query.ts
function i(e) {
	return e;
}
//#endregion
//#region node_modules/.pnpm/@vue+shared@3.5.32/node_modules/@vue/shared/dist/shared.esm-bundler.js
/* @__NO_SIDE_EFFECTS__ */
function a(e) {
	let t = /* @__PURE__ */ Object.create(null);
	for (let n of e.split(",")) t[n] = 1;
	return (e) => e in t;
}
process.env.NODE_ENV === "production" || Object.freeze({}), process.env.NODE_ENV === "production" || Object.freeze([]);
var o = Object.assign, s = Object.prototype.hasOwnProperty, c = (e, t) => s.call(e, t), l = Array.isArray, u = (e) => g(e) === "[object Map]", d = (e) => typeof e == "function", f = (e) => typeof e == "string", p = (e) => typeof e == "symbol", m = (e) => typeof e == "object" && !!e, h = Object.prototype.toString, g = (e) => h.call(e), _ = (e) => g(e).slice(8, -1), ee = (e) => f(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, te = ((e) => {
	let t = /* @__PURE__ */ Object.create(null);
	return ((n) => t[n] || (t[n] = e(n)));
})((e) => e.charAt(0).toUpperCase() + e.slice(1)), v = (e, t) => !Object.is(e, t);
//#endregion
//#region node_modules/.pnpm/@vue+reactivity@3.5.32/node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js
function y(e, ...t) {
	console.warn(`[Vue warn] ${e}`, ...t);
}
var b, ne = class {
	constructor(e = !1) {
		this.detached = e, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this.__v_skip = !0, this.parent = b, !e && b && (this.index = (b.scopes ||= []).push(this) - 1);
	}
	get active() {
		return this._active;
	}
	pause() {
		if (this._active) {
			this._isPaused = !0;
			let e, t;
			if (this.scopes) for (e = 0, t = this.scopes.length; e < t; e++) this.scopes[e].pause();
			for (e = 0, t = this.effects.length; e < t; e++) this.effects[e].pause();
		}
	}
	resume() {
		if (this._active && this._isPaused) {
			this._isPaused = !1;
			let e, t;
			if (this.scopes) for (e = 0, t = this.scopes.length; e < t; e++) this.scopes[e].resume();
			for (e = 0, t = this.effects.length; e < t; e++) this.effects[e].resume();
		}
	}
	run(e) {
		if (this._active) {
			let t = b;
			try {
				return b = this, e();
			} finally {
				b = t;
			}
		} else process.env.NODE_ENV !== "production" && y("cannot run an inactive effect scope.");
	}
	on() {
		++this._on === 1 && (this.prevScope = b, b = this);
	}
	off() {
		this._on > 0 && --this._on === 0 && (b = this.prevScope, this.prevScope = void 0);
	}
	stop(e) {
		if (this._active) {
			this._active = !1;
			let t, n;
			for (t = 0, n = this.effects.length; t < n; t++) this.effects[t].stop();
			for (this.effects.length = 0, t = 0, n = this.cleanups.length; t < n; t++) this.cleanups[t]();
			if (this.cleanups.length = 0, this.scopes) {
				for (t = 0, n = this.scopes.length; t < n; t++) this.scopes[t].stop(!0);
				this.scopes.length = 0;
			}
			if (!this.detached && this.parent && !e) {
				let e = this.parent.scopes.pop();
				e && e !== this && (this.parent.scopes[this.index] = e, e.index = this.index);
			}
			this.parent = void 0;
		}
	}
};
function re(e) {
	return new ne(e);
}
var x, S = /* @__PURE__ */ new WeakSet(), ie = class {
	constructor(e) {
		this.fn = e, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, b && b.active && b.effects.push(this);
	}
	pause() {
		this.flags |= 64;
	}
	resume() {
		this.flags & 64 && (this.flags &= -65, S.has(this) && (S.delete(this), this.trigger()));
	}
	notify() {
		this.flags & 2 && !(this.flags & 32) || this.flags & 8 || oe(this);
	}
	run() {
		if (!(this.flags & 1)) return this.fn();
		this.flags |= 2, ye(this), le(this);
		let e = x, t = T;
		x = this, T = !0;
		try {
			return this.fn();
		} finally {
			process.env.NODE_ENV !== "production" && x !== this && y("Active effect was not restored correctly - this is likely a Vue internal bug."), ue(this), x = e, T = t, this.flags &= -3;
		}
	}
	stop() {
		if (this.flags & 1) {
			for (let e = this.deps; e; e = e.nextDep) pe(e);
			this.deps = this.depsTail = void 0, ye(this), this.onStop && this.onStop(), this.flags &= -2;
		}
	}
	trigger() {
		this.flags & 64 ? S.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
	}
	runIfDirty() {
		de(this) && this.run();
	}
	get dirty() {
		return de(this);
	}
}, ae = 0, C, w;
function oe(e, t = !1) {
	if (e.flags |= 8, t) {
		e.next = w, w = e;
		return;
	}
	e.next = C, C = e;
}
function se() {
	ae++;
}
function ce() {
	if (--ae > 0) return;
	if (w) {
		let e = w;
		for (w = void 0; e;) {
			let t = e.next;
			e.next = void 0, e.flags &= -9, e = t;
		}
	}
	let e;
	for (; C;) {
		let t = C;
		for (C = void 0; t;) {
			let n = t.next;
			if (t.next = void 0, t.flags &= -9, t.flags & 1) try {
				t.trigger();
			} catch (t) {
				e ||= t;
			}
			t = n;
		}
	}
	if (e) throw e;
}
function le(e) {
	for (let t = e.deps; t; t = t.nextDep) t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function ue(e) {
	let t, n = e.depsTail, r = n;
	for (; r;) {
		let e = r.prevDep;
		r.version === -1 ? (r === n && (n = e), pe(r), me(r)) : t = r, r.dep.activeLink = r.prevActiveLink, r.prevActiveLink = void 0, r = e;
	}
	e.deps = t, e.depsTail = n;
}
function de(e) {
	for (let t = e.deps; t; t = t.nextDep) if (t.dep.version !== t.version || t.dep.computed && (fe(t.dep.computed) || t.dep.version !== t.version)) return !0;
	return !!e._dirty;
}
function fe(e) {
	if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === E) || (e.globalVersion = E, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !de(e)))) return;
	e.flags |= 2;
	let t = e.dep, n = x, r = T;
	x = e, T = !0;
	try {
		le(e);
		let n = e.fn(e._value);
		(t.version === 0 || v(n, e._value)) && (e.flags |= 128, e._value = n, t.version++);
	} catch (e) {
		throw t.version++, e;
	} finally {
		x = n, T = r, ue(e), e.flags &= -3;
	}
}
function pe(e, t = !1) {
	let { dep: n, prevSub: r, nextSub: i } = e;
	if (r && (r.nextSub = i, e.prevSub = void 0), i && (i.prevSub = r, e.nextSub = void 0), process.env.NODE_ENV !== "production" && n.subsHead === e && (n.subsHead = i), n.subs === e && (n.subs = r, !r && n.computed)) {
		n.computed.flags &= -5;
		for (let e = n.computed.deps; e; e = e.nextDep) pe(e, !0);
	}
	!t && !--n.sc && n.map && n.map.delete(n.key);
}
function me(e) {
	let { prevDep: t, nextDep: n } = e;
	t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
function he(e, t) {
	e.effect instanceof ie && (e = e.effect.fn);
	let n = new ie(e);
	t && o(n, t);
	try {
		n.run();
	} catch (e) {
		throw n.stop(), e;
	}
	let r = n.run.bind(n);
	return r.effect = n, r;
}
var T = !0, ge = [];
function _e() {
	ge.push(T), T = !1;
}
function ve() {
	let e = ge.pop();
	T = e === void 0 ? !0 : e;
}
function ye(e) {
	let { cleanup: t } = e;
	if (e.cleanup = void 0, t) {
		let e = x;
		x = void 0;
		try {
			t();
		} finally {
			x = e;
		}
	}
}
var E = 0, be = class {
	constructor(e, t) {
		this.sub = e, this.dep = t, this.version = t.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
	}
}, xe = class {
	constructor(e) {
		this.computed = e, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0, process.env.NODE_ENV !== "production" && (this.subsHead = void 0);
	}
	track(e) {
		if (!x || !T || x === this.computed) return;
		let t = this.activeLink;
		if (t === void 0 || t.sub !== x) t = this.activeLink = new be(x, this), x.deps ? (t.prevDep = x.depsTail, x.depsTail.nextDep = t, x.depsTail = t) : x.deps = x.depsTail = t, Se(t);
		else if (t.version === -1 && (t.version = this.version, t.nextDep)) {
			let e = t.nextDep;
			e.prevDep = t.prevDep, t.prevDep && (t.prevDep.nextDep = e), t.prevDep = x.depsTail, t.nextDep = void 0, x.depsTail.nextDep = t, x.depsTail = t, x.deps === t && (x.deps = e);
		}
		return process.env.NODE_ENV !== "production" && x.onTrack && x.onTrack(o({ effect: x }, e)), t;
	}
	trigger(e) {
		this.version++, E++, this.notify(e);
	}
	notify(e) {
		se();
		try {
			if (process.env.NODE_ENV !== "production") for (let t = this.subsHead; t; t = t.nextSub) t.sub.onTrigger && !(t.sub.flags & 8) && t.sub.onTrigger(o({ effect: t.sub }, e));
			for (let e = this.subs; e; e = e.prevSub) e.sub.notify() && e.sub.dep.notify();
		} finally {
			ce();
		}
	}
};
function Se(e) {
	if (e.dep.sc++, e.sub.flags & 4) {
		let t = e.dep.computed;
		if (t && !e.dep.subs) {
			t.flags |= 20;
			for (let e = t.deps; e; e = e.nextDep) Se(e);
		}
		let n = e.dep.subs;
		n !== e && (e.prevSub = n, n && (n.nextSub = e)), process.env.NODE_ENV !== "production" && e.dep.subsHead === void 0 && (e.dep.subsHead = e), e.dep.subs = e;
	}
}
var Ce = /* @__PURE__ */ new WeakMap(), D = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "Object iterate"), we = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "Map keys iterate"), O = /* @__PURE__ */ Symbol(process.env.NODE_ENV === "production" ? "" : "Array iterate");
function k(e, t, n) {
	if (T && x) {
		let r = Ce.get(e);
		r || Ce.set(e, r = /* @__PURE__ */ new Map());
		let i = r.get(n);
		i || (r.set(n, i = new xe()), i.map = r, i.key = n), process.env.NODE_ENV === "production" ? i.track() : i.track({
			target: e,
			type: t,
			key: n
		});
	}
}
function A(e, t, n, r, i, a) {
	let o = Ce.get(e);
	if (!o) {
		E++;
		return;
	}
	let s = (o) => {
		o && (process.env.NODE_ENV === "production" ? o.trigger() : o.trigger({
			target: e,
			type: t,
			key: n,
			newValue: r,
			oldValue: i,
			oldTarget: a
		}));
	};
	if (se(), t === "clear") o.forEach(s);
	else {
		let i = l(e), a = i && ee(n);
		if (i && n === "length") {
			let e = Number(r);
			o.forEach((t, n) => {
				(n === "length" || n === O || !p(n) && n >= e) && s(t);
			});
		} else switch ((n !== void 0 || o.has(void 0)) && s(o.get(n)), a && s(o.get(O)), t) {
			case "add":
				i ? a && s(o.get("length")) : (s(o.get(D)), u(e) && s(o.get(we)));
				break;
			case "delete":
				i || (s(o.get(D)), u(e) && s(o.get(we)));
				break;
			case "set":
				u(e) && s(o.get(D));
				break;
		}
	}
	ce();
}
function j(e) {
	let t = /* @__PURE__ */ U(e);
	return t === e ? t : (k(t, "iterate", O), /* @__PURE__ */ H(e) ? t : t.map(W));
}
function Te(e) {
	return k(e = /* @__PURE__ */ U(e), "iterate", O), e;
}
function M(e, t) {
	return /* @__PURE__ */ V(e) ? G(/* @__PURE__ */ Ze(e) ? W(t) : t) : W(t);
}
var Ee = {
	__proto__: null,
	[Symbol.iterator]() {
		return N(this, Symbol.iterator, (e) => M(this, e));
	},
	concat(...e) {
		return j(this).concat(...e.map((e) => l(e) ? j(e) : e));
	},
	entries() {
		return N(this, "entries", (e) => (e[1] = M(this, e[1]), e));
	},
	every(e, t) {
		return P(this, "every", e, t, void 0, arguments);
	},
	filter(e, t) {
		return P(this, "filter", e, t, (e) => e.map((e) => M(this, e)), arguments);
	},
	find(e, t) {
		return P(this, "find", e, t, (e) => M(this, e), arguments);
	},
	findIndex(e, t) {
		return P(this, "findIndex", e, t, void 0, arguments);
	},
	findLast(e, t) {
		return P(this, "findLast", e, t, (e) => M(this, e), arguments);
	},
	findLastIndex(e, t) {
		return P(this, "findLastIndex", e, t, void 0, arguments);
	},
	forEach(e, t) {
		return P(this, "forEach", e, t, void 0, arguments);
	},
	includes(...e) {
		return F(this, "includes", e);
	},
	indexOf(...e) {
		return F(this, "indexOf", e);
	},
	join(e) {
		return j(this).join(e);
	},
	lastIndexOf(...e) {
		return F(this, "lastIndexOf", e);
	},
	map(e, t) {
		return P(this, "map", e, t, void 0, arguments);
	},
	pop() {
		return I(this, "pop");
	},
	push(...e) {
		return I(this, "push", e);
	},
	reduce(e, ...t) {
		return Oe(this, "reduce", e, t);
	},
	reduceRight(e, ...t) {
		return Oe(this, "reduceRight", e, t);
	},
	shift() {
		return I(this, "shift");
	},
	some(e, t) {
		return P(this, "some", e, t, void 0, arguments);
	},
	splice(...e) {
		return I(this, "splice", e);
	},
	toReversed() {
		return j(this).toReversed();
	},
	toSorted(e) {
		return j(this).toSorted(e);
	},
	toSpliced(...e) {
		return j(this).toSpliced(...e);
	},
	unshift(...e) {
		return I(this, "unshift", e);
	},
	values() {
		return N(this, "values", (e) => M(this, e));
	}
};
function N(e, t, n) {
	let r = Te(e), i = r[t]();
	return r !== e && !/* @__PURE__ */ H(e) && (i._next = i.next, i.next = () => {
		let e = i._next();
		return e.done || (e.value = n(e.value)), e;
	}), i;
}
var De = Array.prototype;
function P(e, t, n, r, i, a) {
	let o = Te(e), s = o !== e && !/* @__PURE__ */ H(e), c = o[t];
	if (c !== De[t]) {
		let t = c.apply(e, a);
		return s ? W(t) : t;
	}
	let l = n;
	o !== e && (s ? l = function(t, r) {
		return n.call(this, M(e, t), r, e);
	} : n.length > 2 && (l = function(t, r) {
		return n.call(this, t, r, e);
	}));
	let u = c.call(o, l, r);
	return s && i ? i(u) : u;
}
function Oe(e, t, n, r) {
	let i = Te(e), a = i !== e && !/* @__PURE__ */ H(e), o = n, s = !1;
	i !== e && (a ? (s = r.length === 0, o = function(t, r, i) {
		return s && (s = !1, t = M(e, t)), n.call(this, t, M(e, r), i, e);
	}) : n.length > 3 && (o = function(t, r, i) {
		return n.call(this, t, r, i, e);
	}));
	let c = i[t](o, ...r);
	return s ? M(e, c) : c;
}
function F(e, t, n) {
	let r = /* @__PURE__ */ U(e);
	k(r, "iterate", O);
	let i = r[t](...n);
	return (i === -1 || i === !1) && /* @__PURE__ */ Qe(n[0]) ? (n[0] = /* @__PURE__ */ U(n[0]), r[t](...n)) : i;
}
function I(e, t, n = []) {
	_e(), se();
	let r = (/* @__PURE__ */ U(e))[t].apply(e, n);
	return ce(), ve(), r;
}
var ke = /* @__PURE__ */ a("__proto__,__v_isRef,__isVue"), Ae = new Set(/* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(p));
function je(e) {
	p(e) || (e = String(e));
	let t = /* @__PURE__ */ U(this);
	return k(t, "has", e), t.hasOwnProperty(e);
}
var Me = class {
	constructor(e = !1, t = !1) {
		this._isReadonly = e, this._isShallow = t;
	}
	get(e, t, n) {
		if (t === "__v_skip") return e.__v_skip;
		let r = this._isReadonly, i = this._isShallow;
		if (t === "__v_isReactive") return !r;
		if (t === "__v_isReadonly") return r;
		if (t === "__v_isShallow") return i;
		if (t === "__v_raw") return n === (r ? i ? Ke : Ge : i ? We : Ue).get(e) || Object.getPrototypeOf(e) === Object.getPrototypeOf(n) ? e : void 0;
		let a = l(e);
		if (!r) {
			let e;
			if (a && (e = Ee[t])) return e;
			if (t === "hasOwnProperty") return je;
		}
		let o = Reflect.get(e, t, /* @__PURE__ */ K(e) ? e : n);
		if ((p(t) ? Ae.has(t) : ke(t)) || (r || k(e, "get", t), i)) return o;
		if (/* @__PURE__ */ K(o)) {
			let e = a && ee(t) ? o : o.value;
			return r && m(e) ? /* @__PURE__ */ B(e) : e;
		}
		return m(o) ? r ? /* @__PURE__ */ B(o) : /* @__PURE__ */ Ye(o) : o;
	}
}, Ne = class extends Me {
	constructor(e = !1) {
		super(!1, e);
	}
	set(e, t, n, r) {
		let i = e[t], a = l(e) && ee(t);
		if (!this._isShallow) {
			let r = /* @__PURE__ */ V(i);
			if (!/* @__PURE__ */ H(n) && !/* @__PURE__ */ V(n) && (i = /* @__PURE__ */ U(i), n = /* @__PURE__ */ U(n)), !a && /* @__PURE__ */ K(i) && !/* @__PURE__ */ K(n)) return r ? (process.env.NODE_ENV !== "production" && y(`Set operation on key "${String(t)}" failed: target is readonly.`, e[t]), !0) : (i.value = n, !0);
		}
		let o = a ? Number(t) < e.length : c(e, t), s = Reflect.set(e, t, n, /* @__PURE__ */ K(e) ? e : r);
		return e === /* @__PURE__ */ U(r) && (o ? v(n, i) && A(e, "set", t, n, i) : A(e, "add", t, n)), s;
	}
	deleteProperty(e, t) {
		let n = c(e, t), r = e[t], i = Reflect.deleteProperty(e, t);
		return i && n && A(e, "delete", t, void 0, r), i;
	}
	has(e, t) {
		let n = Reflect.has(e, t);
		return (!p(t) || !Ae.has(t)) && k(e, "has", t), n;
	}
	ownKeys(e) {
		return k(e, "iterate", l(e) ? "length" : D), Reflect.ownKeys(e);
	}
}, Pe = class extends Me {
	constructor(e = !1) {
		super(!0, e);
	}
	set(e, t) {
		return process.env.NODE_ENV !== "production" && y(`Set operation on key "${String(t)}" failed: target is readonly.`, e), !0;
	}
	deleteProperty(e, t) {
		return process.env.NODE_ENV !== "production" && y(`Delete operation on key "${String(t)}" failed: target is readonly.`, e), !0;
	}
}, Fe = /* @__PURE__ */ new Ne(), Ie = /* @__PURE__ */ new Pe(), L = (e) => e, R = (e) => Reflect.getPrototypeOf(e);
function Le(e, t, n) {
	return function(...r) {
		let i = this.__v_raw, a = /* @__PURE__ */ U(i), s = u(a), c = e === "entries" || e === Symbol.iterator && s, l = e === "keys" && s, d = i[e](...r), f = n ? L : t ? G : W;
		return !t && k(a, "iterate", l ? we : D), o(Object.create(d), { next() {
			let { value: e, done: t } = d.next();
			return t ? {
				value: e,
				done: t
			} : {
				value: c ? [f(e[0]), f(e[1])] : f(e),
				done: t
			};
		} });
	};
}
function z(e) {
	return function(...t) {
		if (process.env.NODE_ENV !== "production") {
			let n = t[0] ? `on key "${t[0]}" ` : "";
			y(`${te(e)} operation ${n}failed: target is readonly.`, /* @__PURE__ */ U(this));
		}
		return e === "delete" ? !1 : e === "clear" ? void 0 : this;
	};
}
function Re(e, t) {
	let n = {
		get(n) {
			let r = this.__v_raw, i = /* @__PURE__ */ U(r), a = /* @__PURE__ */ U(n);
			e || (v(n, a) && k(i, "get", n), k(i, "get", a));
			let { has: o } = R(i), s = t ? L : e ? G : W;
			if (o.call(i, n)) return s(r.get(n));
			if (o.call(i, a)) return s(r.get(a));
			r !== i && r.get(n);
		},
		get size() {
			let t = this.__v_raw;
			return !e && k(/* @__PURE__ */ U(t), "iterate", D), t.size;
		},
		has(t) {
			let n = this.__v_raw, r = /* @__PURE__ */ U(n), i = /* @__PURE__ */ U(t);
			return e || (v(t, i) && k(r, "has", t), k(r, "has", i)), t === i ? n.has(t) : n.has(t) || n.has(i);
		},
		forEach(n, r) {
			let i = this, a = i.__v_raw, o = /* @__PURE__ */ U(a), s = t ? L : e ? G : W;
			return !e && k(o, "iterate", D), a.forEach((e, t) => n.call(r, s(e), s(t), i));
		}
	};
	return o(n, e ? {
		add: z("add"),
		set: z("set"),
		delete: z("delete"),
		clear: z("clear")
	} : {
		add(e) {
			let n = /* @__PURE__ */ U(this), r = R(n), i = /* @__PURE__ */ U(e), a = !t && !/* @__PURE__ */ H(e) && !/* @__PURE__ */ V(e) ? i : e;
			return r.has.call(n, a) || v(e, a) && r.has.call(n, e) || v(i, a) && r.has.call(n, i) || (n.add(a), A(n, "add", a, a)), this;
		},
		set(e, n) {
			!t && !/* @__PURE__ */ H(n) && !/* @__PURE__ */ V(n) && (n = /* @__PURE__ */ U(n));
			let r = /* @__PURE__ */ U(this), { has: i, get: a } = R(r), o = i.call(r, e);
			o ? process.env.NODE_ENV !== "production" && He(r, i, e) : (e = /* @__PURE__ */ U(e), o = i.call(r, e));
			let s = a.call(r, e);
			return r.set(e, n), o ? v(n, s) && A(r, "set", e, n, s) : A(r, "add", e, n), this;
		},
		delete(e) {
			let t = /* @__PURE__ */ U(this), { has: n, get: r } = R(t), i = n.call(t, e);
			i ? process.env.NODE_ENV !== "production" && He(t, n, e) : (e = /* @__PURE__ */ U(e), i = n.call(t, e));
			let a = r ? r.call(t, e) : void 0, o = t.delete(e);
			return i && A(t, "delete", e, void 0, a), o;
		},
		clear() {
			let e = /* @__PURE__ */ U(this), t = e.size !== 0, n = process.env.NODE_ENV === "production" ? void 0 : u(e) ? new Map(e) : new Set(e), r = e.clear();
			return t && A(e, "clear", void 0, void 0, n), r;
		}
	}), [
		"keys",
		"values",
		"entries",
		Symbol.iterator
	].forEach((r) => {
		n[r] = Le(r, e, t);
	}), n;
}
function ze(e, t) {
	let n = Re(e, t);
	return (t, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? t : Reflect.get(c(n, r) && r in t ? n : t, r, i);
}
var Be = { get: /* @__PURE__ */ ze(!1, !1) }, Ve = { get: /* @__PURE__ */ ze(!0, !1) };
function He(e, t, n) {
	let r = /* @__PURE__ */ U(n);
	if (r !== n && t.call(e, r)) {
		let t = _(e);
		y(`Reactive ${t} contains both the raw and reactive versions of the same object${t === "Map" ? " as keys" : ""}, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`);
	}
}
var Ue = /* @__PURE__ */ new WeakMap(), We = /* @__PURE__ */ new WeakMap(), Ge = /* @__PURE__ */ new WeakMap(), Ke = /* @__PURE__ */ new WeakMap();
function qe(e) {
	switch (e) {
		case "Object":
		case "Array": return 1;
		case "Map":
		case "Set":
		case "WeakMap":
		case "WeakSet": return 2;
		default: return 0;
	}
}
function Je(e) {
	return e.__v_skip || !Object.isExtensible(e) ? 0 : qe(_(e));
}
/* @__NO_SIDE_EFFECTS__ */
function Ye(e) {
	return /* @__PURE__ */ V(e) ? e : Xe(e, !1, Fe, Be, Ue);
}
/* @__NO_SIDE_EFFECTS__ */
function B(e) {
	return Xe(e, !0, Ie, Ve, Ge);
}
function Xe(e, t, n, r, i) {
	if (!m(e)) return process.env.NODE_ENV !== "production" && y(`value cannot be made ${t ? "readonly" : "reactive"}: ${String(e)}`), e;
	if (e.__v_raw && !(t && e.__v_isReactive)) return e;
	let a = Je(e);
	if (a === 0) return e;
	let o = i.get(e);
	if (o) return o;
	let s = new Proxy(e, a === 2 ? r : n);
	return i.set(e, s), s;
}
/* @__NO_SIDE_EFFECTS__ */
function Ze(e) {
	return /* @__PURE__ */ V(e) ? /* @__PURE__ */ Ze(e.__v_raw) : !!(e && e.__v_isReactive);
}
/* @__NO_SIDE_EFFECTS__ */
function V(e) {
	return !!(e && e.__v_isReadonly);
}
/* @__NO_SIDE_EFFECTS__ */
function H(e) {
	return !!(e && e.__v_isShallow);
}
/* @__NO_SIDE_EFFECTS__ */
function Qe(e) {
	return e ? !!e.__v_raw : !1;
}
/* @__NO_SIDE_EFFECTS__ */
function U(e) {
	let t = e && e.__v_raw;
	return t ? /* @__PURE__ */ U(t) : e;
}
var W = (e) => m(e) ? /* @__PURE__ */ Ye(e) : e, G = (e) => m(e) ? /* @__PURE__ */ B(e) : e;
/* @__NO_SIDE_EFFECTS__ */
function K(e) {
	return e ? e.__v_isRef === !0 : !1;
}
/* @__NO_SIDE_EFFECTS__ */
function $e(e) {
	return et(e, !0);
}
function et(e, t) {
	return /* @__PURE__ */ K(e) ? e : new tt(e, t);
}
var tt = class {
	constructor(e, t) {
		this.dep = new xe(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = t ? e : /* @__PURE__ */ U(e), this._value = t ? e : W(e), this.__v_isShallow = t;
	}
	get value() {
		return process.env.NODE_ENV === "production" ? this.dep.track() : this.dep.track({
			target: this,
			type: "get",
			key: "value"
		}), this._value;
	}
	set value(e) {
		let t = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ H(e) || /* @__PURE__ */ V(e);
		e = n ? e : /* @__PURE__ */ U(e), v(e, t) && (this._rawValue = e, this._value = n ? e : W(e), process.env.NODE_ENV === "production" ? this.dep.trigger() : this.dep.trigger({
			target: this,
			type: "set",
			key: "value",
			newValue: e,
			oldValue: t
		}));
	}
}, nt = class {
	constructor(e, t, n) {
		this.fn = e, this.setter = t, this._value = void 0, this.dep = new xe(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = E - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !t, this.isSSR = n;
	}
	notify() {
		if (this.flags |= 16, !(this.flags & 8) && x !== this) return oe(this, !0), !0;
		process.env.NODE_ENV;
	}
	get value() {
		let e = process.env.NODE_ENV === "production" ? this.dep.track() : this.dep.track({
			target: this,
			type: "get",
			key: "value"
		});
		return fe(this), e && (e.version = this.dep.version), this._value;
	}
	set value(e) {
		this.setter ? this.setter(e) : process.env.NODE_ENV !== "production" && y("Write operation failed: computed value is readonly");
	}
};
/* @__NO_SIDE_EFFECTS__ */
function rt(e, t, n = !1) {
	let r, i;
	d(e) ? r = e : (r = e.get, i = e.set);
	let a = new nt(r, i, n);
	return process.env.NODE_ENV !== "production" && t && !n && (a.onTrack = t.onTrack, a.onTrigger = t.onTrigger), a;
}
//#endregion
//#region src/types.ts
var it = Symbol("strata.eventCreator"), at = Symbol("strata.commandRef"), ot = Symbol("strata.synthetic"), st = Symbol("strata.inspect"), ct = Symbol("strata.inspectLiveQueries"), lt = Symbol("strata.event");
//#endregion
//#region src/query.ts
function ut(e, t, n) {
	let r = n.run(() => he(e, { scheduler: t }));
	return () => r.effect.stop();
}
function dt(e) {
	return typeof e == "function" && typeof e.subscribe == "function";
}
function ft(e) {
	return !(typeof e == "function" || typeof e == "symbol" || e instanceof Map || e instanceof Set);
}
function pt(e, t) {
	let n = (() => e.value);
	return n.subscribe = (n) => {
		let r = !1, i;
		return i = ut(() => {
			n(e.value);
		}, () => {
			r || (r = !0, queueMicrotask(() => {
				r = !1, i && n(e.value);
			}));
		}, t), () => {
			let e = i;
			i = void 0, e?.();
		};
	}, n;
}
function mt(e, t, n = 1e3) {
	let r = /* @__PURE__ */ new Map();
	return (...i) => {
		let a = i.every(ft) ? JSON.stringify(i) : null;
		if (a !== null) {
			let e = r.get(a);
			if (e) return r.delete(a), r.set(a, e), e.query;
		}
		let o = e(...i), s, c;
		if (dt(o)) s = o, c = () => {};
		else {
			let e = t.run(() => re(!0));
			s = e.run(() => pt(/* @__PURE__ */ rt(o), e)), c = () => e.stop();
		}
		if (a !== null && (r.set(a, {
			query: s,
			dispose: c
		}), r.size > n)) {
			let e = r.keys().next().value;
			r.get(e).dispose(), r.delete(e);
		}
		return s;
	};
}
function ht(e, t, n) {
	if (!e) return {};
	let r = e(t);
	return new Proxy({}, {
		get(e, t) {
			if (t in e) return e[t];
			let i = r[t];
			if (i) {
				if (i.length === 0) {
					let r = n.run(() => i());
					dt(r) ? e[t] = r : e[t] = pt(n.run(() => /* @__PURE__ */ rt(i)), n);
				} else e[t] = mt(i, n);
				return e[t];
			}
		},
		has(e, t) {
			return t in r;
		},
		ownKeys() {
			return Object.keys(r);
		},
		getOwnPropertyDescriptor(e, t) {
			if (t in r) return {
				configurable: !0,
				enumerable: !0,
				writable: !0
			};
		}
	});
}
//#endregion
//#region src/error.ts
var gt = Symbol("STRATA_ERROR"), q = class extends Error {
	[gt] = !0;
	constructor(e) {
		super(`[strata] ${e}`), this.name = "StrataError";
	}
}, _t = class extends q {
	results;
	constructor(e) {
		let t = e.filter((e) => e.status === "rejected");
		super(`${t.length} of ${e.length} reaction(s) failed`), this.name = "ReactionError", this.results = e;
	}
}, vt = class extends q {
	module;
	command;
	corrId;
	constructor(e, t, n) {
		super(`Command "${e}.${t}" declared a result but no reaction emitted the success or failure event (corrId=${n}). Check the reactions subscribed to this command — at least one must dispatch the declared result event in onSuccess or onFailure.`), this.name = "CommandUnresolvedError", this.module = e, this.command = t, this.corrId = n;
	}
};
function J(e) {
	throw new q(e);
}
//#endregion
//#region src/inspect.ts
function yt(e, t, n) {
	let r = [], i = [], a = [];
	if (e.services) for (let [t, n] of Object.entries(e.services)) r.push({
		key: t,
		name: n._name,
		responsibility: n._responsibility
	});
	if (e.stores) for (let [t, n] of Object.entries(e.stores)) i.push({
		key: t,
		name: n._name,
		responsibility: n._responsibility,
		projections: Object.keys(n._projections ?? {})
	});
	if (e.orchestrators) for (let [r, i] of Object.entries(e.orchestrators)) a.push({
		key: r,
		name: i._name,
		responsibility: i._responsibility,
		reactions: t?.[r] ?? [],
		liveQueries: n?.[r] ?? []
	});
	return {
		name: e.name,
		responsibility: e.responsibility,
		services: r,
		stores: i,
		orchestrators: a
	};
}
function bt(e) {
	let t = e[st];
	return t || J("inspectDAG requires a resolved strata graph"), t;
}
function xt(e) {
	return e.responsibility ? `${e.name}: ${e.responsibility}` : e.name;
}
function St(e) {
	let t = [e.name];
	return e.responsibility && t.push(e.responsibility), e.projections.length > 0 && t.push(`projections: ${e.projections.join(", ")}`), t.join(" | ");
}
function Ct(e) {
	let t = [e.name];
	return e.responsibility && t.push(e.responsibility), e.reactions.length > 0 && t.push(`reactions: ${e.reactions.join(", ")}`), e.liveQueries.length > 0 && t.push(`liveQueries: ${e.liveQueries.join(", ")}`), t.join(" | ");
}
function wt(e, t, n) {
	let r = e.stores.length > 0, i = e.services.length > 0, a = e.orchestrators.length > 0, o = e.name.replace(/[^a-zA-Z0-9]/g, "_");
	if (i) {
		t.push(`${n}subgraph services_${o}[Services]`);
		for (let r of e.services) t.push(`${n}  ${r.key}["${xt(r)}"]`);
		t.push(`${n}end`);
	}
	if (r) {
		t.push(`${n}subgraph stores_${o}[Stores]`);
		for (let r of e.stores) t.push(`${n}  ${r.key}["${St(r)}"]`);
		t.push(`${n}end`);
	}
	if (a) {
		t.push(`${n}subgraph orchestrators_${o}[Orchestrators]`);
		for (let r of e.orchestrators) t.push(`${n}  ${r.key}["${Ct(r)}"]`);
		t.push(`${n}end`);
	}
	if (a && r) for (let r of e.orchestrators) for (let i of e.stores) t.push(`${n}${r.key} --> ${i.key}`);
	if (a && i) {
		for (let r of e.orchestrators) if (r.reactions.length > 0 || r.liveQueries.length > 0) for (let i of e.services) t.push(`${n}${r.key} -.-> ${i.key}`);
	}
}
function Tt(e) {
	let t = ["graph TD"];
	return wt(e, t, "  "), t.join("\n");
}
//#endregion
//#region src/strata.ts
var Y = Symbol("strata.corrId");
function Et() {
	let e = 0;
	return () => `c${++e}`;
}
function Dt(e, t) {
	return Object.defineProperty(e, Y, {
		value: t,
		enumerable: !1,
		configurable: !0
	}), e;
}
function Ot(e) {
	return e[Y] ?? null;
}
function kt(e, t) {
	if (t !== null) for (let n of e) n[Y] ?? Object.defineProperty(n, Y, {
		value: t,
		enumerable: !1,
		configurable: !0
	});
}
function At(e) {
	return e[ot] === !0;
}
function X(e) {
	return typeof e == "function" && e[it] === !0;
}
function jt(e) {
	return (typeof e == "function" || typeof e == "object" && !!e) && e[at] === !0;
}
function Mt(e, t) {
	let n = {};
	for (let r of Object.keys(t)) {
		let t = ((t) => ({
			[lt]: !0,
			store: e,
			event: r,
			payload: t
		}));
		Object.defineProperties(t, {
			[it]: {
				value: !0,
				enumerable: !1
			},
			_store: {
				value: e,
				enumerable: !1
			},
			_event: {
				value: r,
				enumerable: !1
			}
		}), n[r] = t;
	}
	return n;
}
function Nt(e, t, n) {
	Object.defineProperties(e, {
		[at]: {
			value: !0,
			enumerable: !1,
			configurable: !0
		},
		_module: {
			value: t,
			enumerable: !1,
			configurable: !0
		},
		_command: {
			value: n,
			enumerable: !1,
			configurable: !0
		}
	});
}
function Pt(e, t) {
	let n = function() {
		throw new q(`Command "${e}.${t}" called before graph fully resolved.`);
	};
	return Nt(n, e, t), n;
}
function Ft(e) {
	if (jt(e)) return `__command__${e._module}::${e._command}`;
	if (X(e)) return `${e._store}::${e._event}`;
	J("Reaction `on:` source is neither an EventCreator nor a CommandRef");
}
function It(e, t) {
	return `${e}::${t}`;
}
var Lt = "__default__";
function Rt(e) {
	return typeof e == "string" ? e : e.mode;
}
function zt(e) {
	return typeof e == "string" ? null : e.key;
}
function Bt(e, t, n, r, i, a) {
	let o = n.concurrency ?? "parallel", s = Rt(o), c = zt(o), l = /* @__PURE__ */ new Set(), u = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Set(), p = !1;
	function m(o, s) {
		let c = new AbortController(), u = {
			abort: c.signal,
			trigger: o
		}, d = Date.now();
		if (s !== null) {
			let n = (a.get(s) ?? 0) + 1;
			if (a.set(s, n), n > 1e4) {
				a.delete(s);
				let n = new q(`reaction cycle detected — "${e}.${t}" exceeded 10000 invocations under corrId ${s}`);
				r({
					module: e,
					reaction: t,
					trigger: o,
					corrId: s,
					status: "failed",
					duration: 0,
					error: n
				});
				let i = Promise.resolve({
					status: "failed",
					error: n
				}), u = {
					trigger: o,
					corrId: s,
					abortController: c,
					settled: i
				};
				return l.add(u), i.finally(() => {
					l.delete(u);
				}), u;
			}
		}
		r({
			module: e,
			reaction: t,
			trigger: o,
			corrId: s,
			status: "started",
			duration: 0
		});
		let f = (async () => {
			let a;
			try {
				a = await n.run(o.payload, u);
			} catch (a) {
				if (c.signal.aborted) return r({
					module: e,
					reaction: t,
					trigger: o,
					corrId: s,
					status: "aborted",
					duration: Date.now() - d
				}), { status: "aborted" };
				let l = a instanceof Error ? a : Error(String(a));
				if (n.onFailure) {
					let e = [];
					try {
						e = n.onFailure(o.payload, l);
					} catch {}
					e.length > 0 && i(e, s);
				}
				return r({
					module: e,
					reaction: t,
					trigger: o,
					corrId: s,
					status: "failed",
					duration: Date.now() - d,
					error: l
				}), {
					status: "failed",
					error: l
				};
			}
			if (c.signal.aborted) return r({
				module: e,
				reaction: t,
				trigger: o,
				corrId: s,
				status: "aborted",
				duration: Date.now() - d
			}), { status: "aborted" };
			if (n.onSuccess) {
				let c = [];
				try {
					c = n.onSuccess(o.payload, a);
				} catch (n) {
					let i = n instanceof Error ? n : Error(String(n));
					return r({
						module: e,
						reaction: t,
						trigger: o,
						corrId: s,
						status: "failed",
						duration: Date.now() - d,
						error: i
					}), {
						status: "failed",
						error: i
					};
				}
				c.length > 0 && i(c, s);
			}
			return r({
				module: e,
				reaction: t,
				trigger: o,
				corrId: s,
				status: "succeeded",
				duration: Date.now() - d,
				result: a
			}), {
				status: "succeeded",
				result: a
			};
		})(), p = {
			trigger: o,
			corrId: s,
			abortController: c,
			settled: f
		};
		return l.add(p), f.finally(() => {
			l.delete(p);
		}), p;
	}
	function h(e, t) {
		return m(e, t);
	}
	function g(e, t, n) {
		let r = new AbortController(), i = {
			trigger: e,
			corrId: t,
			abortController: r,
			settled: (u.get(n) ?? Promise.resolve()).then(async () => {
				if (f.delete(i), p || r.signal.aborted) return { status: "aborted" };
				let n = m(e, t);
				return i.abortController = n.abortController, r.signal.aborted && n.abortController.abort(), n.settled;
			})
		};
		return f.add(i), u.set(n, i.settled.then(() => {}, () => {})), l.add(i), i.settled.finally(() => {
			l.delete(i);
		}), i;
	}
	function _(e, t, n) {
		let r = d.get(n);
		r && r.abortController.abort();
		let i = m(e, t);
		return d.set(n, i), i.settled.finally(() => {
			d.get(n) === i && d.delete(n);
		}), i;
	}
	return {
		module: e,
		name: t,
		concurrency: o,
		invoke(e, t) {
			if (s === "parallel") return h(e, t);
			let n = c ? c(e.payload) : Lt;
			return s === "serial" ? g(e, t, n) : _(e, t, n);
		},
		inFlight: () => Array.from(l),
		corrIdsInFlight: () => {
			let e = /* @__PURE__ */ new Set();
			for (let t of l) t.corrId !== null && e.add(t.corrId);
			return e.size;
		},
		drain: async () => {
			p = !0;
			for (let e of f) e.abortController.abort();
			for (let e of l) e.abortController.abort();
			await Promise.allSettled(Array.from(l).map((e) => e.settled));
		}
	};
}
var Vt = class {
	bySubscription = /* @__PURE__ */ new Map();
	all = [];
	register(e) {
		let t = Array.isArray(e.handler.on) ? e.handler.on : [e.handler.on];
		for (let n of t) {
			let t = Ft(n), r = this.bySubscription.get(t) ?? [];
			r.push(e), this.bySubscription.set(t, r);
		}
		this.all.push(e);
	}
	subscribersFor(e, t) {
		return this.bySubscription.get(It(e, t)) ?? [];
	}
	allEntries() {
		return this.all;
	}
}, Ht = class {
	waitersByCorrId = /* @__PURE__ */ new Map();
	register(e) {
		this.waitersByCorrId.set(e.corrId, e);
	}
	unregister(e) {
		this.waitersByCorrId.delete(e);
	}
	trackInvocation(e, t) {
		if (e === null) return;
		let n = this.waitersByCorrId.get(e);
		n && !n.resolved && n.invocations.add(t);
	}
	checkResultMatches(e) {
		for (let t of e) {
			let e = Ot(t);
			if (e === null) continue;
			let n = this.waitersByCorrId.get(e);
			!n || n.resolved || (n.resultOk && t.store === n.resultOk._store && t.event === n.resultOk._event ? (n.resolved = !0, n.resolve(t.payload), this.unregister(e)) : n.resultFail && t.store === n.resultFail._store && t.event === n.resultFail._event && (n.resolved = !0, n.reject(t.payload), this.unregister(e)));
		}
	}
	async awaitAllSettled(e) {
		let t = -1;
		for (; e.invocations.size !== t;) {
			t = e.invocations.size;
			let n = Array.from(e.invocations);
			await Promise.allSettled(n.map((e) => e.settled));
		}
	}
	async watchForUnresolved(e, t) {
		await this.awaitAllSettled(e), !e.resolved && (e.resultOk === null && e.resultFail === null ? (e.resolved = !0, e.resolve(t)) : (e.resolved = !0, e.reject(new vt(e.module, e.command, e.corrId))), this.unregister(e.corrId));
	}
};
function Z(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) {
		if (At(r)) continue;
		let e = t.storeInternals[r.store];
		e || J(`No store "${r.store}" found for event "${r.event}".`), e.projections[r.event] || J(`No projection "${r.event}" in store "${r.store}".`);
		let i = n.get(r.store);
		i || (i = {
			internal: e,
			events: []
		}, n.set(r.store, i)), i.events.push(r);
	}
	for (let [, e] of n) {
		let n = e.events.reduce((n, r) => (t.config.onEvent?.({
			store: r.store,
			event: r.event,
			payload: r.payload,
			corrId: Ot(r),
			timestamp: Date.now()
		}), e.internal.projections[r.event](n, r.payload)), e.internal.ref.value);
		e.internal.ref.value = n;
	}
	t.invocationTracker.checkResultMatches(e);
	for (let n of e) {
		let e = t.reactionRegistry.subscribersFor(n.store, n.event);
		if (e.length === 0) continue;
		let r = Ot(n), i = {
			store: n.store,
			event: n.event,
			payload: n.payload
		};
		for (let n of e) {
			let e = n.executor.invoke(i, r);
			t.invocationTracker.trackInvocation(r, e);
		}
	}
}
function Ut(e, t, n) {
	kt(e, t), Z(e, n);
}
function Wt(e, t, n) {
	return t.catch(() => {}), {
		data: e,
		then(e, n) {
			return t.then(e, n);
		},
		catch(e) {
			return t.catch(e);
		},
		finally(e) {
			return t.finally(e);
		},
		allSettled: n
	};
}
function Gt(e) {
	if (e == null) return {
		ok: null,
		fail: null
	};
	if (X(e)) return {
		ok: e,
		fail: null
	};
	if (typeof e == "object" && e && "ok" in e && X(e.ok)) {
		let t = e.fail;
		return t != null && !X(t) && J("CommandResult.result.fail must be an EventCreator (returned by a store's projection)."), {
			ok: e.ok,
			fail: t ?? null
		};
	}
	J("CommandResult.result must be an EventCreator or an object { ok: EventCreator, fail?: EventCreator }.");
}
function Q(e) {
	if (e === void 0) return "null";
	if (typeof e != "object" || !e) return JSON.stringify(e);
	if (Array.isArray(e)) return `[${e.map(Q).join(",")}]`;
	let t = Object.keys(e).sort(), n = [];
	for (let r of t) {
		let t = e[r];
		t !== void 0 && n.push(`${JSON.stringify(r)}:${Q(t)}`);
	}
	return `{${n.join(",")}}`;
}
function Kt(e, t) {
	return `${e}::${Q(t)}`;
}
function qt(e) {
	return !(typeof e == "function" || typeof e == "symbol" || e instanceof Map || e instanceof Set);
}
function $(e) {
	return !!e && (typeof e == "object" || typeof e == "function") && typeof e.then == "function";
}
function Jt(e, t, n) {
	let r = /* @__PURE__ */ new Map(), i = n.config, a = (e) => {
		if (Array.isArray(e) && e.length === 1) return e[0];
		if (!(Array.isArray(e) && e.length === 0)) return e;
	}, o = (t) => {
		i.onLiveQuery?.({
			module: e,
			liveQuery: t.name,
			args: a(t.args),
			status: "opened",
			timestamp: Date.now()
		});
	}, s = (t) => {
		i.onLiveQuery?.({
			module: e,
			liveQuery: t.name,
			args: a(t.args),
			status: "closed",
			timestamp: Date.now(),
			duration: Date.now() - t.openedAt
		});
	}, c = (t, n) => {
		i.onLiveQuery?.({
			module: e,
			liveQuery: t.name,
			args: a(t.args),
			status: "errored",
			timestamp: Date.now(),
			duration: Date.now() - t.openedAt,
			error: n
		});
	}, l = (e) => {
		if (e.handler.onClose) {
			let t = e.handler.onClose(a(e.args));
			t && t.length > 0 && Z(t, n);
		}
	}, u = (e, t) => {
		if (e.handler.onError) {
			let r = e.handler.onError(a(e.args), t);
			r && r.length > 0 && Z(r, n);
		}
	}, d = (e) => {
		try {
			let t = e();
			$(t) && t.catch(() => {});
		} catch {}
	}, f = (e, t) => {
		r.delete(e), l(t), s(t), t.teardown && d(t.teardown);
	}, p = (e, t) => {
		let n = r.get(e);
		if (!n) {
			d(t);
			return;
		}
		if (n.status === "pending-close") {
			r.delete(e), l(n), s(n), d(t);
			return;
		}
		n.teardown = t, n.status = "open", o(n);
	}, m = (e, t) => {
		let n = r.get(e);
		if (!n) return;
		r.delete(e);
		let i = t instanceof Error ? t : Error(String(t));
		u(n, i), c(n, i);
	}, h = (e, t) => {
		if (!t || t.length === 0) return;
		let i = r.get(e);
		i && i.status !== "pending-close" && Z(t, n);
	}, g = (e) => ({
		on: (t) => (n) => {
			let r;
			try {
				r = t(n);
			} catch {
				return;
			}
			$(r) ? r.then((t) => h(e, t), () => {}) : h(e, r);
		},
		fail: (t) => {
			let n = r.get(e);
			n && (r.delete(e), u(n, t), n.teardown && d(n.teardown), c(n, t));
		}
	});
	return {
		acquire: (n, i) => {
			let s = t[n];
			s || J(`No live query "${n}" in orchestrator "${e}".`);
			let c = Kt(n, i), l = r.get(c);
			if (l) l.status === "pending-close" && (l.status = "opening"), l.refcount++;
			else {
				l = {
					name: n,
					handler: s,
					args: i,
					refcount: 1,
					status: "opening",
					teardown: null,
					openedAt: Date.now()
				}, r.set(c, l);
				let e;
				try {
					e = s.source(a(i), g(c));
				} catch (e) {
					return m(c, e), () => {};
				}
				if ($(e)) e.then((e) => p(c, e), (e) => m(c, e));
				else {
					let t = r.get(c);
					t ? (t.teardown = e, t.status = "open", o(t)) : d(e);
				}
			}
			let u = !1;
			return () => {
				if (u) return;
				u = !0;
				let e = r.get(c);
				if (e && (e.refcount--, !(e.refcount > 0))) {
					if (e.status === "opening") {
						e.status = "pending-close";
						return;
					}
					f(c, e);
				}
			};
		},
		teardownAll: async () => {
			let e = Array.from(r.entries());
			r.clear();
			for (let [, t] of e) {
				try {
					l(t);
				} catch {}
				try {
					s(t);
				} catch {}
				if (t.teardown) try {
					let e = t.teardown();
					$(e) && await e.catch(() => {});
				} catch {}
			}
		},
		snapshot: (e) => {
			let t = [];
			for (let n of r.values()) t.push({
				module: e,
				liveQuery: n.name,
				args: a(n.args),
				status: n.status,
				refcount: n.refcount,
				openedAt: n.openedAt
			});
			return t;
		}
	};
}
function Yt(e, t, n, r, i, a, o) {
	if (!t) return {
		resolved: {},
		names: [],
		teardownAll: () => Promise.resolve(),
		snapshot: () => []
	};
	let s = t(n, r), c = Object.keys(s);
	for (let t of c) o.has(t) && J(`Orchestrator "${e}" declares "${t}" as both a query and a live query. Names must be unique within the orchestrator's namespace.`);
	let l = Jt(e, s, i), u = {};
	for (let e of c) {
		let t = s[e];
		if (t.query.length === 0) {
			let n = null;
			Object.defineProperty(u, e, {
				enumerable: !0,
				configurable: !1,
				get() {
					return n || (n = Zt(e, [], t, l, a), n);
				}
			});
		} else u[e] = Xt(e, t, l, a);
	}
	return {
		resolved: u,
		names: c,
		teardownAll: l.teardownAll,
		snapshot: () => l.snapshot(e)
	};
}
function Xt(e, t, n, r, i = 1e3) {
	let a = /* @__PURE__ */ new Map();
	return (...o) => {
		let s = o.every(qt) ? Q(o) : null;
		if (s !== null) {
			let e = a.get(s);
			if (e) return a.delete(s), a.set(s, e), e.query;
		}
		let c = r.run(() => re(!0)), l = {
			query: null,
			scope: c,
			pinned: !1
		}, u = Zt(e, o, t, n, c, () => {
			l.pinned = !0;
		}, () => {
			l.pinned = !1;
		});
		if (l.query = u, s !== null && (a.set(s, l), a.size > i)) {
			for (let [e, t] of a) if (!t.pinned) {
				t.scope.stop(), a.delete(e);
				break;
			}
		}
		return u;
	};
}
function Zt(e, t, n, r, i, a, o) {
	let s = i.run(() => n.query(...t)), c;
	if (typeof s == "function" && "subscribe" in s) c = s;
	else {
		let e = i.run(() => /* @__PURE__ */ rt(s));
		c = i.run(() => pt(e, i));
	}
	let l = 0, u = (() => c());
	return u.subscribe = c.subscribe.bind(c), u.acquire = () => {
		let n = r.acquire(e, t);
		l++, l === 1 && a && a();
		let i = !1;
		return () => {
			i || (i = !0, n(), l--, l === 0 && o && o());
		};
	}, u;
}
function Qt(e, t, n, r) {
	let i = {}, a = {}, o = {}, s = {}, c = {}, l = [], u = [], d = [], f = new Vt(), p = {
		storeInternals: o,
		reactionRegistry: f,
		invocationTracker: new Ht(),
		config: e
	};
	if (e.stores) for (let [t, n] of Object.entries(e.stores)) {
		nn(n, "store", t);
		let e = en(t, n, r);
		o[t] = e, i[t] = e.resolved, a[t] = e.resolved;
	}
	if (e.orchestrators) {
		let n = Object.entries(e.orchestrators), o = new Set([...Object.keys(e.stores ?? {}), ...Object.keys(e.orchestrators ?? {})]), m = [];
		for (let [e, s] of n) {
			nn(s, "orchestrator", e), rn(e, s, o);
			let n = ht(s._queries, a, r), c = new Set(s._queries ? Object.keys(s._queries(a)) : []), l = Yt(e, s._liveQueries, a, t, p, r, c), u = s._commands ? Object.keys(s._commands(a)) : [], d = {};
			for (let t of u) d[t] = Pt(e, t);
			let f = {
				...n,
				...l.resolved,
				...d
			};
			i[e] = f, a[e] = f, m.push({
				key: e,
				blueprint: s,
				queries: n,
				queryNames: c,
				liveBundle: l,
				commandKeys: u,
				stubs: d
			});
		}
		for (let n of m) {
			if (!n.blueprint._reactions) {
				s[n.key] = [];
				continue;
			}
			let r = n.blueprint._reactions(a, t, n.stubs), i = [];
			for (let [t, a] of Object.entries(r)) {
				let r = /* @__PURE__ */ new Map(), o = Bt(n.key, t, a, (t) => e.onReaction?.(t), (e, t) => Ut(e, t, p), r), s = {
					module: n.key,
					name: t,
					handler: a,
					executor: o,
					cycleCounter: r
				};
				f.register(s), d.push(o), i.push(t);
			}
			s[n.key] = i;
		}
		let h = Et();
		for (let e of m) {
			let t = e.blueprint._commands ? e.blueprint._commands(a) : {};
			for (let n of e.commandKeys) {
				let r = t[n], a = $t(e.key, n, r, p, h);
				Nt(a, e.key, n);
				let o = i[e.key];
				Object.defineProperty(o, n, {
					value: a,
					enumerable: !0,
					writable: !1,
					configurable: !1
				});
			}
			c[e.key] = e.liveBundle.names, e.liveBundle.names.length > 0 && (l.push(e.liveBundle.teardownAll), u.push(e.liveBundle.snapshot));
		}
	}
	return i.$dispose = async () => {
		await Promise.all(d.map((e) => e.drain()));
		for (let e of l) try {
			let t = e();
			$(t) && await t.catch(() => {});
		} catch {}
		r.stop();
		for (let e = n.length - 1; e >= 0; e--) {
			let t = n[e];
			t.teardown && t.teardown(t.api);
		}
	}, i.$inspectLiveQueries = () => {
		let e = [];
		for (let t of u) e.push(...t());
		return e;
	}, i.$inspectReactions = () => d.map((e) => ({
		module: e.module,
		reaction: e.name,
		inFlight: e.inFlight().length,
		corrIdsInFlight: e.corrIdsInFlight(),
		concurrency: e.concurrency
	})), Object.defineProperty(i, st, {
		value: yt(e, s, c),
		enumerable: !1,
		configurable: !1,
		writable: !1
	}), Object.defineProperty(i, ct, {
		value: i.$inspectLiveQueries,
		enumerable: !1,
		configurable: !1,
		writable: !1
	}), i;
}
function $t(e, t, n, r, i) {
	return (...a) => {
		let o = i();
		r.config.onCommand?.({
			module: e,
			command: t,
			args: a,
			corrId: o,
			timestamp: Date.now()
		});
		let s = n ? n(...a) : void 0, c = s?.data, l = Gt(s?.result), u, d, f = new Promise((e, t) => {
			u = e, d = t;
		}), p = {
			module: e,
			command: t,
			corrId: o,
			resultOk: l.ok,
			resultFail: l.fail,
			resolve: u,
			reject: d,
			resolved: !1,
			invocations: /* @__PURE__ */ new Set()
		};
		if (r.invocationTracker.register(p), s?.events && s.events.length > 0) {
			for (let e of s.events) Dt(e, o);
			Z(s.events, r);
		}
		let m = {
			[lt]: !0,
			store: `__command__${e}`,
			event: t,
			payload: a.length === 0 ? void 0 : a[0]
		};
		return Object.defineProperty(m, ot, {
			value: !0,
			enumerable: !1,
			configurable: !0
		}), Dt(m, o), Z([m], r), r.invocationTracker.watchForUnresolved(p, c).catch(() => {}), Wt(c, f, async () => {
			await r.invocationTracker.awaitAllSettled(p);
		});
	};
}
function en(e, t, n) {
	let r = n.run(() => /* @__PURE__ */ $e(t._initialState())), i = t._projections ?? {}, a = new Proxy({}, {
		get(e, t) {
			return r.value[t];
		},
		has(e, t) {
			return t in r.value;
		},
		ownKeys() {
			return Reflect.ownKeys(r.value);
		},
		getOwnPropertyDescriptor(e, t) {
			return Object.getOwnPropertyDescriptor(r.value, t);
		}
	}), o = ht(t._queries, a, n), s = Mt(e, i);
	return {
		ref: r,
		projections: i,
		resolved: {
			...o,
			...s
		}
	};
}
function tn(e) {
	let t = {}, n = [], r = [], i = !1;
	if (e.services) for (let [a, o] of Object.entries(e.services)) {
		nn(o, "service", a);
		let e = o._setup(o._config);
		e instanceof Promise ? (i = !0, r.push(e.then((e) => {
			t[a] = e, n.push({
				key: a,
				api: e,
				teardown: o._teardown
			});
		}))) : (t[a] = e, n.push({
			key: a,
			api: e,
			teardown: o._teardown
		}));
	}
	return {
		apis: t,
		entries: n,
		hasAsync: i,
		promises: r
	};
}
function nn(e, t, n) {
	(!e || e._type !== t) && J(`"${n}" in ${t}s is not a valid ${t} blueprint. Use define${t[0].toUpperCase()}${t.slice(1)}() to create one.`);
}
function rn(e, t, n) {
	if (t._deps) for (let r of Object.keys(t._deps)) n.has(r) || J(`Orchestrator "${e}" declares dependency "${r}" but it was not found in the graph.`);
}
function an(e) {
	let t = /* @__PURE__ */ new Map(), n = [
		["services", e.services],
		["stores", e.stores],
		["orchestrators", e.orchestrators]
	];
	for (let [e, r] of n) if (r) for (let n of Object.keys(r)) {
		n.startsWith("__command__") && J(`Key "${n}" starts with the reserved prefix "__command__". This namespace is used internally for synthetic command-invocation events.`);
		let r = t.get(n);
		r ? r.push(e) : t.set(n, [e]);
	}
	let r = [];
	for (let [e, n] of t) n.length > 1 && r.push(`"${e}" (in ${n.join(", ")})`);
	r.length > 0 && J(`Graph keys must be disjoint across services, stores, and orchestrators. Colliding key(s): ${r.join("; ")}. A key declared in multiple sections would silently overwrite earlier resolutions and break dependency lookups.`);
}
function on(e) {
	an(e);
	let t = re(), n = tn(e);
	return n.hasAsync ? Promise.all(n.promises).then(() => t.run(() => Qt(e, n.apis, n.entries, t))) : t.run(() => Qt(e, n.apis, n.entries, t));
}
//#endregion
export { vt as CommandUnresolvedError, _t as ReactionError, q as StrataError, on as createStrata, i as defineLiveQuery, n as defineOrchestrator, r as defineReaction, t as defineService, e as defineStore, bt as inspectDAG, J as strataError, Tt as toMermaid };
