/*
 * StreamEnhancer live-module verifier.
 *
 * Executes the plugin's actual patches against captured Discord modules and runs the
 * real plugin runtime through them, proving that the camera pipeline, the stream tile
 * pipeline and the badge spoofing still match the current client.
 *
 * Usage:
 *   1. Capture Discord's chunks (any beautified or minified desktop build), e.g.:
 *        git clone --depth 1 https://github.com/Wumpus-Central/discrapper-canary
 *      or use the maintainer's captured modules JSON with tests/stream-enhancer.cjs.
 *   2. STREAM_ENHANCER_BUNDLE_DIR=/path/to/chunks node tools/verify-live-modules.cjs
 *
 * Requires the chunk ids 83982 (call tile camera), 51092 (VideoStream), 802867
 * (stream tile), 650338 (stream badge helpers) and 673514 (RTC connection). Renumbered
 * builds can be handled by adjusting CHUNKS below.
 *
 * This file contains no Discord code; it reads whatever capture you point it at.
 */
const fs = require("node:fs");
const path = require("node:path");

const bundleDir = process.env.STREAM_ENHANCER_BUNDLE_DIR || path.join(__dirname, "..", "..", "discord-bundle");
if (!fs.existsSync(path.join(bundleDir, "83982.js"))) {
    console.log(`No captured modules at ${bundleDir} - set STREAM_ENHANCER_BUNDLE_DIR to verify against a capture. Skipping.`);
    process.exit(0);
}
const root = path.join(__dirname, "..");
const vm = require("node:vm");
const esbuild = require("esbuild");
const { stripWhitespace } = require("./wspace-min.cjs");

// ---------------------------------------------------------------------------
// 1. Patch application, mirroring Vencord's matcher (\i -> identifier)
// ---------------------------------------------------------------------------
const identifier = "(?:[A-Za-z_$][\\w$]*)";

function applyPatch(code, patch) {
    let result = code;
    const replacements = [].concat(patch.replacement);
    replacements.forEach((replacement, index) => {
        const source = replacement.match.source.replaceAll("\\i", identifier);
        const match = new RegExp(source, replacement.match.flags);
        const replace = replacement.replace;
        const found = [...result.matchAll(new RegExp(source, "g"))];
        if (found.length === 0) throw new Error(`replacement ${index} of patch "${patch.find}" did not match`);
        if (found.length > 1) throw new Error(`replacement ${index} of patch "${patch.find}" matched ${found.length} times (must be unique)`);
        result = result.replace(match, replace);
    });
    return result;
}

function loadPatches() {
    const src = fs.readFileSync(path.join(root, "stream-enhancer/patches.ts"), "utf8");
    const out = esbuild.transformSync(src, { loader: "ts", format: "cjs" }).code;
    const sandbox = { module: { exports: {} } };
    vm.runInNewContext(out, sandbox);
    return sandbox.module.exports.streamEnhancerPatches;
}

