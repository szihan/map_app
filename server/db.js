const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'drawings.json');

// 读取数据
function loadDrawings() {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE);
    try {
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

// 保存数据
function saveDrawings(drawings) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(drawings, null, 2));
}

module.exports = { loadDrawings, saveDrawings };
