// --- Global State ---
let myChart = null;
let db = null;
let currentChar = "Default";
let currentLang = 'en';
let currentTab = 'total';

const colors = ['#3498db', '#fd79a8', '#a29bfe', '#55efc4', '#e84393', '#00cec9'];
const regionIds = ['vj', 'cc', 'lc', 'ac', 'mr', 'es'];

// --- Localization Data ---
const i18n = {
    en: {
        add: "Add", del: "Delete", charPlaceHolder: "Character Name",
        hyper: "Hyper Stat:", guild: "Guild Skill:", tabInd: "Levels", tabTot: "Total ARC",
        currLv: "Level", currExp: "Quantity", daily: "Daily Gain", weekly: "Weekly Gain",
        totalTitle: "Total ARC", detailTitle: "[ Level Details ]",
        confirmDel: "Delete this character?",
        regions: ["Vanishing Journey", "Chu Chu Island", "Lachelein", "Arcana", "Morass", "Esfera"]
    },
    zh: {
        add: "新增", del: "刪除", charPlaceHolder: "角色名稱",
        hyper: "極限屬性:", guild: "公會技能:", tabInd: "等級", tabTot: "總 ARC",
        currLv: "等級", currExp: "數量", daily: "每日獲得", weekly: "每週獲得",
        totalTitle: "總 ARC", detailTitle: "[ 各島等級詳情 ]",
        confirmDel: "確定要刪除此角色嗎？",
        regions: ["消逝的旅途", "啾啾艾爾蘭", "拉契爾恩", "阿爾卡娜", "魔菈斯", "艾斯佩拉"]
    },
    ja: {
        add: "追加", del: "削除", charPlaceHolder: "キャラ名",
        hyper: "Hyper Stat:", guild: "Guild Skill:", tabInd: "レベル", tabTot: "合計 ARC",
        currLv: "レベル", currExp: "數量", daily: "デイリー獲得", weekly: "ウィークリー獲得",
        totalTitle: "合計 ARC", detailTitle: "[ 各地域のレベル詳細 ]",
        confirmDel: "このキャラクターを削除しますか？",
        regions: ["消滅の旅路", "チューチューアイランド", "レヘルン", "アルカナ", "モラス", "エスフェラ"]
    }
};

// --- Database Operations ---
const DB_NAME = "MapleArcDB";
const STORE_NAME = "characters";

async function initDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            let d = e.target.result;
            if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME, { keyPath: "name" });
        };
        request.onsuccess = (e) => { db = e.target.result; resolve(); };
    });
}

async function getAllChars() {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAllKeys();
        req.onsuccess = () => resolve(req.result.length ? req.result : ["Default"]);
    });
}

async function getCharData(name) {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(name);
        req.onsuccess = () => resolve(req.result);
    });
}

async function saveCharData(name, data) {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ name, ...data });
}

// --- Language & UI Management ---
function initLang() {
    const savedLang = localStorage.getItem('arc_lang');
    if (savedLang && i18n[savedLang]) {
        currentLang = savedLang;
    } else {
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.includes('zh')) currentLang = 'zh';
        else if (browserLang.includes('ja')) currentLang = 'ja';
        else currentLang = 'en';
    }
    const picker = document.getElementById('langPicker');
    if (picker) picker.value = currentLang;
}

function updateUI() {
    const t = i18n[currentLang];
    document.getElementById('txt-add').innerText = t.add;
    document.getElementById('txt-del').innerText = t.del;
    document.getElementById('newCharName').placeholder = t.charPlaceHolder;
    document.getElementById('ui-hyper').innerText = t.hyper;
    document.getElementById('ui-guild').innerText = t.guild;
    document.getElementById('txt-ind').innerText = t.tabInd;
    document.getElementById('txt-tot').innerText = t.tabTot;

    const container = document.getElementById('region-inputs');
    container.innerHTML = "";
    regionIds.forEach((id, index) => {
        // --- Default Logic ---
        // If it's the first island (vj), check it by default; others are unchecked.
        const defaultChecked = (index === 0) ? "checked" : "";
        const defaultClass = (index === 0) ? "" : "disabled";

        container.innerHTML += `
            <div class="card ${defaultClass}" id="card_${id}" style="--clr:${colors[index]}">
                <div class="card-title">
                    <input type="checkbox" id="chk_${id}" ${defaultChecked} onchange="saveAndCalc()">
                    <span>${t.regions[index]}</span>
                </div>
                <div class="inp-group">
                    <div class="inp-item"><label>${t.currLv}</label><input type="number" id="lv_${id}" oninput="saveAndCalc()"></div>
                    <div class="inp-item"><label>${t.currExp}</label><input type="number" id="exp_${id}" oninput="saveAndCalc()"></div>
                    <div class="inp-item"><label>${t.daily}</label><input type="number" id="d_${id}" oninput="saveAndCalc()"></div>
                    <div class="inp-item"><label>${t.weekly}</label><input type="number" id="w_${id}" oninput="saveAndCalc()"></div>
                </div>
            </div>
        `;
    });
    document.getElementById('tab-tot').classList.toggle('active', currentTab === 'total');
    document.getElementById('tab-ind').classList.toggle('active', currentTab === 'individual');
}

// --- Character Control ---
async function refreshCharList() {
    const list = await getAllChars();
    const select = document.getElementById('charSelector');
    select.innerHTML = "";
    list.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.innerText = name;
        if (name === currentChar) opt.selected = true;
        select.appendChild(opt);
    });
}

