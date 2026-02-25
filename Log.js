
let detectionLog = [];

function addLog(entry) {
    const time = new Date().toLocaleTimeString();
    detectionLog.push({ time, entry });

    const panel = document.getElementById("logPanel");
    panel.innerHTML += `[${time}] ${entry}<br>`;
    panel.scrollTop = panel.scrollHeight;
}

function clearLog() {
    detectionLog = [];
    document.getElementById("logPanel").innerHTML =
        "<b>DETECTION LOG</b><br><br>";
}
