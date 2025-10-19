const API_KEY = "5b3ce3597851110001cf62483a5bdfdcce0e473a8c7822a4f2e32ad7";
const enderecoBase = "R. Dom João VI, 6 - Santa Cruz, Rio de Janeiro - RJ";

// ==========================
// FUNÇÕES AUXILIARES
// ==========================
async function buscarEnderecoPorCEP(cep, numero) {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

  if (!response.ok) {
    throw new Error("Erro ao buscar endereço: " + response.statusText);
  }

  const data = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado.");
  }

  const enderecoCompleto = `${data.logradouro}, ${numero} - ${data.bairro}, ${data.localidade} - ${data.uf}`;
  const valido = await validarEndereco(enderecoCompleto);

  if (!valido) {
    throw new Error("Endereço inválido ou fora do Brasil.");
  }

  return enderecoCompleto;
}

async function validarEndereco(enderecoCompleto) {
  try {
    const coords = await geocode(enderecoCompleto);
    if (!coords) return false;

    const [lon, lat] = coords;
    return lat <= 6 && lat >= -35 && lon >= -75 && lon <= -34;
  } catch (error) {
    console.warn("Endereço inválido:", enderecoCompleto, error.message);
    return false;
  }
}

async function geocode(endereco) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(endereco)}`;
  const response = await fetch(url);

  if (!response.ok) {
    console.error("Erro ao buscar coordenadas:", response.status, response.statusText);
    throw new Error("Erro ao buscar coordenadas: " + response.statusText);
  }

  const data = await response.json();

  if (!data.features || data.features.length === 0 || !data.features[0].geometry) {
    throw new Error("Endereço não encontrado: " + endereco);
  }

  const coords = data.features[0].geometry.coordinates; // [lon, lat]
  console.log("📍 Geocode:", endereco, "=>", coords);
  return coords;
}

async function rota(pontoA, pontoB) {
  const body = { coordinates: [[pontoA[0], pontoA[1]], [pontoB[0], pontoB[1]]] };

  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car",
    {
      method: "POST",
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    console.error("Erro ao buscar rota:", response.status, response.statusText);
    throw new Error("Erro ao buscar rota: " + response.statusText);
  }

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error("Rota não encontrada entre os pontos informados.");
  }

  const distanciaKm = data.routes[0].summary.distance / 1000;
  console.log("🚗 Rota calculada:", pontoA, "→", pontoB, "=", distanciaKm.toFixed(2), "km");
  return distanciaKm;
}

// ==========================
// CÁLCULO PRINCIPAL
// ==========================
let valorTotal = 0;

async function calcular() {
  const cepOrigem = document.getElementById("cep-origem").value.replace(/\D/g, "");
  const numeroOrigem = document.getElementById("numero-origem").value;
  const cepDestino = document.getElementById("cep-destino").value.replace(/\D/g, "");
  const numeroDestino = document.getElementById("numero-destino").value;

  console.clear();
  console.log("==== INICIANDO CÁLCULO ====");
  console.log("CEP Origem:", cepOrigem, "Número:", numeroOrigem);
  console.log("CEP Destino:", cepDestino, "Número:", numeroDestino);

  try {
    const enderecoOrigemCompleto = await buscarEnderecoPorCEP(cepOrigem, numeroOrigem);
    const enderecoDestinoCompleto = await buscarEnderecoPorCEP(cepDestino, numeroDestino);

    document.getElementById("origem").value = enderecoOrigemCompleto;
    document.getElementById("destino").value = enderecoDestinoCo
