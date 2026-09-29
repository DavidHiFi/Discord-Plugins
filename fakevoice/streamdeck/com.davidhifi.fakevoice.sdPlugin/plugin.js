/**
 * FakeVoice bridge - Stream Deck plugin (HTML/JS plugin, no runtime required).
 *
 * Talks to the bridge that the FakeVoice TestCord user plugin exposes on
 * 127.0.0.1:47830. Stream Deck calls connectElgatoStreamDeckSocket() once the
 * page has loaded; everything after that is the normal WebSocket protocol.
 *
 * The key faces (icon, name and ON/OFF) are baked into the PNGs in imgs/keys,
 * so the plugin only switches state; it never draws a title that could clip.
 */
(function () {
    "use strict";

    var BRIDGE = "http://127.0.0.1:47830/fakevoice/";

    var ACTIONS = {
        "com.davidhifi.fakevoice.fakemute": "mute",
        "com.davidhifi.fakevoice.fakedeafen": "deafen",
        "com.davidhifi.fakevoice.fakecamera": "camera",
        "com.davidhifi.fakevoice.fakestream": "stream",
        "com.davidhifi.fakevoice.fakegame": "game"
    };

    var ws = null;
    var contexts = {};

    function send(payload) {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
    }

    function setState(context, state) {
        send({ event: "setState", context: context, payload: { state: state } });
    }

    function apply(state) {
        if (!state) return;
        Object.keys(contexts).forEach(function (context) {
            var kind = ACTIONS[contexts[context]];
            if (!kind) return;
            setState(context, state[kind] ? 1 : 0);
        });
    }

    function request(path, onDone) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", BRIDGE + path, true);
        xhr.timeout = 4000;
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
                var data = null;
                try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
                onDone(data, null);
            } else {
                onDone(null, xhr.status || "http error");
            }
        };
        xhr.ontimeout = function () { onDone(null, "timeout"); };
        xhr.onerror = function () { onDone(null, "unreachable"); };
        xhr.send();
    }

    function refresh() {
        if (!Object.keys(contexts).length) return;
        request("state", function (state) { apply(state); });
    }

    function toggle(kind, context) {
        request("toggle/" + kind, function (data, err) {
            if (err || !data || !data.state) {
                send({ event: "showAlert", context: context });
                return;
            }
            apply(data.state);
        });
    }

    function handle(message) {
        var event = message.event;
        var action = message.action;
        var context = message.context;

        if (event === "willAppear") {
            contexts[context] = action;
            refresh();
            return;
        }

        if (event === "willDisappear") {
            delete contexts[context];
            return;
        }

        if (event === "keyDown") {
            var kind = ACTIONS[action];
            if (kind) toggle(kind, context);
            return;
        }

        if (event === "propertyInspectorDidAppear") {
            refresh();
        }
    }

    window.connectElgatoStreamDeckSocket = function (port, uuid, registerEvent) {
        ws = new WebSocket("ws://127.0.0.1:" + port);
        ws.onopen = function () {
            send({ event: registerEvent, uuid: uuid });
            refresh();
        };
        ws.onmessage = function (evt) {
            try { handle(JSON.parse(evt.data)); } catch (e) { /* ignore malformed frames */ }
        };
    };

    setInterval(refresh, 3000);
})();
