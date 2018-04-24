let liveID = "UCljdtx_RJ3nqDykKuMLtMyQ";
let kjID = "UCqwb8_dzDRSE5RyrgP0q-tA";
let z = "AIzaSyCiw0Cm8Oa2MWMqvjir7w7-AupwhCK4uvg";
//fetch all videos?
let fetchallvids = `https://www.googleapis.com/youtube/v3/search?key=${z}&channelId=${liveID}&part=snippet,id&order=date&maxResults=50`;

//elem.id.videoID
let liveKJVidResources = [];
let KJVidResources = [];

class Resource {
  constructor(resource) {
    this.counter = 0;
    this.allRetrieved = false;
    this.resource = resource;
  }
  preRetrieve() {
    if (this.counter == this.resource.length - 1) {
      this.allRetrieved = true;
    } else if (this.counter == this.resource.length) {
      this.counter = 0;
    }
  }
}
class VideoResource extends Resource {
  constructor(x) {
    super(x);
  }
  getNext() {
    this.preRetrieve(); //handles around the horn and all asked for.
    try {
      let answer = [];
      let vid = this.resource[this.counter++];
      let seconds = getSeconds(vid.contentDetails.duration);
      let title = vid.snippet.title;

      answer[0] = Math.min(110, seconds); //limit length as per requested.
      answer[1] = title;
      answer[2] = `https://www.youtube.com/embed/${
        vid.id.videoId
      }?autoplay=1&modestbranding=1`;
      return answer;
    } catch (e) {
      console.log(
        "GET NEXT VID FAIL: I think this is due to some reason not being able to get contentDesc. here is video",
        this.resource[this.counter - 1]
      );
      console.log(e);
      console.log("trying again by skipping");
      return this.getNext();
    }
  }
}

class PageResource extends Resource {
  constructor(pages) {
    super(pages);
  }
  getNext() {
    this.preRetrieve();
    return [13, this.resource[this.counter], this.resource[this.counter++]];
  }
}
let protocol = "http://";
let domain = `${protocol}www.kjhk.org`;
let pre = `${domain}/web/`;
class VideoGenie {
  constructor(liveVids, kjvids) {
    this.KJHKpages = [
      `${pre}`,
      `${pre}music/`,
      `${pre}sports/`,
      `${pre}culture/`,
      `${pre}category/multimedia/live-performances/`,
      `${pre}events/`
    ]; // `https://kjhk.merchtable.com/`]
    this.resource_live = new VideoResource(liveVids);
    this.resource_kj = new VideoResource(kjvids);
    this.resource_pages = new PageResource(this.KJHKpages);
  }

  get nextKJHKPage() {
    return this.resource_pages.getNext();
  }

  //must return 3 length array
  get nextLiveResource() {
    return this.resource_live.getNext();
  }
  //must return 3 length array
  get nextKJResource() {
    return this.resource_kj.getNext();
  }

  get nowPlaying() {
    return [13, "Now Playing", `${domain}/nowplaying/nowplaying.html`];
  }
}

async function fetchAllVidInfo() {
  liveKJVidResources = await populateVidInfoFromChannel(liveID);
  KJVidResources = await populateVidInfoFromChannel(kjID);

  return Promise.all([
    addDuration(liveKJVidResources),
    addDuration(KJVidResources)
  ]);
}
async function addDuration(arr, index = 0) {
  if (index >= arr.length) {
    return arr;
  }
  //we can do this 50 at a time,
  let stopindex = Math.min(index + 50, arr.length);

  //harvest ids
  let subarr = arr.slice(index, stopindex);
  let ids = subarr.map(x => x.id.videoId);
  console.log("subarray is", subarr);
  let url = `https://www.googleapis.com/youtube/v3/videos?id=${ids.join(
    ","
  )}&part=contentDetails&key=${apikey}`;
  console.log(url);
  return get(url).then(results => {
    console.log(
      `queried for ${
        ids.length
      } and got here are the length duration query results`
    );
    //need to merge resulsts.items[0].id with subarr.id.videoId and add results.items[0].contentDetails
    results.items.forEach(r => {
      subarr.find(x => x.id.videoId == r.id).contentDetails = r.contentDetails;
    });
    console.log("HERE ARE MY AMMENDED ITEMS WITH CONTENTDETAILS", subarr);
    //now I should be able to continue whilest keeping all changes thanks to heap.
    return addDuration(arr, stopindex);
  });
}

function populateVidInfoFromChannel(chanID, answer = [], page = "") {
  let fetchallvids =
    `https://www.googleapis.com/youtube/v3/search?key=${apikey}&channelId=${chanID}&part=snippet,id&order=date&maxResults=50` +
    page;
  return get(fetchallvids).then(results => {
    answer.push(...results.items);
    console.log("results!!!!!!!", results);
    if (results.nextPageToken) {
      return populateVidInfoFromChannel(
        chanID,
        answer,
        `&pageToken=${results.nextPageToken}`
      );
    } else {
      return answer;
    }
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    let xhttp = new XMLHttpRequest();
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onload = function() {
      if (xhr.status === 200) {
        let result = JSON.parse(xhr.responseText);
        resolve(result);
      } else {
        console.log("Request failed.  Returned status of " + xhr.status);
        reject({ error: xhr.status, data: xhr.responseText });
      }
    };
    xhr.send();
  });
}

fetchAllVidInfo()
  .then(arr => {
    console.log(
      "fetch all vid stuff succeeded!!! here's what I was given\n\n",
      arr
    );
    //[live,kjs]
    return new VideoGenie(arr[0], arr[1]);
  })
  .then(videogenie => {
    //amend global slides away from default:
    // slides = [];//get rid of everything!

    let shouldquit = false;
    while (
      !(
        videogenie.resource_live.allRetrieved &&
        videogenie.resource_kj.allRetrieved
      )
    ) {
      if (!videogenie.resource_live.allRetrieved) {
        let x = videogenie.nextLiveResource;
        if (x) {
          slides.push(x);
          slides.push(videogenie.nowPlaying);
          slides.push(videogenie.nextKJHKPage);
        }
      }
      if (!videogenie.resource_kj.allRetrieved) {
        let x = videogenie.nextKJResource;
        if (x) {
          slides.push(x);
          slides.push(videogenie.nowPlaying);
          slides.push(videogenie.nextKJHKPage);
        }
      }
    }
    // slides[1] = videogenie.nextKJResource;
    // slides[2] = new Array(15, "Today's Sweet tunes", "https://kjhk.org/web/todays-sweet-tunes/");

    // slides[2] = new Array(15, "PHP Proxy", "https://www.kjhk.org");

    // slides[5] = new Array(13, "Now Playing", "http://www.kjhk.org/nowplaying/nowplaying.html");
    // slides[3] = new Array(13, "Youtube Live's Bro", "https://www.youtube.com/embed/+lastest?list=PLcwdTlh_YhzXHGrldwxkCK3plHL4PboTP&autoplay=1&modestbranding=1");
    // slides[4] = new Array(13, "Youtube Live's Bro", "https://www.youtube.com/embed/4KJcEH8zvPI?autoplay=1&modestbranding=1");
    console.log("slides have been reset");
  });

function getSeconds(str) {
  let reptms = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
  let hours = 0,
    minutes = 0,
    seconds = 0,
    totalseconds;

  if (reptms.test(str)) {
    let matches = reptms.exec(str);
    if (matches[1]) hours = Number(matches[1]);
    if (matches[2]) minutes = Number(matches[2]);
    if (matches[3]) seconds = Number(matches[3]);
    totalseconds = hours * 3600 + minutes * 60 + seconds;
    return totalseconds;
  }
  return null;
}
