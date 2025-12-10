// 🔓 グローバルに登録
window.loadWeather = loadWeather;
window.showWeather = showWeather;
window.addCategory = addCategory;
window.renderCategories = renderCategories;
window.showList = showList;
window.goBack = goBack;
window.addItem = addItem;
window.addSchoolItem = addSchoolItem;
window.deleteCategory = deleteCategory;
window.logout = logout;

function logout() {
  signOut(auth).then(() => {
    location.href = "login.html";
  });
}

async function loadWeather() {

  const apiKey = "c70048f541c42691d2a087e6b869a067";
  const city = "Osaka,JP";

  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&lang=ja&units=metric`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&lang=ja&units=metric`;

  try {
    // 現在の天気（正確）
    const currentRes = await fetch(currentUrl);
    const currentData = await currentRes.json();

    // 3時間予報
    const forecastRes = await fetch(forecastUrl);
    const forecastData = await forecastRes.json();

    showWeather(currentData, forecastData);

  } catch (e) {
    console.error("天気取得エラー:", e);
  }
}

function showWeather(current, forecast) {

  // ① 今の天気
  const nowWeather = current.weather[0].description;   // 例: 薄い雲
  const nowTemp = current.main.temp.toFixed(1);        // 小数1桁まで

  const nowMain = current.weather[0].main;             // "Rain" など

  // ② 今日の日付と現在時刻
  const now = new Date();
  const currentHour = now.getHours();
  const today = now.toISOString().slice(0, 10);

  // ③ 今日これからの「一番早い雨の時間」を探す
  let nextRainTime = null;

  for (const info of forecast.list) {
    const [dateStr, timeStr] = info.dt_txt.split(" "); // "YYYY-MM-DD HH:MM:SS"
    const hour = parseInt(timeStr.slice(0, 2), 10);

    // 今日以外は無視
    if (dateStr !== today) continue;
    // 今より前の時間は無視
    if (hour <= currentHour) continue;

    const main = info.weather[0].main;
    const pop = info.pop ?? 0;                  // 降水確率(0〜1)
    const rainAmount = info.rain?.["3h"] ?? 0;  // 3時間の降水量(mm)

    const willRain =
      main === "Rain" ||
      main === "Drizzle" ||
      main === "Thunderstorm" ||
      pop >= 0.5 ||         // 50%以上で雨っぽい
      rainAmount > 0.1;     // 少しでも降水量がある

    if (willRain) {
      nextRainTime = timeStr.slice(0, 5); // "HH:MM"
      break;
    }
  }

  // ④ 表示用メッセージを作る
let advice = "";

if (
  nowMain === "Rain" ||
  nowMain === "Drizzle" ||
  nowMain === "Thunderstorm"
) {
  // 今、もう雨
  advice = "🌧 今は雨が降っています。外出の際は傘をお持ちください。";
} else if (nextRainTime) {
  // これから雨が降りそう
  advice = `🌦 今日の ${nextRainTime} 頃から雨の予報です。お出かけの際は傘があると安心です。`;
} else {
  // 今日はほぼ雨の心配なし
  advice = "☀ 今日は一日を通して大きな雨の予報はなさそうです。身軽にお出かけできます。";
}

// 🌈 カード背景デザインの切り替え
let bgClass = "weather-sunny"; // デフォルト晴れ

if (
  nowMain === "Rain" ||
  nowMain === "Drizzle" ||
  nowMain === "Thunderstorm" ||
  nextRainTime
) {
  bgClass = "weather-rain";
} else if (nowMain === "Clouds") {
  bgClass = "weather-cloud";
}

// ✨ HTML反映（デザイン付き）
document.getElementById("weather-info").innerHTML = `
  <div class="weather-card ${bgClass}">
    <div class="weather-status">
      ${nowWeather}　${nowTemp}℃
    </div>
    <div class="weather-advice">
      ${advice}
    </div>
  </div>
`;

}