// ---------------------------------------------------------------------------
// 2. Load the real plugin runtime (state.ts + badge.ts) with stubbed @-imports
// ---------------------------------------------------------------------------
// stub modules for the plugin's @-imports are written to a temp dir at runtime
const os = require("node:os");
const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), "stream-enhancer-verify-"));
for (const sub of ["api", "utils", "components"]) fs.mkdirSync(path.join(stubDir, sub), { recursive: true });
const stubFiles = {
    "api/DataStore.ts": `export async function get(key: string) { return undefined; }
export async function set(key: string, value: unknown) {}
export async function update(key: string, fn: (v: unknown) => unknown) { return undefined; }
export const DataStore = { get, set, update };
export default DataStore;
`,
    "api/Styles.ts": `export const createStyle = () => ({ enable() {}, disable() {} });
export const enableStyle = () => {};
export const disableStyle = () => {};
`,
    "api/PluginManager.ts": `export const isPluginEnabled = (_name: string) => false;
export const plugins = {};
`,
    "api/Settings.ts": `export const definePluginSettings = (def: Record<string, unknown>) => {
    const store: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(def)) {
        const entry = value as { default?: unknown };
        store[key] = entry && typeof entry === "object" && "default" in entry ? entry.default : value;
    }
    return { store, def };
};
`,
    "components/Button.tsx": `export const Button = (props: Record<string, unknown>) => props;
export const ButtonSizes = {};
export default Button;
`,
    "components/Divider.tsx": `export const Divider = (props: Record<string, unknown>) => props;
`,
    "components/ErrorCard.tsx": `export const ErrorCard = (props: Record<string, unknown>) => props;
`,
    "components/FormSwitch.tsx": `export const FormSwitch = (props: Record<string, unknown>) => props;
`,
    "components/Heading.tsx": `export const Heading = (props: Record<string, unknown>) => props;
`,
    "utils/css.ts": `export const classNameFactory = (prefix: string) => (...args: unknown[]) => {
    const filtered = args.filter(a => typeof a === "string" && a.length > 0);
    return filtered.length ? filtered.map(a => prefix + a).join(" ") : "";
};
`,
    "utils/lazy.ts": `export const proxyLazy = <T>(factory: () => T): T => factory();
export const LazyComponent = <T>(factory: () => T): T => factory();
`,
    "utils/Logger.ts": `export class Logger {
    constructor(private name: string) {}
    log(...args: unknown[]) { void this.name; }
    info(...args: unknown[]) {}
    error(...args: unknown[]) {}
    warn(...args: unknown[]) {}
}
`,
    "utils/misc.ts": `export const classes = (...args: unknown[]) => {
    const out: string[] = [];
    const walk = (v: unknown) => {
        if (!v || typeof v === "boolean") return;
        if (typeof v === "string") { out.push(v); return; }
        if (Array.isArray(v)) { v.forEach(walk); return; }
        if (typeof v === "object") for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (val) out.push(k);
    };
    args.forEach(walk);
    return out.join(" ");
};
export const sleep = async (ms: number) => {};
export const debounce = <T extends (...args: any[]) => any>(fn: T) => fn;
export const useDebounce = (fn: unknown) => fn;
export const checks = () => true;
export const isPluginEnabled = () => true;
export const makeLazy = <T>(f: () => T) => f;
export const clone = <T>(v: T): T => (typeof v === "object" && v !== null ? JSON.parse(JSON.stringify(v)) : v);
`,
    "utils/types.ts": `export const definePlugin = (def: unknown) => def;
export type Patch = { plugin?: string; find: string; replacement: unknown; all?: boolean; noWarn?: boolean; predicate?: () => boolean; group?: boolean; targeted?: boolean; };
export const OptionType = { SELECTOR: 0, STRING: 1, NUMBER: 2, BOOLEAN: 3, COMPONENT: 4, SLIDER: 5, CUSTOM: 6 } as const;
`,
    "utils/constants.ts": `export const EquicordDevs = new Proxy({}, { get: (_, name: string) => ({ id: name, username: name }) });
export const TestcordDevs = new Proxy({}, { get: (_, name: string) => ({ id: name, username: name }) });
export const DEV = false;
export const IS_DEV = false;
`
};
for (const [name, content] of Object.entries(stubFiles)) fs.writeFileSync(path.join(stubDir, name), content);

function makeWebpackCommonStub() {
    const React = makeReactStub();
    const Flux = {
        Store: class Store {
            constructor(dispatcher) { this._dispatcher = dispatcher; }
            emitChange() {}
            addChangeListener() { return () => {}; }
            removeChangeListener() {}
        },
        useStateFromStores: null
    };
    const useStateFromStores = (stores, mapStateToProps, deps, equality) => mapStateToProps();
    Flux.useStateFromStores = useStateFromStores;
    return {
        React,
        Flux,
        FluxDispatcher: { dispatch() {}, addInterceptor() {}, removeInterceptor() {} },
        useStateFromStores,
        ChannelStore: { getChannel: () => ({ id: "111", name: "test", getGuildId: () => "222" }) },
        SelectedChannelStore: { getVoiceChannelId: () => "111", getChannelId: () => "1" },
        UserStore: { getCurrentUser: () => ({ id: "self-user" }), getUser: () => ({ id: "self-user" }) },
        useEffect: React.useEffect,
        useState: React.useState,
        useRef: React.useRef,
        useCallback: React.useCallback,
        useMemo: React.useMemo,
        setStateFromStores: useStateFromStores
    };
}

function makeReactStub() {
    const React = {
        Fragment: "Fragment",
        createElement(type, props, ...children) {
            return { $$element: true, type, props: props ?? {}, key: props?.key, children };
        },
        cloneElement(element, overrides) {
            return { ...element, props: { ...element.props, ...overrides } };
        },
        memo(fn) { const c = props => fn(props); c.type = fn; c.$$memo = true; return c; },
        forwardRef(fn) { const c = (props, ref) => fn(props, ref); c.render = fn; c.$$forwardRef = true; return c; },
        useState(initial) { return [typeof initial === "function" ? initial() : initial, () => {}]; },
        useCallback(fn) { return fn; },
        useMemo(fn) { return fn(); },
        useRef(initial) { return { current: initial }; },
        useEffect() {},
        useLayoutEffect() {},
        useContext() {
            return {
                enabled: false,
                minZoom: 1,
                isDragging: false,
                setIsDragging() {},
                panOffset: { x: 0, y: 0 },
                setPanOffset() {},
                zoomLevel: 1,
                isWheeling: false,
                setIsWheeling() {},
                isSlidering: false,
                setVideoAspectRatio() {},
                wrapperRef: { current: null },
                doZoom() {},
                clampPanOffset: value => value
            };
        },
        Children: { map: (c, fn) => c }
    };
    return React;
}

