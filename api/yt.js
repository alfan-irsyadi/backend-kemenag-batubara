const { Innertube } = require('youtubei.js');

async function getChannelVideos() {
  try {
    const youtube = await Innertube.create();
    
    // Get channel by ID or username
    const channel = await youtube.getChannel('UCJdx4-TdHjo8O0p46wggM0A');    
    // Get all videos (this might paginate)
    const videos = await channel.getVideos();
    
    console.log(`Found ${videos.videos.length} videos:`);
    console.log(videos.videos[0].thumbnails)
    videos.videos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.title.text}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

getChannelVideos();