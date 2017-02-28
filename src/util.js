// from puer/lib/index.js
function getIps() {
    var ifaces = os.networkInterfaces();
    var ips = [];
    for (dev in ifaces) {
        ifaces[dev].forEach(function(details) {
            if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                return ips.push(details.address);
            }
        });
    }
    return ips;
}

// from puer/lib/helper/util.js
function openBrowser(target, callback) {
    var map, opener;
    map = {
        'darwin': 'open',
        'win32': 'start '
    };
    opener = map[process.platform] || 'xdg-open';
    return exec(opener + " " + target, callback);
};

module.exports = {
    getIps: getIps,
    openBrowser: openBrowser
};