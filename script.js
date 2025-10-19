// script.js - Versão corrigida e completa
const API_KEY = "5b3ce3597851110001cf62483a5bdfdcce0e473a8c7822a4f2e32ad7";
const enderecoBase = "R. Dom João VI, 6 - Santa Cruz, Rio de Janeiro - RJ";

// ---------------------------
// Helpers / UI
// ---------------------------
function mostrarMensagemErro(msg) {
  const div = document.getElementById("mensagem-erro");
  if (div) {
    div.style.display = "block";
    div.textContent = msg;
  }
  console.warn("MSG ERRO:", msg);
}

function limparMensagemErro() {
  const div = document.getElementById("mensagem-erro");
  if (div) {
    div.style.display = "none";
    div.textContent = "";
  }
}

// formata valor para exibir no whatsapp com duas casas
function formatMoney(v) {
  return Number.isFinite(v) ? v.toFixed(2) : "0,00";
}

// ---------------------------
// ViaCEP -> compõe endereço
// ---------------------------
async function buscarEnderecoPorCEP(cep, numero) {
  if (!cep || !numero) throw new Error("CEP e número são obrigatórios.");

  // ViaCEP retorna 200 mesmo quando nao encontra, com campo erro
  const url = `https://viacep.com.br/ws/${cep}/json/`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Erro ao buscar CEP: " + response.statusText);

  const data = await response.json();
  if (data.erro) throw new Error("CEP não encontrado.");

  // Monta endereço mesmo se logradouro estiver vazio (tenta compor o máximo possível)
  const logradouro = data.logradouro ? data.logradouro : "";
  const bairro = data.bairro ? data.bairro : "";
  const cidade = data.localidade ? data.localidade : "";
  const uf = data.uf ? data.uf : "";

  const enderecoCompleto = `${logradouro}${logradouro ? ", " : ""}${numero}${bairro ? " - " + bairro : ""}${cidade ? ", " + cidade : ""}${uf ? " - " + uf : ""}`;

  // Valida via geocode se o endereço existe e está no Brasil
  const valido = await validarEndereco(enderecoCompleto);
  if (!valido) throw new Error("Endereço inválido ou fora do Brasil.");

  return enderecoCompleto;
}

// ---------------------------
// Validação de endereço (usa geocode)
// ---------------------------
async function validarEndereco(enderecoCompleto) {
  try {
    const coords = await geocode(enderecoCompleto);
    if (!coords || !Array.isArray(coords)) return false;
    const [lon, lat] = coords;
    // Brasil aprox.: lat entre -35 e +6, lon entre -75 e -34
    return Number.isFinite(lat) && Number.isFinite(lon) && lat <= 6 && lat >= -35 && lon >= -75 && lon <= -34;
  } catch (err) {
    console.warn("validarEndereco falhou:", err?.message || err);
    return false;
  }
}

