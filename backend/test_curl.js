const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function testFetch() {
    const startStr = encodeURIComponent(new Date().toISOString().split('.')[0] + "-03:00");
    const endStr = encodeURIComponent(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('.')[0] + "-03:00");
    const url = `https://comunicacionsmt.gob.ar/get_events?start=${startStr}&end=${endStr}`;
    console.log(`Command: curl -s "${url}"`);
    const { stdout, stderr } = await exec(`curl -s "${url}"`, { timeout: 10000 });
    try {
        const rawResp = JSON.parse(stdout);
        console.log("Parsed JSON:", Array.isArray(rawResp) ? `Array of ${rawResp.length}` : "Object");
    } catch (e) {
        console.log("Failed to parse JSON. Output starts with:", stdout.substring(0, 100));
    }
}
testFetch();
