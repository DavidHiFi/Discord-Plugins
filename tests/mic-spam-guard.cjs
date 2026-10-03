var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_fs = require("node:fs");
var import_node_test = __toESM(require("node:test"));
var import_node_vm = __toESM(require("node:vm"));
var import_esbuild = require("esbuild");
const read = (path) => (0, import_node_fs.readFileSync)(new URL(path, require("node:url").pathToFileURL(__filename).href), "utf8");
const source = read("../mic-spam-guard/index.tsx").replace(/^import .*;\r?\n/gm, "").replace("export default definePlugin(", "globalThis.plugin = definePlugin(");
const holdSource = read("../mic-spam-guard/protection.ts").replace("export class VolumeHold", "class VolumeHold");
const code = (0, import_esbuild.transformSync)(holdSource + "\n" + source, { loader: "tsx", format: "cjs" }).code;
const toRaw = (volume) => volume === 0 ? 0 : (volume < 100 ? (volume / 100) ** 2.8 : 10 ** ((volume / 100 - 1) * 6 / 20)) * 100;
const toSlider = (raw) => raw === 0 ? 0 : (raw < 100 ? (raw / 100) ** (1 / 2.8) : 20 * Math.log10(raw / 100) / 6 + 1) * 100;
const v = (t, user = "2") => t.volumes.get(user);
function setup(initial = {}) {
  let now = 1e5;
  const volumes = new Map(Object.entries(initial));
  const writes = [];
  const persisted = /* @__PURE__ */ new Map();
  const storeWrites = [];
  const notifications = [];
  const toasts = [];
  const timers = /* @__PURE__ */ new Map();
  let nextTimer = 1;
  const muted = /* @__PURE__ */ new Set();
  const friends = /* @__PURE__ */ new Set();
  const members = /* @__PURE__ */ new Set(["1", "2", "3", "4"]);
  const emitter = { on() {
  }, off() {
  } };
  const conn = { context: "default", emitter, getUserIdBySsrc: () => "2" };
  let store;
  const sandbox = {
    Date: { now: () => now },
    console,
    setInterval: () => 1,
    clearInterval: () => {
    },
    setTimeout: (fn, ms = 0) => {
      const id = nextTimer++;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    DataStore: {
      get: async (key) => persisted.get(key),
      set: async (key, value) => {
        persisted.set(key, value);
        storeWrites.push(key);
      },
      del: async (key) => persisted.delete(key)
    },
    plugins: {},
    TestcordDevs: { DavidHiFi: { name: "DavidHiFi" } },
    UserAreaButton() {
    },
    openPluginModal() {
    },
    Logger: class {
      debug() {
      }
      error(...args) {
        throw Error(args.join(" "));
      }
    },
    definePlugin: (plugin) => plugin,
    makeRange: (a, b, step = 1) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step),
    OptionType: { BOOLEAN: 1, SLIDER: 2, SELECT: 3 },
    definePluginSettings: (defs) => {
      store = Object.fromEntries(
        Object.entries(defs).map(([key, def]) => [key, def.default ?? def.options?.find((o) => o.default)?.value])
      );
      store.ignoreFriends = false;
      store.dynamicUserVolume = true;
      store.autoMute = false;
      store.notify = false;
      return { store, defs };
    },
    findByPropsLazy: () => ({
      setLocalVolume: (user, value) => {
        (0, import_strict.default)(Number.isFinite(value));
        volumes.set(user, value);
        writes.push({ user, value, at: now });
      }
    }),
    findByCodeLazy: (...filters) => filters.includes("Math.log10") ? toSlider : toRaw,
    Button: {},
    React: {},
    RelationshipStore: { isFriend: (user) => friends.has(user) },
    SelectedChannelStore: { getVoiceChannelId: () => "channel" },
    UserStore: { getCurrentUser: () => ({ id: "1" }), getUser: (user) => ({ username: user, bot: user === "4" }) },
    VoiceStateStore: {
      getVoiceStatesForChannel: () => Object.fromEntries([...members].map((user) => [user, {}]))
    },
    MediaEngineStore: {
      getMediaEngine: () => ({ connections: [conn] }),
      getLocalVolume: (user) => volumes.get(user) ?? 100,
      isLocalMute: (user) => muted.has(user)
    },
    showToast(message, _type, options) {
      toasts.push({ message, options });
    },
    showNotification(data) {
      notifications.push(data);
      return Promise.resolve();
    },
    Toasts: { Type: { MESSAGE: 1 }, Position: { TOP: 0 } }
  };
  sandbox.lodash = {
    debounce: (fn, wait = 0) => {
      let timer;
      const wrapped = (...args) => {
        if (timer !== void 0) sandbox.clearTimeout(timer);
        timer = sandbox.setTimeout(() => {
          timer = void 0;
          fn(...args);
        }, wait);
      };
      wrapped.flush = () => {
        if (timer === void 0) return;
        sandbox.clearTimeout(timer);
        timer = void 0;
        fn();
      };
      wrapped.cancel = () => {
        if (timer !== void 0) sandbox.clearTimeout(timer);
        timer = void 0;
      };
      return wrapped;
    }
  };
  import_node_vm.default.createContext(sandbox);
  import_node_vm.default.runInContext(code, sandbox);
  const run = (expr) => import_node_vm.default.runInContext(expr, sandbox);
  const stats = (payload) => {
    sandbox.payload = payload;
    run("onStats(payload)");
  };
  const sample = (db, user = "2") => stats({ rtp: { inbound: { [user]: { audioLevel: db === -Infinity ? 0 : 10 ** (db / 20) } } } });
  const runTimers = () => {
    const due = [...timers].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at);
    for (const [id, timer] of due) {
      timers.delete(id);
      timer.fn();
    }
  };
  const advance = (ms) => {
    for (let i = 0; i < ms; i += 100) {
      now += Math.min(100, ms - i);
      run("updateProtection(Date.now()); updateDynamics(Date.now())");
      runTimers();
    }
  };
  const speech = (db, ms, user = "2") => {
    for (let i = 0; i < ms; i += 100) {
      sample(db, user);
      advance(100);
    }
  };
  return {
    run,
    sample,
    stats,
    advance,
    speech,
    store,
    storeWrites,
    notifications,
    toasts,
    volumes,
    writes,
    persisted,
    muted,
    friends,
    members,
    plugin: sandbox.plugin
  };
}
(0, import_node_test.default)("Volume conversion filters match Discord's cached functions and 100% stays 100%", () => {
  const curve = JSON.parse(read("./fixtures/discord-volume-curve.json"));
  const context = import_node_vm.default.createContext({});
  import_node_vm.default.runInContext(curve.code, context);
  (0, import_strict.default)(/Math\.pow\([^,]+,\s*2\.8\)/.test(context.i.toString()));
  (0, import_strict.default)(context.r.toString().includes("Math.log10") && context.r.toString().includes("35714285714285715"));
  for (const slider of [5, 20, 60, 100, 200, 400, 1e3]) {
    (0, import_strict.default)(Math.abs(context.i(slider) - toRaw(slider)) < 1e-5);
    (0, import_strict.default)(Math.abs(context.r(context.i(slider)) - slider) < 1e-5);
  }
  import_strict.default.equal(context.r(100), 100);
  (0, import_strict.default)(context.r(20) > 55 && context.r(20) < 57);
});
(0, import_node_test.default)("Loud speech drops promptly and compression target is separate from mute threshold", () => {
  const t = setup();
  t.store.threshold = 90;
  t.speech(-3, 500);
  (0, import_strict.default)(v(t) < 65);
  t.speech(-3, 2500);
  (0, import_strict.default)(Math.abs(v(t) - 48) <= 48 * 0.05 + 1);
});
(0, import_node_test.default)("Quiet speech rises gradually and respects the 200% ceiling", () => {
  const t = setup();
  t.speech(-35, 1e3);
  (0, import_strict.default)(v(t) < 115);
  t.speech(-35, 15e3);
  const slider = toSlider(v(t));
  (0, import_strict.default)(slider > 190 && slider <= 200.1);
});
(0, import_node_test.default)("Silence and background noise do not trigger boost", () => {
  const t = setup();
  t.speech(-Infinity, 4e3);
  t.speech(-50, 4e3);
  import_strict.default.equal(t.writes.length, 0);
});
(0, import_node_test.default)("Automatic balancing detects very quiet speech without boosting silence", () => {
  const t = setup();
  t.speech(-46, 16e3);
  (0, import_strict.default)(toSlider(v(t)) > 190);
  t.speech(-Infinity, 14e3);
  import_strict.default.equal(t.volumes.get("2"), 100);
});
(0, import_node_test.default)("One-second desktop samples do not release gain between samples", () => {
  const t = setup();
  for (let i = 0; i < 8; i++) {
    t.sample(-3);
    t.advance(1e3);
  }
  (0, import_strict.default)(v(t) < 65);
  (0, import_strict.default)(t.writes.filter((w) => w.at >= 102e3).every((w) => w.value < 65));
});
(0, import_node_test.default)("Loud to quiet transition recovers smoothly without jumping to 200", () => {
  const t = setup();
  t.speech(-3, 2e3);
  const low = v(t);
  t.speech(-18, 300);
  (0, import_strict.default)(v(t) < 70 && v(t) >= low);
  t.speech(-Infinity, 12e3);
  import_strict.default.equal(t.volumes.get("2"), 100);
  import_strict.default.equal(t.run("turnedDown.size"), 0);
});
(0, import_node_test.default)("Boost returns to exact manual baseline during silence", () => {
  const t = setup({ "2": 137 });
  t.speech(-35, 15e3);
  t.speech(-Infinity, 14e3);
  import_strict.default.equal(t.volumes.get("2"), 137);
});
(0, import_node_test.default)("Quiet boost fades smoothly after silence rather than snapping down", () => {
  const t = setup();
  t.speech(-35, 15e3);
  t.speech(-Infinity, 1600);
  (0, import_strict.default)(v(t) > 150);
  t.speech(-Infinity, 12e3);
  import_strict.default.equal(t.volumes.get("2"), 100);
});
(0, import_node_test.default)("Manual volume changes become the baseline and manual zero remains zero", () => {
  const t = setup();
  t.speech(-3, 1e3);
  t.volumes.set("2", 150);
  t.advance(100);
  import_strict.default.equal(t.run('turnedDown.get("2").base'), 150);
  t.run('restoreAll("silent")');
  import_strict.default.equal(t.volumes.get("2"), 150);
  t.speech(-3, 1e3);
  t.volumes.set("2", 0);
  t.advance(100);
  t.speech(-35, 3e3);
  import_strict.default.equal(t.volumes.get("2"), 0);
});
(0, import_node_test.default)("Unlocked 600% baseline is never confused with 100% or 200%", () => {
  const t = setup({ "2": 600 });
  t.speech(-3, 1e3);
  t.run('restoreAll("silent")');
  import_strict.default.equal(t.volumes.get("2"), 600);
});
(0, import_node_test.default)("Automatic cut remains bounded for a very high manual baseline", () => {
  const t = setup({ "2": 6e3 });
  t.speech(0, 4e3);
  (0, import_strict.default)(v(t) >= 378);
  t.run('restoreAll("silent")');
  import_strict.default.equal(t.volumes.get("2"), 6e3);
});
(0, import_node_test.default)("Two users receive independent loud and quiet adjustments", () => {
  const t = setup();
  for (let i = 0; i < 160; i++) {
    t.stats({ rtp: { inbound: { "2": { audioLevel: 10 ** (-3 / 20) }, "3": { audioLevel: 10 ** (-35 / 20) } } } });
    t.advance(100);
  }
  (0, import_strict.default)(v(t) < 65);
  (0, import_strict.default)(toSlider(v(t, "3")) > 190);
});
(0, import_node_test.default)("Friends, self, bots, local mute and users outside the call are excluded", () => {
  const t = setup();
  t.store.ignoreFriends = true;
  t.friends.add("2");
  t.muted.add("3");
  for (const user of ["1", "2", "3", "4", "9"]) t.speech(0, 1e3, user);
  import_strict.default.equal(t.writes.length, 0);
});
(0, import_node_test.default)("Ignore restores immediately and Restore pauses until Resume", () => {
  const t = setup();
  t.speech(-3, 1e3);
  t.run('toggleIgnored("2")');
  import_strict.default.equal(t.volumes.get("2"), 100);
  t.run('toggleIgnored("2")');
  t.speech(-3, 1e3);
  t.run('restoreVolume("2", "manual")');
  t.speech(-3, 2e3);
  import_strict.default.equal(t.volumes.get("2"), 100);
  t.run('pausedDynamics.delete("2")');
  t.speech(-3, 1e3);
  (0, import_strict.default)(v(t) < 65);
});
(0, import_node_test.default)("Malformed stats and video entries cannot trigger adjustments", () => {
  const t = setup();
  t.stats({ rtp: { inbound: { "2": [{ audioLevel: NaN }, { kind: "video", audioLevel: 1 }, { audioLevel: -1 }] } } });
  t.advance(1e3);
  import_strict.default.equal(t.writes.length, 0);
});
(0, import_node_test.default)("Multiple audio entries use the loudest sample, including SSRC mapping", () => {
  const t = setup();
  t.run("poll()");
  t.stats({ rtp: { inbound: [{ ssrc: 12, audioLevel: 0.7 }, { ssrc: 13, audioLevel: 0 }] } });
  t.advance(400);
  (0, import_strict.default)(v(t) < 65);
});
(0, import_node_test.default)("Leaving the call restores held volumes and clears controller state", async () => {
  const t = setup();
  await t.plugin.start();
  t.run("poll()");
  t.speech(-3, 1e3);
  t.members.delete("2");
  t.run("poll()");
  import_strict.default.equal(t.volumes.get("2"), 100);
  import_strict.default.equal(t.run("turnedDown.size"), 0);
  await t.plugin.stop();
});
(0, import_node_test.default)("Disable restores volumes and persistence ends with no stale holds", async () => {
  const t = setup();
  t.speech(-3, 1e3);
  t.store.enabled = false;
  t.run("settings.defs.enabled.onChange()");
  t.advance(1e3);
  await t.run("persistQueue");
  import_strict.default.equal(t.volumes.get("2"), 100);
  import_strict.default.equal(Object.keys(t.persisted.get("MicSpamGuard_held_volumes")).length, 0);
});
(0, import_node_test.default)("Crash recovery restores exact saved raw volumes and rejects invalid values", async () => {
  const t = setup({ "2": 24 });
  t.persisted.set("MicSpamGuard_held_volumes", { "2": 600, "3": NaN, "4": -1 });
  await t.plugin.start();
  import_strict.default.equal(t.volumes.get("2"), 600);
  import_strict.default.equal(t.volumes.get("3"), void 0);
  import_strict.default.equal(t.volumes.get("4"), void 0);
  await t.plugin.stop();
});
(0, import_node_test.default)("Mute mode still holds and restores the manual volume", () => {
  const t = setup({ "2": 155 });
  t.store.dynamicUserVolume = false;
  t.store.threshold = 98;
  t.store.autoMute = true;
  t.speech(0, 1e3);
  import_strict.default.equal(t.volumes.get("2"), 0);
  t.run('unmute("2", "manual")');
  import_strict.default.equal(t.volumes.get("2"), 155);
});
(0, import_node_test.default)("Mute protection and volume controls remain separately configurable", () => {
  const t = setup();
  t.store.autoMute = true;
  import_strict.default.equal(t.store.dynamicTarget, 65);
  import_strict.default.equal(t.store.dynamicMaxReduction, 12);
  import_strict.default.equal(t.store.dynamicMaxBoost, 6);
  import_strict.default.equal(t.store.dynamicResponse, 250);
  for (const key of ["threshold", "sensitivity", "autoUnmute", "dynamicTarget", "dynamicMaxReduction", "dynamicMaxBoost", "dynamicResponse"]) {
    import_strict.default.equal(t.plugin.settings.defs[key].hidden(), false);
  }
  t.store.dynamicUserVolume = false;
  import_strict.default.equal(t.plugin.settings.defs.dynamicTarget.hidden(), true);
  import_strict.default.equal(t.plugin.settings.defs.threshold.hidden(), false);
});
(0, import_node_test.default)("Everyday loud speech is balanced without an extreme mute", () => {
  const t = setup();
  t.store.autoMute = true;
  t.speech(-6, 5e3);
  (0, import_strict.default)(v(t) > 0 && v(t) < 100);
  import_strict.default.equal(t.run("mutedByUs.size"), 0);
});
(0, import_node_test.default)("Consecutive extreme samples mute while dynamic balancing is enabled", () => {
  const t = setup({ "2": 155 });
  t.store.autoMute = true;
  t.speech(-6, 1e3);
  t.speech(0, 500);
  import_strict.default.equal(t.volumes.get("2"), 0);
  import_strict.default.equal(t.run("turnedDown.size"), 0);
  t.run('unmute("2", "manual")');
  import_strict.default.equal(t.volumes.get("2"), 155);
});
(0, import_node_test.default)("Normal samples break the extreme mute count", () => {
  const t = setup();
  t.store.autoMute = true;
  for (let i = 0; i < 10; i++) {
    t.sample(0);
    t.advance(100);
    t.sample(-6);
    t.advance(100);
  }
  (0, import_strict.default)(v(t) > 0);
  import_strict.default.equal(t.run("mutedByUs.size"), 0);
});
(0, import_node_test.default)("Old low thresholds cannot mute everyday speech", () => {
  const t = setup();
  t.store.autoMute = true;
  t.store.threshold = 70;
  t.speech(-6, 5e3);
  (0, import_strict.default)(v(t) > 0);
});
(0, import_node_test.default)("Fresh safe speech restores protection smoothly to 100% after the configured hold", () => {
  const t = setup({ "2": 155 });
  t.run("poll()");
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.speech(0, 1e3);
  import_strict.default.equal(v(t), 0);
  t.speech(-20, 3e3);
  import_strict.default.equal(v(t), 0);
  t.speech(-20, 500);
  (0, import_strict.default)(v(t) > 0 && v(t) < 100);
  t.speech(-20, 1200);
  import_strict.default.equal(v(t), 100);
});
(0, import_node_test.default)("Continuous blasts cannot periodically reopen a held volume", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.speech(0, 1e3);
  const count = t.writes.length;
  t.speech(0, 3e4);
  import_strict.default.equal(t.volumes.get("2"), 0);
  (0, import_strict.default)(t.writes.slice(count).every((w) => w.value === 0));
});
(0, import_node_test.default)("Fresh zero readings restore a held user after silence", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.speech(0, 1e3);
  t.speech(-Infinity, 6e3);
  import_strict.default.equal(v(t), 100);
  import_strict.default.equal(t.run("mutedByUs.size"), 0);
});
(0, import_node_test.default)("Missing readings cannot leave a guard-owned zero volume forever", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.speech(0, 1e3);
  t.advance(3e3);
  import_strict.default.equal(v(t), 0);
  t.advance(5e3);
  import_strict.default.equal(v(t), 100);
  import_strict.default.equal(t.run("mutedByUs.size"), 0);
});
(0, import_node_test.default)("A returning blast closes partial recovery before the next full-volume write", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.speech(0, 1e3);
  t.speech(-20, 3600);
  (0, import_strict.default)(v(t) > 0);
  t.speech(0, 100);
  import_strict.default.equal(t.volumes.get("2"), 0);
  t.speech(-20, 2e3);
  import_strict.default.equal(t.volumes.get("2"), 0);
});
(0, import_node_test.default)("Brief natural speech pauses do not reset verified safe recovery", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.speech(0, 1e3);
  t.speech(-20, 2e3);
  t.speech(-Infinity, 500);
  t.speech(-20, 2200);
  import_strict.default.equal(t.volumes.get("2"), 100);
});
(0, import_node_test.default)("Quiet evidence gaps do not restart recovery forever", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.speech(0, 1e3);
  t.speech(-20, 2500);
  t.advance(2500);
  t.speech(-20, 1500);
  import_strict.default.equal(v(t), 100);
});
(0, import_node_test.default)("Auto restore off never raises volume despite continuous safe speech", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  t.store.autoUnmute = 0;
  t.speech(0, 1e3);
  t.speech(-20, 2e4);
  import_strict.default.equal(t.volumes.get("2"), 0);
});
(0, import_node_test.default)("Duplicated timestamps do not accelerate the quiet interval", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.speech(0, 1e3);
  for (let i = 0; i < 100; i++) t.sample(-20);
  import_strict.default.equal(v(t), 0);
});
(0, import_node_test.default)("Manual volume changes during protection remain the user's choice", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  t.speech(0, 1e3);
  t.volumes.set("2", 137);
  t.advance(100);
  import_strict.default.equal(t.volumes.get("2"), 137);
  import_strict.default.equal(t.run("volumeHolds.size"), 0);
});
(0, import_node_test.default)("Disabling protection restores its mute and keeps balancing enabled", () => {
  const t = setup();
  t.store.autoMute = true;
  t.speech(0, 1e3);
  t.store.autoMute = false;
  t.run("settings.defs.autoMute.onChange(false)");
  import_strict.default.equal(t.volumes.get("2"), 100);
  (0, import_strict.default)(t.store.dynamicUserVolume);
});
(0, import_node_test.default)("Gentler defaults keep ordinary loud speech near the manual volume", () => {
  const t = setup();
  t.speech(-12, 3e3);
  const slider = toSlider(v(t));
  (0, import_strict.default)(slider > 90 && slider < 100);
});
(0, import_node_test.default)("Reduction limits and disabling boost are respected", () => {
  const t = setup();
  t.store.dynamicMaxReduction = 3;
  t.speech(0, 3e3);
  (0, import_strict.default)(v(t) >= 70.7);
  t.run('restoreAll("silent")');
  t.store.dynamicMaxBoost = 0;
  t.speech(-35, 5e3);
  import_strict.default.equal(t.volumes.get("2"), 100);
});
(0, import_node_test.default)("Lower targets reduce more and faster response reacts sooner", () => {
  const a = setup();
  const b = setup();
  a.store.dynamicResponse = 150;
  b.store.dynamicResponse = 400;
  a.speech(-3, 300);
  b.speech(-3, 300);
  (0, import_strict.default)(v(a) < v(b));
  const c = setup();
  const d = setup();
  c.store.dynamicTarget = 55;
  d.store.dynamicTarget = 75;
  c.speech(-3, 3e3);
  d.speech(-3, 3e3);
  (0, import_strict.default)(v(c) < v(d));
});
(0, import_node_test.default)("A conflicting SSRC owner cannot mute or change the keyed participant", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  for (let i = 0; i < 5; i++) {
    t.stats({ rtp: { inbound: { "3": { ssrc: 12, audioLevel: 1 } } } });
    t.advance(1e3);
  }
  import_strict.default.equal(t.writes.length, 0);
});
(0, import_node_test.default)("Self audio mislabeled under another member cannot affect anyone", () => {
  const t = setup();
  t.run("poll(); connection.getUserIdBySsrc=()=> '1'");
  t.store.autoMute = true;
  for (let i = 0; i < 5; i++) {
    t.stats({ rtp: { inbound: { "2": { ssrc: 12, audioLevel: 1 } } } });
    t.advance(1e3);
  }
  import_strict.default.equal(t.writes.length, 0);
});
(0, import_node_test.default)("Explicit user identity conflicts cannot cause volume writes", () => {
  const t = setup();
  t.store.autoMute = true;
  for (let i = 0; i < 5; i++) {
    t.stats({ rtp: { inbound: { "2": { userId: "1", audioLevel: 1 }, "3": { user_id: "2", audioLevel: 1 } } } });
    t.advance(1e3);
  }
  import_strict.default.equal(t.writes.length, 0);
});
(0, import_node_test.default)("Unknown numeric keys without a verified owner are ignored", () => {
  const t = setup();
  t.run("poll();connection.getUserIdBySsrc=()=>null");
  t.stats({ rtp: { inbound: { "999": { audioLevel: 1 }, aggregate: { audioLevel: 1 } } } });
  t.advance(1e3);
  import_strict.default.equal(t.writes.length, 0);
  import_strict.default.equal(t.run("levels.has('999')"), false);
});
(0, import_node_test.default)("Outgoing self audio never controls silent incoming participants", () => {
  const t = setup();
  t.store.autoMute = true;
  for (let i = 0; i < 5; i++) {
    t.stats({ rtp: { outbound: { "1": { audioLevel: 1 } }, inbound: { "2": { audioLevel: 0 }, "3": { audioLevel: 0 } } } });
    t.advance(1e3);
  }
  import_strict.default.equal(t.writes.length, 0);
});
(0, import_node_test.default)("Malformed explicit identities and outbound entries cannot control a member", () => {
  const t = setup();
  t.store.autoMute = true;
  for (let i = 0; i < 5; i++) {
    t.stats({
      rtp: {
        inbound: {
          "2": [{ userId: 1, audioLevel: 1 }, { type: "outbound-rtp", audioLevel: 1 }, { direction: "outbound", audioLevel: 1 }],
          "3": { user_id: "", audioLevel: 1 }
        }
      }
    });
    t.advance(1e3);
  }
  import_strict.default.equal(t.writes.length, 0);
});
(0, import_node_test.default)("A failed SSRC lookup cannot fall back to a guessed participant", () => {
  const t = setup();
  t.run("poll();connection.getUserIdBySsrc=()=> {throw Error('no identity');}");
  t.store.autoMute = true;
  for (let i = 0; i < 5; i++) {
    t.stats({ rtp: { inbound: { "2": { ssrc: 12, audioLevel: 1 } } } });
    t.advance(1e3);
  }
  import_strict.default.equal(t.writes.length, 0);
});
(0, import_node_test.default)("Startup migrates aggressive saved limits and restores held raw baselines", async () => {
  const t = setup({ "2": 20 });
  Object.assign(t.store, { dynamicTarget: 60, dynamicMaxReduction: 24, dynamicMaxBoost: 12, threshold: 80, sensitivity: 5, autoUnmute: 3 });
  t.persisted.set("MicSpamGuard_held_volumes", { "2": 155 });
  await t.plugin.start();
  import_strict.default.equal(t.store.dynamicTarget, 65);
  import_strict.default.equal(t.store.dynamicMaxReduction, 12);
  import_strict.default.equal(t.store.dynamicMaxBoost, 6);
  import_strict.default.equal(t.store.threshold, 98);
  import_strict.default.equal(t.store.sensitivity, 5);
  import_strict.default.equal(t.store.autoUnmute, 3);
  import_strict.default.equal(t.volumes.get("2"), 155);
  import_strict.default.equal(t.persisted.has("MicSpamGuard_held_volumes"), false);
  import_strict.default.equal(t.persisted.get("MicSpamGuard_balance_v2"), true);
  Object.assign(t.store, { dynamicTarget: 70, dynamicMaxReduction: 18, dynamicMaxBoost: 9, threshold: 95 });
  await t.plugin.start();
  import_strict.default.equal(t.store.dynamicTarget, 70);
  import_strict.default.equal(t.store.dynamicMaxReduction, 18);
  import_strict.default.equal(t.store.dynamicMaxBoost, 9);
  import_strict.default.equal(t.store.threshold, 95);
});
(0, import_node_test.default)("Startup preserves already moderate saved settings", async () => {
  const t = setup();
  Object.assign(t.store, { dynamicTarget: 70, dynamicMaxReduction: 9, dynamicMaxBoost: 3, threshold: 95 });
  await t.plugin.start();
  import_strict.default.equal(t.store.dynamicTarget, 70);
  import_strict.default.equal(t.store.dynamicMaxReduction, 9);
  import_strict.default.equal(t.store.dynamicMaxBoost, 3);
  import_strict.default.equal(t.store.threshold, 95);
});
(0, import_node_test.default)("Steady speech stops sending volume writes once the value sits in the deadband", () => {
  const t = setup();
  t.speech(-3, 8e3);
  const settled = t.writes.length;
  t.speech(-3, 3e3);
  (0, import_strict.default)(t.writes.length - settled <= 3);
});
(0, import_node_test.default)("Repeated held volume changes collapse into one debounced DataStore write", async () => {
  const t = setup();
  t.run('savedVolume.set("2", 90); persistHeld()');
  t.run('savedVolume.set("2", 80); persistHeld()');
  t.run('savedVolume.set("3", 70); persistHeld()');
  import_strict.default.equal(t.persisted.has("MicSpamGuard_held_volumes"), false);
  t.run("heldWrite.flush()");
  await t.run("persistQueue");
  const held = t.persisted.get("MicSpamGuard_held_volumes");
  import_strict.default.equal(Object.keys(held).length, 2);
  import_strict.default.equal(held["2"], 80);
  import_strict.default.equal(held["3"], 70);
  import_strict.default.equal(t.storeWrites.length, 1);
});
(0, import_node_test.default)("Balancing actions show prominent notices without a notice every tick", () => {
  const t = setup();
  t.store.notify = true;
  t.store.notificationMode = "verbose";
  t.speech(-6, 5e3);
  (0, import_strict.default)(t.notifications.some((n) => n.body.includes("Turned down")));
  (0, import_strict.default)(t.notifications.length <= 2);
  import_strict.default.equal(t.toasts.length, 0);
  t.speech(-Infinity, 12e3);
  (0, import_strict.default)(t.notifications.some((n) => n.body.includes("Restored")));
  import_strict.default.equal(v(t), 100);
});
(0, import_node_test.default)("Mute and automatic 100% recovery each get a notification", () => {
  const t = setup();
  t.run("poll()");
  t.store.notify = true;
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.speech(0, 1e3);
  t.speech(-Infinity, 6e3);
  (0, import_strict.default)(t.notifications.some((n) => n.body.startsWith("Muted")));
  (0, import_strict.default)(t.notifications.some((n) => n.body.includes("to 100%")));
});
(0, import_node_test.default)("Notifications disabled suppress both presentation channels", () => {
  const t = setup();
  t.speech(-6, 5e3);
  t.speech(-Infinity, 12e3);
  import_strict.default.equal(t.notifications.length, 0);
  import_strict.default.equal(t.toasts.length, 0);
});
(0, import_node_test.default)("Standard mode shows essential events once and skips balancing notices", () => {
  const t = setup();
  t.store.notify = true;
  import_strict.default.equal(t.store.notificationMode, "standard");
  t.speech(-6, 5e3);
  t.speech(-Infinity, 12e3);
  import_strict.default.equal(t.notifications.length, 0);
  import_strict.default.equal(t.toasts.length, 0);
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.speech(0, 1e3);
  t.speech(-Infinity, 6e3);
  import_strict.default.equal(t.notifications.length, 2);
  import_strict.default.equal(t.toasts.length, 0);
  import_strict.default.equal(t.notifications[1].body, "Restored 2 to 100%.");
});
(0, import_node_test.default)("Verbose adds context without adding a second notification channel", () => {
  const t = setup();
  t.store.notify = true;
  t.store.notificationMode = "verbose";
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.speech(0, 1e3);
  t.speech(-Infinity, 6e3);
  import_strict.default.equal(t.notifications.length, 2);
  import_strict.default.equal(t.toasts.length, 0);
  (0, import_strict.default)(t.notifications[0].body.includes("Level 100%"));
  (0, import_strict.default)(t.notifications[1].body.includes("After 3 seconds"));
});
(0, import_node_test.default)("StereoGuard retains volume ownership during MicSpamGuard recovery", () => {
  const t = setup();
  t.run("poll()");
  t.store.autoMute = true;
  t.store.autoUnmute = 3;
  t.store.dynamicUserVolume = false;
  t.run("plugins.StereoGuard={isHolding:()=>true,getHeldBaseline:()=>175}");
  t.speech(0, 1e3);
  t.speech(-Infinity, 8e3);
  import_strict.default.equal(v(t), 0);
});
