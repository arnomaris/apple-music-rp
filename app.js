require('dotenv').config();
const axios = require('axios');
const iTunes = require('itunes-bridge');
const iTunesEmitter = iTunes.emitter;

let connected = false;
let client
let cachedAlbums = {}

let connectInterval = setInterval(() => {
    console.log('Connecting to discord...')
    client = new (require('easy-presence').EasyPresence)(process.env.DISCORD_KEY)
    client.on('connected', () => {
        connected = true
        clearInterval(connectInterval)
        console.log('Connected to discord')
        let currentTrack = iTunes.getCurrentTrack()
        setPresence(currentTrack, currentTrack.playerState == "playing")
    })
    client.on("activityUpdate", (activity) => {
        console.log("Now you're playing", activity ? activity.name : "nothing!")
    });
    
}, 1000)

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
    if (client) {
        console.log("Setting presence")
        try {
            if (isPlaying) {
                if (!(currentTrack.album in cachedAlbums)) {
                    await getAlbumArt(currentTrack)
                }
                client.setActivity({
                    state: "by " + currentTrack.artist + " on " + currentTrack.album,
                    details: currentTrack.name,
                    assets: {
                        large_image: currentTrack.album in cachedAlbums ? cachedAlbums[currentTrack.album] : "logo",
                        large_text: currentTrack.album
                    },
                    timestamps: { 
                        start: Math.floor(Date.now() / 1000) - currentTrack.elapsedTime,
                        end: Math.floor(Date.now() / 1000) + currentTrack.remainingTime, 
                    }
                })
            } else {
                client.setActivity({
                    state: "Paused",
                    details: currentTrack.name,
                    assets: {
                        large_image: currentTrack.album in cachedAlbums ? cachedAlbums[currentTrack.album] : "logo",
                        large_text: currentTrack.album
                    }
                })
            }
        } catch (err) {
            console.log("Discord failed")
            console.log(err)
        }
    } else {
        console.log("No client")
    }
}

async function getAlbumArt(track) {
    let albums = await axios.get(`https://itunes.apple.com/search?term=${track.album}&attribute=albumTerm&entity=song`)
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
    }
    return true
}