const cssModule950183 = {
    wrapper: "wrapper__48b20",
    video: "video__48b20",
    videoCover: "videoCover__48b20",
    videoContain: "videoContain__48b20",
    mirror: "mirror__48b20",
    previewWrapper: "previewWrapper__48b20 video__48b20",
    loading: "loading__48b20",
    previewImage: "previewImage__48b20",
    emptyPreviewWrapper: "emptyPreviewWrapper__48b20",
    emptyPreview: "emptyPreview__48b20",
    spinner: "spinner__48b20"
};

function classNamesJoin(...args) {
    const out = [];
    const walk = v => {
        if (!v || typeof v === "boolean") return;
        if (typeof v === "string") { out.push(v); return; }
        if (Array.isArray(v)) { v.forEach(walk); return; }
        if (typeof v === "object") for (const [k, val] of Object.entries(v)) if (val) out.push(k);
    };
    args.forEach(walk);
    return out.join(" ");
}

function buildPluginRuntime() {
    // generic auto-mock for arbitrary webpack modules
    const universal = () => new Proxy(function () {}, {
        get: (t, p) => {
            if (p === Symbol.toPrimitive) return () => "";
            if (p === "toString") return () => "";
            if (p === Symbol.iterator) return function* () {};
            return universal();
        },
        apply: () => universal()
    });

    const VideoComponentMock = props => ({ $$videoComponent: true, props });

    const moduleStubs = {
        // 51092's own deps
        477900: {
            jsx: (type, props, key) => ({ $$element: true, type, props: props ?? {}, key }),
            jsxs: (type, props, key) => ({ $$element: true, type, props: props ?? {}, key })
        },
        582128: makeReactStub(),
        503698: classNamesJoin,
        289873: { y: props => ({ $$spinner: true, props }) },
        205693: { x: { STREAM: "STREAM", DEFAULT: "DEFAULT" } },
        451988: { Ep: class { start() {} stop() {} } },
        684339: {
            u: { SELF_VIDEO: "SELF_VIDEO", REMOTE_VIDEO: "REMOTE_VIDEO", SELF_STREAM: "SELF_STREAM", REMOTE_STREAM: "REMOTE_STREAM" },
            M: class VideoSpinnerTimer { onSpinnerStarted() {} trackSpinnerDuration() {} }
        },
        276208: { X: { isIncomingVideoEnabled: () => false } },
        927813: { A: { Millis: { SECOND: 1000 } } },
        37965: { Z: () => {}, W: () => {} },
        821589: { t: (css, name, fit) => `cn-${String(fit)}` },
        950183: cssModule950183,

        // 83982's deps that steer which branch renders
        17928: { bG: (stores, mapper) => mapper() },
        25578: {
            Ay: {
                getVideoComponent: () => VideoComponentMock,
                supports: () => true,
                isLocalVideoDisabled: () => false
            }
        },
        51082: { Ay: () => true },
        525505: { A: () => null, u: () => null },
        958713: { A: () => null },
        753727: { A: () => false },
        530804: { uy: () => null },
        550946: { A: () => false },
        562153: { Ay: { getName: () => "Test" } },
        869146: { A: { getWindowFocused: () => true } },
        854627: { A: () => ({ avatarSrc: null, avatarDecorationSrc: null }) },
        912630: { A: { videoBackgroundUnavailable: false } },
        531685: { A: { isFocused: () => true } },
        198052: { A: { getSelectedParticipant: () => null } },
        520698: { A: value => value },
        72755: { A: props => ({ $$avatar: true, props }) },
        289552: { A: props => ({ $$tooltip: true, props }) },
        566566: { A: props => ({ $$avErrorTile: true, props }) },
        375708: { intl: { string: () => "", formatToPlainString: () => "" } },
        367513: { A: { selectParticipant() {} } },
        778712: { _3: { SIZE_80: 80, SIZE_40: 40 } },
        866665: { m: props => ({ $$tooltip2: true, props }) },
        695366: { E: props => ({ $$icon: true, props }) },
        661531: { A: { colors: {} } },
        584841: { tN: "videoWrapper__2f4f7", Qs: "content__2f4f7", Kx: "blockedAvatar__2f4f7", bG: "videoBackgroundUnavailable__2f4f7" },
        280450: { default: { getId: () => "self-user" } },
        164617: { N: { CALL_TILE: "CALL_TILE", NO_POPOUT: "NO_POPOUT" } },
        652215: { MLl: { CHANNEL_CALL_POPOUT: "CHANNEL_CALL_POPOUT" }, O5: { VIDEO: "VIDEO" }, XYD: { ENDED: "ENDED", FAILED: "FAILED", PAUSED: "PAUSED" } },
        731854: { x: { DEFAULT: "DEFAULT", STREAM: "STREAM" }, O5: { VIDEO: "VIDEO" } }
    };

    const live51092 = { exports: null };
    moduleStubs[51092] = {
        get A() { return live51092.exports?.A; },
        get $() { return live51092.exports?.$; }
    };

    const tolerant = value => {
        if (value == null) return universal();
        if (typeof value !== "object") return value;
        return new Proxy(value, {
            get(target, prop) {
                if (prop in target) return target[prop];
                if (prop === Symbol.toPrimitive) return () => "";
                return (...args) => {
                    void args;
                    if (prop === "displayName") return "";
                    return universal();
                };
            }
        });
    };
    const requireModule = id => {
        if (moduleStubs[id] != null) return tolerant(moduleStubs[id]);
        return universal();
    };
    requireModule.live51092 = live51092;
    requireModule.moduleStubs = moduleStubs;
    requireModule.d = (obj, defs) => {
        for (const [name, getter] of Object.entries(defs)) Object.defineProperty(obj, name, { get: getter, enumerable: true, configurable: true });
    };
    requireModule.n = m => () => m;

    return { requireModule, VideoComponentMock };
}