// ---------------------------
// Geocode (OpenRouteService)
// Retorna [lon, lat]
// ---------------------------
async function geocode(endereco) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(endereco)}`;
  const response = await fetch(url);
  if (!response.ok) {
    // tenta ler corpo para dar mensagem útil
    const txt = await response.text().catch(() => "");
    throw new Error("Erro no geocode (" + response.status + "): " + txt);
  }

  const data = await response.json();
  const feature = data?.features?.[0];
  const coords = feature?.geometry?.coordinates;

  if (!coords || coords.length !== 2) {
    throw new Error("Geocode não retornou coordenadas válidas para: " + endereco);
  }

  // coords já está [lon, lat]
  return coords;
}

// ---------------------------
// Rota (OpenRouteService directions)
// pontoA e pontoB: [lon, lat]
// Retorna distância em km (Number)
// ---------------------------
async function rota(pontoA, pontoB) {
  if (!Array.isArray(pontoA) || !Array.isArray(pontoB) || pontoA.length !== 2 || pontoB.length !== 2) {
    throw new Error("Coordenadas inválidas para rota.");
  }

  const body = { coordinates: [pontoA, pontoB] };

  const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    throw new Error(`Erro ao buscar rota (${response.status}): ${txt}`);
  }

  const data = await response.json();
  const distancia = data?.routes?.[0]?.summary?.distance;

  if (!Number.isFinite(distancia)) {
    throw new Error("Distância inválida retornada pela API de rotas.");
  }

  return distancia / 1000; // retorna km
}

// ---------------------------
// Cálculo principal
// ---------------------------
let valorTotal = 0;

async function calcular() {
  console.clear();
  limparMensagemErro();

  const cepOrigem = document.getElementById("cep-origem")?.value.replace(/\D/g, "") || "";
  const numeroOrigem = document.getElementById("numero-origem")?.value || "";
  const cepDestino = document.getElementById("cep-destino")?.value.replace(/\D/g, "") || "";
  const numeroDestino = document.getElementById("numero-destino")?.value || "";

  console.log("Entradas:", { cepOrigem, numeroOrigem, cepDestino, numeroDestino });

  if (!cepOrigem || !numeroOrigem || !cepDestino || !numeroDestino) {
    mostrarMensagemErro("Por favor preencha todos os campos de CEP e NÚMERO.");
    return;
  }

  const tipoVeiculo = document.getElementById("tipo")?.value || "";
  if (!tipoVeiculo) {
    mostrarMensagemErro("Selecione o tipo de veículo.");
    return;
  }

  let taxa = 0;
  if (tipoVeiculo === "50") taxa = 50;
  else if (tipoVeiculo === "15") {
    const cilindrada = parseInt(document.getElementById("cilindrada-moto")?.value, 10);
    if (isNaN(cilindrada)) {
      mostrarMensagemErro("Informe a cilindrada da moto.");
      return;
    }
    if (cilindrada <= 160) taxa = 15;
    else if (cilindrada <= 250) taxa = 25;
    else if (cilindrada <= 499) taxa = 35;
    else if (cilindrada <= 999) taxa = 50;
    else taxa = 100;
  } else {
    mostrarMensagemErro("Tipo de veículo inválido.");
    return;
  }

  // Exibe estado enquanto calcula
  const resultadoDiv = document.getElementById("resultado");
  if (resultadoDiv) resultadoDiv.innerText = "Calculando...";

  try {
    // Buscar endereços completos (e validar)
    console.log("Buscando endereços via CEP...");
    const enderecoOrigemCompleto = await buscarEnderecoPorCEP(cepOrigem, numeroOrigem);
    const enderecoDestinoCompleto = await buscarEnderecoPorCEP(cepDestino, numeroDestino);
    console.log("Endereços:", { enderecoOrigemCompleto, enderecoDestinoCompleto });

    // Geocodificar paralelamente
    console.log("Geocodificando endereços (base, origem, destino)...");
    const [coordBase, coordOrigem, coordDestino] = await Promise.all([
      geocode(enderecoBase).catch(e => { throw new Error("Geocode da base falhou: " + e.message); }),
      geocode(enderecoOrigemCompleto).catch(e => { throw new Error("Geocode da origem falhou: " + e.message); }),
      geocode(enderecoDestinoCompleto).catch(e => { throw new Error("Geocode do destino falhou: " + e.message); }),
    ]);

    console.log("Coordenadas resultantes:", { coordBase, coordOrigem, coordDestino });

    // Validar numericamente
    [coordBase, coordOrigem, coordDestino].forEach((c, idx) => {
      if (!Array.isArray(c) || c.length !== 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) {
        throw new Error(`Coordenada inválida no ponto index ${idx}: ${JSON.stringify(c)}`);
      }
    });

    // Calcular rotas (paralelo)
    console.log("Calculando rotas...");
    const [d1, d2, d3] = await Promise.all([
      rota(coordBase, coordOrigem).catch(e => { throw new Error("Erro rota base→origem: " + e.message); }),
      rota(coordOrigem, coordDestino).catch(e => { throw new Error("Erro rota origem→destino: " + e.message); }),
      rota(coordDestino, coordBase).catch(e => { throw new Error("Erro rota destino→base: " + e.message); }),
    ]);

    console.log("Distâncias (km):", { d1, d2, d3 });

    if (![d1, d2, d3].every(Number.isFinite)) {
      throw new Error("Uma das distâncias não é numérica.");
    }

    const distanciaTotalKm = d1 + d2 + d3;
    const valorKm = distanciaTotalKm * 1.7;
    valorTotal = valorKm + taxa;

    // Exibe resultado na UI
    if (resultadoDiv) {
      resultadoDiv.innerText =
        `Distância da Base até a Origem: ${d1.toFixed(2)} km\n` +
        `Distância da Origem até o Destino: ${d2.toFixed(2)} km\n` +
        `Distância do Destino até a Base: ${d3.toFixed(2)} km\n\n` +
        `Distância Total: ${distanciaTotalKm.toFixed(2)} km\n` +
        `Valor por KM (R$ 1,70): R$ ${valorKm.toFixed(2)}\n` +
        `Taxa Fixa: R$ ${taxa.toFixed(2)}\n` +
        `Valor Total Estimado: R$ ${valorTotal.toFixed(2)}`;
    }

    limparMensagemErro();
    console.log("Cálculo finalizado com sucesso.");
  } catch (err) {
    console.error("Erro no calcular():", err);
    mostrarMensagemErro(err.message || "Erro desconhecido ao calcular.");
    if (resultadoDiv) resultadoDiv.innerText = "Erro no cálculo. Veja mensagem de erro acima.";
  }
}

// ---------------------------
// Funções de busca (botões)
// ---------------------------
async function buscarEnderecoOrigem() {
  limparMensagemErro();
  try {
    const cep = document.getElementById("cep-origem")?.value.replace(/\D/g, "") || "";
    const numero = document.getElementById("numero-origem")?.value || "";
    if (!cep || !numero) throw new Error("Preencha CEP e número da origem.");
    const endereco = await buscarEnderecoPorCEP(cep, numero);
    const origemInput = document.getElementById("origem");
    if (origemInput) origemInput.value = endereco;
  } catch (e) {
    mostrarMensagemErro("Erro com endereço de origem: " + (e.message || e));
  }
}

async function buscarEnderecoDestino() {
  limparMensagemErro();
  try {
    const cep = document.getElementById("cep-destino")?.value.replace(/\D/g, "") || "";
    const numero = document.getElementById("numero-destino")?.value || "";
    if (!cep || !numero) throw new Error("Preencha CEP e número do destino.");
    const endereco = await buscarEnderecoPorCEP(cep, numero);
    const destinoInput = document.getElementById("destino");
    if (destinoInput) destinoInput.value = endereco;
  } catch (e) {
    mostrarMensagemErro("Erro com endereço de destino: " + (e.message || e));
  }
}

// ---------------------------
// WhatsApp - abre link com mensagem
// ---------------------------
function abrirWhatsAppSolicitacao() {
  const cepOrigem = document.getElementById("cep-origem")?.value || "";
  const origem = document.getElementById("origem")?.value || "";
  const cepDestino = document.getElementById("cep-destino")?.value || "";
  const destino = document.getElementById("destino")?.value || "";
  const tipoSelect = document.getElementById("tipo");
  const tipo = tipoSelect ? tipoSelect.options[tipoSelect.selectedIndex]?.text || "" : "";

  const valorExibir = Number.isFinite(valorTotal) ? valorTotal.toFixed(2) : "0,00";

  let mensagem = `Olá! Gostaria de solicitar um reboque:%0A%0A` +
    `Origem: ${origem} (CEP: ${cepOrigem})%0A` +
    `Destino: ${destino} (CEP: ${cepDestino})%0A` +
    `Tipo: ${tipo}%0A` +
    `Valor estimado: R$ ${valorExibir}`;

  const numeroWhatsApp = "552141014470";
  const link = `https://wa.me/${numeroWhatsApp}?text=${mensagem}`;
  window.open(link, "_blank");
}

