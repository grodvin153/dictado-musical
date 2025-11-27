//------------------------------------------------------------
// AUDIO CONTEXT (uno solo para toda la app)
//------------------------------------------------------------

let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bancos = {};  // buffers precargados

//------------------------------------------------------------
// UTILIDAD: Esperar (para secuenciar notas sin solaparse)
//------------------------------------------------------------
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//------------------------------------------------------------
// NORMALIZAR NOTA (latina / inglesa → inglesa estándar)
//------------------------------------------------------------
function normalizarNota(nota) {
    nota = nota.toString().trim().toLowerCase();

    // corregir sostenidos
    nota = nota.replace("♯", "#");

    // reconocer octava si no hay
    if (!/[0-9]/.test(nota[nnota.length - 1])) {
        // por defecto octava 4
        nota = nota + "4";
    }

    const baseMap = {
        "do": "C",
        "re": "D",
        "mi": "E",
        "fa": "F",
        "sol": "G",
        "la": "A",
        "si": "B"
    };

    // separar base + accidental + número
    const match = nota.match(/^([a-z]+)([#b]?)([0-9])$/i);
    if (!match) return null;

    let [_, base, alt, oct] = match;

    // base latina
    if (baseMap[base]) base = baseMap[base].toUpperCase();
    else base = base.toUpperCase();

    // accidental
    if (alt === "b") alt = "b";
    if (alt === "#") alt = "#";

    return base + alt + oct;
}

//------------------------------------------------------------
// NORMALIZAR ARCHIVO (C#4 → Cs4.mp3)
//------------------------------------------------------------
function normalizarArchivo(nota) {
    const n = normalizarNota(nota);
    return n
        .replace("C#", "Cs")
        .replace("D#", "Ds")
        .replace("F#", "Fs")
        .replace("G#", "Gs")
        .replace("A#", "As");
}

//------------------------------------------------------------
// PRECARGAR UNA NOTA
//------------------------------------------------------------
async function loadNote(nota) {
    const fileBase = normalizarArchivo(nota);   // ej: F#4 → Fs4
    const url = `sounds/${fileBase}.mp3`;

    if (bancos[nota]) return bancos[nota];

    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    bancos[nota] = audioBuffer;
    return audioBuffer;
}

//------------------------------------------------------------
// PRECARGAR TODAS LAS NOTAS USADAS EN LA APP
//------------------------------------------------------------
async function precargarTodas() {
    let todas = [
        "si3","do4","re4","mi4","fa4","sol4","la4","si4","do5","re5"
    ];

    for (let n of todas) {
        await loadNote(n);
    }

    console.log("✔ Todas las notas precargadas");
}

//------------------------------------------------------------
// REPRODUCIR UNA NOTA (sin solaparse)
//------------------------------------------------------------
async function playNote(nota) {
    const buf = await loadNote(nota);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
}

//------------------------------------------------------------
// REPRODUCIR UNA SECUENCIA DE 4 NOTAS (Android-friendly)
//------------------------------------------------------------
async function playSequence(notas, duracion) {
    for (let n of notas) {
        await playNote(n);
        await sleep(duracion * 1000);  // pausa exacta entre notas
    }
}

//------------------------------------------------------------
// INTERFAZ / LÓGICA DEL EXAMEN
//------------------------------------------------------------

let preguntaActual = 1;
let total = 15;
let respuesta = [];
let puntuacion = 0;

let preguntas = [
    "do re mi fa",
    "fa sol la si",
    "re do si sol",
    "do si3 do re",
    "fa mi fa sol",
    "re mi fa la",
    "do re mi do",
    "fa sol la fa",
    "fa mi re fa",
    "si3 do5 re5 sol",
    "do si do re",
    "fa mi fa la",
    "re5 si sol re5",
    "sol la si re5",
    "do mi re si3"
];

// elementos UI
const btnEscuchar = document.getElementById("escuchar");
const btnValidar = document.getElementById("validar");
const btnBorrar = document.getElementById("borrar");
const panelNotas = document.getElementById("panelNotas");
const outResp = document.getElementById("respuesta");
const outPreg = document.getElementById("preguntaNum");
const outPunt = document.getElementById("puntuacion");
const sliderVel = document.getElementById("velocidad");
const chkSos = document.getElementById("sostenido");

// nota actual
let notasPregunta = [];

//------------------------------------------------------------
// NUEVA PREGUNTA
//------------------------------------------------------------
function nuevaPregunta() {
    if (preguntaActual > total) {
        alert("Examen terminado. Puntuación: " + puntuacion);
        return;
    }

    const linea = preguntas[Math.floor(Math.random() * preguntas.length)];
    notasPregunta = linea.split(" ");

    respuesta = [];
    outResp.textContent = "[ ]";
    outPreg.textContent = `Pregunta ${preguntaActual} de ${total}`;
}

//------------------------------------------------------------
// REPRODUCIR PREGUNTA COMPLETA
//------------------------------------------------------------
btnEscuchar.addEventListener("click", async () => {
    const dur = parseFloat(sliderVel.value);

    // DO4 como referencia
    await playNote("do4");
    await sleep(600);

    await playSequence(notasPregunta, dur);
});

//------------------------------------------------------------
// BOTONES DE NOTAS
//------------------------------------------------------------
panelNotas.addEventListener("click", e => {
    if (!e.target.classList.contains("nota")) return;

    let nota = e.target.dataset.nota;

    if (chkSos.checked) {
        nota += "#";
        chkSos.checked = false;
    }

    if (respuesta.length < 4) {
        respuesta.push(nota);
        outResp.textContent = "[" + respuesta.join(", ") + "]";
    }
});

//------------------------------------------------------------
// BORRAR
//------------------------------------------------------------
btnBorrar.addEventListener("click", () => {
    respuesta = [];
    outResp.textContent = "[ ]";
});

//------------------------------------------------------------
// VALIDAR
//------------------------------------------------------------
btnValidar.addEventListener("click", () => {
    if (respuesta.length !== 4) {
        alert("Debes seleccionar 4 notas.");
        return;
    }

    let corr = notasPregunta.map(n => normalizarNota(n));
    let usr = respuesta.map(n => normalizarNota(n));

    if (corr.join() === usr.join()) {
        puntuacion += 250;
        alert("✔ Correcto");
    } else {
        alert("❌ Incorrecto\nCorrecta: " + notasPregunta.join(" "));
    }

    outPunt.textContent = "Puntuación: " + puntuacion;

    preguntaActual++;
    nuevaPregunta();
});

//------------------------------------------------------------
// INICIO
//------------------------------------------------------------
(async () => {
    await precargarTodas(); // PRECARGA = SOLUCIÓN ANDROID
    nuevaPregunta();
})();
