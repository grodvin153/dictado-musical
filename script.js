// ─────────────────────────────────────────────
// CONFIGURACIÓN AUDIO
// ─────────────────────────────────────────────

let audioCtx = null;
const noteBuffers = {};   // "C4" → AudioBuffer
let notasCargadas = false;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

async function loadNote(name) {
    // name = "C4", "D4", "F#4", etc. → usa MP3
    const response = await fetch(`sounds/${name}.mp3`);
    if (!response.ok) {
        console.error("No se pudo cargar", name, response.status);
        return;
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer);
    noteBuffers[name] = audioBuffer;
}

async function loadAllNotes(listaNotas) {
    const ctx = getAudioContext();
    for (const n of listaNotas) {
        if (!noteBuffers[n]) {
            await loadNote(n);
        }
    }
    notasCargadas = true;
}

function playNote(name, duracion = 0.5, volumen = 0.8) {
    if (!notasCargadas) return;
    const ctx = getAudioContext();
    const buffer = noteBuffers[name];
    if (!buffer) {
        console.warn("No hay buffer para", name);
        return;
    }
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    source.buffer = buffer;
    gainNode.gain.value = volumen;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;
    source.start(now);
    source.stop(now + duracion);
}

// ─────────────────────────────────────────────
// NOTACIÓN: LATINA → INGLESA (para fichero)
// ─────────────────────────────────────────────

const CONVERSION_LATINA = {
    "DO": "C",
    "RE": "D",
    "MI": "E",
    "FA": "F",
    "SOL": "G",
    "LA": "A",
    "SI": "B",
};

function normalizarNota(nota) {
    // Acepta "do", "do4", "fa#4", "C4", etc. → devuelve "C4", "F#4", etc.
    let n = nota.trim().toUpperCase();

    // Si no trae número, asumir octava 4
    if (!/\d$/.test(n)) {
        n = n + "4";
    }

    // Extraer alteración
    let alteracion = "";
    if (n.includes("#")) {
        alteracion = "#";
        n = n.replace("#", "");
    }

    const octava = n.slice(-1);
    const base = n.slice(0, -1); // DO, RE, C, D, SOL…

    // Notación inglesa directa
    if (["C", "D", "E", "F", "G", "A", "B"].includes(base)) {
        return base + alteracion + octava;
    }

    // Notación latina
    if (CONVERSION_LATINA[base]) {
        return CONVERSION_LATINA[base] + alteracion + octava;
    }

    return null;
}

// ─────────────────────────────────────────────
// PREGUNTAS DEL DICTADO
// ─────────────────────────────────────────────

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
    "sol la si re5",
];

// ─────────────────────────────────────────────
// UTILIDAD: extraer lista de notas a cargar
// ─────────────────────────────────────────────

function obtenerNotasUnicas(preguntas) {
    const set = new Set();
    for (const linea of preguntas) {
        const partes = linea.trim().split(/\s+/);
        for (const p of partes) {
            const norm = normalizarNota(p);
            if (norm) set.add(norm);
        }
    }
    // Añadimos el DO de referencia (do4 → C4)
    const ref = normalizarNota("do4");
    if (ref) set.add(ref);
    return Array.from(set);
}

// ─────────────────────────────────────────────
// LÓGICA DEL EXAMEN
// ─────────────────────────────────────────────

let totalPreguntas = 15;
let preguntaActual = 0;
let puntuacion = 0;
let respuestaUsuario = [];
let preguntaNotas = [];

let durSlider, durLabel;
let chkSostenido;
let infoPregunta;
let lblRespuesta;
let lblPuntuacion;
let popup, popupTexto, popupEscuchar, popupSiguiente;
let btnEscuchar, btnBorrar, btnValidar;

function iniciarUI() {
    infoPregunta    = document.getElementById("info-pregunta");
    durSlider       = document.getElementById("durSlider");
    durLabel        = document.getElementById("durLabel");
    chkSostenido    = document.getElementById("chkSostenido");
    lblRespuesta    = document.getElementById("respuesta");
    lblPuntuacion   = document.getElementById("puntuacion");
    btnEscuchar     = document.getElementById("btn-escuchar");
    btnBorrar       = document.getElementById("btn-borrar");
    btnValidar      = document.getElementById("btn-validar");
    popup           = document.getElementById("popup");
    popupTexto      = document.getElementById("popup-texto");
    popupEscuchar   = document.getElementById("popup-escuchar");
    popupSiguiente  = document.getElementById("popup-siguiente");

    // Velocidad inicial (en segundos)
    durSlider.value = 0.50;
    durLabel.textContent = `${parseFloat(durSlider.value).toFixed(2)} s`;

    durSlider.addEventListener("input", () => {
        durLabel.textContent = `${parseFloat(durSlider.value).toFixed(2)} s`;
    });

    // Construir botones de notas (grave → agudo)
    const notasLista = document.getElementById("notas-lista");
    const notasValidas = [
        "si3", "do4", "re4", "mi4", "fa4",
        "sol4", "la4", "si4", "do5", "re5"
    ];

    notasValidas.forEach(nota => {
        const btn = document.createElement("button");
        btn.className = "nota-btn";
        btn.textContent = nota.toUpperCase();
        btn.addEventListener("click", () => agregarRespuesta(nota));
        notasLista.appendChild(btn);
    });

    btnEscuchar.addEventListener("click", reproducirPregunta);
    btnBorrar.addEventListener("click", borrarRespuesta);
    btnValidar.addEventListener("click", validar);

    popupEscuchar.addEventListener("click", () => {
        ocultarPopup();
        reproducirPregunta();
    });

    popupSiguiente.addEventListener("click", () => {
        ocultarPopup();
        nuevaPregunta();
    });

    nuevaPregunta();
}

