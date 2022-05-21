require('dotenv').config();
const axios = require('axios');
const DiscordRPC = require('discord-rpc')
const iTunes = require('itunes-bridge');
const iTunesEmitter = iTunes.emitter;
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

let cachedAlbums = {}

rpc.connect(process.env.DISCORD_KEY)

iTunesEmitter.on('playing', function(type, currentTrack) {
    if (type === "player_state_change") {
        console.log(currentTrack.name + " has been resumed! ");
    } else if (type === 'new_track'){
        console.log(currentTrack.name+" is now playing!")
    }
    setPresence(currentTrack, true)
})

iTunesEmitter.on('paused', function(type, currentTrack){
    console.log(currentTrack.name+" is now paused!");
    setPresence(currentTrack, false)
});

const setPresence = async(currentTrack, isPlaying) => {
    console.log("Setting presence")
    if (!rpc) {
        console.log('no client')
        return
    }
    try{
        if (!(currentTrack.album in cachedAlbums)) {
            await getAlbumArt(currentTrack)
        }
    } catch(err) {
        console.log("Failed to get album art")
        console.log(err)
    }
    try {
        if (isPlaying) {
            rpc.setActivity({
                state: ("by " + currentTrack.artist + " on " + currentTrack.album).substring(0, 128),
                details: (currentTrack.name).substring(0, 128),
                largeImageKey: currentTrack.album in cachedAlbums ? cachedAlbums[currentTrack.album] : "logo",
                largeImageText: (currentTrack.album).substring(0, 128),
                startTimestamp: Math.floor(Date.now() / 1000) - currentTrack.elapsedTime,
                endTimestamp: Math.floor(Date.now() / 1000) + currentTrack.remainingTime, 
            })
        } else {
            rpc.clearActivity()
        }
    } catch (err) {
        console.log("Discord failed")
        console.log(err)
    }
}

async function getAlbumArt(track) {
    let albums = await axios.get(encodeURI(`https://itunes.apple.com/search?term=${track.album}&attribute=albumTerm&entity=song`))
    console.log("Getting cover")
    if (albums.data.resultCount > 0) {
        for (let i = 0; i < albums.data.resultCount; i++) {
            let album = albums.data.results[i]
            if (track.artist.match(album.artistName)) {
                cachedAlbums[track.album] = album.artworkUrl100
                break
            }
        }
        console.log("Got cover")
    } else {
        console.log("Found no cover for " + track.album)
    }
    return true
}