const API_KEY = "5b3ce3597851110001cf62483a5bdfdcce0e473a8c7822a4f2e32ad7";
const enderecoBase = "R. Dom João VI, 6 - Santa Cruz, Rio de Janeiro - RJ";

// ---------------------------
// Busca endereço pelo CEP
// ---------------------------
async function buscarEnderecoPorCEP(cep, numero) {
  if (!cep || !numero) throw new Error("CEP e número são obrigatórios.");

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) throw new Error("Erro ao buscar CEP.");

  const data = await response.json();
  if (data.erro) throw new Error("CEP não encontrado.");

  const enderecoCompleto = `${data.logradouro || ""}, ${numero} - ${data.bairro || ""}, ${data.localidade} - ${data.uf}`;
  const valido = await validarEndereco(enderecoCompleto);
  if (!valido) throw new Error("Endereço inválido ou fora do Brasil.");

  return enderecoCompleto;
}

async function validarEndereco(enderecoCompleto) {
  try {
    const coords = await geocode(enderecoCompleto);
    if (!coords) return false;

    const [lon, lat] = coords;
    return lat <= 6 && lat >= -35 && lon >= -75 && lon <= -34;
  } catch {
    return false;
  }
}

// ---------------------------
// Geocodificação (OpenRouteService)
// ---------------------------
async function geocode(endereco) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(endereco)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Erro ao buscar coordenadas.");

  const data = await response.json();
  if (!data.features?.length) throw new Error("Endereço não encontrado.");

  return data.features[0].geometry.coordinates; // [lon, lat]
}

// ---------------------------
// Calcula rota entre dois pontos
// ---------------------------
async function rota(pontoA, pontoB) {
  const body = { coordinates: [[pontoA[0], pontoA[1]], [pontoB[0], pontoB[1]]] };
  const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error("Erro ao buscar rota.");
  const data = await response.json();
  if (!data.routes?.length) throw new Error("Rota não encontrada.");

  return data.routes[0].summary.distance / 1000; // km
}

// ---------------------------
// Cálculo principal
// ---------------------------
let valorTotal = 0;

async function calcular() {
  const cepOrigem = document.getElementById("cep-origem").value.replace(/\D/g, "");
  const numeroOrigem = document.getElementById("numero-origem").value;
  const cepDestino = document.getElementById("cep-destino").value.replace(/\D/g, "");
  const numeroDestino = document.getElementById("numero-destino").value;

  if (!cepOrigem || !numeroOrigem || !cepDestino || !numeroDestino) {
    mostrarMensagemErro("Preencha todos os campos de CEP e número.");
    return;
  }

  const tipoVeiculo = document.getElementById("tipo").value;
  if (!tipoVeiculo) {
    mostrarMensagemErro("Selecione o tipo de veículo.");
    return;
  }

  let taxa = 0;
  if (tipoVeiculo === "50") {
    taxa = 50;
  } else if (tipoVeiculo === "15") {
    const cilindrada = parseInt(document.getElementById("cilindrada-moto").value);
    if (isNaN(cilindrada)) {
      mostrarMensagemErro("Informe a cilindrada da moto.");
      return;
    }
    if (cilindrada <= 160) taxa = 15;
    else if (cilindrada <= 250) taxa = 25;
    else if (cilindrada <= 499) taxa = 35;
    else if (cilindrada <= 999) taxa = 50;
    else taxa = 100;
  }

  document.getElementById("resultado").innerText = "Calculando...";

  try {
    const coordBase = await geocode(enderecoBase);
    const coordOrigem = await geocode(await buscarEnderecoPorCEP(cepOrigem, numeroOrigem));
    const coordDestino = await geocode(await buscarEnderecoPorCEP(cepDestino, numeroDestino));

    const d1 = await rota(coordBase, coordOrigem);
    const d2 = await rota(coordOrigem, coordDestino);
    const d3 = await rota(coordDestino, coordBase);

    const totalKm = d1 + d2 + d3;
    const valorKm = totalKm * 1.7;
    valorTotal = valorKm + taxa;

    document.getElementById("resultado").innerText =
      `Distância da Base até a Origem: ${d1.toFixed(2)} km\n` +
      `Distância da Origem até o Destino: ${d2.toFixed(2)} km\n` +
      `Distância do Destino até a Base: ${d3.toFixed(2)} km\n` +
      `Distância Total: ${totalKm.toFixed(2)} km\n` +
      `Valor por KM (R$ 1,70): R$ ${valorKm.toFixed(2)}\n` +
      `Taxa Fixa: R$ ${taxa.toFixed(2)}\n` +
      `Valor Total Estimado: R$ ${valorTotal.toFixed(2)}`;

    limparMensagemErro();
  } catch (err) {
    console.error(err);
    mostrarMensagemErro("Erro ao calcular: " + err.message);
    document.getElementById("resultado").innerText = "";
  }
}

// ---------------------------
// Exibição e WhatsApp
// ---------------------------
function mostrarMensagemErro(msg) {
  const div = document.getElementById("mensagem-erro");
  div.style.display = "block";
  div.textContent = msg;
}

function limparMensagemErro() {
  const div = document.getElementById("mensagem-erro");
  div.style.display = "none";
  div.textContent = "";
}

document.getElementById("tipo").addEventListener("change", () => {
  document.getElementById("detalhes-moto").style.display =
    document.getElementById("tipo").value === "15" ? "block" : "none";
});

// Botões "Buscar Endereço"
async function buscarEnderecoOrigem() {
  const cep = document.getElementById("cep-origem").value.replace(/\D/g, "");
  const numero = document.getElementById("numero-origem").value;
  try {
    const endereco = await buscarEnderecoPorCEP(cep, numero);
    document.getElementById("origem").value = endereco;
    limparMensagemErro();
  } catch (e) {
    mostrarMensagemErro("Erro com endereço de origem: " + e.message);
  }
}

async function buscarEnderecoDestino() {
  const cep = document.getElementById("cep-destino").value.replace(/\D/g, "");
  const numero = document.getElementById("numero-destino").value;
  try {
    const endereco = await buscarEnderecoPorCEP(cep, numero);
    document.getElementById("destino").value = endereco;
    limparMensagemErro();
  } catch (e) {
    mostrarMensagemErro("Erro com endereço de destino: " + e.message);
  }
}

// WhatsApp
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("whatsapp-solicitar-btn");
  btn.addEventListener("click", () => {
    const cepOrigem = document.getElementById("cep-origem").value;
    const origem = document.getElementById("origem").value;
    const cepDestino = document.getElementById("cep-destino").value;
    const destino = document.getElementById("destino").value;
    const tipo = document.getElementById("tipo").options[document.getElementById("tipo").selectedIndex].text;

    let mensagem = `Olá! Gostaria de solicitar um reboque:%0A%0A` +
      `Origem: ${origem} (CEP: ${cepOrigem})%0A` +
      `Destino: ${destino} (CEP: ${cepDestino})%0A` +
      `Tipo de veículo: ${tipo}%0A` +
      `Valor estimado: R$ ${valorTotal.toFixed(2)}`;

    const numeroWhatsApp = "552141014470";
    const link = `https://wa.me/${numeroWhatsApp}?text=${mensagem}`;
    window.open(link, "_blank");
  });
});
