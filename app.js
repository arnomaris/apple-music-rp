require('dotenv').config();
const axios = require('axios');
const DiscordRPC = require('discord-rpc')
const fs = require("fs");
const iTunes = require('itunes-bridge');
const iTunesEmitter = iTunes.emitter;
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

if (!fs.existsSync("./covers.json")) {
    fs.writeFileSync("./covers.json", "{\n}")
}

let cachedAlbums = require("./covers.json")

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
        console.log('No client')
        return
    }
    if (!currentTrack || currentTrack.artist == '') {
        console.log('Not a valid track')
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

async function getAlbumArt(track, specialSearch) {
    if (specialSearch)
        console.log("Special search")
    let searchTerm = specialSearch ? track.artist : track.album
    let attribute = specialSearch ? "artistTerm" : "albumTerm"
    let entity = specialSearch ? "album" : "song"
    let albums = await axios.get(encodeURI(`https://itunes.apple.com/search?term=${searchTerm}&attribute=${attribute}&entity=${entity}`))
    console.log("Getting cover")
    if (albums.data.resultCount > 0) {
        for (let i = 0; i < albums.data.resultCount; i++) {
            let album = albums.data.results[i]
            if ((specialSearch && track.album.match(album.collectionName)) || (!specialSearch && track.artist.match(album.artistName))) {
                cachedAlbums[track.album] = album.artworkUrl100
                console.log("Got cover")
                break
            }
        }
        if (!(track.album in cachedAlbums)) {
            console.log(`Found no cover match in ${albums.data.resultCount} results`)
            if (!specialSearch) {
                await getAlbumArt(track, true)
            }
        }
    } else {
        console.log("Found no cover for " + track.album)
        if (!specialSearch) {
            await getAlbumArt(track, true)
        }
    }
    return
}