function buildPluginObject() {
    // esbuild-bundle state.ts with stubbed @-imports
    const stubFiles = {
        "@api/DataStore": path.join(stubDir, "api/DataStore.ts"),
        "@api/Styles": path.join(stubDir, "api/Styles.ts"),
        "@utils/css": path.join(stubDir, "utils/css.ts"),
        "@utils/lazy": path.join(stubDir, "utils/lazy.ts"),
        "@utils/misc": path.join(stubDir, "utils/misc.ts"),
        "@api/PluginManager": path.join(stubDir, "api/PluginManager.ts"),
        "@api/Settings": path.join(stubDir, "api/Settings.ts"),
        "@components/Button": path.join(stubDir, "components/Button.tsx"),
        "@components/Divider": path.join(stubDir, "components/Divider.tsx"),
        "@components/ErrorCard": path.join(stubDir, "components/ErrorCard.tsx"),
        "@components/FormSwitch": path.join(stubDir, "components/FormSwitch.tsx"),
        "@components/Heading": path.join(stubDir, "components/Heading.tsx"),
        "@utils/Logger": path.join(stubDir, "utils/Logger.ts"),
        "@utils/types": path.join(stubDir, "utils/types.ts"),
        "@utils/constants": path.join(stubDir, "utils/constants.ts"),
        "@webpack": path.join(stubDir, "webpack.ts"),
        "@webpack/common": path.join(stubDir, "webpackCommon.ts")
    };

    fs.writeFileSync(path.join(stubDir, "webpack.ts"), `
export const findComponentByCodeLazy = (...code: string[]) => {
    // resolved lazily at render time against the executed live module
    const lookup = (globalThis as any).__liveVideoStreamLookup;
    const component = (...args: unknown[]) => {
        const resolved = lookup()(code.join("|"), args);
        return (globalThis as any).__harnessReact.createElement(resolved, ...args);
    };
    return component;
};
export const findByCodeLazy = () => (() => undefined);
export const findByPropsLazy = () => new Proxy({}, { get: () => (() => undefined) });
export const findStoreLazy = (name: string) => new Proxy({}, { get: () => (() => undefined) });
export const findModuleId = () => undefined;
export const wreq = undefined;
export const filters = new Proxy({}, { get: () => (() => false) });
export const waitFor = (_filter: unknown, callback: (mod: unknown) => void) => callback(undefined);
export const findByCode = () => undefined;
`);
    fs.writeFileSync(path.join(stubDir, "webpackCommon.ts"), `
const React = (globalThis as any).__harnessReact;
const useStateFromStores = (stores: unknown, mapper: () => unknown) => mapper();
export { React, useStateFromStores };
export const Flux = (globalThis as any).__harnessFlux;
export const FluxDispatcher = { dispatch() {}, addInterceptor() {}, removeInterceptor() {} };
export const ChannelStore = { getChannel: () => ({ id: "111", name: "test", getGuildId: () => "222" }) };
export const SelectedChannelStore = { getVoiceChannelId: () => "111", getChannelId: () => "1" };
export const UserStore = { getCurrentUser: () => ({ id: "self-user" }), getUser: () => ({ id: "self-user" }) };
export const useEffect = React.useEffect;
export const useState = React.useState;
export const useRef = React.useRef;
export const useCallback = React.useCallback;
export const useMemo = React.useMemo;
export const Toasts = { show() {} };
export const Select = (props: unknown) => props;
export const Slider = (props: unknown) => props;
export const TextInput = (props: unknown) => props;
export const Menu = new Proxy({}, { get: () => (props: unknown) => props });
export const ContextMenuApi = { open() {}, close() {} };
export const ColorPicker = (props: unknown) => props;
export const Tooltip = (props: unknown) => props;
`);

    const entry = path.join(stubDir, "stateEntry.ts");
    fs.writeFileSync(entry, `
import * as state from "${path.join(root, "stream-enhancer/state.ts")}";
import * as settings from "${path.join(root, "stream-enhancer/settings.tsx")}";
export const plugin = { ...state, ...settings.streamEnhancerRuntime, streamEnhancerSettings: settings.streamEnhancerSettings };
`);

    const result = esbuild.buildSync({
        entryPoints: [entry],
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node20",
        write: false,
        external: ["react"],
        alias: Object.fromEntries(Object.entries(stubFiles).map(([k, v]) => [k, v])),
        loader: { ".css": "empty", ".tsx": "tsx" },
        define: { "import.meta.url": "undefined" }
    });
    const code = result.outputFiles[0].text;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        require,
        globalThis: mkGlobal()
    };
    vm.runInNewContext(code, sandbox);
    return sandbox.module.exports;
}

