const socket = io();

const map = L.map('map').setView([22.5431, 114.0579], 12);

const baseMaps = {
    "影像底图": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"),
    "矢量地图": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
};
baseMaps["影像底图"].addTo(map);

// 地图底图切换控件
const layersControl = L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);
const layersContainer = layersControl.getContainer();
layersContainer.style.marginTop = "-60px";

// 获取缩放控件容器
const zoomControl = document.querySelector('.leaflet-control-zoom');
zoomControl.style.top = '80px';

const drawnItems = new L.FeatureGroup().addTo(map);

const drawRectangleBtn = document.querySelector('.draw-rectangle-btn');
const drawPolygonBtn = document.querySelector('.draw-polygon-btn');
const drawHandBtn = document.querySelector('.draw-hand-btn');
const editBtn = document.querySelector('.edit-btn');
const deleteBtn = document.querySelector('.delete-btn');
const saveEditBtn = document.querySelector('.save-edit-btn');

const drawControl = new L.Control.Draw({
    draw: false,
    edit: false
});
map.addControl(drawControl);

let idCounter = 0;

// 加载已有图形
socket.on('all-drawings', data => data.forEach(d => addLayerFromData(d)));
socket.on('new-drawing', data => addLayerFromData(data));
socket.on('update-drawing', data => {
    const layer = drawnItems.getLayers().find(l => l._customId === data.id);
    if (layer) {
        drawnItems.removeLayer(layer);
        addLayerFromData(data);
    }
});
socket.on('delete-drawing', id => {
    const layer = drawnItems.getLayers().find(l => l._customId === id);
    if (layer) drawnItems.removeLayer(layer);
});

// 添加图层函数
function addLayerFromData(data) {
    const layer = L.geoJSON(data.geojson).getLayers()[0];
    layer._customId = data.id;
    layer.bindPopup(data.name);
    drawnItems.addLayer(layer);
    if (layer.pm) {
        layer.pm.disable();
    }
}

// 自定义弹窗，仅有确定按钮
function showInputDialog(defaultValue, callback) {
    let dialog = document.getElementById('input-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'input-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '30%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.background = '#fff';
        dialog.style.padding = '24px 32px';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 2px 12px rgba(0,0,0,0.2)';
        dialog.style.zIndex = '3000';
        dialog.innerHTML = `
            <div style="font-size:18px;margin-bottom:12px;">请输入范围名称：</div>
            <input id="input-dialog-value" type="text" style="width:100%;font-size:16px;padding:6px 8px;margin-bottom:18px;" />
            <div style="text-align:right;">
                <button id="input-dialog-ok" style="background:#4caf50;color:#fff;padding:6px 18px;border:none;border-radius:4px;font-size:16px;cursor:pointer;">确定</button>
            </div>
        `;
        document.body.appendChild(dialog);
    }
    dialog.style.display = 'block';
    const input = document.getElementById('input-dialog-value');
    input.value = defaultValue || '';
    input.focus();
    document.getElementById('input-dialog-ok').onclick = function () {
        dialog.style.display = 'none';
        callback(input.value);
    };
}

// 顶部浮动提示
function showTopTip(msg, duration = 2000) {
    let tip = document.getElementById('top-tip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'top-tip';
        tip.style.position = 'fixed';
        tip.style.top = '20px';
        tip.style.left = '50%';
        tip.style.transform = 'translateX(-50%)';
        tip.style.background = '#4caf50';
        tip.style.color = '#fff';
        tip.style.padding = '10px 30px';
        tip.style.borderRadius = '0 0 8px 8px';
        tip.style.zIndex = '2000';
        tip.style.fontSize = '18px';
        tip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        document.body.appendChild(tip);
    }
    tip.textContent = msg;
    tip.style.display = 'block';
    setTimeout(() => {
        tip.style.display = 'none';
    }, duration);
}

