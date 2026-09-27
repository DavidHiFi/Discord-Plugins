(async () => {
    try {
        const response = await fetch("http://127.0.0.1:35499/current", { signal: AbortSignal.timeout(2000) });
        const current = await response.json();
        return { reachable: response.ok, title: current.title, hasArtworkUrl: !!current.artworkUrl, playing: current.playing };
    } catch (error) {
        return { reachable: false, error: String(error) };
    }
})()
