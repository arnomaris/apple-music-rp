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
                    console.log("Getting cover")
                    let album = await axios.get(`https://itunes.apple.com/search?term=${currentTrack.album}&attribute=albumTerm&entity=song&limit=1`)
                    if (album.data.resultCount > 0) {
                        cachedAlbums[currentTrack.album] = album.data.results[0].artworkUrl100
                        console.log("Got cover")
                    }
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