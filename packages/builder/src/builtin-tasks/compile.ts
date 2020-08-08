import { task } from "../internal/core/config/config-env";
import { networks } from "../../sample-project/algob.config";
import { TASK_COMPILE } from "./task-names";
import YAML from "yaml";
const algosdk = require('algosdk');
const fs = require('fs');
const path = require('path');
const murmurhash = require('murmurhash');

/* Credentials */
const token = networks.localhost.token;
const host = networks.localhost.host;
const port = networks.localhost.port;

let algodclient = new algosdk.Algodv2(token, host, port);

export default function (): void {
  task(TASK_COMPILE, "Compilation task")
    .setAction(
      async () => {
        console.log("compiling......");
        /*File paths for assets/ and artifacts/cache/ */
        var srcPath = path.join(__dirname, '../../sample-project/assets/');
        var destPath = path.join(__dirname, '../../sample-project/artifacts/cache');
        /*Read files from assets/ and artifacts/cache/ */
        const assetsFiles = fs.readdirSync(srcPath);
        const compiledFiles = fs.readdirSync(destPath);
        const compiledSrcHashes = [];
        /* Store all source file hash from already compiled files in an array */
    	for(let cfile in compiledFiles) {
    		let pathCFile = path.join(destPath, compiledFiles[cfile]);
    		let cdata = YAML.parse(fs.readFileSync(pathCFile).toString());
    		console.log("compiled file data", cdata.srcHash);
    		compiledSrcHashes.push(cdata.srcHash);
    	}
    	/* Iterate through contracts in assets/ and compile new contracts */
		for (let file in assetsFiles) {
			var flag = 0;
			var src = path.join(srcPath, assetsFiles[file]); //absolute path for contract in assets/
			var name = path.basename(assetsFiles[file], '.teal'); //name of file without extension
			var destFile = path.join(destPath, name + '.yaml'); //destination yaml file name
	    	let data = fs.readFileSync(src); //read the contact data
	    	/* Skip already compiled files (if the srcHash is already stored in artifacts/cache/)*/
	    	for(let hash_i in compiledSrcHashes) {
	    		if(compiledSrcHashes[hash_i] == murmurhash(data)){
	    			flag = 1;
	    			console.log("matched", compiledSrcHashes[hash_i], murmurhash(data));
	    			break;
	    		}
	    	}
	    	if(flag == 1)
	    		continue;

		    let results = await algodclient.compile(data).do(); //Compile file
		    console.log("Hash = " + results.hash);
		    console.log("Result = " + results.result);
		    let date: any;
		    date = new Date();
		    /* Create yaml */
		    let fields = { 
		    				timestamp: Math.floor(date / 1000),
		    				srcHash: murmurhash(data),
		    				address: results.hash,
		    				compiled: results.result,
		    				compiledHash: murmurhash(results.result)
		    			}
		    let yamlStr = YAML.stringify(fields);
		    fs.writeFileSync(destFile, yamlStr); //write yaml to artifacts/cache/
		}
      }
    );
}