const API_KEY = "5b3ce3597851110001cf62483a5bdfdcce0e473a8c7822a4f2e32ad7";
const enderecoBase = "R. Dom João VI, 6 - Santa Cruz, Rio de Janeiro - RJ";

async function buscarEnderecoPorCEP(cep, numero) {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) throw new Error("Erro ao buscar CEP: " + response.statusText);

  const data = await response.json();
  if (data.erro) throw new Error("CEP não encontrado.");

  const enderecoCompleto = `${data.logradouro}, ${numero} - ${data.bairro}, ${data.localidade} - ${data.uf}`;
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

async function geocode(endereco) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(endereco)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Erro no geocode: " + response.statusText);

  const data = await response.json();
  if (!data.features?.length) throw new Error("Endereço não encontrado.");

  const coords = data.features[0].geometry?.coordinates;
  if (!coords || coords.length !== 2) throw new Error("Coordenadas inválidas.");
  return coords; // [lon, lat]
}

async function rota(pontoA, pontoB) {
  if (!Array.isArray(pontoA) || !Array.isArray(pontoB)) throw new Error("Coordenadas inválidas.");

  const body = { coordinates: [pontoA, pontoB] };
  const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: { Authorization: API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Erro ao buscar rota (${response.status}): ${txt}`);
  }

  const data = await response.json();
  const distancia = data?.routes?.[0]?.summary?.distance;
  if (!distancia || isNaN(distancia)) throw new Error("Rota não encontrada ou distância inválida.");

  return distancia / 1000; // km
}

let valorTotal = 0;

async function calcular() {
  const cepOrigem = document.getElementById("cep-origem").value.replace(/\D/g, "");
  const numeroOrigem = document.getElementById("numero-origem").value;
  const cepDestino = document.getElementById("cep-destino").value.replace(/\D/g, "");
  const numeroDestino = document.getElementById("numero-destino").value;

  try {
    const enderecoOrigemCompleto = await buscarEnderecoPorCEP(cepOrigem, numeroOrigem);
    document.getElementById("origem").value = enderecoOrigemCompleto;

    const enderecoDestinoCompleto = await buscarEnderecoPorCEP(cepDestino, numeroDestino);
    document.getElementById("destino").value = enderecoDestinoCompleto;

    const tipoVeiculo = document.getElementById("tipo").value;
    let taxa = 0;

    if (tipoVeiculo === "50") taxa = 50;
    else if (tipoVeiculo === "15") {
      const cilindrada = parseInt(document.getElementById("cilindrada-moto").value);
      if (isNaN(cilindrada)) throw new Error("Informe a cilindrada da moto.");
      if (cilindrada <= 160) taxa = 15;
      else if (cilindrada <= 250) taxa = 25;
      else if (cilindrada <= 499) taxa = 35;
      else if (cilindrada <= 999) taxa = 50;
      else taxa = 100;
    } else throw new Error("Selecione o tipo de veículo.");

    document.getElementById("resultado").innerText = "Calculando...";

    const [coordBase, coordOrigem, coordDestino] = await Promise.all([
      geocode(enderecoBase),
      geocode(enderecoOrigemCompleto),
      geocode(enderecoDestinoCompleto),
    ]);

    const [dist1, dist2, dist3] = await Promise.all([
      rota(coordBase, coordOrigem),
      rota(coordOrigem, coordDestino),
      rota(coordDestino, coordBase),
    ]);

    const distanciaTotalKm = dist1 + dist2 + dist3;
    const valorKm = distanciaTotalKm * 1.7;
    valorTotal = valorKm + taxa;

    document.getElementById("resultado").innerText =
      `Distância Base → Origem: ${dist1.toFixed(2)} km\n` +
      `Distância Origem → Destino: ${dist2.toFixed(2)} km\n` +
      `Distância Destino → Base: ${dist3.toFixed(2)} km\n\n` +
      `Total: ${distanciaTotalKm.toFixed(2)} km\n` +
      `Valor por KM: R$ ${valorKm.toFixed(2)}\n` +
      `Taxa Fixa: R$ ${taxa.toFixed(2)}\n` +
      `💰 Valor Total Estimado: R$ ${valorTotal.toFixed(2)}`;
  } catch (error) {
    console.error("Erro no cálculo:", error);
    mostrarMensagemErro(error.message);
    document.getElementById("resultado").innerText = "Erro no cálculo. Verifique os dados.";
  }
}

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

document.getElementById("btn-buscar-origem").addEventListener("click", async () => {
  const cep = document.getElementById("cep-origem").value.replace(/\D/g, "");
  const numero = document.getElementById("numero-origem").value;
  try {
    const end = await buscarEnderecoPorCEP(cep, numero);
    document.getElementById("origem").value = end;
  } catch (e) {
    mostrarMensagemErro(e.message);
  }
});

document.getElementById("btn-buscar-destino").addEventListener("click", async () => {
  const cep = document.getElementById("cep-destino").value.replace(/\D/g, "");
  const numero = document.getElementById("numero-destino").value;
  try {
    const end = await buscarEnderecoPorCEP(cep, numero);
    document.getElementById("destino").value = end;
  } catch (e) {
    mostrarMensagemErro(e.message);
  }
});

document.getElementById("tipo").addEventListener("change", e => {
  document.getElementById("detalhes-moto").style.display = e.target.value === "15" ? "block" : "none";
});
