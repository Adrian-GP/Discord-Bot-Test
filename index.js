const {Client, Util} = require('discord.js');
require('dotenv').config()
const TOKEN = process.env.TOKEN
const PREFIX = process.env.PREFIX
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
const GIPHY_API_KEY = process.env.GIPHY_API_KEY
const ytdl = require('ytdl-core');
const Youtube = require('simple-youtube-api');
const axios = require('axios')

const client = new Client({disableEveryone: true});

const youtube = new Youtube(GOOGLE_API_KEY);

const queue = new Map();


client.on('warn', console.warn);

client.on('warn', console.error);

client.on('ready', () => {
    console.log("This is ready");
    client.user.setPresence({ status: 'online', game: { name: 'Prefix: '+PREFIX+'play' } });   
});

client.on('disconnect', () => {
    console.log("I just disconnected, making sure you know");
});

client.on('reconnecting', () => {
    console.log("I am reconnecting now");
});


var respuestasVanya = [
    "Me la pelas, Vanya",
    "Vanya, ya báñate",
    "Vanya, ya basta",
    "Eh Vanya, te estás pasando",
    "Tu creador robó mi Token",
    "Ya cállate alv pues",
    "Tú si le pegas al nexo, ¿o no?",
    "Eh, dile a tu creador que pague el airbnb",
    "Tu creador le dijo pinche pendejo al Gus ):"
];


client.on('message', async (message) => {
    if(message.author.username=="Vanya")
    {
        message.channel.send(respuestasVanya[Math.floor((Math.random() * respuestasVanya.length) )]);
    }
    if(message.author.bot) return undefined;
    if(!message.content.startsWith(PREFIX)) return undefined;
    const args = message.content.split(' ');
    const searchString = args.slice(1).join(' ');
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
    const serverQueue = queue.get(message.guild.id);
    //console.log(message.channel);
    if(message.content.startsWith(PREFIX+"play")){
        //console.log("hola");
        const voiceChannel = message.member.voiceChannel;
        if(!voiceChannel) return message.channel.send('You need to be on a voice channel')
        const permissions = voiceChannel.permissionsFor(message.client.user);

        if(!permissions.has('CONNECT')){
            return message.channel.send('I cannot connect to your voice channel ):')
        }
        if(!permissions.has('SPEAK')){
            return message.channel.send("I cannot speak here");
        }
        
        try{
            var video = await youtube.getVideo(url);
        } catch(error){
            try{
                var videos = await youtube.searchVideos(searchString, 1);
                var video = await youtube.getVideoByID(videos[0].id);
            } catch(error2){
                console.log(error2)
                return message.channel.send("No lo encuentro we ):");
            }
        }


        const song = {
            id: video.id,
            title: Util.escapeMarkdown(video.title),
		    url: `https://www.youtube.com/watch?v=${video.id}`
        }

        if(!serverQueue){
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs:[],
                volume: 5,
                playing: true
            };
            queue.set(message.guild.id, queueConstruct);

            queueConstruct.songs.push(song);
            console.log(queueConstruct.songs);

            try{
                var connection = await voiceChannel.join();
                queueConstruct.connection = connection;
                play(message.guild, queueConstruct.songs[0]);
            } catch(error){
                console.error(error);
                message.channel.send("Cant connect");
                queue.delete(message.guild.id);
                return undefined;
            }
        }
        else {
            serverQueue.songs.push(song);
            console.log(serverQueue.songs);
            return message.channel.send(song.title+" ha sido añadida a la queue");
        }

        return undefined;
    
    }
    else if(message.content.startsWith(PREFIX+"skip")) {
        if(!serverQueue){
            return message.channel.send("No hay nada que skipear we");
        }
        serverQueue.connection.dispatcher.end("Skipeo este pedo");
        return message.channel.send("Skipeada esta mierda")
    }
    else if(message.content.startsWith(PREFIX+"stop")){
        if(!message.member.voiceChannel)
            return message.channel.send("No estás en ningún canal, puños")
        if(!serverQueue)
            return message.channel.send("¿Cual stop we?");
        serverQueue.songs=[]
        serverQueue.connection.dispatcher.end("Se le dio stop");
        return undefined;
    }
    else if(message.content.startsWith(PREFIX+"volume")){
        if(!serverQueue)
            return message.channel.send("No hay nada reproduciendose we ):");
        if(!args[1]) return message.channel.send("El volumen actual es: "+serverQueue.volume);
        else {
            serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1]/5);
            serverQueue.volume = args[1];
            return message.channel.send("El volumen cambio a: "+serverQueue.volume);
        }
    }
    else if(message.content.startsWith(PREFIX+"np")){
        if(!serverQueue)
            return message.channel.send("No hay nada reproduciendose we ):");
        return message.channel.send("Se está reproduciendo: "+serverQueue.songs[0].title);
    }
    else if(message.content.startsWith(PREFIX+"queue")){
        if(!serverQueue) return message.channel.send("No hay nada we");
        return message.channel.send(`
        __**Song queue:**__\n
        ${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
        **Now playing:** ${serverQueue.songs[0].title}
                `);
    }
    else if(message.content.startsWith(PREFIX+"pause")){
        if(serverQueue && serverQueue.playing){
        serverQueue.playing=false;
        serverQueue.connection.dispatcher.pause();
        return message.channel.send("Se pausó we");
        }
        return message.channel.send("No hay nada que pausar we");
        
    }


    else if(message.content.startsWith(PREFIX+"resume")){
        if(serverQueue && !serverQueue.playing){
            serverQueue.playing=true;
            serverQueue.connection.dispatcher.resume();
            return message.channel.send("Ya le siguio we");
        }
        return message.channel.send("No hay nada we");
    }

    else if(message.content.startsWith(PREFIX+"gif")) {
        var gifToGet = await getGif(searchString);
        console.log(gifToGet)
        message.channel.send(gifToGet)
    }
    return undefined;

})

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if(!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }
     
    console.log("Intentando reproducir: "+song.title);
    const stream = ytdl(song.url, { filter : 'audioonly' });
    const streamOptions = { seek: 0, volume: 1 };
    const dispatcher = serverQueue.connection.playStream(stream, streamOptions);

    serverQueue.textChannel.send("Ahora reproduciendo: "+song.title);
    
    dispatcher.on('end', (reason) => {
        console.log("Reason:")
        console.log(reason)
        console.log("Song ended")
        serverQueue.songs.shift();
        //console.log(serverQueue.songs);
        play(guild, serverQueue.songs[0]);
    })

    dispatcher.on('error', (error) => {
        console.error(error)
    })

    dispatcher.setVolumeLogarithmic(5 / 5)
}


function getGif(searchString){
        const LIMIT = 1;
        const RATING = 'r';
        const offset = Math.floor((Math.random() * 50) + 0);
        return axios.get('http://api.giphy.com/v1/gifs/search', {
            params:{
                q: searchString,
                rating: RATING,
                api_key: GIPHY_API_KEY,
                offset: offset,
                limit: LIMIT
            }
        })
        .then(res => res.data.data[0].images.original.url)
        .catch(function (error) {
            // .catch(error => console.log(error))
            console.log(error);
            return"Hubo un error we"
        });
}

client.login(TOKEN);