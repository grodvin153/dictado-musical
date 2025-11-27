// -------------------------------------------------
// CONFIGURACIÓN GENERAL
// -------------------------------------------------

const TOTAL_PREGUNTAS = 15;
let notaDuration = 0.50;      // duración por nota (segundos), por defecto 0.5
const MIN_DURATION = 0.20;
const MAX_DURATION = 0.80;

// Estado del examen
let preguntaNumero = 0;
let preguntaActual = [];      // tokens latinos originales, ej: ["do","re","mi","fa"]
let respuestaUsuario = [];    // tokens latinos que pulsa el alumno
let puntuacion = 0;
let examTerminado = false;

// WebAudio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let buffers = {};             // { "C4": AudioBuffer, "D4": AudioBuffer, ... }

const CONVERSION_LATINA_INGLES = {
    "DO": "C",
    "RE": "D",
    "MI": "E",
    "FA": "F",
    "SOL": "G",
    "LA": "A",
    "SI": "B"
};

const CONVERSION_INGLES_LATINO = {
    "C": "Do",
    "D": "Re",
    "E": "Mi",
    "F": "Fa",
    "G": "Sol",
    "A": "La",
    "B": "Si"
};

// Preguntas (las mismas que en Python, notación latina)
const PREGUNTAS = [
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
    "do mi re si3",
    "fa la sol re5",
    "si3 sol fa re",
    "sol la sol re5",
    "do mi re mi",
    "la la do5 la",
    "re5 si sol fa",
    "re fa la re5",
    "mi do re mi",
    "sol fa mi re",
    "mi re do mi",
    "sol la sol fa#",
    "do re mi sol",
    "sol fa# sol la",
    "mi do mi sol",
    "sol la si re5",
    "mi sol mi do",
    "do5 sol fa mi",
    "sol la sol fa",
    "si la sol fa",
    "sol do5 si la",
    "re fa mi re",
    "sol mi fa fa#",
    "re mi fa mi",
    "do si3 do re",
    "re mi fa sol",
    "do re mi fa",
    "re5 do5 si la",
    "re5 do4 si do5",
    "mi sol fa# fa",
    "la do5 si la",
    "mi fa sol la",
    "fa mi re mi",
    "re mi fa la",
    "sol la si re5"
];

// Notas con audio necesario (inglés con octava) para este dictado
// Rango si3–re5 + sostenidos usados (F#4)
const NOTES_TO_LOAD = [
    "B3", "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
    "C5", "C#5", "D5"
];

// Botones de notas (texto que se ve y token interno que guardamos)
const NOTAS_VALIDAS = [
    "si3", "do4", "re4", "mi4", "fa4",
    "sol4", "la4", "si4", "do5", "re5"
];

// -------------------------------------------------
// NORMALIZACIÓN DE NOTAS
// -------------------------------------------------

function normalizarNota(token) {
    // token tipo: "do", "do4", "fa#", "fa#4", "si3", "do5", etc.
    let n = token.trim().toUpperCase();

    // Si no hay dígito, asumimos octava 4
    if (!/\d/.test(n)) {
        n += "4";
    }

    // Separar octava (último dígito)
    const octMatch = n.match(/(\d)$/);
    if (!octMatch) {
        throw new Error("Formato incorrecto de nota: " + token);
    }
    const octava = octMatch[1];
    let base = n.slice(0, -1); // resto sin la octava

    // Detectar sostenido si está al final (FA#) o antes del dígito (FA#4)
    let alter = "";
    if (base.endsWith("#")) {
        alter = "#";
        base = base.slice(0, -1);
    }

    // Base puede ser en inglés (C,D,E,...) o latina (DO,RE,...)
    if (["C","D","E","F","G","A","B"].includes(base)) {
        return base + alter + octava;
    }

    if (CONVERSION_LATINA_INGLES[base]) {
        const baseEng = CONVERSION_LATINA_INGLES[base];
        return baseEng + alter + octava;
    }

    // Caso "SO" → "SOL"
    if (base === "SO") {
        return "G" + alter + octava;
    }

    throw new Error("Nota desconocida: " + token);
}

// Mostrar nota en castellano para mensajes al alumno
function mostrarNotaEspanol(norm) {
    // norm: "C4", "C#4", "D5"...
    const base = norm[0];
    const octava = norm[norm.length - 1];
    const alter = norm.length === 3 ? norm[1] : "";

    const latina = CONVERSION_INGLES_LATINO[base] || base;
    const texto = latina + alter;

    // Ocultamos octava 4; mostramos las demás
    if (octava === "4") return texto;
    return texto + octava;
}

// -------------------------------------------------
// AUDIO: CARGA Y REPRODUCCIÓN CON WebAudio API
// -------------------------------------------------

async function loadNote(name) {
    const resp = await fetch(`sounds/${name}.wav`);
    const arrayBuffer = await resp.arrayBuffer();
    buffers[name] = await audioCtx.decodeAudioData(arrayBuffer);
}

async function loadAllNotes() {
    for (const n of NOTES_TO_LOAD) {
        await loadNote(n);
    }
    console.log("✅ Todas las notas cargadas");
}

function playNote(name, when) {
    const buf = buffers[name];
    if (!buf) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(when);
}

function reproducirPregunta() {
    if (examTerminado) return;
    if (!preguntaActual || preguntaActual.length !== 4) return;

    // Aseguramos que el contexto está activo (por políticas de navegador)
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    const normPregunta = preguntaActual.map(normalizarNota); // ingles + octava
    const t0 = audioCtx.currentTime + 0.2;

    // Nota de referencia DO4
    playNote("C4", t0);
    const inicio = t0 + 1.0;

    normPregunta.forEach((n, i) => {
        playNote(n, inicio + i * notaDuration);
    });
}