// ---------------------------
// Inicialização: liga eventos de botões (sem depender de IDs inexistentes)
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Botão calcular (tem id no HTML)
  const btnCalcular = document.getElementById("calcular-btn");
  if (btnCalcular) btnCalcular.addEventListener("click", calcular);

  // Botões de buscar endereço (pegamos pela classe)
  const buscarBtns = document.querySelectorAll(".button-buscar");
  buscarBtns.forEach(btn => {
    // assumimos que o primeiro botão é origem e o segundo é destino (como no HTML enviado)
    if (btn && btn.textContent.toLowerCase().includes("origem")) {
      btn.addEventListener("click", buscarEnderecoOrigem);
    } else if (btn && btn.textContent.toLowerCase().includes("destino")) {
      btn.addEventListener("click", buscarEnderecoDestino);
    } else {
      // fallback: se tiver data-target, poderia usar; para segurança, mantemos onclick inline já presente no HTML
    }
  });

  // Botão WhatsApp
  const btnWhats = document.getElementById("whatsapp-solicitar-btn");
  if (btnWhats) btnWhats.addEventListener("click", abrirWhatsAppSolicitacao);

  // Toggle detalhes moto
  const tipo = document.getElementById("tipo");
  if (tipo) tipo.addEventListener("change", (e) => {
    const detalhes = document.getElementById("detalhes-moto");
    if (detalhes) detalhes.style.display = e.target.value === "15" ? "block" : "none";
  });
});