// 按钮禁用
function setButtonDisabled(btn, disabled) {
    btn.disabled = disabled;
    if (disabled) {
        btn.style.background = "#ccc";
        btn.style.color = "#888";
        btn.style.cursor = "not-allowed";
    } else {
        btn.style.background = "";
        btn.style.color = "";
        btn.style.cursor = "";
    }
}


// ----------- 绘制逻辑 -----------
let drawPolygon, drawRectangle;
let handDrawActive = false;
let handDrawPoints = [];
let handDrawLayer = null;

// 矩形绘制
drawRectangleBtn.onclick = function () {
    if (!drawRectangle) drawRectangle = new L.Draw.Rectangle(map, { shapeOptions: { color: '#3388ff' } });
    drawRectangle.enable();
    showTopTip("请在地图上绘制矩形");
};

// 多边形绘制
drawPolygonBtn.onclick = function () {
    if (!drawPolygon) drawPolygon = new L.Draw.Polygon(map, { shapeOptions: { color: '#3388ff' } });
    drawPolygon.enable();
    showTopTip("请在地图上绘制多边形");
};

// 手绘
drawHandBtn.onclick = function () {
    handDrawActive = true;
    showTopTip("请在地图上按住鼠标手绘范围");
    map.dragging.disable();
    map.on('mousedown', startHandDraw);
};

// 多边形和矩形绘制完成
map.on(L.Draw.Event.CREATED, e => {
    const layer = e.layer;
    layer._customId = idCounter++;
    drawnItems.addLayer(layer);
    if (layer.pm) layer.pm.disable();
    showInputDialog("范围" + (drawnItems.getLayers().length), function (name) {
        if (!name) name = "范围" + (drawnItems.getLayers().length);
        layer.bindPopup(name).openPopup();
        socket.emit('save-drawing', { id: layer._customId, geojson: layer.toGeoJSON(), name });
    });
    // map.fitBounds(layer.getBounds());
});

// 手绘逻辑
function startHandDraw(e) {
    if (!handDrawActive) return;
    handDrawPoints = [e.latlng];
    handDrawLayer = L.polyline(handDrawPoints, { color: '#3388ff', weight: 4 }).addTo(map);
    map.on('mousemove', handDrawing);
    map.on('mouseup', endHandDraw);
}
function handDrawing(e) {
    handDrawPoints.push(e.latlng);
    if (handDrawLayer) handDrawLayer.setLatLngs(handDrawPoints);
}
function endHandDraw(e) {
    map.off('mousemove', handDrawing);
    map.off('mouseup', endHandDraw);
    map.dragging.enable();
    handDrawActive = false;
    if (handDrawLayer) {
        const latLngs = handDrawLayer.getLatLngs();
        if (latLngs.length > 2) {
            // 先添加到地图上
            const polygon = L.polygon(latLngs, { opacity: 1, color: '#3388ff' }).addTo(map);
            polygon._customId = idCounter++;
            drawnItems.addLayer(polygon);
            if (polygon.pm) {
                polygon.pm.enable({ allowSelfIntersection: false });
                polygon.pm.disable();
            }
            showInputDialog("手绘面" + (drawnItems.getLayers().length), function (name) {
                if (!name) name = "手绘面" + (drawnItems.getLayers().length);
                polygon.bindPopup(name);
                socket.emit('save-drawing', { id: polygon._customId, geojson: polygon.toGeoJSON(), name });
            });
            // map.fitBounds(polygon.getBounds());
        }
        map.removeLayer(handDrawLayer);
        handDrawLayer = null;
        handDrawPoints = [];
    }
}

// ----------- 编辑模式相关 -----------
let editModeActive = false;
let editingLayer = null;

