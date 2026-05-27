import { onScopeDispose as e, readonly as t, shallowRef as n, watchEffect as r } from "vue";
//#region src/integrations/vue.ts
function i(i) {
	let a = n();
	if (typeof i == "function" && typeof i.subscribe == "function") {
		let t = i;
		a.value = t(), e(t.subscribe((e) => {
			a.value = e;
		}));
	} else {
		let e = i;
		r((t) => {
			let n = e();
			a.value = n(), t(n.subscribe((e) => {
				a.value = e;
			}));
		});
	}
	return t(a);
}
function a(i) {
	let a = n();
	if (typeof i == "function" && typeof i.subscribe == "function" && typeof i.acquire == "function") {
		let t = i, n = t.acquire();
		a.value = t();
		let r = t.subscribe((e) => {
			a.value = e;
		});
		e(() => {
			r(), n();
		});
	} else {
		let e = i;
		r((t) => {
			let n = e();
			if (n == null) {
				a.value = void 0;
				return;
			}
			let r = n.acquire();
			a.value = n();
			let i = n.subscribe((e) => {
				a.value = e;
			});
			t(() => {
				i(), r();
			});
		});
	}
	return t(a);
}
//#endregion
export { a as useLiveQuery, i as useQuery };
