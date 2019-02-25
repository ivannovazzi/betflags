const fs = require('fs');
const path = require('path');
const request = require('request');
const lineReader = require('line-reader');
const _cliProgress = require('cli-progress');

const args = process.argv.slice(2);
const filelist = new Array();
 
// create a new progress bar instance and use shades_classic theme
const bar1 = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic);

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
  files[ type ] ++;
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
  bar1.update(total - ids.length);
}

const downloadAllNew = async (ids) => {
  const total = ids.length;

  bar1.start(total, 0);
  while (id = ids.pop()) {
    await getNextAvailable();
    downloadNext(id, total, ids, requests)
  }
  await waitForAllDownloads();
  bar1.stop();

  console.log('Finished!')
  console.log(`Found: ${files.found}`);
  console.log(`Not Found: ${files.notFound}`);
  console.log(`Already Existing : ${files.existing}`);
  console.log(`Errors: ${files.error}`);
}


function createFlagsDirIfNecessary() {
  const dir = path.join(__dirname, 'flags');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

const readFile = async function() {
  return new Promise((resolve, reject) => {
    const items = [];
    lineReader.eachLine('./' + args[0], function(line, end) {
      if (line !== ''&& !filelist.includes(line)) {
        items.push(`${line.replace(`\r`,'')}`);
      }
      if (end) {
        resolve(items)
      }
    });
  });
}
const run = async () => {
  createFlagsDirIfNecessary();
  const ids = await readFile();

  console.log('\nTotal available Ids to try: ' + ids.length);
  
  downloadAllNew(ids);
}

run();