let items = {};
let currentCategory = null;

// Firestoreに保存
async function saveData() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log("⚠ ユーザー未ログイン");
      return;
    }

    const docRef = doc(db, "users", user.uid, "data", "myList");
    await setDoc(docRef, { items: items });
    console.log("✅ Firestoreに保存しました");
  } catch (e) {
    console.error("❌ Firestore保存エラー:", e);
  }
}

async function loadData() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log("⚠ 未ログイン → 読み込み停止");
      return;
    }

    const docRef = doc(db, "users", user.uid, "data", "myList");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log("Firebase にデータあり → 読み込みます");
      items = docSnap.data().items ?? {};
    } else {
      console.log("初回ユーザー → 初期セット生成");
      items = defaultItems();
      await saveData();
    }

  } catch (e) {
    console.error("❌ Firestore読み込みエラー:", e);
  }
}


// 初期データ生成
function defaultItems() {
  return {
    "学校": [],
    "月曜日": [],
    "火曜日": [],
    "水曜日": [],
    "木曜日": [],
    "金曜日": []
  };
}

function renderCategories() {
  const container = document.getElementById("category-container");
  container.innerHTML = "";

  // ホーム画面に表示したいカテゴリだけを抽出
  const homeCategories = Object.keys(items).filter(key =>
    key !== "月曜日" &&
    key !== "火曜日" &&
    key !== "水曜日" &&
    key !== "木曜日" &&
    key !== "金曜日"
  );

  const sorted = homeCategories.sort((a, b) => {
    if (a === "学校") return -1;
    if (b === "学校") return 1;
    return a.localeCompare(b);
  });

  sorted.forEach(category => {
    const card = document.createElement("div");
    card.className = "category-card";
    card.textContent = category;
    card.onclick = () => showList(category);

    const del = document.createElement("button");
    del.textContent = "✕";
    del.className = "delete-btn";
    del.onclick = (event) => {
      event.stopPropagation();
      delete items[category];
      saveData();
      renderCategories();
    };

    card.appendChild(del);
    container.appendChild(card);
  });
}

// ④ カテゴリ追加
function addCategory() {
  const name = document.getElementById("new-category-name").value.trim();

  if (!name) {
    alert("カテゴリ名を入力してください。");
    return;
  }

  if (items[name]) {
    alert("そのカテゴリはすでに存在します。");
    return;
  }

  // ⭐「学校」という文字が含まれていたら学校カテゴリ扱い
  const isSchool = name.includes("学校");

  if (isSchool) {
    items[name] = []; // 「学校」カテゴリ本体

    const days = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日"];
    days.forEach(day => {
      if (!items[day]) items[day] = [];  // 曜日は存在しなければ作る
    });

  } else {
    // ★ 通常カテゴリ
    items[name] = [];
  }

  document.getElementById("new-category-name").value = "";
  saveData();
  renderCategories();
}

function getTodayLabel() {
  const week = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  const todayIndex = new Date().getDay();
  return week[todayIndex];
}