function actualizarRespuestaLabel() {
    lblRespuesta.textContent = `Respuesta: [${respuestaUsuario.join(" ")}]`;
}

function borrarRespuesta() {
    respuestaUsuario = [];
    actualizarRespuestaLabel();
}

function nuevaPregunta() {
    preguntaActual += 1;
    if (preguntaActual > totalPreguntas) {
        terminarExamen();
        return;
    }
    const linea = PREGUNTAS[Math.floor(Math.random() * PREGUNTAS.length)];
    preguntaNotas = linea.trim().split(/\s+/);   // en notación latina: do, re, si3…

    respuestaUsuario = [];
    actualizarRespuestaLabel();
    infoPregunta.textContent = `Pregunta ${preguntaActual} de ${totalPreguntas}`;
}

function reproducirPregunta() {
    if (!notasCargadas) return;

    const dur = parseFloat(durSlider.value) || 0.5;

    // 1) Nota de referencia DO4
    const ref = normalizarNota("do4"); // → C4
    if (ref) {
        playNote(ref, 0.7, 0.9);
    }

    // 2) Espera
    setTimeout(() => {
        let retraso = 0;
        for (const n of preguntaNotas) {
            const norm = normalizarNota(n); // → C4, D4, etc.
            if (norm) {
                setTimeout(() => {
                    playNote(norm, dur, 0.9);
                }, retraso * 1000);
                retraso += dur + 0.05;
            }
        }
    }, 800);
}

function agregarRespuesta(notaBase) {
    if (respuestaUsuario.length >= 4) return;

    let nota = notaBase;
    if (chkSostenido.checked) {
        nota += "#";
        chkSostenido.checked = false;
    }

    respuestaUsuario.push(nota);
    actualizarRespuestaLabel();
}

function mostrarPopup(mensaje) {
    popupTexto.textContent = mensaje;
    popup.classList.remove("oculto");
}

function ocultarPopup() {
    popup.classList.add("oculto");
}

function quitarSufijo4SoloEnOctava4(lista) {
    // Solo quitamos el "4" si la nota es de octava 4 (C4 → C, DO4 → DO)
    return lista.map(n => {
        let s = n.toString();
        if (s.endsWith("4")) {
            return s.slice(0, -1);
        }
        return s;
    });
}

function validar() {
    if (respuestaUsuario.length !== 4) {
        alert("Debes introducir las 4 notas.");
        return;
    }

    // Normalizamos pregunta y respuesta a notación inglesa tipo C4, D4…
    const correctaNorm = preguntaNotas.map(n => normalizarNota(n));
    const usuarioNorm  = respuestaUsuario.map(n => normalizarNota(n));

    const esCorrecta = correctaNorm.length === usuarioNorm.length &&
        correctaNorm.every((v, i) => v === usuarioNorm[i]);

    if (esCorrecta) {
        puntuacion += 250;
        lblPuntuacion.textContent = `Puntuación: ${puntuacion}`;
        mostrarPopup("✅ ¡Respuesta correcta!");
    } else {
        // Para mostrar al usuario en "latino", pero quitando solo el 4
        const textoCorrecta = quitarSufijo4SoloEnOctava4(preguntaNotas).join(" ");
        const textoUsuario  = quitarSufijo4SoloEnOctava4(respuestaUsuario).join(" ");

        mostrarPopup(`❌ Incorrecto.\nCorrecta: ${textoCorrecta}\nTu respuesta: ${textoUsuario}`);
    }
}

function terminarExamen() {
    alert(`Has terminado.\nPuntuación final: ${puntuacion} / ${totalPreguntas * 250}`);
    // Podrías recargar o dejar la pantalla final
}

// ─────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    // Primero montamos la UI
    iniciarUI();

    // Luego cargamos todas las notas necesarias desde MP3
    const listaNotas = obtenerNotasUnicas(PREGUNTAS);
    try {
        await loadAllNotes(listaNotas);
        console.log("Notas cargadas:", listaNotas);
    } catch (e) {
        console.error("Error cargando notas:", e);
    }
});