// 编辑按钮逻辑
editBtn.onclick = function () {
    editModeActive = !editModeActive;
    if (editModeActive) {
        this.textContent = "取消编辑";
        showTopTip("请单击选择要编辑的图形！");

        // 禁用 3 个绘制按钮 + 删除按钮
        setButtonDisabled(drawRectangleBtn, true);
        setButtonDisabled(drawPolygonBtn, true);
        setButtonDisabled(drawHandBtn, true);
        setButtonDisabled(deleteBtn, true);
        setButtonDisabled(saveEditBtn, false);

        drawnItems.eachLayer(layer => {
            layer.on('mousedown', function () { selectLayerForEdit(layer); });
            layer.off('click');
            layer.setStyle && layer.setStyle({ opacity: 1, color: '#3388ff' });
        });
    } else {
        this.textContent = "编辑";

        // 恢复绘制按钮 + 删除按钮
        setButtonDisabled(drawRectangleBtn, false);
        setButtonDisabled(drawPolygonBtn, false);
        setButtonDisabled(drawHandBtn, false);
        setButtonDisabled(deleteBtn, false);
        setButtonDisabled(saveEditBtn, false);

        if (editingLayer && editingLayer._originalGeoJSON) {
            drawnItems.removeLayer(editingLayer);
            const restoredLayer = L.geoJSON(editingLayer._originalGeoJSON).getLayers()[0];
            restoredLayer._customId = editingLayer._customId;
            restoredLayer.bindPopup(editingLayer.getPopup() ? editingLayer.getPopup().getContent() : "");
            drawnItems.addLayer(restoredLayer);
            if (restoredLayer.pm) {
                restoredLayer.pm.enable({ allowSelfIntersection: false });
                restoredLayer.pm.disable();
            }
            editingLayer = null;
        }
        drawnItems.eachLayer(layer => {
            layer.off('mousedown');
            layer.on('click', function (e) { layer.openPopup(); });
            if (layer.pm) layer.pm.disable();
            layer.setStyle && layer.setStyle({ opacity: 1, color: '#3388ff' });
        });
        saveEditBtn.style.display = "none";
    }
};

// 选择图层进行编辑
function selectLayerForEdit(layer) {
    if (editingLayer && editingLayer.pm && editingLayer.pm.disable) {
        editingLayer.pm.disable();
    }
    editingLayer = layer;
    editingLayer._originalGeoJSON = editingLayer.toGeoJSON();
    drawnItems.eachLayer(l => {
        if (l === layer) {
            l.setStyle && l.setStyle({ opacity: 1, color: 'red' });
        } else {
            l.setStyle && l.setStyle({ opacity: 0.3, color: '#3388ff' });
            if (l.pm) l.pm.disable();
        }
    });
    if (editingLayer.pm && editingLayer.pm.enable) {
        editingLayer.pm.enable({ allowSelfIntersection: false });
    }
    saveEditBtn.style.display = "inline-block";
}

// 保存编辑按钮逻辑
saveEditBtn.onclick = function () {
    if (editingLayer) {
        const oldName = editingLayer.getPopup() ? editingLayer.getPopup().getContent() : "";
        showInputDialog(oldName, function (name) {
            editingLayer.bindPopup(name);
            socket.emit('update-drawing', {
                id: editingLayer._customId,
                geojson: editingLayer.toGeoJSON(),
                name: name
            });
            // ✅ 退出编辑模式
            if (editingLayer.pm && editingLayer.pm.disable) {
                editingLayer.pm.disable();
            }
            editingLayer = null;
            editBtn.textContent = "编辑";
            editModeActive = false;
            drawnItems.eachLayer(l => {
                l.off('mousedown');
                l.on('click', function (e) { l.openPopup(); });
                l.setStyle && l.setStyle({ opacity: 1, color: '#3388ff' });
            });
            saveEditBtn.style.display = "none";

            // ✅ 保存编辑后恢复所有按钮可用
            setButtonDisabled(drawRectangleBtn, false);
            setButtonDisabled(drawPolygonBtn, false);
            setButtonDisabled(drawHandBtn, false);
            setButtonDisabled(editBtn, false);
            setButtonDisabled(deleteBtn, false);
        });
    }
};