function mkGlobal() {
    const g = {};
    const sharedReact = makeReactStub();
    globalThis.__harnessReact = sharedReact;
    return new Proxy(g, {
        get(target, prop) {
            if (prop === "__harnessReact") return sharedReact;
            if (prop === "__harnessFlux") {
                return {
                    Store: class Store {
                        emitChange() {}
                        addChangeListener() { return () => {}; }
                        removeChangeListener() {}
                    }
                };
            }
            if (prop in target) return target[prop];
            if (globalThis[prop] !== undefined) return globalThis[prop];
            return undefined;
        },
        set(target, prop, value) { target[prop] = value; return true; },
        has: () => true
    });
}

// ---------------------------------------------------------------------------
// 3. Execute the patched live modules and render a camera tile
// ---------------------------------------------------------------------------
function main() {
    const patches = loadPatches();
    const findPatch = name => {
        const patch = patches.find(p => p.find === name);
        if (!patch) throw new Error(`patch not found: ${name}`);
        return patch;
    };

    const cameraModuleSrc = fs.readFileSync(path.join(bundleDir, "83982.js"), "utf8");
    const videoStreamSrc = fs.readFileSync(path.join(bundleDir, "51092.js"), "utf8");
    const cameraCode = applyPatch(stripWhitespace(cameraModuleSrc), findPatch("REMOTE_VIDEO,paused:"));
    const videoStreamCode = applyPatch(stripWhitespace(videoStreamSrc), findPatch('location:"VideoStream"'));

    // sanity: strip must not change semantics (esbuild-normalized comparison)
    const normalize = s => esbuild.transformSync(`(function(z1,z2,z3){${s}})`, { minify: true }).code;
    if (normalize(stripWhitespace(cameraModuleSrc)) !== normalize(cameraModuleSrc)) throw new Error("camera strip changed semantics");
    if (normalize(stripWhitespace(videoStreamSrc)) !== normalize(videoStreamSrc)) throw new Error("video stream strip changed semantics");

    const { requireModule } = buildPluginRuntime();
    const live51092 = requireModule.live51092;
    const moduleStubs = requireModule.moduleStubs;
    const liveExports = {};

    // plugin runtime, with findComponentByCodeLazy resolving to the live component at render time
    globalThis.__liveVideoStreamLookup = () => () => liveExports.VideoStream;
    const state = buildPluginObject();
    const pluginSelf = {
        ...state.plugin,
        renderViewerControls: () => null
    };
    const settingsStore = state.plugin.streamEnhancerSettings?.store?.config;

    // execute patched 51092 (VideoStream) first
    {
        const factory = vm.runInNewContext(`(function(n,t,e,$self){${videoStreamCode}})`, { console }, { filename: "51092.factory.js" });
        const exportsObj = {};
        factory(requireModule, exportsObj, {}, pluginSelf);
        liveExports.VideoStream = exportsObj.A;
        liveExports.VideoStreamFit = exportsObj.$;
        live51092.exports = exportsObj;
    }


    // execute patched 83982 (CallTile camera component)
    const cameraFactory = vm.runInNewContext(`(function(n,t,e,$self){${cameraCode}})`, { console }, { filename: "83982.factory.js" });
    const cameraExports = {};
    cameraFactory(requireModule, cameraExports, {}, pluginSelf);
    const CallTileCamera = cameraExports.A;

    // ---- render the camera tile: self and remote ----
    const render = participantId => {
        const props = {
            participant: { id: participantId, user: { id: participantId }, streamId: `camera-${participantId}`, speaking: false, type: 1 },
            channel: { id: "111", guild_id: null, getGuildId: () => null, isGuildStageVoice: () => false },
            inCall: true,
            width: 400,
            selected: false,
            popoutType: "CALL_TILE",
            fit: "contain",
            onVideoResize: () => {},
            blocked: false,
            ignored: false,
            paused: false
        };
        return CallTileCamera(props);
    };

    for (const participantId of ["self-user", "friend-user"]) {
        const tile = render(participantId);
        if (!tile || !tile.$$element) throw new Error(`camera tile for ${participantId} did not render an element`);
        // with the component captured at the call site, the tile element IS the VideoStream element
        if (tile.type !== liveExports.VideoStream) {
            throw new Error(`camera tile for ${participantId} rendered ${String(tile.type)} instead of the native VideoStream component`);
        }
        const p = tile.props;
        if (!p.videoComponent) throw new Error(`camera tile for ${participantId} lost videoComponent`);
        if (!String(p.className).includes("vc-stream-enhancer-video-")) throw new Error(`camera tile for ${participantId} lost the fit className`);
        // Discord's own tile video class must be preserved (the plugin merges, never replaces)
        if (!String(p.className).includes("content__2f4f7")) throw new Error(`camera tile for ${participantId} dropped Discord's content class`);
        if (!p.streamId) throw new Error(`camera tile for ${participantId} lost streamId`);
        console.log(`[${participantId}] tile -> VideoStream ok; key=${JSON.stringify(tile.key)} className=${JSON.stringify(p.className)} wrapperClassName=${JSON.stringify(p.wrapperClassName)} fit=${p.fit} streamId=${p.streamId}`);

        // now render the VideoStream component itself
        const rendered = liveExports.VideoStream(p);
        if (!rendered || !rendered.$$element) throw new Error(`VideoStream for ${participantId} did not render`);
        const [videoEl, previewEl] = rendered.props.children;
        if (!videoEl || !videoEl.$$element) throw new Error(`VideoStream for ${participantId} lost the video element`);
        if (videoEl.type !== requireModule(25578).Ay.getVideoComponent() && typeof videoEl.type !== "function") {
            throw new Error(`VideoStream for ${participantId} video element has unexpected type`);
        }
        if (!String(videoEl.props.className).includes("video__48b20")) throw new Error(`VideoStream for ${participantId} video element lost video__48b20`);
        if (!previewEl || !previewEl.$$element) throw new Error(`VideoStream for ${participantId} lost the preview overlay`);
        console.log(`[${participantId}] VideoStream ok; video className=${JSON.stringify(videoEl.props.className)} wrapper=${JSON.stringify(rendered.props.className)}`);
    }

    // ---- stream tile (Go Live) path: "Stream Tile State" + media wrapper patches ----
    {
        const streamTileSrc = fs.readFileSync(path.join(bundleDir, "802867.js"), "utf8");
        const stripped = stripWhitespace(streamTileSrc);
        if (normalize(stripped) !== normalize(streamTileSrc)) throw new Error("stream tile strip changed semantics");
        let streamTileCode = applyPatch(stripped, findPatch("Stream Tile State"));
        streamTileCode = applyPatch(streamTileCode, findPatch(",{streamId:n,onResize:s,wrapperClassName:a}=t,{onActive:o}"));

        const streamFactory = vm.runInNewContext(`(function(n,t,e,$self){${streamTileCode}})`, { console }, { filename: "802867.factory.js" });
        const streamExports = {};
        streamFactory(requireModule, streamExports, {}, pluginSelf);
        const StreamTile = streamExports.A;

        const streamParticipant = {
            id: "stream-user",
            user: { id: "stream-user" },
            streamId: "guild:222:111:stream-user",
            stream: { channelId: "111", guildId: "222" },
            type: 2,
            speaking: false
        };
        const tile = StreamTile({
            participant: streamParticipant,
            selected: false,
            onVideoResize: () => {},
            fit: "contain",
            popoutType: "CALL_TILE",
            width: 400,
            wrapperClassName: undefined,
            paused: false
        });
        if (!tile || tile.$$element !== true) throw new Error("stream tile did not render an element");
        const kids = Array.isArray(tile.props.children) ? tile.props.children : [tile.props.children];
        const videoNode = kids.find(k => k && k.$$element === true && k.props && "streamId" in k.props);
        if (!videoNode) throw new Error("stream tile did not render the ZoomableVideo wrapper");
        // ZoomableVideo renders a wrapper div whose inner div wraps the native VideoStream
        const zoomDiv = videoNode.type(videoNode.props);
        if (!zoomDiv || zoomDiv.$$element !== true) throw new Error("ZoomableVideo wrapper did not render");
        const zoomInner = zoomDiv.props.children;
        if (!zoomInner || zoomInner.$$element !== true) throw new Error("ZoomableVideo inner div missing");
        const videoProps = zoomInner.props.children;
        if (!videoProps || videoProps.$$element !== true || videoProps.type !== liveExports.VideoStream) {
            throw new Error("ZoomableVideo wrapper did not render the native VideoStream");
        }
        if (!String(videoProps.props.className).includes("content__2f4f7")) throw new Error("stream tile dropped Discord's content class");
        if (!String(videoProps.props.className).includes("vc-stream-enhancer-video-contain")) throw new Error("stream tile lost the fit class");
        console.log("[stream] Go Live tile renders VideoStream with merged classes:", JSON.stringify(videoProps.props.className));

        // null participant guard must keep working
        if (StreamTile({ participant: null }) !== null) throw new Error("null participant should render nothing");
        console.log("[stream] null participant guard intact");
    }

    // ---- badge: "useMaxQuality" local tile badge against the live module ----
    {
        Object.assign(moduleStubs, {
            929921: { A: { getState: () => ({ fps: 60, resolution: 1080 }) } },
            763827: { A: { getGuildId: () => "222" } }
        });
        moduleStubs[731854].ei = { SOURCE: "source", FIXED: "fixed" };

        const badgeSrc = fs.readFileSync(path.join(bundleDir, "650338.js"), "utf8");
        const stripped = stripWhitespace(badgeSrc);
        if (normalize(stripped) !== normalize(badgeSrc)) throw new Error("badge module strip changed semantics");
        const badgeCode = applyPatch(stripped, findPatch('"useMaxQuality"'));
        const badgeFactory = vm.runInNewContext(`(function(n,t,e,$self){${badgeCode}})`, { console }, { filename: "650338.factory.js" });
        const badgeExports = {};
        badgeFactory(requireModule, badgeExports, {}, pluginSelf);
        const useStreamBadge = badgeExports.N5;
        if (typeof useStreamBadge !== "function") throw new Error("useMaxQuality module did not export the badge hook");

        const nativeResolution = { height: 1080, width: 0, type: "fixed" };
        const spoofOn = { ...settingsStore, spoofBadgeEnabled: true, spoofBadgeWidth: 7680, spoofBadgeHeight: 4320, spoofBadgeFps: 360 };
        Object.assign(settingsStore, spoofOn);
        const spoofed = useStreamBadge({ user: { id: "self-user" }, maxFrameRate: 30, maxResolution: nativeResolution });
        if (spoofed.maxFrameRate !== 360) throw new Error(`spoofed badge fps wrong: ${spoofed.maxFrameRate}`);
        if (spoofed.maxResolution.width !== 7680 || spoofed.maxResolution.height !== 4320) throw new Error("spoofed badge resolution wrong");
        if (spoofed.maxResolution.type !== "fixed") throw new Error(`badge resolution type must be the Discord enum value, got ${JSON.stringify(spoofed.maxResolution.type)}`);

        Object.assign(settingsStore, { spoofBadgeEnabled: false });
        const native = useStreamBadge({ user: { id: "self-user" }, maxFrameRate: 30, maxResolution: nativeResolution });
        if (native.maxFrameRate !== 60) throw new Error(`native badge fps wrong: ${native.maxFrameRate}`);

        const other = useStreamBadge({ user: { id: "friend" }, maxFrameRate: 30, maxResolution: nativeResolution });
        if (other.maxFrameRate !== 30) throw new Error("other-user badges must not be touched by the local tile spoof");
        Object.assign(settingsStore, { spoofBadgeEnabled: false });
        console.log("[badge] local tile badge spoofs only the self stream and only while enabled");

        // ---- badge: outgoing gateway advertise via the live sendVideo patch ----
        const rtcSrc = fs.readFileSync(path.join(bundleDir, "673514.js"), "utf8");
        const rtcStripped = stripWhitespace(rtcSrc);
        if (normalize(rtcStripped) !== normalize(rtcSrc)) throw new Error("rtc strip changed semantics");
        const rtcCode = applyPatch(rtcStripped, findPatch("this._sentVideo&&"));
        if (!rtcCode.includes("$self.advertise(this,")) throw new Error("advertise hook missing from patched RTC module");
        new Function(`return (function(n,t,e,$self){${rtcCode}})`);

        const sendVideo = rtcCode.match(/sendVideo\(e,t,n,i\)\{[^{}]*\}/);
        if (!sendVideo) throw new Error("patched sendVideo not found");
        const captured = { streams: null };
        const sendVideoFn = vm.runInNewContext(`(function($self){return function sendVideo(e,t,n,i){${sendVideo[0].replace(/^sendVideo\(e,t,n,i\)\{/, "").replace(/\}$/, "")}}})`, { console })(pluginSelf);
        const gatewayStreams = [{ type: "video", maxResolution: { type: "fixed", width: 1920, height: 1080 }, maxFrameRate: 60, maxBitrate: 12000000 }, { type: "audio", maxBitrate: 192000 }];
        const rtc = { _sentVideo: true, _socket: { video: (e, t, n, streams) => { captured.streams = streams; } }, context: "stream" };
        Object.assign(settingsStore, { spoofBadgeEnabled: true, spoofBadgeWidth: 7680, spoofBadgeHeight: 4320, spoofBadgeFps: 360 });
        sendVideoFn.call(rtc, 1, 2, 3, gatewayStreams);
        if (captured.streams === gatewayStreams) throw new Error("gateway streams must be copied when the badge spoof is on");
        if (captured.streams[0].maxFrameRate !== 360 || captured.streams[0].maxResolution.width !== 7680) throw new Error("gateway advertise did not carry the spoofed values");
        if (captured.streams[1] !== gatewayStreams[1]) throw new Error("audio stream entries must pass through untouched");
        if (gatewayStreams[0].maxFrameRate !== 60) throw new Error("the original gateway array must stay unmodified");
        console.log("[badge] outgoing gateway video parameters carry the spoof while audio passes through");
    }

    // ---- partial-failure regression: the vcState hook injection stops matching ----
    {
        const partialPatch = {
            find: "REMOTE_VIDEO,paused:",
            replacement: [].concat(findPatch("REMOTE_VIDEO,paused:").replacement).slice(1)
        };
        const driftedCode = applyPatch(stripWhitespace(cameraModuleSrc), partialPatch);
        const driftedFactory = vm.runInNewContext(`(function(n,t,e,$self){${driftedCode}})`, { console }, { filename: "83982.drifted.js" });
        const driftedExports = {};
        driftedFactory(requireModule, driftedExports, {}, pluginSelf);
        const driftedTile = driftedExports.A({
            participant: { id: "drift-user", user: { id: "drift-user" }, streamId: "camera-drift", speaking: false, type: 1 },
            channel: { id: "111", guild_id: null, getGuildId: () => null, isGuildStageVoice: () => false },
            inCall: true,
            width: 400,
            selected: false,
            popoutType: "CALL_TILE",
            fit: "contain",
            onVideoResize: () => {},
            blocked: false,
            ignored: false,
            paused: false
        });
        if (!driftedTile || !driftedTile.$$element) throw new Error("drifted camera tile did not render an element");
        if (driftedTile.type !== liveExports.VideoStream) throw new Error("drifted camera tile lost the native component");
        if (!String(driftedTile.props.className).includes("content__2f4f7")) throw new Error("drifted camera tile dropped Discord's content class");
        if (String(driftedTile.props.className).includes("vc-stream-enhancer")) throw new Error("drifted camera tile should fall back to pure Discord classes");
        console.log("[drift] tile still renders with native classes when the hook replacement stops matching");
    }

    // ---- resilience: renderZoomableCameraVideo falls back and degrades instead of throwing ----
    {
        const props = { onResize: () => {}, className: "x", key: undefined };
        const native = pluginSelf.renderZoomableCameraVideo(liveExports.VideoStream, props, "k1");
        if (!native || native.$$element !== true || native.type !== liveExports.VideoStream) {
            throw new Error("the captured native component must render directly");
        }
        const fallback = pluginSelf.renderZoomableCameraVideo(undefined, props, "k2");
        if (!fallback || fallback.$$element !== true) throw new Error("a missing native component must fall back to the lazy lookup");

        const ReactCommon = globalThis.__harnessReact;
        const realCreateElement = ReactCommon.createElement;
        ReactCommon.createElement = () => { throw new Error("boom"); };
        let degraded;
        try {
            degraded = pluginSelf.renderZoomableCameraVideo(liveExports.VideoStream, props, "k3");
        } finally {
            ReactCommon.createElement = realCreateElement;
        }
        if (degraded !== null) throw new Error("an element-creation failure must degrade to null, not throw");
        console.log("[resilience] renderZoomableCameraVideo falls back and degrades safely");
    }

    console.log("LIVE MODULE CAMERA EXECUTION PASSED");
}

try {
    main();
} catch (error) {
    console.error("LIVE MODULE CAMERA EXECUTION FAILED:", error?.stack ?? error);
    process.exit(1);
}