async function loadCurrentCharacter() {
    const data = await getCharData(currentChar);
    if (data) {
        document.getElementById('hyper_arc').value = data.hyper || "";
        document.getElementById('guild_arc').value = data.guild || "";
        regionIds.forEach(id => {
            const r = data.regions?.[id];
            if (r) {
                document.getElementById(`chk_${id}`).checked = r.active;
                document.getElementById(`lv_${id}`).value = r.lv;
                document.getElementById(`exp_${id}`).value = r.exp;
                document.getElementById(`d_${id}`).value = r.d;
                document.getElementById(`w_${id}`).value = r.w;
                document.getElementById(`card_${id}`).classList.toggle('disabled', !r.active);
            }
        });
    }
    calculate();
}

async function addCharacter() {
    const name = document.getElementById('newCharName').value.trim();
    if (!name) return;
    currentChar = name;
    await saveCharData(name, {});
    localStorage.setItem('last_char', name);
    location.reload();
}

async function deleteCharacter() {
    if (!confirm(i18n[currentLang].confirmDel)) return;
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(currentChar);
    localStorage.removeItem('last_char');
    location.reload();
}

async function switchCharacter() {
    currentChar = document.getElementById('charSelector').value;
    localStorage.setItem('last_char', currentChar);
    await loadCurrentCharacter();
}

// --- App Logic ---
function saveAndCalc() {
    const data = {
        hyper: document.getElementById('hyper_arc').value,
        guild: document.getElementById('guild_arc').value,
        regions: {}
    };
    regionIds.forEach(id => {
        const active = document.getElementById(`chk_${id}`).checked;
        data.regions[id] = { active, lv: document.getElementById(`lv_${id}`).value, exp: document.getElementById(`exp_${id}`).value, d: document.getElementById(`d_${id}`).value, w: document.getElementById(`w_${id}`).value };
        document.getElementById(`card_${id}`).classList.toggle('disabled', !active);
    });
    saveCharData(currentChar, data);
    calculate();
}

function changeLang(l) { currentLang = l; localStorage.setItem('arc_lang', l); updateUI(); loadCurrentCharacter(); }

function setTab(m, shouldCalc = true) {
    currentTab = m;
    document.getElementById('tab-tot').classList.toggle('active', m === 'total');
    document.getElementById('tab-ind').classList.toggle('active', m === 'individual');
    if (shouldCalc) calculate();
}

// --- Calculation & Chart ---
function calculate() {
    const t = i18n[currentLang];
    const hyper = parseInt(document.getElementById('hyper_arc').value) || 0;
    const guild = parseInt(document.getElementById('guild_arc').value) || 0;
    const startDate = new Date(); startDate.setHours(0, 0, 0, 0);

    const datasets = [];
    let totalMaxDays = 0;
    const dailyLevelDetails = new Array(1001).fill(null).map(() => ({}));
    const totals = new Array(1001).fill(hyper + guild);

    regionIds.forEach((id, index) => {
        const chk = document.getElementById(`chk_${id}`);
        if (!chk || !chk.checked) return;
        let lv = parseInt(document.getElementById(`lv_${id}`).value) || 1;
        let exp = parseInt(document.getElementById(`exp_${id}`).value) || 0;
        const dGain = parseInt(document.getElementById(`d_${id}`).value) || 0;
        const wGain = parseInt(document.getElementById(`w_${id}`).value) || 0;
        const data = [];
        const getReq = (l) => Math.pow(l, 2) + 11;

        for (let day = 0; day <= 800; day++) {
            let simDate = new Date(startDate); simDate.setDate(startDate.getDate() + day);
            if (day > 0) {
                exp += dGain;
                if (simDate.getDay() === 4) exp += wGain;
                while (lv < 20 && exp >= getReq(lv)) { exp -= getReq(lv); lv++; }
            }
            totals[day] += (lv * 10) + 20;
            dailyLevelDetails[day][t.regions[index]] = lv;
            if (simDate.getDay() === 4 || lv === 20 || day === 0) data.push({ x: simDate.getTime(), y: lv });
            if (lv >= 20) {
                totalMaxDays = Math.max(totalMaxDays, day);
                for (let r = day + 1; r <= 800; r++) { totals[r] += 220; dailyLevelDetails[r][t.regions[index]] = 20; }
                break;
            }
        }
        datasets.push({ label: t.regions[index], data, borderColor: colors[index], backgroundColor: colors[index], tension: 0.3, hidden: currentTab === 'total' });
    });

    if (currentTab === 'total') {
        const totalData = [];
        for (let d = 0; d <= totalMaxDays; d++) {
            let dt = new Date(startDate); dt.setDate(startDate.getDate() + d);
            totalData.push({ x: dt.getTime(), y: totals[d], details: dailyLevelDetails[d] });
        }
        datasets.push({ label: t.totalTitle, data: totalData, borderColor: '#2c3e50', backgroundColor: 'rgba(44,62,80,0.1)', fill: true, tension: 0.3, pointRadius: 0 });
    }
    renderChart(datasets, t);
}

function renderChart(datasets, t) {
    const canvas = document.getElementById('arcChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { type: 'time', time: { unit: 'month', displayFormats: { month: 'yyyy/MM' } } },
                y: { ticks: { precision: 0 } }
            },
            plugins: {
                tooltip: {
                    mode: 'index', intersect: false,
                    callbacks: {
                        title: (c) => { const d = new Date(c[0].parsed.x); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; },
                        footer: (items) => {
                            if (currentTab !== 'total' || !items[0].raw.details) return '';
                            let s = `\n${t.detailTitle}\n`;
                            for (const [n, l] of Object.entries(items[0].raw.details)) s += `${n}: Lv.${l}\n`;
                            return s;
                        }
                    }
                }
            }
        }
    });
}

// --- Init ---
async function setup() {
    await initDB();
    initLang();
    currentChar = localStorage.getItem('last_char') || "Default";
    await refreshCharList();
    updateUI();
    await loadCurrentCharacter();
}

window.onload = setup;