// -------------------------------------------------
// GUI Y LÓGICA DEL EXAMEN
// -------------------------------------------------

const infoEl = document.getElementById("info-pregunta");
const puntuacionEl = document.getElementById("puntuacion");
const respuestaEl = document.getElementById("respuesta");
const btnEscuchar = document.getElementById("btn-escuchar");
const btnBorrar = document.getElementById("btn-borrar");
const btnValidar = document.getElementById("btn-validar");
const chkSostenido = document.getElementById("chkSostenido");
const notasListaEl = document.getElementById("notas-lista");

const popupEl = document.getElementById("popup");
const popupTextoEl = document.getElementById("popup-texto");
const popupEscucharBtn = document.getElementById("popup-escuchar");
const popupSiguienteBtn = document.getElementById("popup-siguiente");

// Slider
const durSlider = document.getElementById("durSlider");
const durLabel = document.getElementById("durLabel");

function actualizarEtiquetas() {
    infoEl.textContent = `Pregunta ${preguntaNumero} de ${TOTAL_PREGUNTAS}`;
    puntuacionEl.textContent = `Puntuación: ${puntuacion}`;
}

function actualizarRespuesta() {
    const norm = respuestaUsuario.map(normalizarNota);
    const texto = norm.map(mostrarNotaEspanol).join(", ");
    respuestaEl.textContent = "Respuesta: [" + texto + "]";
}

// Crear botones de notas
function crearBotonesNotas() {
    NOTAS_VALIDAS.forEach(token => {
        const btn = document.createElement("button");
        btn.className = "nota-btn";
        btn.textContent = token.toUpperCase();
        btn.addEventListener("click", () => agregarRespuesta(token));
        notasListaEl.appendChild(btn);
    });
}

// Agregar respuesta del alumno
function agregarRespuesta(tokenBase) {
    if (examTerminado) return;
    if (respuestaUsuario.length >= 4) return;

    let token = tokenBase;

    // Si hay sostenido, insertamos '#' antes de la octava (si3 → si#3)
    if (chkSostenido.checked) {
        const m = token.match(/(\d)$/);
        if (m) {
            const idx = token.length - 1;
            token = token.slice(0, idx) + "#" + token.slice(idx);
        } else {
            token = token + "#4"; // caso raro, pero por si acaso
        }
        chkSostenido.checked = false;
    }

    respuestaUsuario.push(token);
    actualizarRespuesta();
}

// Nueva pregunta
function nuevaPregunta() {
    if (preguntaNumero >= TOTAL_PREGUNTAS) {
        examTerminado = true;
        alert(`Has terminado el examen.\nPuntuación final: ${puntuacion} / ${TOTAL_PREGUNTAS * 250}`);
        return;
    }

    preguntaNumero += 1;
    // Elegimos una pregunta aleatoria
    const texto = PREGUNTAS[Math.floor(Math.random() * PREGUNTAS.length)];
    preguntaActual = texto.split(/\s+/);  // array de 4 tokens latinos
    respuestaUsuario = [];

    actualizarEtiquetas();
    respuestaEl.textContent = "Respuesta: []";
}

// Validación
function validar() {
    if (examTerminado) return;

    if (respuestaUsuario.length !== 4) {
        alert("Debes introducir las 4 notas.");
        return;
    }

    const correctaNorm = preguntaActual.map(normalizarNota);
    const usuarioNorm = respuestaUsuario.map(normalizarNota);

    const ok = correctaNorm.every((n, i) => n === usuarioNorm[i]);

    if (ok) {
        puntuacion += 250;
        actualizarEtiquetas();
        alert("✔ ¡Respuesta correcta!");
        nuevaPregunta();
    } else {
        mostrarPopupError(correctaNorm, usuarioNorm);
    }
}

// Popup error
function mostrarPopupError(correctaNorm, usuarioNorm) {
    const corr = correctaNorm.map(mostrarNotaEspanol).join(", ");
    const usu = usuarioNorm.map(mostrarNotaEspanol).join(", ");

    popupTextoEl.textContent =
        "❌ Respuesta incorrecta.\n\n" +
        "Correcta: " + corr + "\n" +
        "Tu respuesta: " + usu;

    popupEl.classList.remove("oculto");
}

function ocultarPopup() {
    popupEl.classList.add("oculto");
}

// -------------------------------------------------
// INICIALIZACIÓN DE SLIDER Y EVENTOS
// -------------------------------------------------

function setupSlider() {
    durSlider.min = MIN_DURATION;
    durSlider.max = MAX_DURATION;
    durSlider.step = 0.01;
    durSlider.value = notaDuration;
    durLabel.textContent = notaDuration.toFixed(2) + " s";

    durSlider.addEventListener("input", () => {
        notaDuration = parseFloat(durSlider.value);
        durLabel.textContent = notaDuration.toFixed(2) + " s";
    });
}

btnEscuchar.addEventListener("click", reproducirPregunta);
btnBorrar.addEventListener("click", () => {
    respuestaUsuario = [];
    respuestaEl.textContent = "Respuesta: []";
});
btnValidar.addEventListener("click", validar);

popupEscucharBtn.addEventListener("click", () => {
    ocultarPopup();
    reproducirPregunta();
});
popupSiguienteBtn.addEventListener("click", () => {
    ocultarPopup();
    nuevaPregunta();
});

// -------------------------------------------------
// ARRANQUE
// -------------------------------------------------

window.addEventListener("load", async () => {
    crearBotonesNotas();
    setupSlider();
    await loadAllNotes();
    preguntaNumero = 0;
    puntuacion = 0;
    examTerminado = false;
    nuevaPregunta();
});
