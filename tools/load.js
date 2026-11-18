// Nạp phần luật vào Node (không đồ họa)
const path = require('path');
['data', 'rules', 'sim', 'game'].forEach(f => require(path.join(__dirname, '..', 'js', 'core', f + '.js')));
module.exports = globalThis.G;
