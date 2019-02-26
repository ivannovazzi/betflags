const fs = require('fs');
const path = require('path');
const request = require('request');
const lineReader = require('line-reader');
const filelist = new Array(); 

const flagsPath = path.join(__dirname, 'flags');
const flagsUrl = 'http://ls.betradar.com/ls/crest/big/';
const extension = '.png';
let fileindex = 0;
const files = {
  found: 0,
  notFound: 0,
  error: 0,
  existing: 0,
};

function chunkArray(myArray, chunk_size){
  const results = [];
  while (myArray.length) {
      results.push(myArray.splice(0, chunk_size));
  }
  return results;
}

const increment = type => {
  files[type] ++;
}

const saveFile = async function(uri, flagPath) {
  return new Promise(function(resolve, reject) {
    request(uri)
      .on('error', function(err) { reject(err); })
      .pipe(
        fs.createWriteStream(flagPath)
          .on('error', function(err) { reject(err); })
          .on('finish', function() { resolve(); })
      )
      .on('error', function(err) { reject(err); });
  });
}

const requestAsync = async function (flagsUrl, file) {
  const uri = `${flagsUrl}${file.toString()}${extension}`;
  
  return new Promise(function(resolve, reject) {
    let result;
    request.head(uri, async function(err, res, body) {
      if (err) {
        result = 'error';
      } else if (res.statusCode !== 200) {
        result = 'notFound';
      } else if (res.headers['content-type'].includes('image/png')) {

        const flagPath = path.join(__dirname, 'flags', file.toString() + extension);
        try {
          await saveFile(uri, flagPath);
          result = 'found';
        }
        catch (e) {
          result = 'error';
        }
      } else {
        result = 'notFound';
      }
      resolve(result);
    })
  });
}

let available = 50;
const requests = {
  remaining: 0
}

const sleep = async () => new Promise(resolve => setTimeout(() => resolve()));

const getNextAvailable = async function() {
  while(available === 0) {
    await sleep(1);
  }
}

const waitForAllDownloads = async function() {
  while(requests.remaining > 0) {
    await sleep(10);
  }
}

const download = async function(id) {

  let result = null;
  const pathToCheck = path.join(__dirname, 'flags', id.toString() + extension);

  if (!fs.existsSync(pathToCheck)) {
    result  = await requestAsync(flagsUrl, id);
  } else {
    result = 'existing';
  }
  return result;
}

const downloadNext = async (id, total, ids, requests) => {
  available --;
  requests.remaining ++;
  const result = await download(id);
  available ++;
  requests.remaining --;
  increment(result);

  
}

const downloadAllNew = async (ids, send) => {
  const total = ids.length;

  while (id = ids.pop()) {
    await getNextAvailable();
    downloadNext(id, total, ids, requests);
    send('run', total, ids.length, files)
  }
  await waitForAllDownloads();
  send('end');
}


function createFlagsDirIfNecessary() {
  const dir = path.join(__dirname, 'flags');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

const readFile = async function(filePath) {
  return new Promise((resolve, reject) => {
    const items = [];
    lineReader.eachLine(filePath, function(line, end) {
      if (line !== ''&& !filelist.includes(line)) {
        items.push(`${line.replace(`\r`,'')}`);
      }
      if (end) {
        resolve(items)
      }
    });
  });
}
const downloader = async (filePath, send) => {
  createFlagsDirIfNecessary();
  const ids = await readFile(filePath);
  downloadAllNew(ids, send);
}

exports.downloader = downloader;
