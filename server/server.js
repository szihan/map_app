const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname,'../client')));
app.use(express.json());

const DATA_FILE = path.join(__dirname,'drawings.json');

let drawings = [];
if(fs.existsSync(DATA_FILE)){
    drawings = JSON.parse(fs.readFileSync(DATA_FILE));
}

// 保存到JSON
function saveData(){
    fs.writeFileSync(DATA_FILE, JSON.stringify(drawings,null,2));
}

io.on('connection', socket => {
    console.log('用户连接');
    socket.emit('all-drawings', drawings);

    socket.on('save-drawing', data => {
        drawings.push(data);
        saveData();
        io.emit('new-drawing', data);
    });

    socket.on('update-drawing', data => {
        let index = drawings.findIndex(d=>d.id===data.id);
        if(index!==-1){ drawings[index]=data; saveData(); io.emit('update-drawing', data); }
    });

    socket.on('delete-drawing', id => {
        drawings = drawings.filter(d=>d.id!==id);
        saveData();
        io.emit('delete-drawing', id);
    });

    socket.on('disconnect', ()=>console.log('用户断开'));
});

server.listen(3000, ()=>console.log('Server running on http://localhost:3000'));