// ----------- 删除模式相关 -----------
let deleteModeActive = false;
let deletingLayer = null;

// 删除按钮逻辑
deleteBtn.onclick = function () {
    deleteModeActive = !deleteModeActive;
    if (deleteModeActive) {
        deleteBtn.textContent = "退出删除状态";
        showTopTip("请选择要删除的图形！");

        // 禁用 3 个绘制按钮 + 编辑按钮
        setButtonDisabled(drawRectangleBtn, true);
        setButtonDisabled(drawPolygonBtn, true);
        setButtonDisabled(drawHandBtn, true);
        setButtonDisabled(editBtn, true);
        setButtonDisabled(saveEditBtn, true);

        drawnItems.eachLayer(layer => {
            layer.on('mousedown', function () { selectLayerForDelete(layer); });
            layer.off('click');
            layer.setStyle && layer.setStyle({ opacity: 1, color: '#3388ff' });
        });
    } else {
        deleteBtn.textContent = "进入删除状态";

        // 恢复绘制按钮 + 编辑按钮
        setButtonDisabled(drawRectangleBtn, false);
        setButtonDisabled(drawPolygonBtn, false);
        setButtonDisabled(drawHandBtn, false);
        setButtonDisabled(editBtn, false);
        setButtonDisabled(saveEditBtn, false);

        drawnItems.eachLayer(layer => {
            layer.off('mousedown');
            layer.on('click', function (e) { layer.openPopup(); });
            layer.setStyle && layer.setStyle({ opacity: 1, color: '#3388ff' });
        });
        deletingLayer = null;
    }
};

// 选择图层进行删除
function selectLayerForDelete(layer) {
    deletingLayer = layer;
    drawnItems.eachLayer(l => {
        if (l === layer) {
            l.setStyle && l.setStyle({ opacity: 1, color: 'red' });
        } else {
            l.setStyle && l.setStyle({ opacity: 0.3, color: '#3388ff' });
        }
    });
    showDeleteDialog(layer.getPopup() ? layer.getPopup().getContent() : "", function (confirm) {
        if (confirm) {
            socket.emit('delete-drawing', layer._customId);
            drawnItems.removeLayer(layer);
            drawnItems.eachLayer(l => {
                l.off('mousedown');
                l.on('mousedown', function () { selectLayerForDelete(l); });
                l.setStyle && l.setStyle({ opacity: 1, color: '#3388ff' });
            });
            deletingLayer = null;
        } else {
            drawnItems.eachLayer(l => {
                l.setStyle && l.setStyle({ opacity: 1, color: '#3388ff' });
            });
            deletingLayer = null;
        }
    });
}

// 自定义删除确认弹窗
function showDeleteDialog(name, callback) {
    let dialog = document.getElementById('delete-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'delete-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '30%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.background = '#fff';
        dialog.style.padding = '24px 32px';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 2px 12px rgba(0,0,0,0.2)';
        dialog.style.zIndex = '3000';
        dialog.innerHTML = `
            <div style="font-size:18px;margin-bottom:12px;">是否删除该图形：${name}？</div>
            <div style="text-align:right;">
                <button id="delete-dialog-ok" style="background:#d32f2f;color:#fff;padding:6px 18px;border:none;border-radius:4px;font-size:16px;cursor:pointer;margin-right:10px;">确认</button>
                <button id="delete-dialog-cancel" style="background:#aaa;color:#fff;padding:6px 18px;border:none;border-radius:4px;font-size:16px;cursor:pointer;">取消</button>
            </div>
        `;
        document.body.appendChild(dialog);
    } else {
        dialog.querySelector('div').innerHTML = `是否删除该图形：${name}？`;
    }
    dialog.style.display = 'block';
    document.getElementById('delete-dialog-ok').onclick = function () {
        dialog.style.display = 'none';
        callback(true);
    };
    document.getElementById('delete-dialog-cancel').onclick = function () {
        dialog.style.display = 'none';
        callback(false);
    };
}