// ⑤ カテゴリ内の持ち物表示
function showList(category) {

  if (category.includes("学校")) {
    openSchool();
    return;
  }

  currentCategory = category;
  document.getElementById("category-menu").style.display = "none";
  document.getElementById("item-lists").style.display = "block";

  const title = document.getElementById("category-title");
  const list = document.getElementById("item-list");

  title.textContent = `${category} の持ち物`;
  list.innerHTML = "";

  items[category].forEach((item, index) => {
    const li = document.createElement("li");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";

    const span = document.createElement("span");
    span.textContent = item;

    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.onclick = () => {
      items[category].splice(index, 1);
      saveData(); // ← 削除後に保存
      showList(category);
    };

    li.onclick = (e) => {
      // ボタン（削除）を押したとき li のクリックが動かないようにする
      if (e.target.tagName === "BUTTON") return;

      checkbox.checked = !checkbox.checked;

      if (checkbox.checked) {
        span.classList.add("checked-item");
        li.classList.add("checked-bg");
      } else {
        span.classList.remove("checked-item");
        li.classList.remove("checked-bg");
      }
    };


    checkbox.onchange = () => {
      if (checkbox.checked) {
        span.classList.add("checked-item");
        li.classList.add("checked-bg");
      } else {
        span.classList.remove("checked-item");
        li.classList.remove("checked-bg");
      }
    };


    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

function openSchool() {
  const today = getTodayLabel();
  showSchoolDay(today);
}

function showSchoolDay(day) {

  // ページ切り替え
  document.getElementById("category-menu").style.display = "none";
  document.getElementById("item-lists").style.display = "none";
  document.getElementById("school-days").style.display = "block";

  // タイトル変更
  document.getElementById("school-title").textContent = `${day} の持ち物`;

  // タブ生成
  const tabs = document.getElementById("school-tabs");
  tabs.innerHTML = "";

  const days = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日"];
  days.forEach(d => {
    const btn = document.createElement("button");
    btn.textContent = d;
    btn.className = "day-tab" + (d === day ? " active" : "");
    btn.onclick = () => showSchoolDay(d);
    tabs.appendChild(btn);
  });

  // 持ち物一覧
  const list = document.getElementById("school-item-list");
  list.innerHTML = "";

  items[day].forEach((item, index) => {
    const li = document.createElement("li");

    // ✔ チェックボックス
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.style.transform = "scale(1.4)";
    checkbox.style.marginRight = "12px";

    // ✔ テキスト
    const span = document.createElement("span");
    span.textContent = item;

    // ✔ 削除ボタン
    const del = document.createElement("button");
    del.textContent = "✕";
    del.onclick = () => {
      items[day].splice(index, 1);
      saveData();
      showSchoolDay(day);
    };

    li.onclick = (e) => {
      if (e.target.tagName === "BUTTON") return;

      checkbox.checked = !checkbox.checked;

      if (checkbox.checked) {
        span.classList.add("checked-item");
        li.classList.add("checked-bg");
      } else {
        span.classList.remove("checked-item");
        li.classList.remove("checked-bg");
      }
    };


    // ✔ チェック時のデザイン
    checkbox.onchange = () => {
      if (checkbox.checked) {
        span.classList.add("checked-item");
        li.classList.add("checked-bg");
      } else {
        span.classList.remove("checked-item");
        li.classList.remove("checked-bg");
      }
    };

    // li に全部追加
    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(del);
    list.appendChild(li);
  });

  currentCategory = day;
}

function addSchoolItem() {
  const input = document.getElementById("new-school-item");
  const value = input.value.trim();

  if (value && currentCategory) {
    items[currentCategory].push(value);
    input.value = "";
    saveData();
    showSchoolDay(currentCategory);
  }
}


// ⑥ 持ち物追加
function addItem() {
  const input = document.getElementById("new-item");
  const value = input.value.trim();
  if (value && currentCategory) {
    items[currentCategory].push(value);
    input.value = "";
    saveData(); // ← 追加後に保存
    showList(currentCategory);
  }
}

// ⑦ カテゴリ削除
function deleteCategory() {
  if (confirm("このカテゴリを削除しますか？")) {
    delete items[currentCategory];
    saveData(); // ← 削除後に保存
    goBack();
    renderCategories();
  }
}

function goBack() {

  // 学校ページを閉じる
  const schoolSection = document.getElementById("school-days");
  schoolSection.style.display = "none";
  schoolSection.classList.remove("school-fade-in");

  // 持ち物ページを閉じる
  document.getElementById("item-lists").style.display = "none";

  // ホーム画面（カテゴリ一覧）を表示
  document.getElementById("category-menu").style.display = "block";

  currentCategory = null;
}

// ⑨ ページ読み込み時
window.onload = async function () {
  await loadData();
  renderCategories();
  await loadWeather();
};

