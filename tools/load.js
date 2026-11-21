// Nạp phần luật vào Node (không đồ họa)
const path = require('path'), fs = require('fs');
['data', 'rules', 'sim', 'ghosts', 'game'].forEach(f => { const p = path.join(__dirname, '..', 'js', 'core', f + '.js'); if (f !== 'ghosts' || fs.existsSync(p)) require(p); });
module.exports = globalThis.G;
