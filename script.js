//------------------------------------------------------------
// NORMALIZACIÓN DE NOTAS (latina → inglesa estándar)
//------------------------------------------------------------
function normalizarNota(nota) {
    let n = nota.trim().toUpperCase();

    // Si no tiene número, asumimos octava 4
    if (!/\d$/.test(n)) n += "4";

    // Detectar alteración
    let alter = "";
    if (n.includes("#")) {
        alter = "#";
        n = n.replace("#", "");
    }

    // Base + número
    const oct = n.slice(-1);
    let base = n.slice(0, -1);

    // Conversión latina
    const LAT = {
        "DO": "C",
        "RE": "D",
        "MI": "E",
        "FA": "F",
        "SOL": "G",
        "LA": "A",
        "SI": "B"
    };

    if (LAT[base]) base = LAT[base];
    if (base === "SO") base = "G";

    return base + alter + oct; // Ej: F#4
}

//------------------------------------------------------------
// NORMALIZACIÓN A NOMBRE DE ARCHIVO (C#4 → Cs4)
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
// CARGA DE SONIDO
//------------------------------------------------------------
async function cargarNota(nota) {
    const archivo = normalizarArchivo(nota);
    const url = `sounds/${archivo}.mp3`;

    try {
        const audio = new Audio(url);
        await audio.play();
    } catch (e) {
        console.error("ERROR cargando:", archivo, e);
    }
}

//------------------------------------------------------------
// REPRODUCIR SECUENCIA
//------------------------------------------------------------
async function reproducirSecuencia(lista, duracion) {
    for (const n of lista) {
        await cargarNota(n);
        await new Promise(r => setTimeout(r, duracion * 1000));
    }
}

//------------------------------------------------------------
// LISTA DE PREGUNTAS (tu lista original)
//------------------------------------------------------------
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

//------------------------------------------------------------
// ESTADO Y GUI
//------------------------------------------------------------
let preguntaActual = [];
let respuestaUsuario = [];
let numeroPregunta = 1;
let duracionNota = 0.5;

function elegirNuevaPregunta() {
    const linea = PREGUNTAS[Math.floor(Math.random() * PREGUNTAS.length)];
    preguntaActual = linea.split(" ");
}

document.getElementById("velocidad").addEventListener("input", e => {
    duracionNota = parseFloat(e.target.value);
    document.getElementById("velLabel").innerText = duracionNota.toFixed(2);
});

document.getElementById("btnEscuchar").addEventListener("click", async () => {

    // Nota de referencia DO4
    await cargarNota("do4");
    await new Promise(r => setTimeout(r, 800));

    await reproducirSecuencia(preguntaActual, duracionNota);
});

document.querySelectorAll(".btnNota").forEach(boton => {
    boton.addEventListener("click", () => {
        let nota = boton.dataset.nota;

        if (document.getElementById("chkSostenido").checked) {
            nota += "#";
            document.getElementById("chkSostenido").checked = false;
        }

        if (respuestaUsuario.length < 4) {
            respuestaUsuario.push(nota);
            actualizarRespuesta();
        }
    });
});

function actualizarRespuesta() {
    document.getElementById("respuesta").innerText =
        "[" + respuestaUsuario.join(", ") + "]";
}

document.getElementById("btnBorrar").addEventListener("click", () => {
    respuestaUsuario = [];
    actualizarRespuesta();
});

//------------------------------------------------------------
// VALIDAR RESPUESTA
//------------------------------------------------------------
document.getElementById("btnValidar").addEventListener("click", () => {
    if (respuestaUsuario.length < 4) {
        alert("Debes elegir 4 notas.");
        return;
    }

    const correctas = preguntaActual.map(normalizarNota);
    const usuario = respuestaUsuario.map(normalizarNota);

    if (JSON.stringify(correctas) === JSON.stringify(usuario)) {
        alert("✔ ¡Correcto!");
    } else {
        alert(
            "❌ Incorrecto.\n" +
            "Correcta: " + preguntaActual.join(" ") + "\n" +
            "Tu respuesta: " + respuestaUsuario.join(" ")
        );
    }

    respuestaUsuario = [];
    actualizarRespuesta();
    numeroPregunta++;
    elegirNuevaPregunta();
    document.getElementById("numPreg").innerText = numeroPregunta;
});

//------------------------------------------------------------
// INICIALIZAR
//------------------------------------------------------------
elegirNuevaPregunta();
